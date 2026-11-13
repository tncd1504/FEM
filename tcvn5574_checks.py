"""TCVN 5574:2018 material limits and checks for the elastic pipe model.

Only normal-weight concrete is supported. Tables 6/7/10 are transcribed values
(MPa/GPa). Table 7 ALREADY includes material reliability factors. Clause 6.1.2.3
working-condition factors are applied separately, once.

Principal stress comparisons are explicitly an ELASTIC SCREEN, not a substitute
for the multiaxial/nonlinear resistance required by 6.1.4.9 and 7.2.2. There is
no blanket "TCVN compliant" or full ULS/SLS pass flag. Displacement limits are
project requirements, not an invented span rule for an infinitely long pipe.
"""
from __future__ import annotations

from copy import deepcopy
import math

import numpy as np

from annular_pipe_fem import solve_annular_pipe

STANDARD = "TCVN 5574:2018"
SOURCE = "https://www.rds.com.vn/TCXD1/TCVN5574-2018.pdf"
# grade: Rb, Rbt (table 7), Rb,ser, Rbt,ser (table 6), Eb in GPa (table 10)
CONCRETE = {
    "B15": (8.5, .75, 11.0, 1.10, 24.0),
    "B20": (11.5, .90, 15.0, 1.35, 27.5),
    "B25": (14.5, 1.05, 18.5, 1.55, 30.0),
    "B30": (17.0, 1.15, 22.0, 1.75, 32.5),
    "B35": (19.5, 1.30, 25.5, 1.95, 34.5),
    "B40": (22.0, 1.40, 29.0, 2.10, 36.0),
    "B45": (25.0, 1.50, 32.0, 2.25, 37.0),
    "B50": (27.5, 1.60, 36.0, 2.45, 38.0),
    "B55": (30.0, 1.70, 39.5, 2.60, 39.0),
    "B60": (33.0, 1.80, 43.0, 2.75, 39.5),
    "B70": (37.0, 1.90, 50.0, 3.00, 41.0),
    "B80": (41.0, 2.10, 57.0, 3.30, 42.0),
    "B90": (44.0, 2.15, 64.0, 3.60, 42.5),
    "B100": (47.5, 2.20, 71.0, 3.80, 43.0),
}


def material_catalog() -> dict:
    return {"standard": STANDARD, "source": SOURCE, "concrete_type": "Bê tông nặng",
            "grades": {grade: {"Rb_MPa": v[0], "Rbt_MPa": v[1],
                                 "Rb_ser_MPa": v[2], "Rbt_ser_MPa": v[3],
                                 "Eb_GPa": v[4]} for grade, v in CONCRETE.items()}}


def _finite(value, label, low=0.0, *, positive=False):
    if isinstance(value, bool):
        raise ValueError(f"{label} phải là số.")
    try:
        v = float(value)
    except (ValueError, TypeError) as exc:
        raise ValueError(f"{label} phải là số hữu hạn.") from exc
    if not math.isfinite(v) or v < low or (positive and v == 0):
        raise ValueError(f"{label} phải hữu hạn và {'lớn hơn' if positive else 'không nhỏ hơn'} {low}.")
    return v


def _boolean(value, label):
    if not isinstance(value, bool):
        raise ValueError(f"{label} phải là true hoặc false.")
    return value


def check_settings(raw: dict) -> dict:
    if not isinstance(raw, dict):
        raise ValueError("tcvn phải là một đối tượng JSON.")
    grade = str(raw.get("grade", "B30")).upper()
    if grade not in CONCRETE:
        raise ValueError("Cấp bê tông chưa hỗ trợ; chọn một cấp trong B15–B100 của danh mục.")
    duration = raw.get("duration", "short")
    if duration not in ("short", "sustained"):
        raise ValueError("Thời hạn tải phải là short hoặc sustained.")
    result = {"grade": grade, "duration": duration,
              "uls_load_factor": _finite(raw.get("uls_load_factor", 1.0), "Hệ số tải TTGH1"),
              "uls_prestress_factor": _finite(raw.get("uls_prestress_factor", 1.0), "Hệ số nén trước TTGH1"),
              "vertical_pour_over_1_5m": _boolean(raw.get("vertical_pour_over_1_5m", False), "Điều kiện đổ đứng"),
              "limit_basis": str(raw.get("limit_basis", "Nhiệm vụ thiết kế — người dùng nhập"))[:500]}
    for name in ("radial_displacement_limit_m", "diameter_change_limit_ratio"):
        value = raw.get(name)
        result[name] = None if value is None else _finite(value, name, positive=True)
    return result


