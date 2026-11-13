"""Run the D600 elastic load-step comparison and export plots and numerical data.

Each load level is solved again, including unilateral contact. Material stiffness
has no history: a dashed extension past the tensile screen is NOT a post-crack
analysis or a prediction of ultimate capacity. Run with --check-fine for a second
mesh; point-load/support stress peaks are not mesh-independent design values.
"""
from __future__ import annotations

import argparse
from copy import deepcopy
import csv
import hashlib
import html
import json
import math
from pathlib import Path
import sys

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

from annular_pipe_fem import solve_annular_pipe
from annular_pipe_rc import STEELS, solve_reinforced_pipe
from tcvn5574_checks import CONCRETE, principal_stresses


DEFAULT_LOADS = [0, 10, 20, 30, 40, 50, 60, 65, 66, 66.4, 66.5, 67, 70, 80, 100, 150, 200]
CASES = (("plain", "Không kể thép", "#2469a5"), ("rc", "Có thép", "#d36a12"))


def parameters(nr: int, nt: int, prestress_mpa: float) -> dict:
    if nt % 12:
        raise ValueError("ntheta must be divisible by 12 to place all loads and stops exactly.")
    node = lambda angle: nr * nt + round(angle * nt / 360) + 1
    return {
        "r_inner": .2, "r_outer": .3, "E": 39.5e9, "nu": .2,
        "prestress": prestress_mpa * 1e6, "axial_mode": "constant_force",
        "nr": nr, "ntheta": nt, "pressures": [], "include_check_points": True,
        "supports": [{"target": "node", "node_id": node(a), "direction": "r",
                      "kind": "upper", "value": 0} for a in (0, 180, 270)],
        "nodal_loads": [{"node_id": node(a), "force_r": 0, "force_t": 0} for a in (60, 120)],
        "reinforcement": {
            "longitudinal_count": 12, "longitudinal_diameter": .012,
            "longitudinal_grade": "CB400-V", "hoop_diameter": .006,
            "hoop_pitch": .1, "hoop_grade": "CB240-T", "cover": .03,
            "E_s": 200e9, "initial_longitudinal_stress": 0,
        },
    }


