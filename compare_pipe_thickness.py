"""Compare D600/D800 wall thicknesses using the existing elastic/contact solvers.

Run: python compare_pipe_thickness.py
The plots distinguish uncracked elastic screens from elastic extrapolation.
No post-crack law, strength enhancement, or ultimate capacity is introduced.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
from pathlib import Path
import sys

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.lines import Line2D

from compare_pipe_load_steps import CASES, parameters, run_study, solve_level


DIAMETERS = (600, 800)
THICKNESSES = (80, 100, 120, 150)
LOADS = [0, 10, 20, 40, 60, 80, 100, 150, 200]
COLORS = ("#2469a5", "#188767", "#bd7b0d", "#9a4679")
SOURCE_NAMES = ("annular_pipe_fem.py", "annular_pipe_rc.py", "tcvn5574_checks.py",
                "compare_pipe_load_steps.py", "compare_pipe_thickness.py")


def source_hashes() -> dict:
    root = Path(__file__).resolve().parent
    return {name: hashlib.sha256((root / name).read_bytes()).hexdigest() for name in SOURCE_NAMES}


def geometry(diameter: int, thickness: int, nr: int, nt: int, prestress: float) -> dict:
    if not 0 < thickness < diameter / 2:
        raise ValueError("Wall thickness must be positive and smaller than the outer radius.")
    p = parameters(nr, nt, prestress)
    p.update(r_outer=diameter / 2000, r_inner=(diameter / 2 - thickness) / 1000)
    return p


def row_at(study: dict, case: str, q: float = 20.) -> dict:
    return next(row for row in study["rows"][case] if row["q_each_kN_per_m"] == q)


def crossing_from_reference(base: dict, case: str, ref: dict) -> dict:
    # A candidate obtained from proportional loading is always solved again.
    q = ref["q_each_kN_per_m"] / ref["eta_cracking"]
    crossing = solve_level(base, q, case)
    assert abs(crossing["eta_cracking"] - 1) < 1e-6
    assert crossing["contact_signature"] == ref["contact_signature"]
    ratio = q / ref["q_each_kN_per_m"]
    assert math.isclose(crossing["u_max_mm"], ref["u_max_mm"] * ratio, rel_tol=1e-7)
    assert math.isclose(crossing["strain_energy_J_per_m"],
                        ref["strain_energy_J_per_m"] * ratio ** 2, rel_tol=1e-7)
    assert crossing["eta_compression_linear"] < 1 and crossing["eta_steel_yield"] < 1
    return crossing


def fine_check(study: dict) -> dict:
    p = dict(study["parameters"], nr=18, ntheta=288)
    # Rebuild node numbers for this mesh; do not reuse numbers from 12 x 192.
    d, t = study["diameter_mm"], study["thickness_mm"]
    p = geometry(d, t, 18, 288, p["prestress"] / 1e6)
    rows, crossings = {}, {}
    for case, _, _ in CASES:
        ref = solve_level(p, 20., case)
        rows[case] = ref
        crossings[case] = crossing_from_reference(p, case, ref)
    return {"diameter_mm": d, "thickness_mm": t, "parameters": p,
            "reference_rows": rows, "crack_screen_crossings": crossings}


def summarize(studies: list[dict], fine_checks: list[dict]) -> list[dict]:
    fine = {(f["diameter_mm"], f["thickness_mm"]): f for f in fine_checks}
    summary = []
    for study in studies:
        d, t = study["diameter_mm"], study["thickness_mm"]
        a, b = row_at(study, "plain"), row_at(study, "rc")
        ca, cb = (study["crack_screen_crossings"][case] for case in ("plain", "rc"))
        row = {"diameter_mm": d, "thickness_mm": t, "inner_diameter_mm": d - 2 * t,
               "thickness_to_diameter": t / d,
               "nominal_concrete_area_mm2": math.pi * ((d / 2) ** 2 - (d / 2 - t) ** 2),
               "q_reference_kN_per_m_each": 20.,
               "u_plain_mm": a["u_max_mm"], "u_rc_mm": b["u_max_mm"],
               "load_displacement_plain_mm": a["mean_inward_at_loads_mm"],
               "load_displacement_rc_mm": b["mean_inward_at_loads_mm"],
               "steel_displacement_reduction_percent": 100 * (1 - b["u_max_mm"] / a["u_max_mm"]),
               "crack_screen_plain_kN_per_m_each": ca["q_each_kN_per_m"],
               "crack_screen_rc_kN_per_m_each": cb["q_each_kN_per_m"],
               "tensile_stress_plain_at_reference_MPa": a["sigma_tensile_max_MPa"],
               "tensile_stress_rc_at_reference_MPa": b["sigma_tensile_max_MPa"],
               "crack_critical_plain_radius_mm": math.hypot(ca["crack_critical_x_mm"], ca["crack_critical_y_mm"]),
               "crack_critical_plain_theta_deg": math.degrees(math.atan2(ca["crack_critical_y_mm"], ca["crack_critical_x_mm"])) % 360,
               "reference_within_elastic_screens": a["within_elastic_screens"] and b["within_elastic_screens"]}
        assert row["reference_within_elastic_screens"], (d, t, "reference load exceeds an elastic screen")
        if (d, t) in fine:
            f = fine[(d, t)]
            for case, name in (("plain", "plain"), ("rc", "rc")):
                u_fine = f["reference_rows"][case]["u_max_mm"]
                q_fine = f["crack_screen_crossings"][case]["q_each_kN_per_m"]
                row[f"fine_u_{name}_mm"] = u_fine
                row[f"fine_crack_screen_{name}_kN_per_m_each"] = q_fine
                row[f"fine_u_change_{name}_percent"] = 100 * (u_fine / row[f"u_{name}_mm"] - 1)
                row[f"fine_crack_screen_change_{name}_percent"] = 100 * (
                    q_fine / row[f"crack_screen_{name}_kN_per_m_each"] - 1)
            row["fine_steel_displacement_reduction_percent"] = 100 * (1 - row["fine_u_rc_mm"] / row["fine_u_plain_mm"])
            point = f["crack_screen_crossings"]["plain"]
            row["fine_crack_critical_plain_radius_mm"] = math.hypot(point["crack_critical_x_mm"], point["crack_critical_y_mm"])
            row["fine_crack_critical_plain_theta_deg"] = math.degrees(math.atan2(point["crack_critical_y_mm"], point["crack_critical_x_mm"])) % 360
        summary.append(row)
    return summary


def save_figure(fig, output: Path, name: str) -> str:
    fig.savefig(output / f"{name}.png", dpi=180)
    fig.savefig(output / f"{name}.svg")
    plt.close(fig)
    svg = (output / f"{name}.svg").read_text(encoding="utf-8")
    return svg[svg.index("<svg"):]


def figures(data: dict, output: Path) -> tuple[str, str]:
    plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 10})
    fig, axes = plt.subplots(2, 2, figsize=(13, 10.7))
    studies, summary = data["studies"], data["summary"]
    xmax = max(r["u_max_mm"] for s in studies for values in s["rows"].values() for r in values
               if r["q_each_kN_per_m"] <= max(LOADS))
    for column, diameter in enumerate(DIAMETERS):
        axis = axes[0, column]
        for thickness, color in zip(THICKNESSES, COLORS):
            s = next(s for s in studies if s["diameter_mm"] == diameter and s["thickness_mm"] == thickness)
            for case in ("plain", "rc"):
                crossing = s["crack_screen_crossings"][case]
                cutoff = crossing["q_each_kN_per_m"]
                values = [r for r in s["rows"][case] if r["q_each_kN_per_m"] <= max(LOADS)]
                valid = [r for r in values if r["q_each_kN_per_m"] <= cutoff + 1e-8]
                extension = [r for r in values if r["q_each_kN_per_m"] >= cutoff - 1e-8]
                axis.plot([r["u_max_mm"] for r in valid], [r["q_each_kN_per_m"] for r in valid],
                          color=color, linestyle="-" if case == "plain" else "--", linewidth=2,
                          label=f"t = {thickness} mm" if case == "plain" else None)
                axis.plot([r["u_max_mm"] for r in extension], [r["q_each_kN_per_m"] for r in extension],
                          color=color, linestyle=":", linewidth=1.6, alpha=.55)
                if cutoff <= max(LOADS):
                    axis.scatter(crossing["u_max_mm"], cutoff, color=color,
                                 marker="o" if case == "plain" else "x", s=30, zorder=5)
        axis.set(title=f"D{diameter}: đường tải–chuyển vị", xlabel="|Δu|max [mm]",
                 ylabel="Mỗi lực ép q [kN/m]", xlim=(0, xmax * 1.06), ylim=(0, max(LOADS) * 1.03))
        axis.legend(loc="lower right", fontsize=9)
    for diameter, color in zip(DIAMETERS, ("#2469a5", "#b75016")):
        values = [r for r in summary if r["diameter_mm"] == diameter]
        for case, label, style, marker in (("plain", "không thép", "-", "o"), ("rc", "có thép", "--", "s")):
            for axis, key in ((axes[1, 0], f"u_{case}_mm"),
                              (axes[1, 1], f"crack_screen_{case}_kN_per_m_each")):
                axis.plot([r["thickness_mm"] for r in values], [r[key] for r in values],
                          color=color, linestyle=style, marker=marker, markersize=5,
                          label=f"D{diameter} · {label}")
        if all("fine_crack_screen_plain_kN_per_m_each" in r for r in values):
            axes[1, 1].plot([r["thickness_mm"] for r in values],
                            [r["fine_crack_screen_plain_kN_per_m_each"] for r in values],
                            color=color, linestyle=":", marker="^", linewidth=1.5, alpha=.8,
                            label=f"D{diameter} · lưới mịn, không thép")
    axes[1, 0].set(title="Cùng q = 20 kN/m mỗi lực", xlabel="Chiều dày t [mm]", ylabel="|Δu|max [mm]")
    axes[1, 1].set(title="Ngưỡng kéo tại điểm: độ nhạy theo lưới", xlabel="Chiều dày t [mm]",
                   ylabel="q tại σkéo chính,max = 2,75 MPa [kN/m]")
    for axis in axes[1]:
        axis.set_xticks(THICKNESSES)
        axis.set_ylim(bottom=0)
        axis.legend(fontsize=9)
    axes[1, 1].legend(fontsize=8)
    max_screen_change = max(abs(r.get("fine_crack_screen_change_plain_percent", 0)) for r in summary)
    axes[1, 1].text(.97, .025, f"Ngưỡng kéo thay đổi tới {max_screen_change:.1f}% khi làm mịn lưới",
                    transform=axes[1, 1].transAxes, ha="right", fontsize=8,
                    bbox={"facecolor": "white", "edgecolor": "none", "alpha": .8})
    for axis in axes.flat:
        axis.grid(True, color="#dce2e8", linewidth=.6)
        axis.spines[["top", "right"]].set_visible(False)
    fig.suptitle("D600 và D800 · 4 chiều dày · B60 · lưới 12 × 192", fontsize=17)
    fig.legend(handles=[Line2D([0], [0], color="#333", label="Không kể thép"),
                        Line2D([0], [0], color="#333", linestyle="--", label="Có thép"),
                        Line2D([0], [0], color="#777", linestyle=":", label="Ngoại suy đàn hồi sau ngưỡng kéo")],
               loc="lower center", bbox_to_anchor=(.5, .035), ncol=3, frameon=False)
    fig.text(.5, .015, "Dấu tròn / ×: chạm ngưỡng kéo; chưa mô phỏng sau nứt hoặc tải phá hoại. Hai đồ thị trên dùng cùng thang đo.",
             ha="center", fontsize=9)
    fig.tight_layout(rect=(0, .08, 1, .95))
    main_svg = save_figure(fig, output, "thickness_comparison")
    fig, axes = plt.subplots(1, 2, figsize=(12.5, 4.9))
    for diameter, color in zip(DIAMETERS, ("#2469a5", "#b75016")):
        values = [r for r in summary if r["diameter_mm"] == diameter]
        axes[0].plot(THICKNESSES, [r["steel_displacement_reduction_percent"] for r in values],
                     "o-", color=color, label=f"D{diameter}")
    for case, label, style in (("plain", "Không kể thép", "o-"), ("rc", "Có thép", "s--")):
        ratios = []
        for t in THICKNESSES:
            a = next(r for r in summary if r["diameter_mm"] == 600 and r["thickness_mm"] == t)
            b = next(r for r in summary if r["diameter_mm"] == 800 and r["thickness_mm"] == t)
            ratios.append(b[f"u_{case}_mm"] / a[f"u_{case}_mm"])
        axes[1].plot(THICKNESSES, ratios, style, label=label)
    axes[0].set(title="Ảnh hưởng thép đến chuyển vị đàn hồi", ylabel="Giảm |Δu|max so với không thép [%]", ylim=(0, None))
    axes[1].set(title="Cùng chiều dày, cùng tải ép ngang", ylabel="Tỷ số |Δu|max: D800 / D600", ylim=(0, None))
    for axis in axes:
        axis.set_xlabel("Chiều dày t [mm]")
        axis.set_xticks(THICKNESSES)
        axis.grid(True, color="#dce2e8", linewidth=.6)
        axis.spines[["top", "right"]].set_visible(False)
        axis.legend()
    fig.suptitle("Đối chiếu tại q = 20 kN/m cho mỗi lực · cùng cấu hình thép", fontsize=14)
    fig.tight_layout(rect=(0, 0, 1, .92))
    return main_svg, save_figure(fig, output, "steel_and_diameter_effect")


def csv_output(path: Path, records: list[dict]) -> None:
    fields = [k for k in records[0] if k != "contact_signature"]
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(records)


def write_report(data: dict, output: Path) -> None:
    data["summary"] = summarize(data["studies"], data["fine_checks"])
    svg, steel_svg = figures(data, output)
    csv_output(output / "summary.csv", data["summary"])
    records = [{"diameter_mm": s["diameter_mm"], "thickness_mm": s["thickness_mm"],
                "mesh": "12x192", **r} for s in data["studies"] for values in s["rows"].values() for r in values]
    for f in data["fine_checks"]:
        for case in ("plain", "rc"):
            for r in (f["reference_rows"][case], f["crack_screen_crossings"][case]):
                records.append({"diameter_mm": f["diameter_mm"], "thickness_mm": f["thickness_mm"],
                                "mesh": "18x288", **r})
    csv_output(output / "load_steps.csv", records)
    table, mesh_table, details = [], [], []
    conclusions = []
    for d in DIAMETERS:
        a = next(r for r in data["summary"] if r["diameter_mm"] == d and r["thickness_mm"] == min(THICKNESSES))
        b = next(r for r in data["summary"] if r["diameter_mm"] == d and r["thickness_mm"] == max(THICKNESSES))
        main_reduction = 100 * (1 - b["u_plain_mm"] / a["u_plain_mm"])
        fine_reduction = 100 * (1 - b["fine_u_plain_mm"] / a["fine_u_plain_mm"])
        conclusions.append(f"<li>D{d}: tăng t từ {min(THICKNESSES)} lên {max(THICKNESSES)} mm "
                           f"giảm chuyển vị {main_reduction:.1f}% trên lưới chính và {fine_reduction:.1f}% trên lưới mịn "
                           "(cùng q = 20 kN/m, không kể thép).</li>")
    steel_min = min(r["steel_displacement_reduction_percent"] for r in data["summary"])
    steel_max = max(r["steel_displacement_reduction_percent"] for r in data["summary"])
    u_changes = [r[f"fine_u_change_{case}_percent"] for r in data["summary"] for case in ("plain", "rc")]
    max_screen_change = max(abs(r[f"fine_crack_screen_change_{case}_percent"])
                            for r in data["summary"] for case in ("plain", "rc"))
    for s, r in zip(data["studies"], data["summary"]):
        d, t = r["diameter_mm"], r["thickness_mm"]
        table.append(f"<tr><td>D{d}</td><td>{t}</td><td>{d-2*t}</td><td>{r['u_plain_mm']:.6f}</td>"
                     f"<td>{r['u_rc_mm']:.6f}</td><td>{r['steel_displacement_reduction_percent']:.3f}</td>"
                     f"<td>{r['crack_screen_plain_kN_per_m_each']:.2f}</td><td>{r['crack_screen_rc_kN_per_m_each']:.2f}</td></tr>")
        if "fine_u_plain_mm" in r:
            mesh_table.append(f"<tr><td>D{d} × {t}</td><td>{r['fine_u_plain_mm']:.6f}</td>"
                              f"<td>{r['fine_u_change_plain_percent']:+.2f}%</td>"
                              f"<td>{r['fine_steel_displacement_reduction_percent']:.3f}%</td>"
                              f"<td>{r['fine_crack_screen_plain_kN_per_m_each']:.2f}</td>"
                              f"<td>{r['fine_crack_screen_change_plain_percent']:+.2f}%</td></tr>")
        steps = []
        for q in LOADS:
            a, b = row_at(s, "plain", q), row_at(s, "rc", q)
            valid = a["within_elastic_screens"] and b["within_elastic_screens"]
            steps.append(f"<tr class='{'' if valid else 'extension'}'><td>{q:g}</td>"
                         f"<td>{a['u_max_mm']:.6f}</td><td>{b['u_max_mm']:.6f}</td>"
                         f"<td>{a['eta_cracking']:.3f}</td><td>{b['eta_cracking']:.3f}</td>"
                         f"<td>{'Trong các ngưỡng sàng lọc đàn hồi' if valid else 'Ngoại suy đàn hồi'}</td></tr>")
        details.append(f"<details><summary>D{d} × {t} mm · các cấp tải</summary><div class='table'><table>"
                       "<tr><th>q mỗi lực, kN/m</th><th>u không thép, mm</th><th>u có thép, mm</th>"
                       f"<th>η kéo không thép</th><th>η kéo có thép</th><th>Phạm vi</th></tr>{''.join(steps)}</table></div></details>")
    p = data["studies"][0]["parameters"]
    report = f"""<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>D600 và D800 · Ảnh hưởng chiều dày</title><style>