def principal_stresses(point: dict) -> tuple[float, float, float]:
    """Eigenvalues of [[sr,trt,0],[trt,st,0],[0,0,sz]], descending."""
    sr, st, shear = point["sigma_r"], point["sigma_theta"], point["tau_rt"]
    mid = .5 * (sr + st)
    radius = math.hypot(.5 * (sr - st), shear)
    return tuple(sorted((mid + radius, mid - radius, point["sigma_z"]), reverse=True))


def _critical(point: dict) -> dict:
    return {"element_id": point["element_id"], "point_id": point.get("point_id", "G"),
            "x_m": point["x"], "y_m": point["y"],
            "theta_deg": math.degrees(math.atan2(point["y"], point["x"])) % 360,
            "principal_stresses_Pa": list(principal_stresses(point))}


def _row(key, group, title, demand, limit, unit, clause, *, critical=None, note="", applicable=True):
    ratio = demand / limit if limit is not None else None
    status = ("not_assessed" if limit is None or not applicable else
              "within_limits" if demand <= limit * (1 + 1e-10) else "exceeded")
    return {"id": key, "group": group, "title": title, "demand": float(demand),
            "limit": limit, "ratio": ratio, "unit": unit, "status": status,
            "clause": clause, "critical": critical, "note": note}


def _stress_row(points, key, group, title, limit, compression, clause, note):
    demands = [max(0.0, -principal_stresses(p)[2] if compression else principal_stresses(p)[0]) for p in points]
    index = int(np.argmax(demands))
    demand = demands[index]
    return _row(key, group, title, demand, limit, "Pa", clause,
                critical=_critical(points[index]) if demand > 0 else None, note=note)


def _diameter_change(result):
    nt = result["mesh"]["ntheta"]
    ids = np.array(result["mesh"]["outer_nodes"]) - 1
    radial = np.array(result["nodal"]["u_r"])[ids]
    # Periodic interpolation supports odd as well as even angular mesh counts.
    angles = np.arange(nt) * 360.0 / nt
    opposite = np.interp((angles + 180) % 360, np.r_[angles, 360.0], np.r_[radial, radial[0]])
    changes = radial + opposite  # rigid translations cancel
    j = int(np.argmax(np.abs(changes)))
    ro = result["mesh"]["polar"][int(ids[0])][0]
    return {"absolute_m": float(abs(changes[j])), "signed_m": float(changes[j]),
            "ratio": float(abs(changes[j]) / (2 * ro)), "theta_deg": float(angles[j])}