def solve_level(base: dict, q: float, case: str) -> dict:
    p = deepcopy(base)
    for load in p["nodal_loads"]:
        load["force_r"] = -q * 1000
    result = (solve_reinforced_pipe if case == "rc" else solve_annular_pipe)(p)
    points = result["check_points"]
    critical = max(points, key=lambda point: principal_stresses(point)[0])
    tensile = max(0., principal_stresses(critical)[0])
    compressive = max(-principal_stresses(point)[-1] for point in points)
    crack_limit = CONCRETE["B60"][3] * 1e6
    compression_linear_limit = .6 * CONCRETE["B60"][2] * 1e6
    ur = result["nodal"]["u_r"]
    load_ids = [load["node_id"] for load in p["nodal_loads"]]
    mean_inward = -sum(ur[n - 1] for n in load_ids) / len(load_ids)
    steel_eta = 0.
    for family, grade_key in (("hoop_results", "hoop_grade"),
                              ("longitudinal_results", "longitudinal_grade")):
        for point in result.get("reinforcement", {}).get(family, []):
            yield_stress = STEELS[p["reinforcement"][grade_key]][0] * 1e6
            steel_eta = max(steel_eta, abs(point["stress_total"]) / yield_stress)
    s = result["summary"]
    force_error = max(abs(s["force_balance_x"]), abs(s["force_balance_y"]))
    tolerance = 1e-5 + q * 1000 * 1e-8
    assert force_error < tolerance, (case, q, "force balance", force_error)
    assert abs(s["moment_balance"]) < tolerance, (case, q, "moment balance")
    ground = next(r for r in result["reactions"]
                  if r["node_id"] == base["nr"] * base["ntheta"] + 3 * base["ntheta"] // 4 + 1)
    assert abs(-ground["reaction_r"] - math.sqrt(3) * q * 1000) < tolerance
    if q == 0:
        assert s["u_max"] < 1e-12, "Prestress must not be reapplied as a new load."
    row = {
        "case": case, "q_each_kN_per_m": q, "total_force_magnitudes_kN_per_m": 2 * q,
        "vertical_resultant_kN_per_m": math.sqrt(3) * q,
        "u_max_mm": s["u_max"] * 1000,
        "mean_inward_at_loads_mm": mean_inward * 1000,
        "sigma_tensile_max_MPa": tensile / 1e6,
        "sigma_compressive_max_MPa": compressive / 1e6,
        "eta_cracking": tensile / crack_limit,
        "eta_compression_linear": compressive / compression_linear_limit,
        "eta_steel_yield": steel_eta,
        "within_elastic_screens": (tensile <= crack_limit * (1 + 1e-9)
                                   and compressive <= compression_linear_limit and steel_eta <= 1),
        "strain_energy_J_per_m": s["strain_energy_increment"],
        "active_unilateral_dofs": s["active_unilateral_dofs"],
        "contact_signature": [[r["node_id"], r["state_r"], r["state_t"]]
                              for r in result["reactions"]],
        "force_balance_error_N_per_m": force_error,
        "moment_balance_error_N": abs(s["moment_balance"]),
        "crack_critical_element": critical["element_id"],
        "crack_critical_point": critical["point_id"],
        "crack_critical_x_mm": critical["x"] * 1000,
        "crack_critical_y_mm": critical["y"] * 1000,
    }
    print(f"{base['nr']}x{base['ntheta']} {case:5s} q={q:9.5f} kN/m "
          f"u_max={row['u_max_mm']:.8f} mm eta_cr={row['eta_cracking']:.6f}", flush=True)
    return row


def run_study(base: dict, loads: list[float]) -> dict:
    rows = {case: [] for case, _, _ in CASES}
    for q in sorted(set(loads)):
        for case in rows:
            rows[case].append(solve_level(base, q, case))
    crossings, verification = {}, {}
    for case, values in rows.items():
        bracket = next(((a, b) for a, b in zip(values, values[1:])
                        if a["eta_cracking"] < 1 <= b["eta_cracking"]), None)
        crossings[case] = None
        if bracket:
            a, b = bracket
            # Interpolate only to locate the screen crossing, then SOLVE it.
            q = a["q_each_kN_per_m"] + (1 - a["eta_cracking"]) * (
                b["q_each_kN_per_m"] - a["q_each_kN_per_m"]) / (b["eta_cracking"] - a["eta_cracking"])
            crossing = solve_level(base, q, case)
            assert abs(crossing["eta_cracking"] - 1) < 1e-6, "Refine the crossing bracket."
            assert crossing["eta_compression_linear"] < 1 and crossing["eta_steel_yield"] < 1
            crossings[case] = crossing
            values.append(crossing)
            values.sort(key=lambda row: row["q_each_kN_per_m"])
        positive = [row for row in values if row["q_each_kN_per_m"] > 0]
        ref = positive[0]
        deviation = max(abs(row["u_max_mm"] / (ref["u_max_mm"] * row["q_each_kN_per_m"] /
                                               ref["q_each_kN_per_m"]) - 1) for row in positive)
        energy_deviation = max(abs(row["strain_energy_J_per_m"] / (
            ref["strain_energy_J_per_m"] * (row["q_each_kN_per_m"] / ref["q_each_kN_per_m"]) ** 2) - 1)
            for row in positive)
        contacts_unchanged = all(row["contact_signature"] == ref["contact_signature"] for row in positive)
        assert contacts_unchanged, "This D600 example should keep the same active contacts."
        assert deviation < 1e-7 and energy_deviation < 1e-7, "Unexpected loss of proportionality."
        verification[case] = {"max_relative_displacement_proportionality_error": deviation,
                              "max_relative_energy_scaling_error": energy_deviation,
                              "positive_load_contacts_unchanged": contacts_unchanged,
                              "u_max_compliance_mm_per_kN_per_m": ref["u_max_mm"] / ref["q_each_kN_per_m"]}
    return {"parameters": base, "requested_loads_kN_per_m_each": sorted(set(loads)),
            "rows": rows, "crack_screen_crossings": crossings, "verification": verification}


def plot_study(study: dict, output: Path) -> str:
    plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 10})
    fig, axes = plt.subplots(2, 2, figsize=(12.4, 9.4))
    for case, label, color in CASES:
        values = study["rows"][case]
        crossing = study["crack_screen_crossings"][case]
        cutoff = crossing["q_each_kN_per_m"] if crossing else math.inf
        valid = [r for r in values if r["q_each_kN_per_m"] <= cutoff + 1e-8]
        extrapolated = [r for r in values if r["q_each_kN_per_m"] >= cutoff - 1e-8]
        for axis, field in ((axes[0, 0], "u_max_mm"), (axes[0, 1], "mean_inward_at_loads_mm")):
            axis.plot([r[field] for r in valid], [r["q_each_kN_per_m"] for r in valid],
                      color=color, label=label, linewidth=2)
            axis.plot([r[field] for r in extrapolated], [r["q_each_kN_per_m"] for r in extrapolated],
                      color=color, linestyle="--", linewidth=1.8)
            if crossing:
                axis.scatter(crossing[field], cutoff, color=color, marker="o" if case == "plain" else "x",
                             s=65, zorder=5)
            axis.set_ylabel("Mỗi lực ép q [kN/m]")
            axis.legend(loc="upper left")
        axes[1, 1].plot([r["q_each_kN_per_m"] for r in values], [r["eta_cracking"] for r in values],
                        color=color, label=label, linewidth=1.8, linestyle="-" if case == "plain" else "--")
    plain = {r["q_each_kN_per_m"]: r for r in study["rows"]["plain"]}
    rc = {r["q_each_kN_per_m"]: r for r in study["rows"]["rc"]}
    shared = [q for q in study["requested_loads_kN_per_m_each"] if q > 0]
    change = [100 * (1 - rc[q]["u_max_mm"] / plain[q]["u_max_mm"]) for q in shared]
    axes[1, 0].plot(shared, change, "o-", color="#48794c", markersize=4)
    axes[1, 0].set_ylim(0, max(1, max(change) * 1.4))
    axes[1, 0].text(.04, .90, f"Giảm chuyển vị: {min(change):.4f}–{max(change):.4f}%",
                    transform=axes[1, 0].transAxes)
    axes[0, 0].set(title="Chuyển vị lớn nhất trên mặt cắt", xlabel="|Δu|max [mm]")
    axes[0, 1].set(title="Chuyển vị tại hai vị trí đặt lực", xlabel="Δur vào tâm trung bình [mm]")
    axes[1, 0].set(title="Mức giảm |Δu|max khi kể thép", xlabel="Mỗi lực ép q [kN/m]", ylabel="Giảm so với không kể thép [%]")
    axes[1, 1].set(title="Ngưỡng kéo đàn hồi tại điểm kiểm tra", xlabel="Mỗi lực ép q [kN/m]",
                   ylabel="η = σkéo chính,max / 2,75 MPa")
    axes[1, 1].axhline(1, color="#7b2633", linewidth=1, label="Ngưỡng dấu hiệu nứt")
    axes[1, 1].legend(loc="upper left")
    for axis in axes.flat:
        axis.grid(True, color="#dce2e8", linewidth=.6)
        axis.set_xlim(left=0)
        axis.set_ylim(bottom=0)
        axis.spines[["top", "right"]].set_visible(False)
    p = study["parameters"]
    fig.suptitle(f"D600 × 100 · B60 · so sánh tăng tải · lưới {p['nr']} × {p['ntheta']}", fontsize=16)
    fig.text(.5, .025,
             "Hai lực q tại 60° và 120°; giữ nguyên nén trước z và gối.\n"
             "Dấu tròn / ×: chạm ngưỡng kéo. Nét đứt sau mốc này là ngoại suy đàn hồi, không phải kết quả sau nứt.",
             ha="center", fontsize=10)
    fig.tight_layout(rect=(0, .065, 1, .95))
    fig.savefig(output / "load_displacement.png", dpi=170)
    fig.savefig(output / "load_displacement.svg")
    plt.close(fig)
    svg = (output / "load_displacement.svg").read_text(encoding="utf-8")
    return svg[svg.index("<svg"):]


