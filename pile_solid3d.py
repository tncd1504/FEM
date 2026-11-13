"""Finite hollow pile: 3D hexahedra, incompatible modes, unilateral saddle pads.

H8 interpolation/quadrature follows Ref/CIMNE/MAT-fem3D_v1.2/HeStif3D_v1_2.m.
The optional 13 enhanced-strain modes are orthogonal to constant stress and
statically condensed (small-strain Simo/Rifai formulation). This is not an
axisymmetric or beam model. Initial effective concrete stress is an equilibrated
reference stress, added once to stress recovery, without geometric stiffness.
"""
from __future__ import annotations

from functools import lru_cache
import itertools
import math

import numpy as np
from scipy.sparse import block_diag, coo_matrix

from annular_pipe_fem import _integer, _number, _solve_bounds
from tcvn5574_checks import CONCRETE


SIGNS = np.array([[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
                  [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]], dtype=float)
GP = tuple(itertools.product((-1 / math.sqrt(3), 1 / math.sqrt(3)), repeat=3))


def shape(point):
    factors = 1 + SIGNS * np.asarray(point)
    n = np.prod(factors, axis=1) / 8
    derivatives = np.array([SIGNS[:, i] * np.prod(factors[:, [j for j in range(3) if j != i]], axis=1) / 8
                            for i in range(3)])
    return n, derivatives


def strain_matrix(grad):
    b = np.zeros((6, 3 * grad.shape[1]))
    dx, dy, dz = grad
    b[0, 0::3], b[1, 1::3], b[2, 2::3] = dx, dy, dz
    b[3, 0::3], b[3, 1::3] = dy, dx
    b[4, 0::3], b[4, 2::3] = dz, dx
    b[5, 1::3], b[5, 2::3] = dz, dy
    return b


def constitutive(young, nu):
    mu = young / (2 * (1 + nu))
    lam = young * nu / ((1 + nu) * (1 - 2 * nu))
    d = np.zeros((6, 6))
    d[:3, :3] = lam
    d[np.arange(3), np.arange(3)] += 2 * mu
    d[3:, 3:] = np.eye(3) * mu
    return d


def element_operators(xyz, material, enhanced=True):
    """Cartesian element stiffness plus exact strain recovery at arbitrary points."""
    _, dn0 = shape((0, 0, 0))
    j0 = dn0 @ xyz
    det0 = float(np.linalg.det(j0))
    if det0 <= 0:
        raise ValueError("Phần tử khối có Jacobian không dương.")
    inverse0 = np.linalg.inv(j0)

    def operators(point):
        n, derivatives = shape(point)
        jac = derivatives @ xyz
        det = float(np.linalg.det(jac))
        if det <= 0:
            raise ValueError("Phần tử khối bị đảo hoặc suy biến.")
        b = strain_matrix(np.linalg.solve(jac, derivatives))
        if not enhanced:
            return n, b, np.zeros((6, 0)), det
        xi, eta, zeta = point
        g = np.zeros((6, 13))
        g[:, :9] = strain_matrix(inverse0 * np.asarray(point)[None, :]) * det0 / det
        g[:3, 9:] = np.array([xi * eta, xi * zeta, eta * zeta, xi * eta * zeta])[None, :] * det0 / det
        return n, b, g, det

    kuu, kua, kaa = np.zeros((24, 24)), np.zeros((24, 13)), np.zeros((13, 13))
    weights = np.zeros(8)
    for point in GP:
        n, b, g, det = operators(point)
        kuu += b.T @ material @ b * det
        weights += n * det
        if enhanced:
            kua += b.T @ material @ g * det
            kaa += g.T @ material @ g * det
    recovery = -np.linalg.solve(kaa, kua.T) if enhanced else np.zeros((0, 24))
    stiffness = kuu + kua @ recovery if enhanced else kuu
    stiffness = .5 * (stiffness + stiffness.T)

    def effective(point):
        n, b, g, det = operators(point)
        return n, b + g @ recovery, det

    return stiffness, effective, weights


def _boolean(value, title):
    if not isinstance(value, bool):
        raise ValueError(f"{title} phải là true hoặc false.")
    return value


def settings(params):
    if not isinstance(params, dict):
        raise ValueError("Dữ liệu phải là một đối tượng JSON.")
    c = {key: _number(params.get(key, default), key) for key, default in
         (("r_outer", .3), ("r_inner", .2), ("length", 12.), ("E", 39.5e9),
          ("nu", .2), ("prestress", 5e6), ("support_width", .3), ("support_arc_deg", 30.),
          ("outer_pressure", 0.), ("density", 2500.))}
    if not 0 < c["r_inner"] < c["r_outer"] or c["length"] <= 0 or c["E"] <= 0:
        raise ValueError("Cần 0 < r < R, chiều dài và E lớn hơn 0.")
    if not 0 <= c["nu"] < .49 or c["prestress"] < 0 or c["density"] < 0:
        raise ValueError("Cần 0 ≤ ν < 0,49; nén trước và khối lượng riêng không âm.")
    c.update(nr=_integer(params.get("nr", 2), "nr", 1, 8),
             ntheta=_integer(params.get("ntheta", 48), "nθ", 12, 144),
             nz=_integer(params.get("nz", 40), "nz", 4, 200))
    fractions = params.get("support_fractions", [.2, .8])
    if not isinstance(fractions, list) or len(fractions) not in (0, 2):
        raise ValueError("Nhập hai vị trí gối theo tỷ lệ chiều dài.")
    c["support_fractions"] = [_number(f, "Vị trí gối") for f in fractions]
    if fractions and not 0 < c["support_fractions"][0] < c["support_fractions"][1] < 1:
        raise ValueError("Vị trí hai gối phải thỏa 0 < a < b < 1.")
    if not 0 <= c["support_width"] < c["length"] or not 0 < c["support_arc_deg"] <= 120:
        raise ValueError("Bề rộng gối không âm, nhỏ hơn L; cung tiếp xúc từ trên 0° đến 120°.")
    centers = np.array(c["support_fractions"]) * c["length"]
    half = c["support_width"] / 2
    if len(centers) and (centers[0] - half < 0 or centers[-1] + half > c["length"] or centers[1] - centers[0] <= 2 * half):
        raise ValueError("Miền gối phải nằm trong cọc và không chồng nhau.")
    c["side_stops"] = _boolean(params.get("side_stops", False), "Chặn hai bên")
    c["support_shape"] = params.get("support_shape", "flat")
    if c["support_shape"] not in ("flat", "saddle"):
        raise ValueError("Gối phải là flat (phẳng) hoặc saddle (yên ôm cung).")
    c["self_weight"] = _boolean(params.get("self_weight", False), "Tự trọng")
    c["element_type"] = params.get("element_type", "H8_EAS")
    if c["element_type"] not in ("H8_EAS", "H8_FULL"):
        raise ValueError("Chọn H8_EAS hoặc H8_FULL.")
    c["grade"] = str(params.get("grade", "B60")).upper()
    if c["grade"] not in CONCRETE:
        raise ValueError("Cấp bê tông không có trong danh mục TCVN.")
    raw_loads = params.get("line_loads", [{"angle_deg": 60, "value": 20000}, {"angle_deg": 120, "value": 20000}])
    if not isinstance(raw_loads, list) or len(raw_loads) > 20:
        raise ValueError("Nhập tối đa 20 lực đường dọc cọc.")
    c["line_loads"] = [{"angle_deg": _number(v.get("angle_deg", 0), "Góc tải") % 360,
                        "value": _number(v.get("value", 0), "Lực đường")} for v in raw_loads]
    return c


def make_mesh(params):
    c = settings(params)
    angles = list(np.arange(c["ntheta"]) * 360 / c["ntheta"])
    angles += [v["angle_deg"] for v in c["line_loads"]] + [0., 90., 180., 270.]
    angles += [270 - c["support_arc_deg"] / 2, 270 + c["support_arc_deg"] / 2]
    angles = np.array(sorted(set(round(a % 360, 10) for a in angles)))
    zs = list(np.linspace(0, c["length"], c["nz"] + 1))
    for fraction in c["support_fractions"]:
        center = fraction * c["length"]
        zs += [center - c["support_width"] / 2, center, center + c["support_width"] / 2]
    zs = np.array(sorted(set(round(z, 10) for z in zs)))
    nt, nz = len(angles), len(zs) - 1
    radii = np.linspace(c["r_inner"], c["r_outer"], c["nr"] + 1)
    nplane = (c["nr"] + 1) * nt
    if nplane * len(zs) > 16000 or c["nr"] * nt * nz > 12000:
        raise ValueError("Lưới quá lớn cho máy chủ cục bộ: giới hạn 16.000 nút và 12.000 phần tử.")
    xy = np.array([(r * math.cos(math.radians(a)), r * math.sin(math.radians(a))) for r in radii for a in angles])
    xyz = np.array([(x, y, z) for z in zs for x, y in xy])
    cells, labels = [], []
    for k in range(nz):
        for ir in range(c["nr"]):
            for j in range(nt):
                bottom = [k * nplane + ir * nt + j, k * nplane + (ir + 1) * nt + j,
                          k * nplane + (ir + 1) * nt + (j + 1) % nt, k * nplane + ir * nt + (j + 1) % nt]
                cells.append(bottom + [n + nplane for n in bottom])
                labels.append((k, ir, j))
    angle_node = np.tile(np.tile(np.deg2rad(angles), c["nr"] + 1), len(zs))
    co, si = np.cos(angle_node), np.sin(angle_node)
    transforms = np.zeros((len(xyz), 3, 3))
    transforms[:, 0, 0], transforms[:, 0, 1] = co, -si
    transforms[:, 1, 0], transforms[:, 1, 1], transforms[:, 2, 2] = si, co, 1
    pads = []
    for index, fraction in enumerate(c["support_fractions"]):
        center = fraction * c["length"]
        indices = [k * nplane + c["nr"] * nt + j for k, z in enumerate(zs)
                   if abs(z - center) <= c["support_width"] / 2 + 1e-9
                   for j, a in enumerate(angles) if abs(a - 270) <= c["support_arc_deg"] / 2 + 1e-9]
        pads.append({"name": "AB"[index], "center_z": center, "fraction": fraction,
                     "width": c["support_width"], "node_ids": [n + 1 for n in indices]})
    return {"settings": c, "coordinates": xyz, "elements": np.array(cells), "labels": labels,
            "angles": angles, "z_planes": zs, "nplane": nplane, "transforms": transforms, "supports": pads,
            "ntheta": nt, "nr": c["nr"], "nz": nz, "nnode": len(xyz), "nel": len(cells)}


def mesh_payload(mesh):
    return {key: mesh[key] for key in ("nnode", "nel", "nr", "ntheta", "nz", "nplane", "supports")} | {
        "coordinates": mesh["coordinates"].tolist(), "elements": (mesh["elements"] + 1).tolist(),
        "angles": mesh["angles"].tolist(), "z_planes": mesh["z_planes"].tolist(), "settings": mesh["settings"]}


def _tensor(stress):
    s = np.asarray(stress)
    out = np.zeros(s.shape[:-1] + (3, 3))
    out[..., 0, 0], out[..., 1, 1], out[..., 2, 2] = s[..., 0], s[..., 1], s[..., 2]
    out[..., 0, 1] = out[..., 1, 0] = s[..., 3]
    out[..., 0, 2] = out[..., 2, 0] = s[..., 4]
    out[..., 1, 2] = out[..., 2, 1] = s[..., 5]
    return out


def _global_stress(stress, angle):
    xx, yy, zz, xy, xz, yz = stress
    co, si = math.cos(angle), math.sin(angle)
    return np.array([co * co * xx + si * si * yy - 2 * co * si * xy,
                     si * si * xx + co * co * yy + 2 * co * si * xy, zz,
                     co * si * (xx - yy) + (co * co - si * si) * xy,
                     co * xz - si * yz, si * xz + co * yz])


def solve_pile_solid3d(params):
    mesh = make_mesh(params)
    c, xyz, elements = mesh["settings"], mesh["coordinates"], mesh["elements"]
    nt, nr, nz, npn = mesh["ntheta"], mesh["nr"], mesh["nz"], mesh["nplane"]
    size = 3 * mesh["nnode"]
    material = constitutive(c["E"], c["nu"])
    dr = (c["r_outer"] - c["r_inner"]) / nr

    @lru_cache(maxsize=None)
    def template(ir, delta_deg, dz):
        delta = math.radians(delta_deg)
        r0, r1 = c["r_inner"] + ir * dr, c["r_inner"] + (ir + 1) * dr
        coords = np.array([[r0, 0, 0], [r1, 0, 0], [r1 * math.cos(delta), r1 * math.sin(delta), 0],
                           [r0 * math.cos(delta), r0 * math.sin(delta), 0]])
        coords = np.vstack((coords, coords + [0, 0, dz]))
        transform = np.zeros((24, 24))
        for i in range(8):
            a = delta if i % 4 in (2, 3) else 0
            transform[3 * i:3 * i + 3, 3 * i:3 * i + 3] = [[math.cos(a), -math.sin(a), 0],
                                                                           [math.sin(a), math.cos(a), 0], [0, 0, 1]]
        ke, recover, weights = element_operators(coords, material, c["element_type"] == "H8_EAS")
        def sample(point):
            n, b, det = recover(point)
            return n @ coords, material @ b @ transform, det, n
        return {"K": transform.T @ ke @ transform, "weights": weights, "gp": [sample(p) for p in GP],
                "center": sample((0, 0, 0)), "plane": [sample((a, b, 0)) for a, b in itertools.product((-1/math.sqrt(3), 1/math.sqrt(3)), repeat=2)],
                "wall": [sample((a, 0, 0)) for a in (-1/math.sqrt(3), 1/math.sqrt(3))], "dz": dz, "angle": delta}

    groups = {}
    for eid, (k, ir, j) in enumerate(mesh["labels"]):
        delta = (mesh["angles"][(j + 1) % nt] - mesh["angles"][j]) % 360
        dz = mesh["z_planes"][k + 1] - mesh["z_planes"][k]
        groups.setdefault((ir, round(float(delta), 10), round(float(dz), 10)), []).append(eid)
    row, col, data = [], [], []
    force = np.zeros((mesh["nnode"], 3))
    plane_weights = np.zeros(npn)
    for key, ids in groups.items():
        t = template(*key)
        enodes = elements[ids]
        dofs = (enodes[..., None] * 3 + np.arange(3)).reshape(len(ids), 24)
        row.append(np.repeat(dofs, 24, axis=1).ravel())
        col.append(np.tile(dofs, (1, 24)).ravel())
        data.append(np.tile(t["K"].ravel(), len(ids)))
        if c["self_weight"]:
            for i in range(8):
                np.add.at(force[:, 1], enodes[:, i], -c["density"] * 9.81 * t["weights"][i])
        for eid in ids:
            k, ir, j = mesh["labels"][eid]
            if k == 0:
                local = elements[eid, :4]
                for point, _, det, n in t["plane"]:
                    plane_weights[local] += (n[:4] + n[4:]) * det * 2 / t["dz"]
    stiffness = coo_matrix((np.concatenate(data), (np.concatenate(row), np.concatenate(col))), shape=(size, size)).tocsr()
    del row, col, data
    for load in c["line_loads"]:
        j = int(np.argmin(np.abs(mesh["angles"] - load["angle_deg"])))
        angle = math.radians(load["angle_deg"])
        vector = -load["value"] * np.array([math.cos(angle), math.sin(angle), 0])
        for k, dz in enumerate(np.diff(mesh["z_planes"])):
            for iz in (k, k + 1):
                force[iz * npn + nr * nt + j] += vector * dz / 2
    if c["outer_pressure"]:
        # Exact consistent pressure on each planar outer quad: edge normal * dz.
        for k, dz in enumerate(np.diff(mesh["z_planes"])):
            for j in range(nt):
                a, b = nr * nt + j, nr * nt + (j + 1) % nt
                edge = xyz[b] - xyz[a]
                normal_area = np.array([edge[1], -edge[0], 0]) * dz
                for node in (k * npn + a, k * npn + b, (k + 1) * npn + a, (k + 1) * npn + b):
                    force[node] -= c["outer_pressure"] * normal_area / 4
    transforms = mesh["transforms"]
    polar_force = np.einsum("nji,nj->ni", transforms, force).ravel()
    lower, upper = np.full(size, -np.inf), np.full(size, np.inf)
    for pad in mesh["supports"]:
        ids = np.array(pad["node_ids"]) - 1
        if c["support_shape"] == "flat":
            lower[3 * ids + 1] = -(xyz[ids, 1] + c["r_outer"])
        else:
            upper[3 * ids] = 0
    side_ids = []
    if c["side_stops"]:
        for j, a in enumerate(mesh["angles"]):
            if min(abs(a), abs(a - 180)) < 1e-8:
                side_ids += [k * npn + nr * nt + j for k in range(nz + 1)]
        if c["support_shape"] == "flat":
            for node in side_ids:
                if xyz[node, 0] > 0:
                    upper[3 * node] = 0
                else:
                    lower[3 * node] = 0
        else:
            upper[3 * np.array(side_ids)] = 0
    rigid_cart = np.zeros((mesh["nnode"], 3, 6))
    rigid_cart[:, :, :3] = np.eye(3)
    centered = xyz - [0, 0, c["length"] / 2]
    for axis in range(3):
        rigid_cart[:, :, 3 + axis] = np.cross(np.eye(3)[axis], centered) / c["length"]
    rigid = np.einsum("nji,njk->nik", transforms, rigid_cart).reshape(size, 6)
    if c["support_shape"] == "flat":
        rotation = block_diag([coo_matrix(transforms[0]), *transforms[1:]], format="csr")
        stiffness = (rotation @ stiffness @ rotation.T).tocsr()
        polar_force = force.ravel()
        rigid = rigid_cart.reshape(size, 6)
    q, residual, states, iterations, violation, free_error, gauge = _solve_bounds(stiffness, polar_force, lower, upper, rigid)
    energy = float(.5*q@(stiffness@q))
    if c["support_shape"] == "flat":
        u, reaction = q.reshape(-1, 3), residual.reshape(-1, 3)
        q = np.einsum("nji,nj->ni", transforms, u).ravel()
    else:
        u = np.einsum("nij,nj->ni", transforms, q.reshape(-1, 3))
        reaction = np.einsum("nij,nj->ni", transforms, residual.reshape(-1, 3))
    net = (force + reaction).sum(axis=0)
    moment = np.cross(xyz, force + reaction).sum(axis=0)
    supports = []
    for pad in mesh["supports"]:
        ids = np.array(pad["node_ids"]) - 1
        normal_clearance = (u[ids, 1] + xyz[ids, 1] + c["r_outer"]) if c["support_shape"] == "flat" else -q.reshape(-1, 3)[ids, 0]
        normal_reaction = reaction[ids, 1] if c["support_shape"] == "flat" else -residual.reshape(-1, 3)[ids, 0]
        vertical = reaction[ids, 1]
        supports.append({**pad, "reaction": reaction[ids].sum(axis=0).tolist(),
                         "active_nodes": int(np.count_nonzero(states.reshape(-1, 3)[ids, 1 if c["support_shape"] == "flat" else 0])),
                         "normal_clearance_min": float(np.min(normal_clearance)),
                         "normal_reaction_min": float(np.min(normal_reaction)),
                         "reaction_centroid_z": float(vertical @ xyz[ids, 2] / vertical.sum()) if abs(vertical.sum()) > 1e-6 else None})
    records = [None] * mesh["nel"]
    sections = [{"z": float((mesh["z_planes"][k] + mesh["z_planes"][k + 1]) / 2),
                 "N_z": 0., "V_x": 0., "V_y": 0., "M_x": 0., "M_y": 0., "T_z": 0.} for k in range(nz)]
    ring_sections = [[{"theta_deg": float((mesh["angles"][j] + ((mesh["angles"][(j+1)%nt]-mesh["angles"][j])%360)/2)%360),
                       "N_theta": 0., "M_theta": 0., "Q_theta": 0., "N_z": 0., "M_z": 0., "N_theta_z": 0.}
                      for j in range(nt)] for k in range(nz)]
    critical = {"tension": None, "compression": None}
    limits = {"tension": -math.inf, "compression": -math.inf}
    volume = 0.
    for key, ids in groups.items():
        t = template(*key)
        enodes = elements[ids]
        dofs = (enodes[..., None] * 3 + np.arange(3)).reshape(len(ids), 24)
        qe = q[dofs]
        gpstress = np.einsum("gsi,ei->egs", np.array([s[1] for s in t["gp"]]), qe)
        gpstress[:, :, 2] -= c["prestress"]
        eigen = np.linalg.eigvalsh(_tensor(gpstress))
        volume += len(ids) * sum(s[2] for s in t["gp"])
        for name, field in (("tension", eigen[:, :, 2]), ("compression", -eigen[:, :, 0])):
            local, gpindex = np.unravel_index(np.argmax(field), field.shape)
            value = float(field[local, gpindex])
            if value > limits[name]:
                eid = ids[local]
                k, ir, j = mesh["labels"][eid]
                theta = math.radians(mesh["angles"][j])
                co, si = math.cos(theta), math.sin(theta)
                point = t["gp"][gpindex][0]
                critical[name] = {"element_id": eid + 1, "point_id": f"G{gpindex+1}",
                                  "x": float(co*point[0]-si*point[1]), "y": float(si*point[0]+co*point[1]),
                                  "z": float(mesh["z_planes"][k]+point[2]), "principal": eigen[local, gpindex].tolist()}
                limits[name] = value
        for local, eid in enumerate(ids):
            k, ir, j = mesh["labels"][eid]
            theta = math.radians(mesh["angles"][j])
            co, si = math.cos(theta), math.sin(theta)
            center, operator, _, _ = t["center"]
            stress = operator @ qe[local]
            stress[2] -= c["prestress"]
            global_stress = _global_stress(stress, theta)
            half = t["angle"] / 2
            polar_stress = _global_stress(stress, -half)
            eig = np.linalg.eigvalsh(_tensor(stress))
            record = {"element_id": eid + 1, "layer": k, "radial_layer": ir, "sector": j,
                      "x": float(co*center[0]-si*center[1]), "y": float(si*center[0]+co*center[1]),
                      "z": float(mesh["z_planes"][k]+center[2]),
                      **dict(zip(("sigma_x", "sigma_y", "sigma_z", "tau_xy", "tau_xz", "tau_yz"), map(float, global_stress))),
                      "sigma_r": float(polar_stress[0]), "sigma_theta": float(polar_stress[1]),
                      "tau_rt": float(polar_stress[3]), "principal_max": float(eig[-1]), "principal_min": float(eig[0]),
                      "gauss_principal_max": float(np.max(eigen[local, :, 2])), "gauss_principal_min": float(np.min(eigen[local, :, 0]))}
            records[eid] = record
            for point, operator, det, n in t["plane"]:
                st = operator @ qe[local]
                st[2] -= c["prestress"]
                st = _global_stress(st, theta)
                x, y = co*point[0]-si*point[1], si*point[0]+co*point[1]
                area = det * 2 / t["dz"]
                sec = sections[k]
                for name, value in (("N_z", st[2]), ("V_x", st[4]), ("V_y", st[5]),
                                    ("M_x", y*st[2]), ("M_y", -x*st[2]), ("T_z", x*st[5]-y*st[4])):
                    sec[name] += float(value*area)
            midpoint = (c["r_inner"] + c["r_outer"]) / 2 * math.cos(half)
            for point, operator, det, n in t["wall"]:
                st = operator @ qe[local]
                st[2] -= c["prestress"]
                st = _global_stress(st, -half)
                lever = math.hypot(point[0], point[1]) - midpoint
                weight = dr / 2 * math.cos(half)
                sec = ring_sections[k][j]
                for name, value in (("N_theta", st[1]), ("M_theta", st[1]*lever), ("Q_theta", st[3]),
                                    ("N_z", st[2]), ("M_z", st[2]*lever), ("N_theta_z", st[5])):
                    sec[name] += float(value*weight)
    area = float(plane_weights.sum())
    axis = np.einsum("knj,n->kj", u.reshape(nz + 1, npn, 3), plane_weights) / area
    axis_displacements = [{"z": float(z), "u_x": float(v[0]), "u_y": float(v[1]), "u_z": float(v[2])}
                          for z, v in zip(mesh["z_planes"], axis)]
    for k, sec in enumerate(sections):
        sec.update(u_x=float((axis[k, 0]+axis[k+1, 0])/2), u_y=float((axis[k, 1]+axis[k+1, 1])/2),
                   u_z=float((axis[k, 2]+axis[k+1, 2])/2))
    rb, rbt, rbser, rbtser, _ = CONCRETE[c["grade"]]
    screens = {"standard": "TCVN 5574:2018", "grade": c["grade"], "full_tcvn_verification": False,
               "Rbt_ser": rbtser*1e6, "Rb_effective": .9*rb*1e6,
               "eta_cracking": max(0., limits["tension"])/(rbtser*1e6),
               "eta_compression": max(0., limits["compression"])/(.9*rb*1e6),
               "elastic_screen_valid": limits["tension"] <= rbtser*1e6 and limits["compression"] <= .6*rbser*1e6,
               "note": "So sánh ứng suất chính 3D tại điểm Gauss; chưa phải kiểm tra TTGH đầy đủ, chưa tính bề rộng nứt hoặc sau nứt."}
    return {"model": {"type": "finite_hollow_pile_solid_3d", "element_type": c["element_type"],
                       "units": "m, Pa, N; line loads N/m; section forces N and moments N.m",
                       "assumptions": ["Bê tông đàn hồi, biến dạng nhỏ; chưa xét cốt thép, nứt hoặc P-Delta.",
                                       "Nén trước hữu hiệu là trạng thái đã cân bằng; ứng suất ban đầu cộng một lần, không tạo lại tải.",
                                       ("Gối phẳng ở y=-R: uy ≥ -(y+R), kể khe hở hình học; cho phép nhấc và trượt, không ma sát." if c["support_shape"] == "flat" else
                                        "Gối yên ôm cung tròn; chặn hướng ra ngoài, cho phép nhấc vào trong; không ma sát."),
                                       "Loại bỏ chuyển động vật rắn còn tự do bằng điều kiện chọn nghiệm, không thêm gối có phản lực."]},
            "mesh": mesh_payload(mesh), "nodal": {"u_x": u[:, 0].tolist(), "u_y": u[:, 1].tolist(), "u_z": u[:, 2].tolist(),
                "u_r": q.reshape(-1, 3)[:, 0].tolist(), "u_t": q.reshape(-1, 3)[:, 1].tolist(),
                "reaction_x": reaction[:, 0].tolist(), "reaction_y": reaction[:, 1].tolist(), "reaction_z": reaction[:, 2].tolist()},
            "element_results": records, "axis_displacements": axis_displacements,
            "section_resultants": sections, "ring_sections": ring_sections, "supports": supports,
            "critical": critical, "screens": screens,
            "summary": {"nnode": mesh["nnode"], "nel": mesh["nel"], "ndof": size, "volume": volume,
                        "section_area": area, "prestress": c["prestress"], "initial_axial_force": -c["prestress"]*area,
                        "u_max": float(np.max(np.linalg.norm(u, axis=1))), "axis_u_y_min": float(np.min(axis[:, 1])),
                        "sigma_tensile_max": max(0., limits["tension"]), "sigma_compressive_max": max(0., limits["compression"]),
                        "total_applied_force": force.sum(axis=0).tolist(), "total_reaction": reaction.sum(axis=0).tolist(),
                        "force_balance": net.tolist(), "moment_balance": moment.tolist(),
                        "contact_iterations": iterations, "bound_violation": violation, "free_residual": free_error,
                        "gauge_force": gauge, "strain_energy": energy}}
