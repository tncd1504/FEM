"""
Giải bài toán Phần tử hữu hạn (FEM) tấm dày (Mindlin-Reissner) hình vành khuyên
Dựa trên bộ code MATLAB trong thư mục "Ly Thuyet Tam" (Square Plate & CS-MIN3):
  - MITC4 (Bathe 4-node Mixed Interpolation of Tensorial Components)
  - Q4_REDUCED (4-node Mindlin plate với tích phân suy giảm 2x2 uốn + 1x1 cắt)
  - Q4_FULL (4-node Mindlin plate tích phân đầy đủ 2x2)
  - DSG3 (3-node Discrete Shear Gap triangular element)
  - CS_DSG3 (3-node Cell-based Smoothed DSG3 triangular element)
  - MIN3 (3-node Tessler & Hughes Mindlin triangular element)
  - CS_MIN3 (3-node Cell-based Smoothed MIN3 triangular element)

Bậc tự do tại mỗi nút i (3 DOFs/node):
  [w_i, theta_xi, theta_yi]
  trong đó:
    w_i       : chuyển vị thẳng đứng theo phương z
    theta_xi  : góc xoay quanh trục x (quy ước bàn tay phải, beta_y = -theta_x)
    theta_yi  : góc xoay quanh trục y (quy ước bàn tay phải, beta_x = +theta_y)
"""

from __future__ import annotations
import math
from typing import Dict, List, Optional, Tuple, Any
import numpy as np
from scipy.sparse import lil_matrix, csr_matrix
from scipy.sparse.linalg import spsolve


# ==============================================================================
# 1. HÀM DẠNG & TÍCH PHÂN GAUSS (Tương ứng Gauss_1D.m, Gauss_2D.m, get_Gauss_T3.m,
#    shape_Q4.m, shape_T3.m, cal_jacobi.m, dNx_dNy.m)
# ==============================================================================

def gauss_1d(ngl: int) -> Tuple[np.ndarray, np.ndarray]:
    """Tương ứng Gauss_1D.m"""
    if ngl == 1:
        pts = np.array([0.0])
        wts = np.array([2.0])
    elif ngl == 2:
        p = 1.0 / math.sqrt(3.0)
        pts = np.array([-p, p])
        wts = np.array([1.0, 1.0])
    elif ngl == 3:
        p = math.sqrt(3.0 / 5.0)
        pts = np.array([-p, 0.0, p])
        wts = np.array([5.0 / 9.0, 8.0 / 9.0, 5.0 / 9.0])
    else:
        pts, wts = np.polynomial.legendre.leggauss(ngl)
    return pts, wts


def get_gauss_t3(n_gauss: int = 3) -> Tuple[np.ndarray, np.ndarray]:
    """Tương ứng get_Gauss_T3.m (tích phân trên tam giác chuẩn (0,0)-(1,0)-(0,1))"""
    if n_gauss == 1:
        point = np.array([[1.0 / 3.0, 1.0 / 3.0]])
        weight = np.array([1.0])
    elif n_gauss == 3:
        point = np.array([
            [1.0 / 6.0, 1.0 / 6.0],
            [4.0 / 6.0, 1.0 / 6.0],
            [1.0 / 6.0, 4.0 / 6.0],
        ])
        weight = np.array([1.0 / 3.0, 1.0 / 3.0, 1.0 / 3.0])
    elif n_gauss == 7:
        point = np.array([
            [0.1012865073235, 0.1012865073235],
            [0.7974269853531, 0.1012865073235],
            [0.1012865073235, 0.7974269853531],
            [0.4701420641051, 0.0597158717898],
            [0.4701420641051, 0.4701420641051],
            [0.0597158717898, 0.4701420641051],
            [0.3333333333333, 0.3333333333333],
        ])
        weight = np.array([
            0.1259391805448,
            0.1259391805448,
            0.1259391805448,
            0.1323941527885,
            0.1323941527885,
            0.1323941527885,
            0.225,
        ])
    else:
        raise ValueError(f"Unsupported n_gauss={n_gauss} for T3")
    return point, weight / 2.0


def shape_q4(r: float, s: float, al: float = 1.0) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Tương ứng shape_Q4.m"""
    N = np.array([
        0.25 * (1.0 - r) * (1.0 - s),
        0.25 * (1.0 + r) * (1.0 - s),
        0.25 * (1.0 + r) * (1.0 + s),
        0.25 * (1.0 - r) * (1.0 + s),
    ])
    dNdxi = np.array([
        -0.25 * (1.0 - al * s),
         0.25 * (1.0 - al * s),
         0.25 * (1.0 + al * s),
        -0.25 * (1.0 + al * s),
    ])
    dNdeta = np.array([
        -0.25 * (1.0 - al * r),
        -0.25 * (1.0 + al * r),
         0.25 * (1.0 + al * r),
         0.25 * (1.0 - al * r),
    ])
    return N, dNdxi, dNdeta


def shape_t3(xi: float, eta: float) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Tương ứng shape_T3.m"""
    N = np.array([1.0 - xi - eta, xi, eta])
    dNdxi = np.array([-1.0, 1.0, 0.0])
    dNdeta = np.array([-1.0, 0.0, 1.0])
    return N, dNdxi, dNdeta


def cal_jacobi(dNdxi: np.ndarray, dNdeta: np.ndarray, xcoord: np.ndarray, ycoord: np.ndarray) -> np.ndarray:
    """Tương ứng cal_jacobi.m"""
    J = np.zeros((2, 2), dtype=float)
    J[0, 0] = np.dot(dNdxi, xcoord)
    J[0, 1] = np.dot(dNdxi, ycoord)
    J[1, 0] = np.dot(dNdeta, xcoord)
    J[1, 1] = np.dot(dNdeta, ycoord)
    return J


