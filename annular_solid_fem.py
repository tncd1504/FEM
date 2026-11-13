"""Axisymmetric FEM solver for a compressed annular solid with frictionless stops."""

from __future__ import annotations

import math
import warnings
from typing import Any, Dict, List, Tuple

import numpy as np
from scipy.sparse import lil_matrix
from scipy.sparse.linalg import MatrixRankWarning, spsolve


_GAUSS = (-1.0 / math.sqrt(3.0), 1.0 / math.sqrt(3.0))


def _shape_q4(xi: float, eta: float) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    shape = 0.25 * np.array([
        (1.0 - xi) * (1.0 - eta),
        (1.0 + xi) * (1.0 - eta),
        (1.0 + xi) * (1.0 + eta),
        (1.0 - xi) * (1.0 + eta),
    ])
    dxi = 0.25 * np.array([
        -(1.0 - eta),
        1.0 - eta,
        1.0 + eta,
        -(1.0 + eta),
    ])
    deta = 0.25 * np.array([
        -(1.0 - xi),
        -(1.0 + xi),
        1.0 + xi,
        1.0 - xi,
    ])
    return shape, dxi, deta


def _constitutive_matrix(young_modulus: float, poisson_ratio: float) -> np.ndarray:
    shear = young_modulus / (2.0 * (1.0 + poisson_ratio))
    lame = young_modulus * poisson_ratio / (
        (1.0 + poisson_ratio) * (1.0 - 2.0 * poisson_ratio)
    )
    return np.array([
        [lame + 2.0 * shear, lame, lame, 0.0],
        [lame, lame + 2.0 * shear, lame, 0.0],
        [lame, lame, lame + 2.0 * shear, 0.0],
        [0.0, 0.0, 0.0, shear],
    ])


def _strain_displacement(
    radius: float,
    shape: np.ndarray,
    dshape_dr: np.ndarray,
    dshape_dz: np.ndarray,
) -> np.ndarray:
    matrix = np.zeros((4, 8), dtype=float)
    for node in range(4):
        radial_dof = 2 * node
        vertical_dof = radial_dof + 1
        matrix[0, radial_dof] = dshape_dr[node]
        matrix[1, vertical_dof] = dshape_dz[node]
        matrix[2, radial_dof] = shape[node] / radius
        matrix[3, radial_dof] = dshape_dz[node]
        matrix[3, vertical_dof] = dshape_dr[node]
    return matrix


def _validate(
    params: Dict[str, Any],
) -> Tuple[float, float, float, float, float, float, float, int, int]:
    r_inner = float(params.get("r_inner", 0.05))
    r_outer = float(params.get("r_outer", 0.1))
    height = float(params.get("height", 0.08))
    force = float(params.get("force", 100_000.0))
    young_modulus = float(params.get("E", 200.0e9))
    poisson_ratio = float(params.get("nu", 0.3))
    yield_strength = float(params.get("yield_strength", 250.0e6))
    nr = int(params.get("nr", 12))
    nz = int(params.get("nz", 12))

    values = (r_inner, r_outer, height, force, young_modulus, poisson_ratio, yield_strength)
    if not all(math.isfinite(value) for value in values):
        raise ValueError("Các thông số phải là số hữu hạn.")
    if r_inner <= 0.0 or r_outer <= r_inner:
        raise ValueError("Cần thỏa mãn 0 < bán kính trong < bán kính ngoài.")
    if height <= 0.0:
        raise ValueError("Chiều cao tiết diện phải lớn hơn 0.")
    if force <= 0.0:
        raise ValueError("Tải nén tổng phải lớn hơn 0.")
    if young_modulus <= 0.0:
        raise ValueError("Mô đun đàn hồi E phải lớn hơn 0.")
    if not -1.0 < poisson_ratio < 0.5:
        raise ValueError("Hệ số Poisson phải nằm trong khoảng (-1, 0.5).")
    if yield_strength <= 0.0:
        raise ValueError("Giới hạn chảy phải lớn hơn 0.")
    if not 1 <= nr <= 80 or not 1 <= nz <= 80:
        raise ValueError("Số phần tử theo bán kính và chiều cao phải từ 1 đến 80.")

    return r_inner, r_outer, height, force, young_modulus, poisson_ratio, yield_strength, nr, nz


