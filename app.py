"""
Web server for the FEM annular Mindlin plate and axisymmetric annular solid apps.
Run `python app.py`, then open http://127.0.0.1:8080 for the plate app or
http://127.0.0.1:8080/solid.html for the compressed-solid app.
"""

from __future__ import annotations
import json
import os
import sys
import time
import traceback
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Dict

from annular_plate_fem import generate_annular_mesh, solve_annular_plate
from annular_solid_fem import solve_annular_solid
from annular_pipe_fem import mesh_payload, pipe_mesh
from tcvn5574_checks import material_catalog, solve_pipe_with_checks
from annular_pipe_rc import solve_reinforced_with_checks, steel_catalog
from pile_solid3d import make_mesh as pile3d_mesh, mesh_payload as pile3d_payload, solve_pile_solid3d

BASE_DIR = Path(__file__).resolve().parent


class FEMRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BASE_DIR), **kwargs)

    def log_message(self, format: str, *args: Any) -> None:
        # Ghi log gọn gàng
        sys.stdout.write(f"[FEM-Server] {self.address_string()} - {format % args}\n")

    def _send_json(self, status_code: int, payload: Dict[str, Any]) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _read_json_body(self) -> Dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length) if length > 0 else b"{}"
        return json.loads(raw.decode("utf-8"))

    def do_GET(self) -> None:
        if self.path == "/api/pipe-rc/steel-materials":
            return self._send_json(200, {"ok": True, **steel_catalog()})
        if self.path == "/api/pipe/tcvn-materials":
            return self._send_json(200, {"ok": True, **material_catalog()})
        if self.path in ("/", "/index.html"):
            self.path = "/index.html"
            return super().do_GET()
        if self.path == "/api/health":
            return self._send_json(200, {"status": "ok"})
        return super().do_GET()

    def do_POST(self) -> None:
        if self.path in ("/api/pile3d/mesh", "/api/pile3d/solve"):
            try:
                params = self._read_json_body()
                if self.path.endswith("/mesh"):
                    return self._send_json(200, {"ok": True, "mesh": pile3d_payload(pile3d_mesh(params))})
                t0 = time.perf_counter()
                result = solve_pile_solid3d(params)
                result["summary"]["solve_time_ms"] = round((time.perf_counter()-t0)*1000, 2)
                return self._send_json(200, {"ok": True, "result": result})
            except Exception as exc:
                return self._send_json(400, {"ok": False, "error": str(exc)})
        if self.path in ("/api/pipe/mesh", "/api/pipe/solve", "/api/pipe-rc/solve"):
            try:
                params = self._read_json_body()
                if not isinstance(params, dict):
                    raise ValueError("Dữ liệu đầu vào phải là một đối tượng JSON.")
                if self.path.endswith("/mesh"):
                    return self._send_json(200, {"ok": True, "mesh": mesh_payload(pipe_mesh(params))})
                t0 = time.perf_counter()
                result = (solve_reinforced_with_checks(params) if self.path == "/api/pipe-rc/solve"
                          else solve_pipe_with_checks(params))
                result["summary"]["solve_time_ms"] = round((time.perf_counter() - t0) * 1000, 2)
                return self._send_json(200, {"ok": True, "result": result})
            except Exception as exc:
                return self._send_json(400, {"ok": False, "error": str(exc)})

        if self.path == "/api/mesh":
            try:
                params = self._read_json_body()
                mesh = generate_annular_mesh(
                    r_inner=float(params.get("r_inner", 0.3)),
                    r_outer=float(params.get("r_outer", 1.0)),
                    nr=int(params.get("nr", 10)),
                    ntheta=int(params.get("ntheta", 36)),
                    element_type=str(params.get("element_type", "MITC4")),
                    theta_start_deg=float(params.get("theta_start_deg", 0.0)),
                    theta_end_deg=float(params.get("theta_end_deg", 360.0)),
                )
                return self._send_json(200, {
                    "ok": True,
                    "mesh": {
                        "gcoord": mesh["gcoord"].tolist(),
                        "polar_coord": mesh["polar_coord"].tolist(),
                        "nodes": mesh["nodes"].tolist(),
                        "quad_grid": mesh["quad_grid"].tolist(),
                        "inner_nodes": [int(i + 1) for i in mesh["inner_nodes"]],
                        "outer_nodes": [int(i + 1) for i in mesh["outer_nodes"]],
                        "is_triangle": mesh["is_triangle"],
                        "nnode": mesh["nnode"],
                        "nel": mesh["nel"],
                        "nr": mesh["nr"],
                        "ntheta": mesh["ntheta"],
                    },
                })
            except Exception as exc:
                return self._send_json(400, {"ok": False, "error": str(exc)})

        if self.path == "/api/solve":
            try:
                params = self._read_json_body()
                t0 = time.perf_counter()
                result = solve_annular_plate(params)
                elapsed_ms = (time.perf_counter() - t0) * 1000.0
                result["summary"]["solve_time_ms"] = round(elapsed_ms, 2)
                return self._send_json(200, {"ok": True, "result": result})
            except Exception as exc:
                traceback.print_exc()
                return self._send_json(400, {"ok": False, "error": str(exc)})

        if self.path == "/api/solve_solid":
            try:
                params = self._read_json_body()
                t0 = time.perf_counter()
                result = solve_annular_solid(params)
                result["summary"]["solve_time_ms"] = round(
                    (time.perf_counter() - t0) * 1000.0,
                    2,
                )
                return self._send_json(200, {"ok": True, "result": result})
            except Exception as exc:
                traceback.print_exc()
                return self._send_json(400, {"ok": False, "error": str(exc)})

        if self.path == "/api/compare_elements":
            try:
                params = self._read_json_body()
                elements = ["MITC4", "Q4_REDUCED", "Q4_FULL", "CS_DSG3", "DSG3", "MIN3", "CS_MIN3"]
                comparison = []
                for el in elements:
                    p_copy = dict(params)
                    p_copy["element_type"] = el
                    t0 = time.perf_counter()
                    res = solve_annular_plate(p_copy)
                    dt_ms = (time.perf_counter() - t0) * 1000.0
                    s = res["summary"]
                    comparison.append({
                        "element_type": el,
                        "nel": s["nel"],
                        "nnode": s["nnode"],
                        "w_max_abs": s["w_max_abs"],
                        "w_min": s["w_min"],
                        "w_max": s["w_max"],
                        "sigma_vm_max": s["sigma_vm_max"],
                        "Mr_max_abs": s["Mr_max_abs"],
                        "Mtheta_max_abs": s["Mtheta_max_abs"],
                        "strain_energy": s["strain_energy"],
                        "force_balance_error": s["force_balance_error"],
                        "solve_time_ms": round(dt_ms, 2),
                    })
                return self._send_json(200, {"ok": True, "comparison": comparison})
            except Exception as exc:
                traceback.print_exc()
                return self._send_json(400, {"ok": False, "error": str(exc)})

        return self._send_json(404, {"ok": False, "error": f"Unknown endpoint {self.path}"})


def run_server(host: str = "127.0.0.1", port: int = 8080, open_browser: bool = True) -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="backslashreplace")
    server = ThreadingHTTPServer((host, port), FEMRequestHandler)
    url = f"http://{host}:{port}"
    print("=" * 72)
    print("  PHẦN MỀM PHẦN TỬ HỮU HẠN (FEM) TẤM DÀY HÌNH VÀNH KHUYÊN (MINDLIN)")
    print(f"  Địa chỉ giao diện Web HTML: {url}")
    print(f"  Mặt cắt ống dài chịu ép hướng tâm: {url}/pipe.html")
    print(f"  Bài toán có thép đai và thép dọc: {url}/pipe_rc.html")
    print("  Nhấn Ctrl+C để dừng server.")
    print("=" * 72)
    if open_browser:
        try:
            webbrowser.open(url)
        except Exception:
            pass
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nĐang dừng server...")
        server.server_close()


if __name__ == "__main__":
    port_arg = int(os.environ.get("FEM_PORT", "8080"))
    no_browser = "--no-browser" in sys.argv
    run_server(port=port_arg, open_browser=not no_browser)
