"""Long pipe cross-section: small-strain Q4 continuum, elastic concrete only.

Q4 interpolation, 2x2 integration and the material matrix follow the continuum
examples in Ref/CIMNE/MAT-fem_v1.3. Coordinates describe the equilibrated,
effectively prestressed reference configuration. All loads, displacements and
reactions are INCREMENTS from that state; only sigma_zz has an initial value.
No steel, stress stiffening, cracking, or design-code checks are included.

SI units: m, Pa, N. Cross-section nodal forces/reactions are N per m of pipe.
Positive pressure pushes into the concrete; positive prestress means compression.
"""

from __future__ import annotations

import math
from typing import Any

import numpy as np
from scipy.linalg import null_space
from scipy.sparse import bmat, coo_matrix, csc_matrix
from scipy.sparse.linalg import splu

from annular_plate_fem import generate_annular_mesh

GAUSS = (-1.0 / math.sqrt(3.0), 1.0 / math.sqrt(3.0))


def _number(value: Any, name: str) -> float:
    result = float(value)
    if not math.isfinite(result):
        raise ValueError(f"{name} phải là số hữu hạn.")
    return result


def _integer(value: Any, name: str, low: int, high: int) -> int:
    result = _number(value, name)
    if not result.is_integer() or not low <= result <= high:
        raise ValueError(f"{name} phải là số nguyên từ {low} đến {high}.")
    return int(result)


def pipe_mesh(params: dict) -> dict:
    ri = _number(params.get("r_inner", 0.8), "r")
    ro = _number(params.get("r_outer", 1.0), "R")
    if not 0 < ri < ro:
        raise ValueError("Cần thỏa mãn 0 < r < R.")
    nr = _integer(params.get("nr", 6), "nr", 1, 40)
    nt = _integer(params.get("ntheta", 96), "nθ", 8, 360)
    if nr * nt > 6000:
        raise ValueError("Lưới tối đa 6000 phần tử cho phiên bản tính cục bộ.")
    mesh = generate_annular_mesh(ri, ro, nr, nt)
    return mesh


def mesh_payload(mesh: dict) -> dict:
    return {"coordinates": mesh["gcoord"].tolist(),
            "elements": (mesh["nodes"] + 1).tolist(),
            "polar": mesh["polar_coord"].tolist(),
            "inner_nodes": [n + 1 for n in mesh["inner_nodes"]],
            "outer_nodes": [n + 1 for n in mesh["outer_nodes"]],
            "nr": mesh["nr"], "ntheta": mesh["ntheta"]}


def _shape(xi: float, eta: float):
    signs = np.array([[-1, -1], [1, -1], [1, 1], [-1, 1]])
    nx = 0.25 * signs[:, 0] * (1 + signs[:, 1] * eta)
    ny = 0.25 * signs[:, 1] * (1 + signs[:, 0] * xi)
    return np.vstack((nx, ny))


def _strain_matrix(xy: np.ndarray, transform: np.ndarray, xi: float, eta: float,
                   axial: bool, length: float):
    derivatives = _shape(xi, eta)
    jacobian = derivatives @ xy
    det = float(np.linalg.det(jacobian))
    if det <= 0:
        raise ValueError("Phần tử có Jacobian không dương.")
    dx, dy = np.linalg.solve(jacobian, derivatives)
    matrix = np.zeros((4, 9 if axial else 8))
    cart = np.zeros((4, 8))
    cart[0, 0::2], cart[1, 1::2] = dx, dy
    cart[2, 0::2], cart[2, 1::2] = dy, dx
    matrix[:, :8] = cart @ transform
    if axial:
        matrix[3, -1] = 1.0 / length
    return matrix, det


def _in_arc(angle: float, start: float, end: float) -> bool:
    if abs(end - start) >= 360 - 1e-9:
        return True
    return (angle - start) % 360 <= (end - start) % 360 + 1e-9


def _arc(spec: dict):
    return (_number(spec.get("start_deg", 0), "Góc đầu"),
            _number(spec.get("end_deg", 360), "Góc cuối"))


def _node(value: Any, count: int) -> int:
    return _integer(value, "Số nút", 1, count) - 1