def evaluate_checks(sls: dict, uls: dict, params: dict, config: dict) -> dict:
    rb, rbt, rbser, rbtser, eb = CONCRETE[config["grade"]]
    gamma1 = 1.0 if config["duration"] == "short" else .9
    gamma2 = 1.0 if sls.get("reinforcement", {}).get("has_steel", False) else .9
    gamma3 = .85 if config["vertical_pour_over_1_5m"] else 1.0
    rb_eff, rbt_eff = rb * gamma1 * gamma2 * gamma3 * 1e6, rbt * gamma1 * 1e6
    service_points = sls.get("check_points", sls["gauss_results"])
    design_points = uls.get("check_points", uls["gauss_results"])
    screen_note = ("So sánh ứng suất chính đàn hồi với cường độ đơn trục. "
                   "Chưa thay thế kiểm tra sức kháng phi tuyến và tương tác đa trục theo 6.1.4.9, 7.2.2.")
    rows = [
        _stress_row(design_points, "uls_compression", "TTGH1", "Nén chính — sàng lọc đàn hồi", rb_eff,
                    True, "6.1.2.2–6.1.2.3; Bảng 7", screen_note),
        _stress_row(design_points, "uls_tension", "TTGH1", "Kéo chính — sàng lọc đàn hồi", rbt_eff,
                    False, "6.1.2.2–6.1.2.3; Bảng 7", screen_note),
        _stress_row(service_points, "sls_cracking", "TTGH2", "Kéo chính / Rbt,ser — dấu hiệu nứt", rbtser*1e6,
                    False, "Bảng 6; 5.3; 8.2.2.2", "Ngưỡng đàn hồi tại điểm, chưa phải mô phỏng vết nứt hoặc tính bề rộng nứt."),
    ]
    cracked = rows[2]["status"] == "exceeded"
    peak_compression = max(max(0, -principal_stresses(p)[2]) for p in service_points)
    # The first branch of the three-segment diagram ends at 0.6R (6.1.4.2).
    nonlinear_compression = peak_compression > .6 * rbser * 1e6
    valid_deformation = not cracked and not nonlinear_compression and config["duration"] == "short"
    radial = np.abs(sls["nodal"]["u_r"])
    radial_id = int(np.argmax(radial))
    diameter = _diameter_change(sls)
    deformation_note = ("Giới hạn riêng của dự án: " + config["limit_basis"] +
                        ". Chuyển vị tăng thêm từ hình học đã nén trước; không gán giới hạn nhịp của dầm cho ống.")
    if not valid_deformation:
        deformation_note += " Kết quả đàn hồi chưa đủ kết luận do có dấu hiệu nứt, nén phi tuyến hoặc tải dài hạn."
    rows.extend([
        _row("sls_radial", "TTGH2", "Chuyển vị hướng tâm tăng thêm", float(radial[radial_id]),
             config["radial_displacement_limit_m"], "m", "5.5; 8.2.3.1.2; Phụ lục M / nhiệm vụ thiết kế",
             critical={"node_id": radial_id+1}, note=deformation_note, applicable=valid_deformation),
        _row("sls_diameter", "TTGH2", "Thay đổi đường kính tương đối", diameter["ratio"],
             config["diameter_change_limit_ratio"], "ratio", "5.5; 8.2.3.1.2 / nhiệm vụ thiết kế",
             critical={"theta_deg": diameter["theta_deg"]}, note=deformation_note, applicable=valid_deformation),
    ])
    for key, group, title, clause, reason in (
        ("uls_multiaxial", "TTGH1", "Sức kháng đầy đủ & tương tác đa trục", "6.1.4.9; 7.2.2", "Chưa có mô hình sức kháng đa trục/phi tuyến; không tăng cường độ do nén trước."),
        ("uls_stability", "TTGH1", "Ổn định dọc trục, nén cục bộ và các dạng phá hoại khác", "5.2; 7.2.1", "Ngoài phạm vi mặt cắt đàn hồi bất biến dọc ống."),
        ("sls_crack_width", "TTGH2", "Bề rộng vết nứt sau khi nứt", "8.2.2.3; 9.3.2", "Chưa có dữ liệu cốt thép/bám dính và chưa giải sau nứt."),
        ("sls_long_term", "TTGH2", "Biến dạng dài hạn, từ biến và co ngót", "6.1.3.3–6.1.3.4; 8.2.3", "Bộ giải hiện tại chỉ tính biến dạng đàn hồi tức thời từ trạng thái hữu hiệu."),
    ):
        rows.append({"id": key, "group": group, "title": title, "status": "not_assessed",
                     "demand": None, "limit": None, "ratio": None, "unit": "",
                     "clause": clause, "critical": None, "note": reason})
    if float(params.get("prestress", 5e6)) > 0 and float(config["grade"][1:]) < 20:
        rows.append(_row("prestressed_grade", "Vật liệu", "Cấp tối thiểu cho cấu kiện ứng suất trước",
                         20, float(config["grade"][1:]), "B", "6.1.1.6",
                         note="Yêu cầu tối thiểu B20; yêu cầu theo loại cáp có thể cao hơn."))
    young = float(params.get("E", 30e9))
    nu = float(params.get("nu", .2))
    equivalent_strains = []
    for point in service_points:
        stresses = principal_stresses(point)
        trace = sum(stresses)
        strains = tuple(((1 + nu)*s - nu*trace)/young for s in stresses)
        equivalent_strains.append((strains, point))
    compressive = max(equivalent_strains, key=lambda pair: -pair[0][2])
    tensile = max(equivalent_strains, key=lambda pair: pair[0][0])
    warnings = ["Các tỷ số ứng suất là sàng lọc đàn hồi; không kết luận toàn bộ kết cấu đạt TCVN.",
                "TTGH1 được giải lại với hệ số tải; giữ nguyên chuyển vị gối. Không tự sinh tổ hợp tải.",
                "Không coi nén trước hữu hiệu là bê tông tự ứng suất; không áp dụng hệ số 1,2 của loại bê tông đó."]
    if cracked:
        warnings.append("Có điểm vượt Rbt,ser: cần tính lại độ cứng/nội lực sau nứt trước khi kết luận biến dạng sử dụng.")
    if nonlinear_compression:
        warnings.append("Nén chính vượt 0,6Rb,ser: mô hình đàn hồi có thể không còn phù hợp để kết luận biến dạng.")
    if abs(young/(eb*1e9)-1) > .05:
        warnings.append("E đang dùng khác Eb tra Bảng 10 trên 5%; vẫn giữ E người dùng đã nhập.")
    element_maps = []
    for k in range(len(sls["element_results"])):
        element_maps.append({"element_id": k+1, "eta_uls_compression": 0.0,
                             "eta_uls_tension": 0.0, "eta_sls_cracking": 0.0})
    for points, service in ((service_points, True), (design_points, False)):
        for point in points:
            s1, _, s3 = principal_stresses(point)
            target = element_maps[point["element_id"]-1]
            if service:
                target["eta_sls_cracking"] = max(target["eta_sls_cracking"], max(s1, 0)/(rbtser*1e6))
            else:
                target["eta_uls_compression"] = max(target["eta_uls_compression"], max(-s3, 0)/rb_eff)
                target["eta_uls_tension"] = max(target["eta_uls_tension"], max(s1, 0)/rbt_eff)
    return {"standard": STANDARD, "source": SOURCE, "settings": config,
            "scope": "elastic_material_screen_and_project_displacement_limits",
            "full_tcvn_verification": False,
            "summary_status": "exceeded" if any(r["status"] == "exceeded" for r in rows) else "incomplete",
            "material": {"type": "normal_weight", "grade": config["grade"], "Rb_Pa": rb*1e6,
                         "Rbt_Pa": rbt*1e6, "Rb_ser_Pa": rbser*1e6, "Rbt_ser_Pa": rbtser*1e6,
                         "Eb_table_Pa": eb*1e9, "E_used_Pa": young,
                         "gamma_b1": gamma1, "gamma_b2": gamma2, "gamma_b3": gamma3,
                         "Rb_effective_Pa": rb_eff, "Rbt_effective_Pa": rbt_eff,
                         "source_clauses": "Bảng 6, 7, 10; 6.1.2.2–6.1.2.3"},
            "cases": {"SLS": {"load_factor": 1.0, "prestress_factor": 1.0, "summary": sls["summary"]},
                      "ULS": {"load_factor": config["uls_load_factor"], "prestress_factor": config["uls_prestress_factor"],
                              "summary": uls["summary"], "reactions": uls["reactions"]}},
            "rows": rows, "element_utilization": element_maps,
            "deformation": {"elastic_uncracked_short_term": valid_deformation,
                            "diameter_change": diameter,
                            "equivalent_compressive_strain": max(0.0, -compressive[0][2]),
                            "equivalent_tensile_strain": max(0.0, tensile[0][0]),
                            "strain_note": "Biến dạng đàn hồi quy đổi từ ứng suất tổng bằng E, ν. Không khôi phục lịch sử từ biến/co ngót và không dùng giãn Poisson để kết luận nứt."},
            "warnings": warnings}