def dnx_dny(dNdxi: np.ndarray, dNdeta: np.ndarray, invjacob: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
    """Tương ứng dNx_dNy.m"""
    dNdx = invjacob[0, 0] * dNdxi + invjacob[0, 1] * dNdeta
    dNdy = invjacob[1, 0] * dNdxi + invjacob[1, 1] * dNdeta
    return dNdx, dNdy


def cal_area_polygon(x: np.ndarray, y: np.ndarray) -> float:
    """Tương ứng cal_area_polygon.m"""
    return 0.5 * abs(np.dot(x, np.roll(y, -1)) - np.dot(y, np.roll(x, -1)))


def cal_side_t3(x: np.ndarray, y: np.ndarray) -> Tuple[float, float, float, float, float, float, float]:
    """Tương ứng cal_side.m trong CS-MIN3"""
    a1 = x[2] - x[1]
    a2 = x[0] - x[2]
    a3 = x[1] - x[0]
    b1 = y[1] - y[2]
    b2 = y[2] - y[0]
    b3 = y[0] - y[1]
    L12 = math.hypot(x[1] - x[0], y[1] - y[0])
    L23 = math.hypot(x[2] - x[1], y[2] - y[1])
    L31 = math.hypot(x[0] - x[2], y[0] - y[2])
    length_side = max(L12, L23, L31)
    return a1, a2, a3, b1, b2, b3, length_side


# ==============================================================================
# 2. MA TRẬN VẬT LIỆU & MA TRẬN ĐỔI DẤU (material_matrix.m, T_sign.m)
# ==============================================================================

def material_matrices(E: float, nu: float, t: float, kappa: float = 5.0 / 6.0) -> Tuple[np.ndarray, np.ndarray, float]:
    """
    Tương ứng material_matrix.m (iopt=1) và material_shear.m:
      Db = E*t^3 / (12*(1 - nu^2)) * [1, nu, 0; nu, 1, 0; 0, 0, (1-nu)/2]
      Ds = kappa * G * t * [1, 0; 0, 1]
    """
    D_flex = (E * (t ** 3)) / (12.0 * (1.0 - nu ** 2))
    Db = D_flex * np.array([
        [1.0, nu, 0.0],
        [nu, 1.0, 0.0],
        [0.0, 0.0, 0.5 * (1.0 - nu)],
    ])
    G = 0.5 * E / (1.0 + nu)
    Ds = (kappa * G * t) * np.eye(2)
    return Db, Ds, G


def get_T_matrix(nnel: int) -> np.ndarray:
    """
    Ma trận đổi dấu T chuyển từ bậc tự do vật lý [w, theta_x, theta_y]
    sang [w, beta_x, beta_y] với beta_x = theta_y, beta_y = -theta_x.
    Tương ứng ma trận T trong Plate_MindLin.m, Plate_MindLin_CSDSG3_static.m.
    """
    T_node = np.array([
        [1.0,  0.0, 0.0],
        [0.0,  0.0, 1.0],
        [0.0, -1.0, 0.0],
    ])
    T = np.zeros((3 * nnel, 3 * nnel), dtype=float)
    for i in range(nnel):
        T[3 * i:3 * i + 3, 3 * i:3 * i + 3] = T_node
    return T


T_Q4 = get_T_matrix(4)
T_T3 = get_T_matrix(3)

# Trong Plate_MindLin_MIN3_static.m, thứ tự DOF nội bộ của tác giả là [w, beta_y, beta_x]
# với beta_y = -theta_x, beta_x = theta_y:
T_MIN3_NODE = np.array([
    [1.0,  0.0, 0.0],
    [0.0, -1.0, 0.0],
    [0.0,  0.0, 1.0],
])
T_MIN3 = np.kron(np.eye(3), T_MIN3_NODE)


# ==============================================================================
# 3. CÁC MA TRẬN BIẾN DẠNG PHẦN TỬ (Bb_Bathe.m, Bs_Natural_MITC4.m, DSG3, CS-DSG3,
#    MIN3, CS-MIN3, Q4-Reduced, Q4-Full)
# ==============================================================================

def bb_bathe(nnel: int, dNdx: np.ndarray, dNdy: np.ndarray) -> np.ndarray:
    """
    Tương ứng Bb_Bathe.m trong thư mục Square Plate.
    Liên hệ độ cong uốn với DOF (w, theta_x, theta_y).
    """
    Bb = np.zeros((3, 3 * nnel), dtype=float)
    for i in range(nnel):
        i1 = 3 * i
        i2 = i1 + 1
        i3 = i1 + 2
        Bb[0, i3] = dNdx[i]
        Bb[1, i2] = -dNdy[i]
        Bb[2, i2] = -dNdx[i]
        Bb[2, i3] = dNdy[i]
    return Bb


def bs_natural_mitc4(xcoord: np.ndarray, ycoord: np.ndarray, dNdxi: np.ndarray, dNdeta: np.ndarray) -> np.ndarray:
    """
    Tương ứng Bs_Natural_MITC4.m trong thư mục Square Plate.
    """
    xi = np.array([-1.0, 1.0, 1.0, -1.0])
    eta = np.array([-1.0, -1.0, 1.0, 1.0])

    a1 = np.array([-1.0, 1.0, 1.0, -1.0]) / 4.0
    a2 = np.array([-1.0, -1.0, 1.0, 1.0]) / 4.0
    h = np.array([1.0, -1.0, 1.0, -1.0]) / 4.0

    dxxi = np.array([
        np.dot(xcoord, a1 - h),
        np.dot(xcoord, a1 - h),
        np.dot(xcoord, a1 + h),
        np.dot(xcoord, a1 + h),
    ])
    dyxi = np.array([
        np.dot(ycoord, a1 - h),
        np.dot(ycoord, a1 - h),
        np.dot(ycoord, a1 + h),
        np.dot(ycoord, a1 + h),
    ])
    dxeta = np.array([
        np.dot(xcoord, a2 - h),
        np.dot(xcoord, a2 + h),
        np.dot(xcoord, a2 + h),
        np.dot(xcoord, a2 - h),
    ])
    dyeta = np.array([
        np.dot(ycoord, a2 - h),
        np.dot(ycoord, a2 + h),
        np.dot(ycoord, a2 + h),
        np.dot(ycoord, a2 - h),
    ])

    Bsn = np.zeros((2, 12), dtype=float)
    for i in range(4):
        i1 = 3 * i
        i2 = i1 + 1
        i3 = i1 + 2
        Bsn[0, i1] = dNdxi[i]
        Bsn[0, i2] = xi[i] * dyxi[i] * dNdxi[i]
        Bsn[0, i3] = -xi[i] * dxxi[i] * dNdxi[i]

        Bsn[1, i1] = dNdeta[i]
        Bsn[1, i2] = eta[i] * dyeta[i] * dNdeta[i]
        Bsn[1, i3] = -eta[i] * dxeta[i] * dNdeta[i]
    return Bsn


def element_mitc4(xcoord: np.ndarray, ycoord: np.ndarray, Db: np.ndarray, Ds: np.ndarray, q: float = 0.0) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """
    Phần tử tứ giác 4 nút MITC4 (square_plate_MICT4_static.m).
    Trả về: (ke, fe, Bb_center, Bs_center)
    """
    pts, wts = gauss_1d(2)
    kb = np.zeros((12, 12), dtype=float)
    ks = np.zeros((12, 12), dtype=float)
    fe = np.zeros(12, dtype=float)

    for intx in range(2):
        r = pts[intx]
        wtx = wts[intx]
        for inty in range(2):
            s = pts[inty]
            wty = wts[inty]
            N, dNdxi, dNdeta = shape_q4(r, s, 1.0)
            J = cal_jacobi(dNdxi, dNdeta, xcoord, ycoord)
            detJ = np.linalg.det(J)
            invJ = np.linalg.inv(J)
            dNdx, dNdy = dnx_dny(dNdxi, dNdeta, invJ)

            Bb = bb_bathe(4, dNdx, dNdy)
            kb += (Bb.T @ Db @ Bb) * wtx * wty * detJ

            Bsn = bs_natural_mitc4(xcoord, ycoord, dNdxi, dNdeta)
            Bs = invJ @ Bsn
            ks += (Bs.T @ Ds @ Bs) * wtx * wty * detJ

            if q != 0.0:
                f_vec = np.zeros(12, dtype=float)
                f_vec[0::3] = N
                fe += q * f_vec * wtx * wty * detJ

    # Tính Bb, Bs tại tâm phần tử (r=0, s=0) để phục vụ hậu xử lý nội lực
    N0, dNdxi0, dNdeta0 = shape_q4(0.0, 0.0, 1.0)
    J0 = cal_jacobi(dNdxi0, dNdeta0, xcoord, ycoord)
    invJ0 = np.linalg.inv(J0)
    dNdx0, dNdy0 = dnx_dny(dNdxi0, dNdeta0, invJ0)
    Bb0 = bb_bathe(4, dNdx0, dNdy0)
    Bs0 = invJ0 @ bs_natural_mitc4(xcoord, ycoord, dNdxi0, dNdeta0)

    return kb + ks, fe, Bb0, Bs0


def element_q4_mindlin(
    xcoord: np.ndarray,
    ycoord: np.ndarray,
    Db: np.ndarray,
    Ds: np.ndarray,
    q: float = 0.0,
    reduced_shear: bool = True,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """
    Phần tử tứ giác Q4 Mindlin (Plate_MindLin_Reduce.m & Plate_MindLin.m).
    - reduced_shear=True: tích phân 2x2 cho uốn Kb và 1x1 cho cắt Ks (Plate_MindLin_Reduce.m)
    - reduced_shear=False: tích phân 2x2 cho cả uốn và cắt (Plate_MindLin.m)
    """
    pts_b, wts_b = gauss_1d(2)
    kb = np.zeros((12, 12), dtype=float)
    ks = np.zeros((12, 12), dtype=float)
    fe = np.zeros(12, dtype=float)

    for intx in range(2):
        r = pts_b[intx]
        wtx = wts_b[intx]
        for inty in range(2):
            s = pts_b[inty]
            wty = wts_b[inty]
            N, dNdxi, dNdeta = shape_q4(r, s, 1.0)
            J = cal_jacobi(dNdxi, dNdeta, xcoord, ycoord)
            detJ = np.linalg.det(J)
            invJ = np.linalg.inv(J)
            dNdx, dNdy = dnx_dny(dNdxi, dNdeta, invJ)

            Bb = bb_bathe(4, dNdx, dNdy)
            kb += (Bb.T @ Db @ Bb) * wtx * wty * detJ

            if not reduced_shear:
                Bs_beta = np.zeros((2, 12), dtype=float)
                for i in range(4):
                    Bs_beta[0, 3 * i] = -dNdx[i]
                    Bs_beta[0, 3 * i + 1] = N[i]
                    Bs_beta[1, 3 * i] = -dNdy[i]
                    Bs_beta[1, 3 * i + 2] = N[i]
                Bs = Bs_beta @ T_Q4
                ks += (Bs.T @ Ds @ Bs) * wtx * wty * detJ

            if q != 0.0:
                f_vec = np.zeros(12, dtype=float)
                f_vec[0::3] = N
                fe += q * f_vec * wtx * wty * detJ

    # Tích phân 1 điểm Gauss tại tâm (0,0) cho Ks nếu dùng tích phân suy giảm
    N0, dNdxi0, dNdeta0 = shape_q4(0.0, 0.0, 1.0)
    J0 = cal_jacobi(dNdxi0, dNdeta0, xcoord, ycoord)
    detJ0 = np.linalg.det(J0)
    invJ0 = np.linalg.inv(J0)
    dNdx0, dNdy0 = dnx_dny(dNdxi0, dNdeta0, invJ0)
    Bb0 = bb_bathe(4, dNdx0, dNdy0)

    Bs_beta0 = np.zeros((2, 12), dtype=float)
    for i in range(4):
        Bs_beta0[0, 3 * i] = -dNdx0[i]
        Bs_beta0[0, 3 * i + 1] = N0[i]
        Bs_beta0[1, 3 * i] = -dNdy0[i]
        Bs_beta0[1, 3 * i + 2] = N0[i]
    Bs0 = Bs_beta0 @ T_Q4

    if reduced_shear:
        ks += (Bs0.T @ Ds @ Bs0) * 4.0 * detJ0

    return kb + ks, fe, Bb0, -Bs0


def _dsg3_sub_matrices(xcoord: np.ndarray, ycoord: np.ndarray) -> Tuple[np.ndarray, np.ndarray, float]:
    """
    Tính ma trận biến dạng uốn Bb (chưa nhân T) và cắt Bs (chưa nhân T)
    của 1 tam giác 3 nút theo công thức DSG3 (square_plate_DSG3_static.m & Plate_MindLin_CSDSG3_static.m).
    """
    area = cal_area_polygon(xcoord, ycoord)
    detJ = 2.0 * area
    a = xcoord[1] - xcoord[0]
    b = ycoord[1] - ycoord[0]
    c = ycoord[2] - ycoord[0]
    d = xcoord[2] - xcoord[0]

    bb1 = np.array([
        [0.0, b - c, 0.0],
        [0.0, 0.0, d - a],
        [0.0, d - a, b - c],
    ]) / detJ
    bb2 = np.array([
        [0.0, c, 0.0],
        [0.0, 0.0, -d],
        [0.0, -d, c],
    ]) / detJ
    bb3 = np.array([
        [0.0, -b, 0.0],
        [0.0, 0.0, a],
        [0.0, a, -b],
    ]) / detJ

    bs1 = np.array([
        [b - c, 0.5 * detJ, 0.0],
        [d - a, 0.0, 0.5 * detJ],
    ]) / detJ
    bs2 = np.array([
        [c, 0.5 * a * c, 0.5 * b * c],
        [-d, -0.5 * a * d, -0.5 * b * d],
    ]) / detJ
    bs3 = np.array([
        [-b, -0.5 * b * d, -0.5 * b * c],
        [a, 0.5 * a * d, 0.5 * a * c],
    ]) / detJ

    Bb_raw = np.hstack([bb1, bb2, bb3])
    Bs_raw = np.hstack([bs1, bs2, bs3])
    return Bb_raw, Bs_raw, area


def element_dsg3(
    xcoord: np.ndarray,
    ycoord: np.ndarray,
    Db: np.ndarray,
    G: float,
    t: float,
    kappa: float = 5.0 / 6.0,
    alstab: float = 0.1,
    q: float = 0.0,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """
    Phần tử tam giác 3 nút DSG3 (square_plate_DSG3_static.m).
    """
    Bb_raw, Bs_raw, area = _dsg3_sub_matrices(xcoord, ycoord)
    _, _, _, _, _, _, he = cal_side_t3(xcoord, ycoord)
    ds_factor = (G * kappa * (t ** 3)) / (t ** 2 + alstab * (he ** 2))
    Ds = ds_factor * np.eye(2)

    Bb = Bb_raw @ T_T3
    Bs = Bs_raw @ T_T3

    kb = (Bb.T @ Db @ Bb) * area
    ks = (Bs.T @ Ds @ Bs) * area
    fe = np.zeros(9, dtype=float)
    if q != 0.0:
        fe[0::3] = q * area / 3.0

    return kb + ks, fe, Bb, Bs


def element_cs_dsg3(
    xcoord: np.ndarray,
    ycoord: np.ndarray,
    Db: np.ndarray,
    G: float,
    t: float,
    kappa: float = 5.0 / 6.0,
    alstab: float = 0.1,
    q: float = 0.0,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """
    Phần tử tam giác 3 nút làm trơn trên ô CS-DSG3 (Plate_MindLin_CSDSG3_static.m).
    Chia tam giác chính thành 3 tam giác con qua trọng tâm (cen_x, cen_y).
    """
    cen_x = float(np.mean(xcoord))
    cen_y = float(np.mean(ycoord))
    area = cal_area_polygon(xcoord, ycoord)
    _, _, _, _, _, _, he = cal_side_t3(xcoord, ycoord)
    ds_factor = (G * kappa * (t ** 3)) / (t ** 2 + alstab * (he ** 2))
    Ds = ds_factor * np.eye(2)

    sub_tris = [
        (np.array([cen_x, xcoord[0], xcoord[1]]), np.array([cen_y, ycoord[0], ycoord[1]])),
        (np.array([cen_x, xcoord[1], xcoord[2]]), np.array([cen_y, ycoord[1], ycoord[2]])),
        (np.array([cen_x, xcoord[2], xcoord[0]]), np.array([cen_y, ycoord[2], ycoord[0]])),
    ]

    Bbs_sum = np.zeros((3, 9), dtype=float)
    Bss_sum = np.zeros((2, 9), dtype=float)

    for s_el, (xs, ys) in enumerate(sub_tris, start=1):
        Bb_sub, Bs_sub, Ase = _dsg3_sub_matrices(xs, ys)
        bb1, bb2, bb3 = Bb_sub[:, 0:3], Bb_sub[:, 3:6], Bb_sub[:, 6:9]
        bs1, bs2, bs3 = Bs_sub[:, 0:3], Bs_sub[:, 3:6], Bs_sub[:, 6:9]

        if s_el == 1:
            Bbs_sum += np.hstack([bb1 / 3.0 + bb2, bb1 / 3.0 + bb3, bb1 / 3.0]) * Ase
            Bss_sum += np.hstack([bs1 / 3.0 + bs2, bs1 / 3.0 + bs3, bs1 / 3.0]) * Ase
        elif s_el == 2:
            Bbs_sum += np.hstack([bb1 / 3.0, bb1 / 3.0 + bb2, bb1 / 3.0 + bb3]) * Ase
            Bss_sum += np.hstack([bs1 / 3.0, bs1 / 3.0 + bs2, bs1 / 3.0 + bs3]) * Ase
        else:
            Bbs_sum += np.hstack([bb1 / 3.0 + bb3, bb1 / 3.0, bb1 / 3.0 + bb2]) * Ase
            Bss_sum += np.hstack([bs1 / 3.0 + bs3, bs1 / 3.0, bs1 / 3.0 + bs2]) * Ase

    Bb = (Bbs_sum / area) @ T_T3
    Bs = (Bss_sum / area) @ T_T3

    kb = (Bb.T @ Db @ Bb) * area
    ks = (Bs.T @ Ds @ Bs) * area
    fe = np.zeros(9, dtype=float)
    if q != 0.0:
        fe[0::3] = q * area / 3.0

    return kb + ks, fe, Bb, Bs


def cal_bs_min3_plate(
    dNdx: np.ndarray,
    dNdy: np.ndarray,
    N: np.ndarray,
    a1: float,
    a2: float,
    a3: float,
    b1: float,
    b2: float,
    b3: float,
) -> np.ndarray:
    """
    Tương ứng Bs_MIN3.m & cal_Bs_MIN3_shell.m (cho bài toán tấm 3 DOF/nút).
    Trả về Bs ứng với bậc tự do nội bộ [w, beta_y, beta_x] của Plate_MindLin_MIN3_static.m.
    """
    dH1x = 0.5 * (a2 * (dNdx[2] * N[0] + N[2] * dNdx[0]) - a3 * (dNdx[0] * N[1] + N[0] * dNdx[1]))
    dH2x = 0.5 * (a3 * (dNdx[0] * N[1] + N[0] * dNdx[1]) - a1 * (dNdx[1] * N[2] + N[1] * dNdx[2]))
    dH3x = 0.5 * (a1 * (dNdx[1] * N[2] + N[1] * dNdx[2]) - a2 * (dNdx[2] * N[0] + N[2] * dNdx[0]))

    dH1y = 0.5 * (a2 * (dNdy[2] * N[0] + N[2] * dNdy[0]) - a3 * (dNdy[0] * N[1] + N[0] * dNdy[1]))
    dH2y = 0.5 * (a3 * (dNdy[0] * N[1] + N[0] * dNdy[1]) - a1 * (dNdy[1] * N[2] + N[1] * dNdy[2]))
    dH3y = 0.5 * (a1 * (dNdy[1] * N[2] + N[1] * dNdy[2]) - a2 * (dNdy[2] * N[0] + N[2] * dNdy[0]))

    dL1x = 0.5 * (b3 * (dNdx[0] * N[1] + N[0] * dNdx[1]) - b2 * (dNdx[2] * N[0] + N[2] * dNdx[0]))
    dL2x = 0.5 * (b1 * (dNdx[1] * N[2] + N[1] * dNdx[2]) - b3 * (dNdx[0] * N[1] + N[0] * dNdx[1]))
    dL3x = 0.5 * (b2 * (dNdx[2] * N[0] + N[2] * dNdx[0]) - b1 * (dNdx[1] * N[2] + N[1] * dNdx[2]))

    dL1y = 0.5 * (b3 * (dNdy[0] * N[1] + N[0] * dNdy[1]) - b2 * (dNdy[2] * N[0] + N[2] * dNdy[0]))
    dL2y = 0.5 * (b1 * (dNdy[1] * N[2] + N[1] * dNdy[2]) - b3 * (dNdy[0] * N[1] + N[0] * dNdy[1]))
    dL3y = 0.5 * (b2 * (dNdy[2] * N[0] + N[2] * dNdy[0]) - b1 * (dNdy[1] * N[2] + N[1] * dNdy[2]))

    bs1 = np.array([
        [dNdx[0], dL1x, dH1x + N[0]],
        [dNdy[0], dL1y + N[0], dH1y],
    ])
    bs2 = np.array([
        [dNdx[1], dL2x, dH2x + N[1]],
        [dNdy[1], dL2y + N[1], dH2y],
    ])
    bs3 = np.array([
        [dNdx[2], dL3x, dH3x + N[2]],
        [dNdy[2], dL3y + N[2], dH3y],
    ])
    return np.hstack([bs1, bs2, bs3])


def element_min3(
    xcoord: np.ndarray,
    ycoord: np.ndarray,
    Db: np.ndarray,
    G: float,
    t: float,
    kappa: float = 5.0 / 6.0,
    alstab: float = 0.1,
    q: float = 0.0,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """
    Phần tử tam giác 3 nút MIN3 của Hughes (Plate_MindLin_MIN3_static.m).
    """
    point, weight = get_gauss_t3(3)
    a1, a2, a3, b1, b2, b3, h = cal_side_t3(xcoord, ycoord)
    Ds = (kappa * (t ** 3) * G / (t ** 2 + alstab * (h ** 2))) * np.eye(2)

    kb = np.zeros((9, 9), dtype=float)
    ks = np.zeros((9, 9), dtype=float)
    fe = np.zeros(9, dtype=float)

    Bb_center = np.zeros((3, 9), dtype=float)
    Bs_center = np.zeros((2, 9), dtype=float)

    for inth in range(len(weight)):
        xi, eta = point[inth, 0], point[inth, 1]
        wt = weight[inth]
        N, dNdxi, dNdeta = shape_t3(xi, eta)
        J = cal_jacobi(dNdxi, dNdeta, xcoord, ycoord)
        detJ = np.linalg.det(J)
        invJ = np.linalg.inv(J)
        dNdx, dNdy = dnx_dny(dNdxi, dNdeta, invJ)

        Bb_raw = np.zeros((3, 9), dtype=float)
        Bb_raw[0, 2::3] = dNdx
        Bb_raw[1, 1::3] = dNdy
        Bb_raw[2, 1::3] = dNdx
        Bb_raw[2, 2::3] = dNdy
        Bb = Bb_raw @ T_MIN3

        Bs_raw = cal_bs_min3_plate(dNdx, dNdy, N, a1, a2, a3, b1, b2, b3)
        Bs = Bs_raw @ T_MIN3

        kb += (Bb.T @ Db @ Bb) * wt * detJ
        ks += (Bs.T @ Ds @ Bs) * wt * detJ

        Bb_center += Bb * wt
        Bs_center += Bs * wt

        if q != 0.0:
            f_vec = np.zeros(9, dtype=float)
            f_vec[0::3] = N
            fe += q * f_vec * wt * detJ

    # Nhân 2 cho trung bình trọng số vì sum(weight) = 0.5
    Bb_center *= 2.0
    Bs_center *= 2.0

    return kb + ks, fe, Bb_center, Bs_center


def element_cs_min3(
    xcoord: np.ndarray,
    ycoord: np.ndarray,
    Db: np.ndarray,
    G: float,
    t: float,
    kappa: float = 5.0 / 6.0,
    alstab: float = 0.1,
    q: float = 0.0,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """
    Phần tử tam giác 3 nút làm trơn trên ô CS-MIN3 (Flat_Shell_CSMIN3_static.m / D_FlatShell_MindLin_CSMIN3.m).
    """
    point, weight = get_gauss_t3(3)
    cen_x = float(np.mean(xcoord))
    cen_y = float(np.mean(ycoord))
    area = cal_area_polygon(xcoord, ycoord)
    _, _, _, _, _, _, he = cal_side_t3(xcoord, ycoord)
    Ds = (kappa * (t ** 3) * G / (t ** 2 + alstab * (he ** 2))) * np.eye(2)

    sub_tris = [
        (np.array([cen_x, xcoord[0], xcoord[1]]), np.array([cen_y, ycoord[0], ycoord[1]])),
        (np.array([cen_x, xcoord[1], xcoord[2]]), np.array([cen_y, ycoord[1], ycoord[2]])),
        (np.array([cen_x, xcoord[2], xcoord[0]]), np.array([cen_y, ycoord[2], ycoord[0]])),
    ]

    Bb_sum = np.zeros((3, 9), dtype=float)
    Bs_sum = np.zeros((2, 9), dtype=float)

    for s_el, (xs, ys) in enumerate(sub_tris, start=1):
        Ase = cal_area_polygon(xs, ys)
        detJ_sub = 2.0 * Ase
        a1, a2, a3, b1, b2, b3, _ = cal_side_t3(xs, ys)

        bb1 = np.array([[0.0, 0.0, b1], [0.0, a1, 0.0], [0.0, b1, a1]]) / detJ_sub
        bb2 = np.array([[0.0, 0.0, b2], [0.0, a2, 0.0], [0.0, b2, a2]]) / detJ_sub
        bb3 = np.array([[0.0, 0.0, b3], [0.0, a3, 0.0], [0.0, b3, a3]]) / detJ_sub

        if s_el == 1:
            Bb_sum += np.hstack([bb1 / 3.0 + bb2, bb1 / 3.0 + bb3, bb1 / 3.0]) * Ase
        elif s_el == 2:
            Bb_sum += np.hstack([bb1 / 3.0, bb1 / 3.0 + bb2, bb1 / 3.0 + bb3]) * Ase
        else:
            Bb_sum += np.hstack([bb1 / 3.0 + bb3, bb1 / 3.0, bb1 / 3.0 + bb2]) * Ase

        for inth in range(len(weight)):
            xi, eta = point[inth, 0], point[inth, 1]
            wt = weight[inth]
            N, dNdxi, dNdeta = shape_t3(xi, eta)
            J = cal_jacobi(dNdxi, dNdeta, xs, ys)
            detJ = np.linalg.det(J)
            invJ = np.linalg.inv(J)
            dNdx, dNdy = dnx_dny(dNdxi, dNdeta, invJ)

            bs = cal_bs_min3_plate(dNdx, dNdy, N, a1, a2, a3, b1, b2, b3)
            bs1, bs2, bs3 = bs[:, 0:3], bs[:, 3:6], bs[:, 6:9]

            if s_el == 1:
                Bs_sum += np.hstack([bs1 / 3.0 + bs2, bs1 / 3.0 + bs3, bs1 / 3.0]) * wt * detJ
            elif s_el == 2:
                Bs_sum += np.hstack([bs1 / 3.0, bs1 / 3.0 + bs2, bs1 / 3.0 + bs3]) * wt * detJ
            else:
                Bs_sum += np.hstack([bs1 / 3.0 + bs3, bs1 / 3.0, bs1 / 3.0 + bs2]) * wt * detJ

    Bb = (Bb_sum / area) @ T_MIN3
    Bs = (Bs_sum / area) @ T_MIN3

    kb = (Bb.T @ Db @ Bb) * area
    ks = (Bs.T @ Ds @ Bs) * area
    fe = np.zeros(9, dtype=float)
    if q != 0.0:
        fe[0::3] = q * area / 3.0

    return kb + ks, fe, Bb, Bs


# ==============================================================================
# 4. CHIA LƯỚI TẤM HÌNH VÀNH KHUYÊN (Annular Plate Mesh Generation)
# ==============================================================================

def generate_annular_mesh(
    r_inner: float,
    r_outer: float,
    nr: int,
    ntheta: int,
    element_type: str = "MITC4",
    theta_start_deg: float = 0.0,
    theta_end_deg: float = 360.0,
) -> Dict[str, Any]:
    """
    Tạo lưới phần tử hữu hạn cho tấm hình vành khuyên (hoặc quạt vành khuyên).
    - r_inner: bán kính trong (R_in > 0)
    - r_outer: bán kính ngoài (R_out > R_in)
    - nr: số phần tử theo phương bán kính
    - ntheta: số phần tử theo phương chu vi
    - element_type:
        Nhóm Q4 (4 nút): 'MITC4', 'Q4_REDUCED', 'Q4_FULL'
        Nhóm T3 (3 nút): 'CS_DSG3', 'DSG3', 'MIN3', 'CS_MIN3'
    """
    if r_inner <= 0:
        raise ValueError("Bán kính trong (R_in) phải lớn hơn 0 cho tấm hình vành khuyên.")
    if r_outer <= r_inner:
        raise ValueError("Bán kính ngoài (R_out) phải lớn hơn bán kính trong (R_in).")
    if nr < 1 or ntheta < 3:
        raise ValueError("Số phần tử nr >= 1 và ntheta >= 3.")

    span_deg = theta_end_deg - theta_start_deg
    is_full_ring = abs(span_deg - 360.0) < 1e-6 or span_deg >= 360.0
    if is_full_ring:
        span_deg = 360.0

    r_vals = np.linspace(r_inner, r_outer, nr + 1)
    if is_full_ring:
        theta_degs = np.linspace(theta_start_deg, theta_start_deg + 360.0, ntheta, endpoint=False)
        n_ang_nodes = ntheta
    else:
        theta_degs = np.linspace(theta_start_deg, theta_end_deg, ntheta + 1, endpoint=True)
        n_ang_nodes = ntheta + 1

    gcoord = []
    polar_coord = []
    inner_nodes = []
    outer_nodes = []

    node_idx = 0
    for i_r, r in enumerate(r_vals):
        for j_t, th_deg in enumerate(theta_degs):
            th_rad = math.radians(th_deg)
            x = r * math.cos(th_rad)
            y = r * math.sin(th_rad)
            gcoord.append([x, y])
            polar_coord.append([r, th_deg % 360.0 if is_full_ring else th_deg])
            if i_r == 0:
                inner_nodes.append(node_idx)
            if i_r == nr:
                outer_nodes.append(node_idx)
            node_idx += 1

    gcoord_arr = np.array(gcoord, dtype=float)
    polar_arr = np.array(polar_coord, dtype=float)

    is_triangle = element_type.upper() in ("DSG3", "CS_DSG3", "MIN3", "CS_MIN3", "T3")
    nodes = []
    quad_for_plot = []

    for i_r in range(nr):
        for j_t in range(ntheta):
            j_next = (j_t + 1) % n_ang_nodes if is_full_ring else (j_t + 1)
            n1 = i_r * n_ang_nodes + j_t
            n2 = (i_r + 1) * n_ang_nodes + j_t
            n3 = (i_r + 1) * n_ang_nodes + j_next
            n4 = i_r * n_ang_nodes + j_next
            quad_for_plot.append([n1, n2, n3, n4])
            if is_triangle:
                nodes.append([n1, n2, n3])
                nodes.append([n1, n3, n4])
            else:
                nodes.append([n1, n2, n3, n4])

    nodes_arr = np.array(nodes, dtype=int)
    return {
        "gcoord": gcoord_arr,
        "polar_coord": polar_arr,
        "nodes": nodes_arr,
        "quad_grid": np.array(quad_for_plot, dtype=int),
        "inner_nodes": inner_nodes,
        "outer_nodes": outer_nodes,
        "nnode": len(gcoord_arr),
        "nel": len(nodes_arr),
        "nnel": 3 if is_triangle else 4,
        "is_triangle": is_triangle,
        "is_full_ring": is_full_ring,
        "r_inner": r_inner,
        "r_outer": r_outer,
        "nr": nr,
        "ntheta": ntheta,
    }


# ==============================================================================
# 5. ĐỊNH VỊ ĐIỂM TRÊN LƯỚI (Tìm nút gần nhất hoặc phần tử chứa điểm đặt lực)
# ==============================================================================

def resolve_point_coords(point_spec: Dict[str, Any], gcoord: np.ndarray) -> Tuple[float, float, int]:
    """
    Chuyển thông số vị trí của người dùng (node_id, hoặc polar (r, theta_deg), hoặc cartesian (x, y))
    thành tọa độ (x, y) và chỉ số nút gần nhất (0-based).
    """
    nnode = len(gcoord)
    mode = str(point_spec.get("coord_type", "polar")).lower()

    if "node_id" in point_spec and point_spec["node_id"] is not None and mode == "node":
        nid = int(point_spec["node_id"])
        # Hỗ trợ 1-based hoặc 0-based: quy ước giao diện là 1-based (1..nnode)
        idx = max(0, min(nnode - 1, nid - 1 if nid >= 1 else 0))
        return float(gcoord[idx, 0]), float(gcoord[idx, 1]), idx

    if mode == "cartesian" or ("x" in point_spec and "y" in point_spec and "r" not in point_spec):
        x = float(point_spec.get("x", 0.0))
        y = float(point_spec.get("y", 0.0))
    else:
        r = float(point_spec.get("r", 0.0))
        theta_deg = float(point_spec.get("theta", point_spec.get("theta_deg", 0.0)))
        th_rad = math.radians(theta_deg)
        x = r * math.cos(th_rad)
        y = r * math.sin(th_rad)

    dists = np.hypot(gcoord[:, 0] - x, gcoord[:, 1] - y)
    nearest_idx = int(np.argmin(dists))
    return x, y, nearest_idx


def _point_in_triangle_barycentric(px: float, py: float, tri_xy: np.ndarray) -> Tuple[bool, np.ndarray]:
    """Kiểm tra điểm (px, py) có nằm trong tam giác tri_xy (3x2) và trả về hàm dạng N = [N1, N2, N3]."""
    x1, y1 = tri_xy[0]
    x2, y2 = tri_xy[1]
    x3, y3 = tri_xy[2]
    detT = (y2 - y3) * (x1 - x3) + (x3 - x2) * (y1 - y3)
    if abs(detT) < 1e-14:
        return False, np.array([1.0 / 3.0, 1.0 / 3.0, 1.0 / 3.0])
    l1 = ((y2 - y3) * (px - x3) + (x3 - x2) * (py - y3)) / detT
    l2 = ((y3 - y1) * (px - x3) + (x1 - x3) * (py - y3)) / detT
    l3 = 1.0 - l1 - l2
    N = np.array([l1, l2, l3])
    inside = bool(np.all(N >= -1e-5))
    return inside, np.clip(N, 0.0, 1.0) / max(np.sum(np.clip(N, 0.0, 1.0)), 1e-12)


def _invert_q4_mapping(px: float, py: float, quad_xy: np.ndarray) -> Tuple[bool, np.ndarray]:
    """
    Tìm tọa độ tự nhiên (r, s) trong [-1, 1]^2 của phần tử Q4 cho điểm (px, py) bằng Newton-Raphson.
    """
    r, s = 0.0, 0.0
    xcoord = quad_xy[:, 0]
    ycoord = quad_xy[:, 1]
    for _ in range(12):
        N, dNdxi, dNdeta = shape_q4(r, s, 1.0)
        fx = float(np.dot(N, xcoord) - px)
        fy = float(np.dot(N, ycoord) - py)
        if math.hypot(fx, fy) < 1e-9:
            break
        J = cal_jacobi(dNdxi, dNdeta, xcoord, ycoord)
        detJ = np.linalg.det(J)
        if abs(detJ) < 1e-14:
            break
        # J = [[dx/dr, dy/dr], [dx/ds, dy/ds]] => [dx, dy]^T = J^T [dr, ds]^T
        delta = np.linalg.solve(J.T, np.array([fx, fy]))
        r -= float(delta[0])
        s -= float(delta[1])

    inside = (abs(r) <= 1.0 + 1e-4) and (abs(s) <= 1.0 + 1e-4)
    N, _, _ = shape_q4(float(np.clip(r, -1.0, 1.0)), float(np.clip(s, -1.0, 1.0)), 1.0)
    return inside, N


def find_containing_element_weights(
    px: float,
    py: float,
    gcoord: np.ndarray,
    nodes: np.ndarray,
    is_triangle: bool,
) -> Optional[Tuple[int, np.ndarray, np.ndarray]]:
    """
    Tìm phần tử chứa điểm (px, py) và trả về (elem_idx, elem_nodes, shape_weights N).
    Nếu điểm nằm ngoài miền một chút, trả về None để fallback về nút gần nhất.
    """
    elem_centers = np.mean(gcoord[nodes], axis=1)
    order = np.argsort(np.hypot(elem_centers[:, 0] - px, elem_centers[:, 1] - py))

    for iel in order[:16]:
        nd = nodes[iel]
        el_xy = gcoord[nd]
        if is_triangle:
            inside, N = _point_in_triangle_barycentric(px, py, el_xy)
            if inside:
                return int(iel), nd, N
        else:
            # Kiểm tra nhanh bằng 2 tam giác trước khi giải Newton-Raphson Q4
            in1, _ = _point_in_triangle_barycentric(px, py, el_xy[[0, 1, 2]])
            in2, _ = _point_in_triangle_barycentric(px, py, el_xy[[0, 2, 3]])
            if in1 or in2:
                inside, N = _invert_q4_mapping(px, py, el_xy)
                if inside:
                    return int(iel), nd, N
    return None


# ==============================================================================
# 6. BỘ GIẢI CHÍNH (SOLVER) CHO BÀI TOÁN TẤM DÀY HÌNH VÀNH KHUYÊN
# ==============================================================================

def solve_annular_plate(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Giải bài toán FEM tấm dày hình vành khuyên với các thông số, gối đỡ và lực do người dùng nhập.
    """
    # 1. Thông số hình học & vật liệu
    r_inner = float(params.get("r_inner", 0.3))
    r_outer = float(params.get("r_outer", 1.0))
    t = float(params.get("thickness", 0.1))
    E = float(params.get("E", 2.0e11))
    nu = float(params.get("nu", 0.3))
    kappa = float(params.get("kappa", 5.0 / 6.0))
    alstab = float(params.get("alstab", 0.1))
    q_uniform = float(params.get("q_uniform", 0.0))

    nr = int(params.get("nr", 10))
    ntheta = int(params.get("ntheta", 36))
    element_type = str(params.get("element_type", "MITC4")).upper()
    theta_start_deg = float(params.get("theta_start_deg", 0.0))
    theta_end_deg = float(params.get("theta_end_deg", 360.0))
    load_distribution_mode = str(params.get("load_distribution_mode", "element")).lower()

    # 2. Tạo lưới phần tử
    mesh = generate_annular_mesh(
        r_inner=r_inner,
        r_outer=r_outer,
        nr=nr,
        ntheta=ntheta,
        element_type=element_type,
        theta_start_deg=theta_start_deg,
        theta_end_deg=theta_end_deg,
    )
    gcoord = mesh["gcoord"]
    polar_coord = mesh["polar_coord"]
    nodes = mesh["nodes"]
    nnode = mesh["nnode"]
    nel = mesh["nel"]
    nnel = mesh["nnel"]
    is_triangle = mesh["is_triangle"]
    ndof = 3
    sdof = nnode * ndof

    # 3. Ma trận vật liệu Db, Ds
    Db, Ds, G = material_matrices(E, nu, t, kappa)

    # 4. Lắp ghép ma trận độ cứng toàn cục K và vector tải phân bố F
    K_lil = lil_matrix((sdof, sdof), dtype=float)
    F = np.zeros(sdof, dtype=float)

    elem_Bb_list: List[np.ndarray] = []
    elem_Bs_list: List[np.ndarray] = []
    elem_Ds_list: List[np.ndarray] = []
    elem_areas = np.zeros(nel, dtype=float)

    for iel in range(nel):
        nd = nodes[iel]
        xcoord = gcoord[nd, 0]
        ycoord = gcoord[nd, 1]
        elem_areas[iel] = cal_area_polygon(xcoord, ycoord)

        if element_type == "MITC4":
            ke, fe, Bb_c, Bs_c = element_mitc4(xcoord, ycoord, Db, Ds, q_uniform)
            Ds_el = Ds
        elif element_type == "Q4_REDUCED":
            ke, fe, Bb_c, Bs_c = element_q4_mindlin(xcoord, ycoord, Db, Ds, q_uniform, reduced_shear=True)
            Ds_el = Ds
        elif element_type == "Q4_FULL":
            ke, fe, Bb_c, Bs_c = element_q4_mindlin(xcoord, ycoord, Db, Ds, q_uniform, reduced_shear=False)
            Ds_el = Ds
        elif element_type == "DSG3":
            ke, fe, Bb_c, Bs_c = element_dsg3(xcoord, ycoord, Db, G, t, kappa, alstab, q_uniform)
            _, _, _, _, _, _, he = cal_side_t3(xcoord, ycoord)
            Ds_el = ((G * kappa * (t ** 3)) / (t ** 2 + alstab * (he ** 2))) * np.eye(2)
        elif element_type == "CS_DSG3":
            ke, fe, Bb_c, Bs_c = element_cs_dsg3(xcoord, ycoord, Db, G, t, kappa, alstab, q_uniform)
            _, _, _, _, _, _, he = cal_side_t3(xcoord, ycoord)
            Ds_el = ((G * kappa * (t ** 3)) / (t ** 2 + alstab * (he ** 2))) * np.eye(2)
        elif element_type == "MIN3":
            ke, fe, Bb_c, Bs_c = element_min3(xcoord, ycoord, Db, G, t, kappa, alstab, q_uniform)
            _, _, _, _, _, _, he = cal_side_t3(xcoord, ycoord)
            Ds_el = ((kappa * (t ** 3) * G) / (t ** 2 + alstab * (he ** 2))) * np.eye(2)
        elif element_type == "CS_MIN3":
            ke, fe, Bb_c, Bs_c = element_cs_min3(xcoord, ycoord, Db, G, t, kappa, alstab, q_uniform)
            _, _, _, _, _, _, he = cal_side_t3(xcoord, ycoord)
            Ds_el = ((kappa * (t ** 3) * G) / (t ** 2 + alstab * (he ** 2))) * np.eye(2)
        else:
            raise ValueError(f"Không hỗ trợ loại phần tử: {element_type}")

        elem_Bb_list.append(Bb_c)
        elem_Bs_list.append(Bs_c)
        elem_Ds_list.append(Ds_el)

        # index_assemble (0-based)
        index = np.empty(nnel * ndof, dtype=int)
        for idx_n, node_i in enumerate(nd):
            index[3 * idx_n:3 * idx_n + 3] = [3 * node_i, 3 * node_i + 1, 3 * node_i + 2]

        K_lil[np.ix_(index, index)] += ke
        F[index] += fe

    # 5. Đặt các lực tập trung (Point Loads) do người dùng nhập
    point_loads_input = params.get("point_loads", [])
    resolved_loads = []

    for ld_idx, ld in enumerate(point_loads_input):
        fz = float(ld.get("fz", ld.get("P", 0.0)))
        mx = float(ld.get("mx", 0.0))
        my = float(ld.get("my", 0.0))
        px, py, nearest_node = resolve_point_coords(ld, gcoord)
        pr = math.hypot(px, py)
        ptheta = math.degrees(math.atan2(py, px)) % 360.0

        mode_this = str(ld.get("distribution", load_distribution_mode)).lower()
        elem_match = None
        if mode_this == "element" and str(ld.get("coord_type", "polar")).lower() != "node":
            elem_match = find_containing_element_weights(px, py, gcoord, nodes, is_triangle)

        if elem_match is not None:
            iel_hit, nd_hit, N_weights = elem_match
            for loc_i, glob_n in enumerate(nd_hit):
                w_n = float(N_weights[loc_i])
                F[3 * glob_n] += w_n * fz
                F[3 * glob_n + 1] += w_n * mx
                F[3 * glob_n + 2] += w_n * my
            applied_info = {
                "method": "element_interpolation",
                "element_id": int(iel_hit + 1),
                "nearest_node_id": int(nearest_node + 1),
                "x": px,
                "y": py,
            }
        else:
            # Gán trực tiếp vào nút gần nhất
            F[3 * nearest_node] += fz
            F[3 * nearest_node + 1] += mx
            F[3 * nearest_node + 2] += my
            applied_info = {
                "method": "nearest_node",
                "element_id": None,
                "nearest_node_id": int(nearest_node + 1),
                "x": float(gcoord[nearest_node, 0]),
                "y": float(gcoord[nearest_node, 1]),
            }

        resolved_loads.append({
            "id": ld_idx + 1,
            "label": ld.get("label", f"Lực P{ld_idx + 1}"),
            "input_x": px,
            "input_y": py,
            "input_r": pr,
            "input_theta": ptheta,
            "applied_x": applied_info["x"],
            "applied_y": applied_info["y"],
            "nearest_node_id": applied_info["nearest_node_id"],
            "element_id": applied_info["element_id"],
            "method": applied_info["method"],
            "fz": fz,
            "mx": mx,
            "my": my,
        })

    # 6. Xử lý điều kiện biên và các điểm đặt gối (Supports) do người dùng nhập
    # Map: dof_index -> prescribed_value
    constrained_dofs: Dict[int, float] = {}
    support_nodes_meta: Dict[int, Dict[str, Any]] = {}

    def _add_node_support(node_idx: int, sup_type: str, label: str, custom_flags: Optional[Dict[str, Any]] = None):
        stype = sup_type.lower()
        fix_w = True
        fix_tx = False
        fix_ty = False
        val_w = 0.0
        val_tx = 0.0
        val_ty = 0.0

        if stype in ("clamped", "fixed", "ngam"):
            fix_w, fix_tx, fix_ty = True, True, True
        elif stype in ("pinned", "simply_supported", "goi", "hinged", "ss"):
            fix_w, fix_tx, fix_ty = True, False, False
        elif stype in ("roller_x", "truot_x"):
            fix_w, fix_tx, fix_ty = True, True, False
        elif stype in ("roller_y", "truot_y"):
            fix_w, fix_tx, fix_ty = True, False, True
        elif stype == "custom" and custom_flags:
            fix_w = bool(custom_flags.get("fix_w", True))
            fix_tx = bool(custom_flags.get("fix_theta_x", False))
            fix_ty = bool(custom_flags.get("fix_theta_y", False))
            val_w = float(custom_flags.get("val_w", 0.0))
            val_tx = float(custom_flags.get("val_theta_x", 0.0))
            val_ty = float(custom_flags.get("val_theta_y", 0.0))

        if fix_w:
            constrained_dofs[3 * node_idx] = val_w
        if fix_tx:
            constrained_dofs[3 * node_idx + 1] = val_tx
        if fix_ty:
            constrained_dofs[3 * node_idx + 2] = val_ty

        prev = support_nodes_meta.get(node_idx, {"fix_w": False, "fix_theta_x": False, "fix_theta_y": False})
        support_nodes_meta[node_idx] = {
            "node_id": int(node_idx + 1),
            "x": float(gcoord[node_idx, 0]),
            "y": float(gcoord[node_idx, 1]),
            "r": float(polar_coord[node_idx, 0]),
            "theta": float(polar_coord[node_idx, 1]),
            "type": stype,
            "label": label,
            "fix_w": prev["fix_w"] or fix_w,
            "fix_theta_x": prev["fix_theta_x"] or fix_tx,
            "fix_theta_y": prev["fix_theta_y"] or fix_ty,
        }

    # 6a. Điều kiện biên cạnh trong / cạnh ngoài (nếu người dùng bật)
    bc_inner = str(params.get("bc_inner", "free")).lower()
    bc_outer = str(params.get("bc_outer", "free")).lower()

    if bc_inner not in ("free", "none", "tu_do", ""):
        for nid in mesh["inner_nodes"]:
            _add_node_support(nid, bc_inner, "Biên trong (R_in)")

    if bc_outer not in ("free", "none", "tu_do", ""):
        for nid in mesh["outer_nodes"]:
            _add_node_support(nid, bc_outer, "Biên ngoài (R_out)")

    # 6b. Các điểm đặt gối đơn lẻ do người dùng tự nhập
    point_supports_input = params.get("point_supports", [])
    resolved_point_supports = []
    for sup_idx, sup in enumerate(point_supports_input):
        sx, sy, nearest_node = resolve_point_coords(sup, gcoord)
        stype = str(sup.get("type", "pinned")).lower()
        lbl = sup.get("label", f"Gối S{sup_idx + 1}")
        _add_node_support(nearest_node, stype, lbl, sup)
        resolved_point_supports.append({
            "id": sup_idx + 1,
            "label": lbl,
            "type": stype,
            "input_x": sx,
            "input_y": sy,
            "node_id": int(nearest_node + 1),
            "node_x": float(gcoord[nearest_node, 0]),
            "node_y": float(gcoord[nearest_node, 1]),
            "node_r": float(polar_coord[nearest_node, 0]),
            "node_theta": float(polar_coord[nearest_node, 1]),
            "fix_w": support_nodes_meta[nearest_node]["fix_w"],
            "fix_theta_x": support_nodes_meta[nearest_node]["fix_theta_x"],
            "fix_theta_y": support_nodes_meta[nearest_node]["fix_theta_y"],
        })

    if len(constrained_dofs) == 0:
        raise ValueError(
            "Chưa có điều kiện gối đỡ nào! Vui lòng thêm ít nhất các điểm đặt gối (hoặc chọn điều kiện biên) để hệ kết cấu không bị biến hình."
        )

    # 7. Giải hệ phương trình [K]{U} = {F} (Tương ứng apply_condition.m nhưng bảo toàn K gốc để tính phản lực chính xác)
    K_orig = K_lil.tocsr()
    F_orig = F.copy()

    bcdof = np.array(sorted(constrained_dofs.keys()), dtype=int)
    bcval = np.array([constrained_dofs[d] for d in bcdof], dtype=float)

    all_dofs = np.arange(sdof, dtype=int)
    is_constrained = np.zeros(sdof, dtype=bool)
    is_constrained[bcdof] = True
    free_dofs = all_dofs[~is_constrained]

    U = np.zeros(sdof, dtype=float)
    U[bcdof] = bcval

    if len(free_dofs) > 0:
        K_ff = K_orig[free_dofs, :][:, free_dofs]
        rhs = F_orig[free_dofs]
        if np.any(bcval != 0.0):
            K_fc = K_orig[free_dofs, :][:, bcdof]
            rhs = rhs - K_fc @ bcval

        # Kiểm tra suy biến (nếu chỉ có 1-2 gối bản lề không đủ khóa chuyển vị xoay cứng)
        # Thêm độ cứng nhỏ ổn định nếu ma trận gần suy biến
        diag_max = float(np.max(np.abs(K_ff.diagonal()))) if K_ff.shape[0] > 0 else 1.0
        try:
            U_free = spsolve(K_ff, rhs)
            if np.any(~np.isfinite(U_free)):
                raise RuntimeError("Singular matrix")
        except Exception:
            reg = 1e-10 * max(diag_max, 1.0)
            U_free = spsolve(K_ff + reg * csr_matrix(np.eye(len(free_dofs))), rhs)
        U[free_dofs] = U_free

    # Vector phản lực toàn cục: R = K_orig * U - F_orig
    R_full = K_orig.dot(U) - F_orig

    # Trích xuất chuyển vị tại các nút
    W = U[0::3]
    theta_x = U[1::3]
    theta_y = U[2::3]

    # Góc xoay trong hệ tọa độ cực (theta_r, theta_theta)
    angles_rad = np.radians(polar_coord[:, 1])
    cos_t = np.cos(angles_rad)
    sin_t = np.sin(angles_rad)
    # beta_x = theta_y, beta_y = -theta_x
    beta_x = theta_y
    beta_y = -theta_x
    beta_r = beta_x * cos_t + beta_y * sin_t
    beta_theta = -beta_x * sin_t + beta_y * cos_t

    # 8. Hậu xử lý (Post-processing): Tính nội lực Moment (Mx, My, Mxy, Mr, Mtheta, Mrtheta),
    #    lực cắt (Qx, Qy, Qr, Qtheta) và ứng suất tương đương Von Mises tại nút (trung bình theo diện tích phần tử)
    nodal_moment = np.zeros((nnode, 3), dtype=float)   # [Mx, My, Mxy]
    nodal_shear = np.zeros((nnode, 2), dtype=float)    # [Qx, Qy]
    nodal_area = np.zeros(nnode, dtype=float)

    for iel in range(nel):
        nd = nodes[iel]
        index = np.empty(nnel * ndof, dtype=int)
        for idx_n, node_i in enumerate(nd):
            index[3 * idx_n:3 * idx_n + 3] = [3 * node_i, 3 * node_i + 1, 3 * node_i + 2]
        edisp = U[index]

        Bb_c = elem_Bb_list[iel]
        Bs_c = elem_Bs_list[iel]
        Ds_el = elem_Ds_list[iel]
        area_el = elem_areas[iel]

        m_el = Db @ (Bb_c @ edisp)      # [Mx, My, Mxy]
        q_el = Ds_el @ (Bs_c @ edisp)   # [Qx, Qy]

        for node_i in nd:
            nodal_moment[node_i] += m_el * area_el
            nodal_shear[node_i] += q_el * area_el
            nodal_area[node_i] += area_el

    nodal_area_safe = np.where(nodal_area > 0, nodal_area, 1.0)
    nodal_moment /= nodal_area_safe[:, None]
    nodal_shear /= nodal_area_safe[:, None]

    Mx = nodal_moment[:, 0]
    My = nodal_moment[:, 1]
    Mxy = nodal_moment[:, 2]
    Qx = nodal_shear[:, 0]
    Qy = nodal_shear[:, 1]

    # Chuyển đổi Moment & Lực cắt sang hệ tọa độ cực (r, theta) cho tấm hình vành khuyên
    cos2 = cos_t ** 2
    sin2 = sin_t ** 2
    sincos = sin_t * cos_t

    Mr = Mx * cos2 + My * sin2 + 2.0 * Mxy * sincos
    Mtheta = Mx * sin2 + My * cos2 - 2.0 * Mxy * sincos
    Mrtheta = (My - Mx) * sincos + Mxy * (cos2 - sin2)

    Qr = Qx * cos_t + Qy * sin_t
    Qtheta = -Qx * sin_t + Qy * cos_t

    # Ứng suất uốn cực đại tại mặt trên/dưới tấm (z = +- t/2): sigma = 6*M / t^2, tau = 1.5*Q / t
    sigma_xx = 6.0 * Mx / (t ** 2)
    sigma_yy = 6.0 * My / (t ** 2)
    tau_xy = 6.0 * Mxy / (t ** 2)
    tau_xz = 1.5 * Qx / t
    tau_yz = 1.5 * Qy / t
    sigma_vm = np.sqrt(
        sigma_xx ** 2 + sigma_yy ** 2 - sigma_xx * sigma_yy
        + 3.0 * (tau_xy ** 2 + tau_xz ** 2 + tau_yz ** 2)
    )

    # 9. Tổng hợp phản lực tại các gối đỡ
    reactions_list = []
    total_rz = 0.0
    for node_idx in sorted(support_nodes_meta.keys()):
        meta = support_nodes_meta[node_idx]
        rz = float(R_full[3 * node_idx]) if meta["fix_w"] else 0.0
        mrx = float(R_full[3 * node_idx + 1]) if meta["fix_theta_x"] else 0.0
        mry = float(R_full[3 * node_idx + 2]) if meta["fix_theta_y"] else 0.0
        total_rz += rz
        reactions_list.append({
            **meta,
            "Rz": rz,
            "Mrx": mrx,
            "Mry": mry,
        })

    total_applied_fz = float(np.sum(F_orig[0::3]))
    strain_energy = float(0.5 * np.dot(U, K_orig.dot(U)))

    idx_w_max = int(np.argmax(np.abs(W)))
    idx_vm_max = int(np.argmax(sigma_vm))

    D_flex = (E * (t ** 3)) / (12.0 * (1.0 - nu ** 2))

    return {
        "summary": {
            "element_type": element_type,
            "nnode": nnode,
            "nel": nel,
            "sdof": sdof,
            "constrained_dof_count": len(bcdof),
            "r_inner": r_inner,
            "r_outer": r_outer,
            "thickness": t,
            "E": E,
            "nu": nu,
            "kappa": kappa,
            "D_flexural": D_flex,
            "w_max_abs": float(np.max(np.abs(W))),
            "w_min": float(np.min(W)),
            "w_max": float(np.max(W)),
            "w_max_node_id": int(idx_w_max + 1),
            "w_max_r": float(polar_coord[idx_w_max, 0]),
            "w_max_theta": float(polar_coord[idx_w_max, 1]),
            "sigma_vm_max": float(np.max(sigma_vm)),
            "sigma_vm_max_node_id": int(idx_vm_max + 1),
            "Mr_max_abs": float(np.max(np.abs(Mr))),
            "Mtheta_max_abs": float(np.max(np.abs(Mtheta))),
            "Qr_max_abs": float(np.max(np.abs(Qr))),
            "strain_energy": strain_energy,
            "total_applied_fz": total_applied_fz,
            "total_reaction_rz": total_rz,
            "force_balance_error": abs(total_applied_fz + total_rz),
        },
        "mesh": {
            "gcoord": gcoord.tolist(),
            "polar_coord": polar_coord.tolist(),
            "nodes": nodes.tolist(),
            "quad_grid": mesh["quad_grid"].tolist(),
            "inner_nodes": [int(i + 1) for i in mesh["inner_nodes"]],
            "outer_nodes": [int(i + 1) for i in mesh["outer_nodes"]],
            "is_triangle": is_triangle,
            "nr": nr,
            "ntheta": ntheta,
        },
        "fields": {
            "w": W.tolist(),
            "theta_x": theta_x.tolist(),
            "theta_y": theta_y.tolist(),
            "beta_r": beta_r.tolist(),
            "beta_theta": beta_theta.tolist(),
            "Mx": Mx.tolist(),
            "My": My.tolist(),
            "Mxy": Mxy.tolist(),
            "Mr": Mr.tolist(),
            "Mtheta": Mtheta.tolist(),
            "Mrtheta": Mrtheta.tolist(),
            "Qx": Qx.tolist(),
            "Qy": Qy.tolist(),
            "Qr": Qr.tolist(),
            "Qtheta": Qtheta.tolist(),
            "sigma_vm": sigma_vm.tolist(),
        },
        "resolved_loads": resolved_loads,
        "resolved_point_supports": resolved_point_supports,
        "reactions": reactions_list,
    }


if __name__ == "__main__":
    for el_type in ["MITC4", "Q4_REDUCED", "Q4_FULL", "DSG3", "CS_DSG3", "MIN3", "CS_MIN3"]:
        res = solve_annular_plate({
            "r_inner": 0.3,
            "r_outer": 1.0,
            "thickness": 0.1,
            "E": 2e11,
            "nu": 0.3,
            "nr": 10,
            "ntheta": 36,
            "element_type": el_type,
            "bc_inner": "free",
            "bc_outer": "clamped",
            "point_supports": [],
            "point_loads": [
                {"coord_type": "polar", "r": 0.3, "theta": 0.0, "fz": -10000.0},
                {"coord_type": "polar", "r": 0.3, "theta": 120.0, "fz": -10000.0},
                {"coord_type": "polar", "r": 0.3, "theta": 240.0, "fz": -10000.0},
            ],
        })
        s = res["summary"]
        print(
            f"{el_type:10s} | w_max = {s['w_max_abs']*1e3:.4f} mm | "
            f"sigma_vm = {s['sigma_vm_max']*1e-6:.2f} MPa | "
            f"F_err = {s['force_balance_error']:.2e}"
        )