def _solve_bounds(stiffness, force, lower, upper, rigid):
    """Feasible primal active-set QP, with exact removal of remaining rigid modes.

No springs/pins are added. A force in a remaining rigid mode is advanced until
a unilateral stop is encountered; if none exists, static equilibrium is absent.
"""
    n = len(force)
    fixed = np.isfinite(lower) & (lower == upper)
    bounded = np.isfinite(lower) | np.isfinite(upper)
    state = np.zeros(n, dtype=int)  # -1 lower, +1 upper, 2 prescribed
    state[fixed] = 2
    q = np.zeros(n)
    q[fixed] = lower[fixed]
    for i in np.flatnonzero(bounded & ~fixed):
        if np.isfinite(lower[i]) and (not np.isfinite(upper[i]) or
                                      abs(lower[i]) <= abs(upper[i])):
            q[i], state[i] = lower[i], -1
        else:
            q[i], state[i] = upper[i], 1
    fscale = max(float(np.max(np.abs(force))), 1.0)
    fscale = max(fscale, float(np.max(np.abs(stiffness @ q))))
    ftol = 2e-8 * fscale
    xtol = 1e-11 * max(float(np.max(np.abs(q))), 1.0)
    all_ids = np.arange(n)
    last_gauge = 0.0
    for iteration in range(1, max(100, 6 * int(np.count_nonzero(bounded)) + 50)):
        held, free = all_ids[state != 0], all_ids[state == 0]
        trial = q.copy()
        direction = None
        if len(free):
            kff = stiffness[free, :][:, free].tocsc()
            rhs = force[free] - stiffness[free, :][:, held] @ q[held]
            remaining = null_space(rigid[held, :]) if len(held) else np.eye(rigid.shape[1])
            modes = rigid[free, :] @ remaining
            if modes.shape[1]:
                modes, _ = np.linalg.qr(modes, mode="reduced")
                kkt = bmat([[kff, csc_matrix(modes)],
                            [csc_matrix(modes.T), None]], format="csc")
                rhs_full = np.r_[rhs, modes.T @ q[free]]
            else:
                kkt, rhs_full = kff, rhs
            try:
                solution = splu(kkt).solve(rhs_full)
            except RuntimeError as exc:
                raise ValueError("Hệ suy biến; hãy kiểm tra lưới và liên kết.") from exc
            if not np.all(np.isfinite(solution)):
                raise ValueError("Không tìm được nghiệm hữu hạn.")
            trial[free] = solution[:len(free)]
            if modes.shape[1]:
                multipliers = solution[len(free):]
                last_gauge = float(np.max(np.abs(multipliers)))
                if last_gauge > ftol:
                    direction = np.zeros(n)
                    direction[free] = modes @ multipliers
                    direction /= np.max(np.abs(direction))
            else:
                last_gauge = 0.0

        step = direction if direction is not None else trial - q
        alpha = math.inf if direction is not None else 1.0
        blocker, side = None, 0
        for i in free:
            if step[i] > 1e-16 and np.isfinite(upper[i]):
                candidate = max(0.0, (upper[i] - q[i]) / step[i])
                if candidate < alpha:
                    alpha, blocker, side = candidate, i, 1
            elif step[i] < -1e-16 and np.isfinite(lower[i]):
                candidate = max(0.0, (lower[i] - q[i]) / step[i])
                if candidate < alpha:
                    alpha, blocker, side = candidate, i, -1
        if not math.isfinite(alpha):
            raise ValueError("Tải không thể cân bằng với các gối/chặn đã khai báo "
                             "(còn chuyển động vật rắn không được giữ).")
        q += alpha * step
        if blocker is not None:
            state[blocker] = side
            q[blocker] = upper[blocker] if side == 1 else lower[blocker]
            continue
        residual = stiffness @ q - force
        wrong = np.zeros(n)
        wrong[state == -1] = -residual[state == -1]
        wrong[state == 1] = residual[state == 1]
        release = wrong > ftol
        if np.any(release):
            state[release] = 0
            continue
        violation = max(float(np.max(lower - q)), float(np.max(q - upper)), 0.0)
        if violation > xtol:
            raise RuntimeError("Sai số chuyển vị chặn vượt dung sai.")
        free_error = float(np.max(np.abs(residual[state == 0]), initial=0.0))
        if free_error > 10 * ftol:
            raise RuntimeError("Sai số cân bằng tại bậc tự do tự do vượt dung sai.")
        # Zero-force touching stops must not arbitrarily anchor a freely
        # contracting ring. Choose a centered representative when feasible.
        anchors = fixed | ((state != 0) & (np.abs(residual) > ftol))
        remaining = null_space(rigid[anchors, :]) if np.any(anchors) else np.eye(rigid.shape[1])
        if remaining.shape[1]:
            modes, _ = np.linalg.qr(rigid @ remaining, mode="reduced")
            centered = q - modes @ (modes.T @ q)
            if np.all(centered >= lower - xtol) and np.all(centered <= upper + xtol):
                q = centered
                residual = stiffness @ q - force
                # A touching stop with zero reaction is degenerate; report
                # its geometric active state, not an artificial reaction.
                state[~fixed] = 0
                at_lower = np.isfinite(lower) & (np.abs(q - lower) <= xtol) & ~fixed
                at_upper = np.isfinite(upper) & (np.abs(q - upper) <= xtol) & ~fixed
                state[at_lower], state[at_upper] = -1, 1
                free_error = float(np.max(np.abs(residual[state == 0]), initial=0.0))
        return q, residual, state, iteration, violation, free_error, last_gauge
    raise RuntimeError("Bài toán chặn một chiều chưa hội tụ; hãy kiểm tra liên kết.")


