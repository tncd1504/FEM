"""Elastic, perfectly bonded reinforcement for the long-pipe cross-section.

Hoops: embedded uniaxial lines, area per unit axial length Ah/pitch, integrated
inside Q4 host elements. Longitudinal bars: axial uniaxial members coupled to
the generalized plane-strain DOF. No steel Poisson effect or bar bending.

Steel stiffness is ADDED to the gross concrete domain (embedded approximation;
displaced concrete is not deducted). Initial longitudinal steel stress is an
independent input in the already-equilibrated reference state, not inferred
from effective concrete prestress. Initial hoop stress is zero. No bond slip,
steel yielding, crack development or automatic confinement enhancement.
"""
from __future__ import annotations

import math

import numpy as np
from scipy.sparse import coo_matrix

from annular_pipe_fem import GAUSS, _integer, _number, _shape, _strain_matrix, solve_annular_pipe
from tcvn5574_checks import _row, solve_pipe_with_checks

# TCVN 5574:2018 tables 12/13/14: Rsn, Rs, Rsc(long), Rsw, max diameter mm.
STEELS = {"CB240-T": (240, 210, 210, 170, 40),
          "CB300-T": (300, 260, 260, 210, 40),
          "CB300-V": (300, 260, 260, 210, 50),
          "CB400-V": (400, 350, 350, 280, 50),
          "CB500-V": (500, 435, 435, 300, 50)}


def steel_catalog():
    return {"standard": "TCVN 5574:2018", "clauses": "Bảng 12, 13, 14; 6.2.2.2",
            "grades": {name: {"Rsn_MPa": v[0], "Rs_MPa": v[1], "Rsc_short_MPa": min(v[2], 400),
                                "Rsc_long_MPa": v[2], "Rsw_MPa": v[3]} for name, v in STEELS.items()}}