body{{font:16px/1.6 system-ui,sans-serif;background:#f3f6fa;color:#213047;margin:0}}main{{max-width:1220px;margin:auto;padding:30px;background:white}}
h1{{line-height:1.3}}svg{{width:100%;height:auto}}.note{{padding:16px;border-left:4px solid #c48215;background:#fff7e6}}
.table{{overflow:auto}}table{{border-collapse:collapse;width:100%;font-size:14px}}th,td{{padding:9px;border-bottom:1px solid #dbe3ec;text-align:right}}
th{{background:#eaf0f7}}td:first-child,th:first-child{{text-align:left}}.extension{{background:#fff7ef}}a{{color:#205e9e}}
details{{margin:12px 0;border:1px solid #dbe3ec;padding:12px}}summary{{cursor:pointer;font-weight:600}}</style><main>
<h1>D600 và D800 · So sánh bốn chiều dày</h1>
<p>Đường kính ngoài D = 600 và 800 mm; thành dày t = 80, 100, 120 và 150 mm cho cả hai loại.
Đường kính trong bằng D − 2t. Có 8 hình học và 16 trường hợp vật liệu, mỗi trường hợp giải lại tại 9 cấp
q = 0, 10, 20, 40, 60, 80, 100, 150 và 200 kN/m cho mỗi lực, cùng các cấp bổ sung chạm ngưỡng kéo.</p>
<p>Bê tông B60, E = 39,5 GPa, ν = 0,2. Hai lực q hướng tâm tại 60° và 120°; ba chặn một chiều tại
0°, 180° và 270°, không ma sát, khe hở bằng 0. q là độ lớn mỗi lực, tổng thành phần đứng bằng √3q.
Nén trước hữu hiệu z giữ ở {p['prestress']/1e6:g} MPa minh họa; giữ lực dọc trong mỗi bài tính.
Giữ cùng ứng suất trước có nghĩa lực nén trước ban đầu thay đổi theo diện tích bê tông.</p>
<p>Trường hợp có thép giữ 12Ø12 CB400-V, đai Ø6a100 CB240-T, Es = 200 GPa và lớp bảo vệ ngoài đai 30 mm.
Vị trí lồng thép đi theo biên ngoài, hàm lượng thép thay đổi theo D và t; chưa kiểm tra cấu tạo thiết kế đầy đủ.
Ứng suất thép dọc ban đầu vẫn giả thiết bằng 0. Kết quả phản ánh đồng thời thép dọc và thép đai.</p>
<div class="note"><b>Phạm vi:</b> đàn hồi, biến dạng nhỏ, tải/gối bất biến dọc cọc; chưa tính nứt và chảy thép.
Ngưỡng kéo tại điểm σkéo chính,max = Rbt,ser = 2,75 MPa dùng để sàng lọc dấu hiệu nứt; chưa phải kiểm tra
không nứt đầy đủ hoặc tải phá hoại. Nét chấm trên hai đồ thị tải–chuyển vị là ngoại suy đàn hồi.</div>
<h2>Kết quả chính</h2><ul>{''.join(conclusions)}
<li>Với cùng cấu hình thép, mức giảm chuyển vị đàn hồi do kể thép trong bộ mẫu là {steel_min:.2f}–{steel_max:.2f}%.
Kết quả này chỉ phản ánh giai đoạn trước nứt.</li></ul>
<div class="note"><b>Giới hạn do mô hình gối/lực điểm:</b> khi đổi từ lưới 12 × 192 sang 18 × 288,
chuyển vị thay đổi {min(u_changes):.1f}–{max(u_changes):.1f}%, còn tải chạm ngưỡng kéo thay đổi tới
{max_screen_change:.1f}%. Lưới mịn xuất hiện đỉnh kéo ở biên ngoài sát gối nền trong một số trường hợp.
Xu hướng giảm chuyển vị khi tăng chiều dày giữ nguyên; <b>các mốc kéo chưa đủ tin cậy để chốt tải không nứt</b>.
Cần mô hình miền tiếp xúc hữu hạn nếu dùng kết quả để kiểm tra nứt cục bộ.</div>
{svg}
<h2>So sánh tại cùng q = 20 kN/m cho mỗi lực</h2><p>Cả 16 trường hợp tại tải này còn trong các ngưỡng
sàng lọc đàn hồi hiện có. u là độ lớn chuyển vị tăng thêm lớn nhất trên mặt cắt. Mốc kéo được giải lại
tại chính tải chạm ngưỡng; không nhân ứng suất nén trước với hệ số tăng tải ngang.</p>
<div class="table"><table><tr><th>Cọc</th><th>t, mm</th><th>D trong, mm</th><th>u không thép, mm</th>
<th>u có thép, mm</th><th>Giảm do thép, %</th><th>q ngưỡng kéo<br>không thép, kN/m</th><th>q ngưỡng kéo<br>có thép, kN/m</th></tr>
{''.join(table)}</table></div>{steel_svg}
<h2>Độ nhạy theo lưới</h2><p>Lưới chính 12 × 192; lưới đối chiếu 18 × 288 cho cả 8 hình học,
giải lại tại q = 20 và tại ngưỡng kéo của từng trường hợp có/không thép. Bảng dưới ghi kết quả chuyển vị
và mốc kéo của trường hợp không thép; dữ liệu cả hai nằm trong CSV/JSON. Chênh lệch lưới là độ nhạy,
chưa phải chứng minh hội tụ của đỉnh ứng suất dưới tải/gối điểm.</p>
<div class="table"><table><tr><th>Hình học</th><th>u lưới mịn, mm</th><th>Δu so lưới chính</th>
<th>Giảm u do thép<br>lưới mịn</th><th>q ngưỡng kéo<br>lưới mịn, kN/m</th><th>Δq so lưới chính</th></tr>
{''.join(mesh_table)}</table></div>
<h2>Từng cấp tải</h2>{''.join(details)}
<p>Đã kiểm tra cân bằng lực và mô men tại từng nghiệm, phản lực nền bằng √3q, chuyển vị ở q = 0 bằng 0,
trạng thái tì không đổi tại tải dương, u tỷ lệ với q và năng lượng tỷ lệ q². Chi tiết sai số và cấu hình
tái lập được lưu trong JSON.</p>
<p><a href="thickness_comparison.png">Biểu đồ chính PNG</a> · <a href="thickness_comparison.svg">SVG</a> ·
<a href="steel_and_diameter_effect.png">Ảnh hưởng thép và đường kính</a> · <a href="summary.csv">CSV tổng hợp</a> ·
<a href="load_steps.csv">CSV từng cấp tải</a> · <a href="results.json">Dữ liệu JSON</a></p></main></html>"""
    (output / "report.html").write_text(report, encoding="utf-8")
    data["render_source_sha256"] = source_hashes()
    (output / "results.json").write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--prestress-mpa", type=float, default=5.)
    parser.add_argument("--output", type=Path, default=Path("results/thickness_d600_d800"))
    parser.add_argument("--render-only", action="store_true")
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    result_path = args.output / "results.json"
    if args.render_only:
        data = json.loads(result_path.read_text(encoding="utf-8"))
        assert data["complete"], "The numerical study has not completed."
        hashes = source_hashes()
        for name in SOURCE_NAMES[:-1]:
            assert data["source_sha256"][name] == hashes[name], f"Numerical source changed: {name}"
    else:
        data = {"complete": False, "scope": "elastic_geometry_and_steel_sensitivity_not_postcrack",
                "full_tcvn_verification": False, "python": sys.version, "source_sha256": source_hashes(),
                "studies": [], "fine_checks": []}
        for d in DIAMETERS:
            for t in THICKNESSES:
                print(f"START D{d} t={t} mm, 12x192", flush=True)
                study = run_study(geometry(d, t, 12, 192, args.prestress_mpa), LOADS)
                study.update(diameter_mm=d, thickness_mm=t)
                for case, _, _ in CASES:
                    if study["crack_screen_crossings"][case] is None:
                        crossing = crossing_from_reference(study["parameters"], case, row_at(study, case))
                        study["crack_screen_crossings"][case] = crossing
                        study["rows"][case].append(crossing)
                        study["rows"][case].sort(key=lambda r: r["q_each_kN_per_m"])
                data["studies"].append(study)
                result_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        for study in data["studies"]:
            print(f"FINE D{study['diameter_mm']} t={study['thickness_mm']} mm, 18x288", flush=True)
            data["fine_checks"].append(fine_check(study))
            result_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        data["complete"] = True
    write_report(data, args.output)
    print(f"SAVED: {args.output.resolve() / 'report.html'}", flush=True)


if __name__ == "__main__":
    main()