def solve_annular_pipe(params: dict, *, reinforcement=None) -> dict:
    mesh = pipe_mesh(params)
    xy, elements = mesh["gcoord"], mesh["nodes"]
    count, nt = mesh["nnode"], mesh["ntheta"]
    ri, ro = mesh["r_inner"], mesh["r_outer"]
    young = _number(params.get("E", 30e9), "E")
    nu = _number(params.get("nu", 0.2), "ν")
    prestress = _number(params.get("prestress", 5e6), "Nén trước hữu hiệu")
    if young <= 0 or not 0 <= nu < 0.49 or prestress < 0:
        raise ValueError("Cần E > 0, 0 ≤ ν < 0,49 và nén trước hữu hiệu ≥ 0.")
    axial_mode = params.get("axial_mode", "constant_force")
    if axial_mode not in ("constant_force", "fixed_strain"):
        raise ValueError("Điều kiện dọc phải là constant_force hoặc fixed_strain.")
    axial = axial_mode == "constant_force"
    size = 2 * count + int(axial)
    shear = young / (2 * (1 + nu))
    lame = young * nu / ((1 + nu) * (1 - 2 * nu))
    material = np.array([[lame + 2 * shear, lame, 0, lame],
                         [lame, lame + 2 * shear, 0, lame],
                         [0, 0, shear, 0],
                         [lame, lame, 0, lame + 2 * shear]])
    angles = np.deg2rad(mesh["polar_coord"][:, 1])
    cosine, sine = np.cos(angles), np.sin(angles)
    transforms = np.array([[[c, -s], [s, c]] for c, s in zip(cosine, sine)])
    row, col, data = [], [], []
    force = np.zeros(size)
    element_data = []
    area = 0.0
    for ids in elements:
        dofs = np.array([d for node in ids for d in (2 * node, 2 * node + 1)]
                        + ([size - 1] if axial else []))
        transform = np.zeros((8, 8))
        for j, node in enumerate(ids):
            transform[2*j:2*j+2, 2*j:2*j+2] = transforms[node]
        points = xy[ids]
        ke = np.zeros((len(dofs), len(dofs)))
        for xi in GAUSS:
            for eta in GAUSS:
                b, det = _strain_matrix(points, transform, xi, eta, axial, ro)
                ke += b.T @ material @ b * det
                area += det
        row.extend(np.repeat(dofs, len(dofs)))
        col.extend(np.tile(dofs, len(dofs)))
        data.extend(ke.ravel())
        element_data.append((dofs, transform, points))
    stiffness = coo_matrix((data, (row, col)), shape=(size, size)).tocsr()
    if reinforcement is not None:
        stiffness += reinforcement.assemble(mesh, element_data, axial, ro)

    resolved_pressures = []
    for spec in params.get("pressures", [{"boundary": "outer", "pressure": 1e6}]):
        boundary = spec.get("boundary", "outer")
        if boundary not in ("inner", "outer"):
            raise ValueError("Áp lực phải đặt trên biên inner hoặc outer.")
        pressure = _number(spec.get("pressure", 0), "Áp lực")
        start, end = _arc(spec)
        offset = 0 if boundary == "inner" else mesh["nr"] * nt
        edges = 0
        for j in range(nt):
            if not _in_arc((j + 0.5) * 360 / nt, start, end):
                continue
            a, b = offset + j, offset + (j + 1) % nt
            edge = xy[b] - xy[a]
            outward = np.array([edge[1], -edge[0]])
            if boundary == "inner":
                outward = -outward
            # Consistent load on each straight Q4 boundary segment.
            for node in (a, b):
                force[2*node:2*node+2] += transforms[node].T @ (-pressure * outward / 2)
            edges += 1
        if not edges:
            raise ValueError("Cung đặt áp lực không chứa cạnh nào; hãy tăng nθ hoặc mở rộng cung.")
        resolved_pressures.append({**spec, "edge_count": edges})
    for spec in params.get("nodal_loads", []):
        node = _node(spec.get("node_id"), count)
        force[2*node] += _number(spec.get("force_r", 0), "Lực hướng tâm")
        force[2*node+1] += _number(spec.get("force_t", 0), "Lực tiếp tuyến")

    lower, upper = np.full(size, -np.inf), np.full(size, np.inf)
    resolved_supports = []
    for spec in params.get("supports", []):
        target = spec.get("target", "node")
        if target == "node":
            selected = [_node(spec.get("node_id"), count)]
        elif target in ("inner", "outer", "both"):
            start, end = _arc(spec)
            candidates = (mesh["inner_nodes"] + mesh["outer_nodes"] if target == "both"
                          else mesh[target + "_nodes"])
            selected = [n for n in candidates if _in_arc(math.degrees(angles[n]), start, end)]
        else:
            raise ValueError("Đối tượng gối phải là node, inner, outer hoặc both.")
        if not selected:
            raise ValueError("Cung khai báo gối không chứa nút nào.")
        direction, kind = spec.get("direction", "r"), spec.get("kind", "upper")
        if direction not in ("r", "t") or kind not in ("fixed", "lower", "upper"):
            raise ValueError("Gối cần phương r/t và kiểu fixed/lower/upper.")
        value = _number(spec.get("value", 0), "Chuyển vị gối")
        for node in selected:
            dof = 2 * node + int(direction == "t")
            if kind in ("fixed", "lower"):
                lower[dof] = max(lower[dof], value)
            if kind in ("fixed", "upper"):
                upper[dof] = min(upper[dof], value)
        resolved_supports.append({**spec, "node_ids": [n + 1 for n in selected]})
    if np.any(lower > upper):
        raise ValueError("Các điều kiện chuyển vị mâu thuẫn tại cùng nút/phương.")
    rigid = np.zeros((size, 3))
    rigid[0:2*count:2, :2] = np.c_[cosine, sine]
    rigid[1:2*count:2, :2] = np.c_[-sine, cosine]
    rigid[1:2*count:2, 2] = mesh["polar_coord"][:, 0] / ro
    q, residual, states, iterations, penetration, free_error, gauge = _solve_bounds(
        stiffness, force, lower, upper, rigid)
    polar_u = q[:2*count].reshape(-1, 2)
    cart_u = np.einsum("nij,nj->ni", transforms, polar_u)
    polar_reactions = residual[:2*count].reshape(-1, 2)
    cart_reactions = np.einsum("nij,nj->ni", transforms, polar_reactions)
    cart_loads = np.einsum("nij,nj->ni", transforms, force[:2*count].reshape(-1, 2))

    def stress_at(element_id, xi, eta):
        dofs, transform, points = element_data[element_id]
        b, det = _strain_matrix(points, transform, xi, eta, axial, ro)
        delta = material @ (b @ q[dofs])
        shape = 0.25 * np.array([(1-xi)*(1-eta), (1+xi)*(1-eta),
                                 (1+xi)*(1+eta), (1-xi)*(1+eta)])
        x, y = shape @ points
        angle = math.atan2(y, x)
        c, s = math.cos(angle), math.sin(angle)
        sx, sy, tau, sz = delta
        sr = c*c*sx + s*s*sy + 2*c*s*tau
        st = s*s*sx + c*c*sy - 2*c*s*tau
        rt = c*s*(sy-sx) + (c*c-s*s)*tau
        return {"x": float(x), "y": float(y), "radius": math.hypot(x, y),
                "sigma_r": float(sr), "sigma_theta": float(st), "tau_rt": float(rt),
                "delta_sigma_z": float(sz), "sigma_z": float(sz - prestress)}, det

    records, gauss_records, check_points = [], [], []
    axial_increment = 0.0
    for k in range(len(elements)):
        center, _ = stress_at(k, 0, 0)
        records.append({"element_id": k + 1, **center})
        for gx, xi in enumerate(GAUSS):
            for gy, eta in enumerate(GAUSS):
                stress, det = stress_at(k, xi, eta)
                gauss_records.append({"element_id": k + 1, "point_id": f"G{2*gx+gy+1}", **stress})
                axial_increment += stress["delta_sigma_z"] * det
        if params.get("include_check_points", False):
            # Surface/corner samples catch bending peaks missed by Gauss
            # centers. They remain element-side values, not smoothed stresses.
            for corner, (xi, eta) in enumerate(((-1, -1), (1, -1), (1, 1), (-1, 1))):
                stress, _ = stress_at(k, xi, eta)
                check_points.append({"element_id": k+1, "point_id": f"C{corner+1}", **stress})
    sections = []
    thickness = (ro - ri) * math.cos(math.pi / nt)
    midpoint = (ro + ri) / 2 * math.cos(math.pi / nt)
    for j in range(nt):
        section = {"theta_deg": (j + 0.5) * 360 / nt,
                   "N_theta": 0.0, "M_theta": 0.0, "Q_theta": 0.0,
                   "delta_N_z": 0.0, "N_z": 0.0, "M_z": 0.0,
                   "N_z_initial": -prestress * thickness}
        for i in range(mesh["nr"]):
            k = i * nt + j
            points = element_data[k][2]
            for xi in GAUSS:
                stress, _ = stress_at(k, xi, 0)
                ds = float(np.linalg.norm(_shape(xi, 0)[0] @ points))
                lever = stress["radius"] - midpoint
                section["N_theta"] += stress["sigma_theta"] * ds
                section["M_theta"] += stress["sigma_theta"] * lever * ds
                section["Q_theta"] += stress["tau_rt"] * ds
                section["delta_N_z"] += stress["delta_sigma_z"] * ds
                section["N_z"] += stress["sigma_z"] * ds
                section["M_z"] += stress["sigma_z"] * lever * ds
        sections.append(section)
    net = (cart_loads + cart_reactions).sum(axis=0)
    moment = float(np.sum(xy[:, 0] * (cart_loads[:, 1] + cart_reactions[:, 1])
                          - xy[:, 1] * (cart_loads[:, 0] + cart_reactions[:, 0])))
    finite_bound = np.isfinite(lower) | np.isfinite(upper)
    reactions = []
    for node in range(count):
        if np.any(finite_bound[2*node:2*node+2]):
            reactions.append({"node_id": node + 1,
                              "reaction_r": float(polar_reactions[node, 0]),
                              "reaction_t": float(polar_reactions[node, 1]),
                              "state_r": int(states[2*node]),
                              "state_t": int(states[2*node+1])})
    result = {"model": {"type": "long_pipe_cross_section_q4", "axial_mode": axial_mode,
                       "reference": "equilibrated_effectively_prestressed",
                       "units": "m, Pa, N; nodal loads/reactions N/m; N-resultants N/m; M-resultants N",
                       "assumptions": ["Bê tông đàn hồi tuyến tính; chưa xét cốt thép, tính sau nứt và kiểm tra TTGH đầy đủ.",
                                       "Tải và gối bất biến dọc ống; không xét mất ổn định dọc trục.",
                                       "Gia số tính từ trạng thái nén trước hữu hiệu đã cân bằng; không tính tổn hao.",
                                       "Chưa xét độ cứng hình học; nén trước chỉ cộng vào ứng suất/nội lực tổng.",
                                       "Biên tròn được xấp xỉ bằng các cạnh thẳng Q4; nội lực tích phân trên lưới này."]},
            "mesh": mesh_payload(mesh), "element_results": records,
            "gauss_results": gauss_records, "sections": sections,
            **({"check_points": gauss_records + check_points} if check_points else {}),
            "nodal": {"u_r": polar_u[:, 0].tolist(), "u_t": polar_u[:, 1].tolist(),
                      "u_x": cart_u[:, 0].tolist(), "u_y": cart_u[:, 1].tolist()},
            "reactions": reactions, "resolved_supports": resolved_supports,
            "resolved_pressures": resolved_pressures,
            "summary": {"nnode": count, "nel": len(elements), "mesh_area": area,
                        "nominal_area": math.pi * (ro*ro - ri*ri),
                        "section_thickness": thickness, "prestress": prestress,
                        "axial_force_initial": -prestress * area,
                        "axial_force_increment": float(axial_increment),
                        "axial_force_total": float(axial_increment - prestress * area),
                        "delta_epsilon_z": float(q[-1] / ro) if axial else 0.0,
                        "u_max": float(np.max(np.linalg.norm(cart_u, axis=1))),
                        "u_r_min": float(np.min(polar_u[:, 0])),
                        "u_r_max": float(np.max(polar_u[:, 0])),
                        "sigma_theta_min": min(s["sigma_theta"] for s in gauss_records),
                        "sigma_z_min": min(s["sigma_z"] for s in gauss_records),
                        "contact_iterations": iterations,
                        "active_unilateral_dofs": int(np.count_nonzero((states == -1) | (states == 1))),
                        "bound_violation": penetration, "free_residual": free_error,
                        "rigid_gauge_force": gauge,
                        "force_balance_x": float(net[0]), "force_balance_y": float(net[1]),
                        "moment_balance": moment,
                        "strain_energy_increment": float(0.5 * q @ (stiffness @ q))}}
    if reinforcement is not None:
        reinforcement.augment(result, q, mesh)
    return result