def solve_annular_solid(params: Dict[str, Any]) -> Dict[str, Any]:
    """Solve an axisymmetric annular solid under uniform axial compression.

    The bottom, inner wall, and outer wall are rigid frictionless unilateral
    stops: outward normal motion is blocked, while motion into the solid is free.
    """
    (
        r_inner,
        r_outer,
        height,
        force,
        young_modulus,
        poisson_ratio,
        yield_strength,
        nr,
        nz,
    ) = _validate(params)

    radial_positions = np.linspace(r_inner, r_outer, nr + 1)
    vertical_positions = np.linspace(0.0, height, nz + 1)
    coordinates = np.array(
        [(radius, elevation) for elevation in vertical_positions for radius in radial_positions],
        dtype=float,
    )
    nnode = len(coordinates)
    ndof = 2 * nnode
    nodes: List[List[int]] = []
    for iz in range(nz):
        for ir in range(nr):
            lower_left = iz * (nr + 1) + ir
            lower_right = lower_left + 1
            upper_left = lower_left + nr + 1
            upper_right = upper_left + 1
            nodes.append([lower_left, lower_right, upper_right, upper_left])

    constitutive = _constitutive_matrix(young_modulus, poisson_ratio)
    stiffness = lil_matrix((ndof, ndof), dtype=float)
    element_dofs: List[np.ndarray] = []
    element_stiffnesses: List[np.ndarray] = []
    element_coordinates: List[np.ndarray] = []

    for element in nodes:
        element_xy = coordinates[element]
        dofs = np.array(
            [dof for node in element for dof in (2 * node, 2 * node + 1)],
            dtype=int,
        )
        element_stiffness = np.zeros((8, 8), dtype=float)
        for xi in _GAUSS:
            for eta in _GAUSS:
                shape, dshape_dxi, dshape_deta = _shape_q4(xi, eta)
                jacobian = np.array([
                    [dshape_dxi @ element_xy[:, 0], dshape_dxi @ element_xy[:, 1]],
                    [dshape_deta @ element_xy[:, 0], dshape_deta @ element_xy[:, 1]],
                ])
                determinant = float(np.linalg.det(jacobian))
                if determinant <= 0.0:
                    raise ValueError("Lưới phần tử bị suy biến; không thể lắp ma trận độ cứng.")
                dshape_dr, dshape_dz = np.linalg.solve(
                    jacobian,
                    np.vstack((dshape_dxi, dshape_deta)),
                )
                radius = float(shape @ element_xy[:, 0])
                strain_matrix = _strain_displacement(radius, shape, dshape_dr, dshape_dz)
                element_stiffness += (
                    strain_matrix.T
                    @ constitutive
                    @ strain_matrix
                    * (2.0 * math.pi * radius * determinant)
                )
        stiffness[np.ix_(dofs, dofs)] += element_stiffness
        element_dofs.append(dofs)
        element_stiffnesses.append(element_stiffness)
        element_coordinates.append(element_xy)

    force_vector = np.zeros(ndof, dtype=float)
    top_area = math.pi * (r_outer**2 - r_inner**2)
    pressure = force / top_area
    top_start = nz * (nr + 1)
    for ir in range(nr):
        node_ids = (top_start + ir, top_start + ir + 1)
        edge_radii = coordinates[list(node_ids), 0]
        for point in _GAUSS:
            edge_shape = np.array([(1.0 - point) / 2.0, (1.0 + point) / 2.0])
            radius = float(edge_shape @ edge_radii)
            jacobian = float((edge_radii[1] - edge_radii[0]) / 2.0)
            for local_node, node_id in enumerate(node_ids):
                force_vector[2 * node_id + 1] -= (
                    pressure * edge_shape[local_node] * 2.0 * math.pi * radius * jacobian
                )

    # sign * displacement is the outward-normal displacement, constrained <= 0.
    contacts: List[Tuple[str, int, int]] = []
    for ir in range(nr + 1):
        bottom_node = ir
        contacts.append(("bottom", 2 * bottom_node + 1, -1))
    for iz in range(nz + 1):
        inner_node = iz * (nr + 1)
        outer_node = inner_node + nr
        contacts.append(("inner", 2 * inner_node, -1))
        contacts.append(("outer", 2 * outer_node, 1))

    contact_dofs = np.array([contact[1] for contact in contacts], dtype=int)
    contact_signs = np.array([contact[2] for contact in contacts], dtype=float)
    active = np.ones(len(contacts), dtype=bool)
    all_dofs = np.arange(ndof, dtype=int)
    displacement = np.zeros(ndof, dtype=float)
    displacement_tolerance = 1.0e-10 * max(r_outer, height, 1.0e-3)
    reaction_tolerance = 1.0e-9 * max(force, 1.0)
    seen_states = set()
    max_iterations = max(50, 4 * len(contacts))

    for iteration in range(1, max_iterations + 1):
        fixed_dofs = contact_dofs[active]
        free_mask = np.ones(ndof, dtype=bool)
        free_mask[fixed_dofs] = False
        free_dofs = all_dofs[free_mask]
        displacement.fill(0.0)
        if free_dofs.size:
            reduced_stiffness = stiffness.tocsr()[free_dofs, :][:, free_dofs].tocsc()
            with warnings.catch_warnings():
                warnings.simplefilter("error", MatrixRankWarning)
                try:
                    displacement[free_dofs] = spsolve(
                        reduced_stiffness,
                        force_vector[free_dofs],
                    )
                except (MatrixRankWarning, RuntimeError) as exc:
                    raise RuntimeError("Hệ FEM suy biến; hãy kiểm tra điều kiện biên và lưới.") from exc
            if not np.all(np.isfinite(displacement[free_dofs])):
                raise RuntimeError("Không tìm được nghiệm hữu hạn cho hệ FEM.")

        residual = stiffness.tocsr() @ displacement - force_vector
        outward_displacement = contact_signs * displacement[contact_dofs]
        outward_reaction = contact_signs * residual[contact_dofs]
        release = active & (outward_reaction > reaction_tolerance)
        engage = (~active) & (outward_displacement > displacement_tolerance)
        updated = (active & ~release) | engage
        if np.array_equal(updated, active):
            break
        state = updated.tobytes()
        if state in seen_states:
            raise RuntimeError(
                "Bài toán tiếp xúc không hội tụ. Hãy tăng độ mịn lưới hoặc kiểm tra hình học/tải."
            )
        seen_states.add(state)
        active = updated
    else:
        raise RuntimeError(
            f"Bài toán tiếp xúc không hội tụ sau {max_iterations} vòng lặp."
        )

    stress_records = []
    element_results = []
    max_stress = -1.0
    max_stress_record: Dict[str, float] = {}
    max_ur_idx = int(np.argmax(np.abs(displacement[0::2])))
    max_uz_idx = int(np.argmax(np.abs(displacement[1::2])))

    for element_index, element in enumerate(nodes):
        element_xy = element_coordinates[element_index]
        element_displacement = displacement[element_dofs[element_index]]
        element_vm_max = 0.0
        for xi in _GAUSS:
            for eta in _GAUSS:
                shape, dshape_dxi, dshape_deta = _shape_q4(xi, eta)
                jacobian = np.array([
                    [dshape_dxi @ element_xy[:, 0], dshape_dxi @ element_xy[:, 1]],
                    [dshape_deta @ element_xy[:, 0], dshape_deta @ element_xy[:, 1]],
                ])
                dshape_dr, dshape_dz = np.linalg.solve(
                    jacobian,
                    np.vstack((dshape_dxi, dshape_deta)),
                )
                radius, elevation = shape @ element_xy
                strain_matrix = _strain_displacement(
                    float(radius),
                    shape,
                    dshape_dr,
                    dshape_dz,
                )
                sigma_r, sigma_z, sigma_theta, tau_rz = (
                    constitutive @ strain_matrix @ element_displacement
                )
                von_mises = math.sqrt(
                    0.5 * (
                        (sigma_r - sigma_z) ** 2
                        + (sigma_z - sigma_theta) ** 2
                        + (sigma_theta - sigma_r) ** 2
                    )
                    + 3.0 * tau_rz**2
                )
                record = {
                    "r": float(radius),
                    "z": float(elevation),
                    "sigma_r": float(sigma_r),
                    "sigma_z": float(sigma_z),
                    "sigma_theta": float(sigma_theta),
                    "tau_rz": float(tau_rz),
                    "sigma_vm": float(von_mises),
                }
                stress_records.append(record)
                element_vm_max = max(element_vm_max, float(von_mises))
                if von_mises > max_stress:
                    max_stress = float(von_mises)
                    max_stress_record = record

        r0, r1 = float(element_xy[0, 0]), float(element_xy[1, 0])
        z0, z1 = float(element_xy[0, 1]), float(element_xy[2, 1])
        element_results.append({
            "r_inner": r0,
            "r_outer": r1,
            "z_bottom": z0,
            "z_top": z1,
            "sigma_vm": element_vm_max,
        })

    contact_reactions = {"bottom": 0.0, "inner": 0.0, "outer": 0.0}
    for (kind, dof, sign), is_active in zip(contacts, active):
        if is_active:
            contact_reactions[kind] += max(0.0, -sign * residual[dof])

    max_outward_displacement = float(max(
        0.0,
        np.max(contact_signs * displacement[contact_dofs]),
    ))
    max_abs_ur = float(abs(displacement[2 * max_ur_idx]))
    max_abs_uz = float(abs(displacement[2 * max_uz_idx + 1]))
    utilization = max_stress / yield_strength
    bottom_balance_error = abs(contact_reactions["bottom"] - force)

    return {
        "summary": {
            "r_inner": r_inner,
            "r_outer": r_outer,
            "height": height,
            "force": force,
            "pressure": pressure,
            "E": young_modulus,
            "nu": poisson_ratio,
            "yield_strength": yield_strength,
            "nnode": nnode,
            "nel": len(nodes),
            "nr": nr,
            "nz": nz,
            "contact_iterations": iteration,
            "active_contact_nodes": int(np.count_nonzero(active)),
            "max_abs_ur": max_abs_ur,
            "max_abs_ur_r": float(coordinates[max_ur_idx, 0]),
            "max_abs_ur_z": float(coordinates[max_ur_idx, 1]),
            "max_abs_uz": max_abs_uz,
            "max_abs_uz_r": float(coordinates[max_uz_idx, 0]),
            "max_abs_uz_z": float(coordinates[max_uz_idx, 1]),
            "sigma_vm_max": max_stress,
            "sigma_vm_max_r": max_stress_record["r"],
            "sigma_vm_max_z": max_stress_record["z"],
            "sigma_r_at_max": max_stress_record["sigma_r"],
            "sigma_z_at_max": max_stress_record["sigma_z"],
            "sigma_theta_at_max": max_stress_record["sigma_theta"],
            "tau_rz_at_max": max_stress_record["tau_rz"],
            "utilization": utilization,
            "safety_factor": yield_strength / max_stress if max_stress > 0.0 else math.inf,
            "strength_ok": bool(utilization <= 1.0),
            "bottom_reaction": float(contact_reactions["bottom"]),
            "inner_wall_reaction": float(contact_reactions["inner"]),
            "outer_wall_reaction": float(contact_reactions["outer"]),
            "vertical_force_balance_error": float(bottom_balance_error),
            "max_outward_penetration": max_outward_displacement,
        },
        "stress_points": stress_records,
        "elements": element_results,
    }