class EmbeddedCage:
    def __init__(self, params):
        raw = params.get("reinforcement", {})
        if not isinstance(raw, dict):
            raise ValueError("reinforcement phải là một đối tượng JSON.")
        self.count = _integer(raw.get("longitudinal_count", 12), "Số thanh thép dọc", 0, 200)
        self.dl = _number(raw.get("longitudinal_diameter", .012), "Đường kính thép dọc")
        self.dh = _number(raw.get("hoop_diameter", .006), "Đường kính thép đai")
        self.pitch = _number(raw.get("hoop_pitch", .1), "Bước thép đai")
        self.cover = _number(raw.get("cover", .03), "Lớp bảo vệ tới mép ngoài đai")
        self.young = _number(raw.get("E_s", 200e9), "Es")
        self.initial = _number(raw.get("initial_longitudinal_stress", 0), "Ứng suất thép dọc ban đầu")
        self.rotation = _number(raw.get("longitudinal_start_deg", 0), "Góc thanh thép dọc đầu tiên")
        self.grade_l, self.grade_h = raw.get("longitudinal_grade", "CB400-V"), raw.get("hoop_grade", "CB240-T")
        if self.grade_l not in STEELS or self.grade_h not in STEELS:
            raise ValueError("Chỉ hỗ trợ các cấp thép thường trong danh mục; chưa mô hình cáp không bám dính.")
        if self.young <= 0 or self.cover < 0 or self.dh < 0 or self.dl < 0 or self.pitch <= 0:
            raise ValueError("Cần Es > 0, bước đai > 0, lớp bảo vệ và đường kính không âm.")
        if self.dh and self.pitch < self.dh:
            raise ValueError("Bước đai nhỏ hơn đường kính đai làm các vòng đai chồng lấn.")
        for diameter, grade in ((self.dl if self.count else 0, self.grade_l), (self.dh, self.grade_h)):
            if diameter and not .006 <= diameter <= STEELS[grade][4]/1000:
                raise ValueError("Đường kính thép thường phải trong phạm vi Bảng 12 (tối thiểu 6 mm).")
        if self.count and not self.dl:
            raise ValueError("Thép dọc có số thanh > 0 cần đường kính > 0.")
        if not self.count and self.initial:
            raise ValueError("Không có thép dọc thì không được khai báo ứng suất ban đầu trong thép dọc.")
        self.al = math.pi*self.dl**2/4 if self.count else 0.0
        self.ah = math.pi*self.dh**2/(4*self.pitch)
        self.has_steel = bool(self.count or self.dh)

    def assemble(self, mesh, element_data, axial, ro):
        self.axial, self.ro, self.nt = axial, ro, mesh["ntheta"]
        size = 2*mesh["nnode"] + int(axial)
        ri, dr = mesh["r_inner"], (ro-mesh["r_inner"])/mesh["nr"]
        self.rh = ro-self.cover-self.dh/2
        self.rl = ro-self.cover-self.dh-self.dl/2
        if self.dh and not ri < self.rh-self.dh/2 < self.rh+self.dh/2 <= ro:
            raise ValueError("Lớp đai không nằm hoàn toàn trong thành bê tông.")
        if self.count and not ri < self.rl-self.dl/2 < self.rl+self.dl/2 <= ro:
            raise ValueError("Lớp thép dọc không nằm hoàn toàn trong thành bê tông.")
        if self.count > 1 and 2*self.rl*math.sin(math.pi/self.count) < self.dl:
            raise ValueError("Các thanh thép dọc chồng lấn; giảm số thanh hoặc đường kính.")
        self.samples, self.centers = [], []
        rows, cols, data = [], [], []
        self.hoop_length = 0.0
        if self.dh:
            ir = min(int((self.rh-ri)/dr), mesh["nr"]-1)
            xi = 2*(self.rh-(ri+ir*dr))/dr-1
            for j in range(self.nt):
                element_id = ir*self.nt+j
                dofs, transform, xy = element_data[element_id]
                ke = np.zeros((len(dofs), len(dofs)))
                for eta in (*GAUSS, 0.0):
                    b, _ = _strain_matrix(xy, transform, xi, eta, axial, ro)
                    tangent = _shape(xi, eta)[1] @ xy
                    ds = float(np.linalg.norm(tangent))
                    nx, ny = tangent/ds
                    bs = np.array([nx*nx, ny*ny, nx*ny, 0.0]) @ b
                    sample = {"element_id": element_id+1, "sector": j,
                              "dofs": dofs, "B": bs, "ds": ds}
                    if eta == 0:
                        self.centers.append(sample)
                    else:
                        self.samples.append(sample)
                        self.hoop_length += ds
                        ke += self.young*self.ah*ds*np.outer(bs, bs)
                rows.extend(np.repeat(dofs, len(dofs)))
                cols.extend(np.tile(dofs, len(dofs)))
                data.extend(ke.ravel())
        if axial and self.count:
            rows.append(size-1); cols.append(size-1)
            data.append(self.young*self.al*self.count/(ro*ro))
        self.stiffness = coo_matrix((data, (rows, cols)), shape=(size, size)).tocsr()
        return self.stiffness

    def augment(self, result, q, mesh):
        ez = float(q[-1]/self.ro) if self.axial else 0.0
        delta_sz = self.young*ez
        total_sz = self.initial+delta_sz
        hoops = []
        for sample in self.samples:
            strain = float(sample["B"] @ q[sample["dofs"]])
            hoops.append({"element_id": sample["element_id"], "sector": sample["sector"],
                          "strain_increment": strain, "stress_increment": self.young*strain,
                          "stress_total": self.young*strain})
        bars = [{"bar_id": j+1, "theta_deg": (self.rotation+j*360/self.count) % 360,
                 "radius": self.rl, "strain_increment": ez, "initial_stress": self.initial,
                 "stress_increment": delta_sz, "stress_total": total_sz,
                 "force_per_bar": total_sz*self.al} for j in range(self.count)]
        # Longitudinal forces are smeared over the polygonal midsurface
        # circumference for reporting Nz/Mz; exact total axial forces are below.
        radius_mid = (mesh["r_inner"]+self.ro)/2
        perimeter_mid = 2*self.nt*radius_mid*math.sin(math.pi/self.nt)
        longitudinal_area_per_length = self.count*self.al/perimeter_mid
        cos_half = math.cos(math.pi/self.nt)
        for j, section in enumerate(result["sections"]):
            for key in ("N_theta", "M_theta", "N_z", "M_z", "delta_N_z", "N_z_initial"):
                section[key+"_concrete"] = section[key]
            nh = 0.0
            if self.dh:
                center = self.centers[j]
                nh = self.young*float(center["B"] @ q[center["dofs"]])*self.ah
            section["N_theta_steel"] = nh
            section["M_theta_steel"] = nh*(self.rh-radius_mid)*cos_half
            section["N_z_steel"] = total_sz*longitudinal_area_per_length
            section["M_z_steel"] = section["N_z_steel"]*(self.rl-radius_mid)*cos_half
            section["N_theta"] += section["N_theta_steel"]
            section["M_theta"] += section["M_theta_steel"]
            section["N_z"] += section["N_z_steel"]
            section["M_z"] += section["M_z_steel"]
            section["delta_N_z"] += delta_sz*longitudinal_area_per_length
            section["N_z_initial"] += self.initial*longitudinal_area_per_length
        summary = result["summary"]
        for key in ("axial_force_initial", "axial_force_increment", "axial_force_total"):
            summary[key+"_concrete"] = summary[key]
        p0, dp = self.initial*self.al*self.count, delta_sz*self.al*self.count
        summary["axial_force_initial_steel"] = p0
        summary["axial_force_increment_steel"] = dp
        summary["axial_force_total_steel"] = p0+dp
        summary["axial_force_initial"] += p0
        summary["axial_force_increment"] += dp
        summary["axial_force_total"] += p0+dp
        steel_energy = float(.5*q @ (self.stiffness @ q))
        summary["strain_energy_increment_steel"] = steel_energy
        summary["strain_energy_increment_concrete"] = summary["strain_energy_increment"]-steel_energy
        result["model"]["type"] = "long_pipe_reinforced_elastic_q4"
        result["model"]["assumptions"][0] = "Bê tông và thép đàn hồi, bám dính hoàn toàn; chưa giải sau nứt/chảy thép."
        result["model"]["assumptions"].extend([
            "Thép đai là đường một trục nhúng Q4, diện tích quy đổi Ah/bước đai; chưa xét đai xoắn có góc nghiêng.",
            "Thép dọc dùng cùng gia số biến dạng dọc; không có uốn dọc/biến dạng trượt bám dính trong mô hình bất biến z.",
            "Cộng độ cứng thép vào bê tông toàn miền; chưa trừ thể tích bê tông bị thép chiếm chỗ.",
            "Ứng suất thép dọc ban đầu nhập độc lập, không suy từ nén trước bê tông; ứng suất đai ban đầu bằng 0."])
        result["reinforcement"] = {"has_steel": self.has_steel,
            "geometry": {"hoop_radius": self.rh, "longitudinal_radius": self.rl,
                         "hoop_diameter": self.dh, "hoop_pitch": self.pitch,
                         "longitudinal_count": self.count, "longitudinal_diameter": self.dl,
                         "cover": self.cover, "longitudinal_start_deg": self.rotation},
            "material": {"E_s": self.young, "hoop_grade": self.grade_h, "longitudinal_grade": self.grade_l,
                         "initial_longitudinal_stress": self.initial},
            "summary": {"hoop_area_per_axial_length": self.ah,
                        "longitudinal_area": self.al*self.count,
                        "hoop_modeled_length": self.hoop_length,
                        "total_steel_volume_per_axial_length": self.ah*self.hoop_length+self.al*self.count,
                        "delta_epsilon_longitudinal": ez},
            "hoop_results": hoops, "longitudinal_results": bars,
            "section_convention": "Thép dọc phân bố đều trên chu vi đa giác mặt trung bình khi xuất Nz/Mz; tổng lực dọc tính trực tiếp từ từng thanh."}