def write_outputs(study: dict, fine: dict | None, output: Path) -> None:
    output.mkdir(parents=True, exist_ok=True)
    svg = plot_study(study, output)
    records = [row for case, _, _ in CASES for row in study["rows"][case]]
    fields = [key for key in records[0] if key != "contact_signature"]
    with (output / "load_steps.csv").open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(records)
    source = Path(__file__).resolve().parent
    provenance = {name: hashlib.sha256((source / name).read_bytes()).hexdigest()
                  for name in ("annular_pipe_fem.py", "annular_pipe_rc.py", "tcvn5574_checks.py",
                               "compare_pipe_load_steps.py")}
    data = {"scope": "elastic_load_steps_with_contact_and_tensile_screen_not_postcrack",
            "full_tcvn_verification": False, "python": sys.version,
            "source_sha256": provenance, "study": study, "fine_mesh_check": fine}
    (output / "results.json").write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    by_case = {case: {r["q_each_kN_per_m"]: r for r in study["rows"][case]} for case, _, _ in CASES}
    table = []
    for q in study["requested_loads_kN_per_m_each"]:
        a, b = by_case["plain"][q], by_case["rc"][q]
        decrease = 100 * (1 - b["u_max_mm"] / a["u_max_mm"]) if q else None
        change_text = f"{decrease:.4f}" if decrease is not None else "—"
        valid = a["within_elastic_screens"] and b["within_elastic_screens"]
        table.append(f"<tr class='{'' if valid else 'extension'}'><td>{q:g}</td>"
                     f"<td>{a['u_max_mm']:.6f}</td><td>{b['u_max_mm']:.6f}</td><td>{change_text}</td>"
                     f"<td>{a['eta_cracking']:.4f}</td><td>{b['eta_cracking']:.4f}</td>"
                     f"<td>{'Trong các ngưỡng sàng lọc đàn hồi' if valid else 'Ngoại suy đàn hồi; cần mô hình phi tuyến'}</td></tr>")
    meshes = [("Lưới chính", study)] + ([("Lưới kiểm tra", fine)] if fine else [])
    thresholds = []
    for title, mesh_study in meshes:
        p = mesh_study["parameters"]
        for case, label, _ in CASES:
            crossing = mesh_study["crack_screen_crossings"][case]
            if crossing:
                thresholds.append(f"<tr><td>{title}: {p['nr']} × {p['ntheta']}</td><td>{label}</td>"
                                  f"<td>{crossing['q_each_kN_per_m']:.4f}</td><td>{crossing['u_max_mm']:.6f}</td>"
                                  f"<td>{crossing['crack_critical_element']} / {html.escape(crossing['crack_critical_point'])}</td></tr>")
    p = study["parameters"]
    report = f"""<!doctype html><html lang="vi"><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>D600 · So sánh tăng tải</title>
<style>body{{font:16px/1.6 system-ui,sans-serif;color:#213047;background:#f3f6fa;margin:0}}
main{{max-width:1160px;margin:auto;background:white;padding:32px}}h1{{line-height:1.25}}
svg{{width:100%;height:auto}}table{{border-collapse:collapse;width:100%;font-size:14px}}
td,th{{padding:9px;border-bottom:1px solid #dbe3ec;text-align:right}}td:first-child,th:first-child{{text-align:left}}
th{{background:#eaf0f7}}.table{{overflow:auto}}.note{{border-left:4px solid #c48215;background:#fff7e6;padding:16px}}
.extension{{background:#fff7ef}}a{{color:#205e9e}}code{{font-size:14px}}</style><main>
<h1>D600 × 100 · So sánh tải–chuyển vị khi tăng tải</h1>
<p>Mỗi lực q tăng đồng thời tại góc 60° và 120°, hướng vào tâm. q là độ lớn <b>mỗi lực</b>,
không phải tổng hai lực. Tổng thành phần đứng bằng √3q. Bê tông B60, E = 39,5 GPa, ν = 0,2;
nén trước hữu hiệu theo z giữ nguyên {p['prestress']/1e6:g} MPa (giá trị minh họa đang dùng).
Giữ tổng lực dọc; ba chặn một chiều, không ma sát tại 0°, 180°, 270°, khe hở bằng 0.</p>
<p>Trường hợp có thép dùng 12Ø12 CB400-V và đai Ø6a100 CB240-T, lớp bảo vệ 30 mm, Es = 200 GPa;
ứng suất thép dọc ban đầu giả thiết bằng 0. Trường hợp không kể thép giữ cùng bê tông, tải, gối
và ứng suất trước bê tông. So sánh này thay đổi cả thép dọc và đai.</p>
<div class="note"><b>Phạm vi kết quả:</b> giải lại tiếp xúc ở từng cấp tải, vật liệu vẫn đàn hồi và biến dạng nhỏ.
Ngưỡng σkéo chính,max = Rbt,ser = 2,75 MPa được lấy từ bộ kiểm tra B60 theo TCVN 5574:2018 hiện có.
Đây là dấu hiệu nứt theo sàng lọc ứng suất tại điểm, chưa phải chứng minh đầy đủ điều kiện không nứt.
Các điểm vượt ngưỡng chỉ là ngoại suy đàn hồi; chưa mô phỏng nứt, giảm độ cứng, chảy thép hoặc tải phá hoại.</div>
{svg}
<h2>Các cấp tải đã giải</h2><p>Chuyển vị là phần tăng thêm từ trạng thái đã nén trước.
|Δu|max là độ lớn chuyển vị lớn nhất trên toàn mặt cắt. Biểu đồ thứ hai dùng trung bình chuyển vị hướng tâm
vào trong tại hai nút đặt tải. Ô trống tỷ lệ tại q = 0 không được thay bằng 0%.</p>
<div class="table"><table><thead><tr><th>q mỗi lực<br>kN/m</th><th>Không thép<br>|Δu|max, mm</th>
<th>Có thép<br>|Δu|max, mm</th><th>Giảm<br>%</th><th>η nứt<br>không thép</th><th>η nứt<br>có thép</th><th>Phạm vi</th>
</tr></thead><tbody>{''.join(table)}</tbody></table></div>
<h2>Cấp tải chạm ngưỡng kéo tại điểm</h2><p>Các mốc dưới được nội suy để tìm tải rồi giải lại tại chính tải đó.
Lực và gối tại điểm làm đỉnh ứng suất phụ thuộc lưới; chênh lệch giữa hai lưới không được diễn giải là hội tụ
hoặc tải nứt thiết kế. Cần mô hình cung tiếp xúc hữu hạn để đánh giá vùng đặt lực và gối thực tế.</p>
<div class="table"><table><thead><tr><th>Lưới</th><th>Trường hợp</th><th>q chạm ngưỡng<br>kN/m mỗi lực</th>
<th>|Δu|max<br>mm</th><th>Phần tử / điểm</th></tr></thead><tbody>{''.join(thresholds)}</tbody></table></div>
<h2>Kiểm tra số</h2><p>Ở các cấp tải dương, cả ba tiếp xúc giữ nguyên trạng thái tì.
Đã kiểm tra cân bằng lực, mô men, phản lực đứng của nền bằng √3q, chuyển vị ở q = 0 bằng 0,
chuyển vị tỷ lệ với q và năng lượng tỷ lệ với q². Sai số cụ thể và cấu hình tái lập nằm trong dữ liệu JSON.</p>
<p><a href="load_displacement.png">Ảnh PNG</a> · <a href="load_displacement.svg">Biểu đồ SVG</a> ·
<a href="load_steps.csv">Bảng CSV</a> · <a href="results.json">Dữ liệu và cấu hình JSON</a></p>
</main></html>"""
    (output / "report.html").write_text(report, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--nr", type=int, default=6)
    parser.add_argument("--ntheta", type=int, default=96)
    parser.add_argument("--prestress-mpa", type=float, default=5.)
    parser.add_argument("--loads", type=float, nargs="+", default=DEFAULT_LOADS)
    parser.add_argument("--check-fine", action="store_true")
    parser.add_argument("--output", type=Path, default=Path("results/load_steps_d600"))
    args = parser.parse_args()
    if len(set(args.loads)) < 2 or any(not math.isfinite(q) or q < 0 for q in args.loads):
        parser.error("At least two distinct, finite, nonnegative load levels are required.")
    study = run_study(parameters(args.nr, args.ntheta, args.prestress_mpa), args.loads)
    fine = None
    if args.check_fine:
        fine = run_study(parameters(args.nr * 2, args.ntheta * 2, args.prestress_mpa), [0, 20, 70])
    write_outputs(study, fine, args.output)
    print(f"Saved: {args.output.resolve() / 'report.html'}", flush=True)


if __name__ == "__main__":
    main()