def solve_pipe_with_checks(params: dict, *, solver=solve_annular_pipe) -> dict:
    raw = params.get("tcvn")
    if raw is None:
        return solver(params)
    if not isinstance(raw, dict):
        raise ValueError("tcvn phải là một đối tượng JSON.")
    if not _boolean(raw.get("enabled", True), "Bật kiểm tra TCVN"):
        return solver(params)
    config = check_settings(raw)
    sls_params = {**params, "include_check_points": True}
    sls = solver(sls_params)
    # Contact is nonlinear even though concrete is elastic: solve the ULS case,
    # never multiply SLS stresses/displacements after the solve.
    if config["uls_load_factor"] == 1 and config["uls_prestress_factor"] == 1:
        uls = sls
    else:
        uls_params = deepcopy(sls_params)
        factor = config["uls_load_factor"]
        uls_params["pressures"] = [{**p, "pressure": float(p.get("pressure", 0))*factor}
                                   for p in params.get("pressures", [{"boundary": "outer", "pressure": 1e6}])]
        uls_params["nodal_loads"] = [{**p, "force_r": float(p.get("force_r", 0))*factor,
                                     "force_t": float(p.get("force_t", 0))*factor}
                                    for p in params.get("nodal_loads", [])]
        uls_params["prestress"] = float(params.get("prestress", 5e6))*config["uls_prestress_factor"]
        if isinstance(uls_params.get("reinforcement"), dict):
            steel = uls_params["reinforcement"]
            steel["initial_longitudinal_stress"] = float(steel.get("initial_longitudinal_stress", 0))*config["uls_prestress_factor"]
        uls = solver(uls_params)
    sls["tcvn_checks"] = evaluate_checks(sls, uls, params, config)
    if sls.get("reinforcement"):
        from annular_pipe_rc import append_steel_checks
        append_steel_checks(sls["tcvn_checks"], sls, uls)
    for values, element in zip(sls["tcvn_checks"]["element_utilization"], sls["element_results"]):
        element.update({k: v for k, v in values.items() if k != "element_id"})
    return sls