def solve_reinforced_pipe(params):
    return solve_annular_pipe(params, reinforcement=EmbeddedCage(params))


def append_steel_checks(checks, sls, uls):
    rows = checks["rows"]
    duration = checks["settings"]["duration"]
    yielded = False
    for family, title, grade_name in (("hoop_results", "Đai — ứng suất dọc thanh", "hoop_grade"),
                                      ("longitudinal_results", "Thép dọc", "longitudinal_grade")):
        grade = sls["reinforcement"]["material"][grade_name]
        rsn, rs, rsc, _, _ = STEELS[grade]
        rsc = min(rsc, 400) if duration == "short" else rsc
        for case, model in (("ULS", uls), ("SLS", sls)):
            points = model["reinforcement"][family]
            if not points:
                continue
            for compression in (False, True):
                sign = -1 if compression else 1
                limit = (rsc if compression else rs)*1e6 if case == "ULS" else rsn*1e6
                point = max(points, key=lambda p: max(0, sign*p["stress_total"]))
                demand = max(0, sign*point["stress_total"])
                critical = {"element_id": point["element_id"], "point_id": "Thép đai"} if "element_id" in point else {"bar_id": point["bar_id"], "theta_deg": point["theta_deg"]}
                rows.append(_row(f"{case.lower()}_{family}_{'compression' if compression else 'tension'}",
                                 "TTGH1" if case == "ULS" else "TTGH2",
                                 title+(" — nén" if compression else " — kéo"), demand, limit, "Pa",
                                 "6.2.2.2; Bảng 12, 13", critical=critical,
                                 note="Kiểm tra ứng suất đàn hồi dọc thanh. Chưa tính sức kháng tiết diện sau nứt; Rsw không dùng thay Rs cho lực vòng trực tiếp."))
                yielded |= case == "SLS" and demand > rsn*1e6
    if yielded:
        checks["deformation"]["elastic_uncracked_short_term"] = False
        for row in rows:
            if row["id"] in ("sls_radial", "sls_diameter"):
                row["status"] = "not_assessed"
                row["note"] += " Thép vượt ngưỡng đàn hồi: cần mô hình vật liệu phi tuyến."
    checks["summary_status"] = "exceeded" if any(r["status"] == "exceeded" for r in rows) else "incomplete"
    checks["warnings"].append("Có xét độ cứng và ứng suất thép; chưa xét chảy thép, trượt bám dính, bề rộng nứt hoặc tăng sức bền do đai bó bê tông.")


def solve_reinforced_with_checks(params):
    result = solve_pipe_with_checks(params, solver=solve_reinforced_pipe)
    if params.get("compare_plain", True):
        bare = solve_annular_pipe(params)
        result["comparison_plain"] = {"summary": bare["summary"],
            "displacement_change_percent": 100*(result["summary"]["u_max"]/bare["summary"]["u_max"]-1) if bare["summary"]["u_max"] else 0.0,
            "note": "Cùng tải/gối và nén trước bê tông; bỏ độ cứng và ứng suất ban đầu của thép để đối chiếu gia số."}
    return result
