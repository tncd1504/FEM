/**
 * contact_checker.js — Triển khai Bài tính BT04 (Nén tại vùng tiếp xúc cọc–kê và cọc–cọc)
 * và Bài tính BT05 (Ép ngang, uốn vòng và nứt thành cọc rỗng) theo hệ đơn vị chuẩn SI (m, kg, s, N, Pa).
 *
 * Nguyên tắc bắt buộc (Plan v0.5.0 & Skill fem-web):
 * - Thanh kê gỗ 100 × 100 mm (0,1 × 0,1 m, A = 0,01 m²) được mô hình là vật rắn tuyệt đối cứng;
 *   không kiểm tra nén hay biến dạng gỗ. Chỉ kiểm tra ứng suất/sức kháng nén cục bộ phía cọc.
 * - Không coi diện tiếp xúc bằng diện tích tiết diện cọc Ag hoặc diện tích tiết diện gỗ 0,01 m².
 * - Lực đầu vào là giá trị tiêu chuẩn (tải bản thân); kiểm tra TTGH I nhân γf (TCVN 2737), kiểm tra nứt dùng giá trị tiêu chuẩn.
 * - Trong BT05: lấy đúng hàm lượng và vị trí bán kính cốt đai xoắn theo vùng section(x);
 *   dự ứng lực dọc σ_pc không được coi là dự ứng lực vòng; kiểm tra R/A trung bình không thay thế kiểm tra uốn vòng.
 * - Vòng kín chịu các lực hướng kính bất kỳ; phần không tự cân bằng được truyền vào thân cọc (dầm) bằng dòng cắt
 *   tiếp tuyến q(θ) = (G·t(θ))/(π·R) — không dùng hệ số kinh nghiệm.
 */
import { TCVN5574 } from './standards/tcvn5574_factors.js';

function deepFreeze(obj) {
  if (!obj || typeof obj !== 'object' || Object.isFrozen(obj)) return obj;
  Object.freeze(obj);
  for (const k of Object.keys(obj)) {
    if (obj[k] && typeof obj[k] === 'object') deepFreeze(obj[k]);
  }
  return obj;
}

const NU_CONCRETE = 0.2;

/**
 * BT04 — Kiểm tra nén cục bộ phía cọc tại vùng tiếp xúc cọc–kê (thanh kê gỗ cứng 100×100 mm) hoặc cọc–cọc.
 *
 * @param {object} params
 * @param {object} params.bt00 kết quả BT00 đã kiểm chứng
 * @param {number} params.normalForce_N lực nén pháp tuyến tiêu chuẩn tại vùng tiếp xúc (N, ≥ 0)
 * @param {'pile_batten'|'pile_pile'} [params.contactType='pile_batten'] loại tiếp xúc
 * @param {number} [params.contactLengthAlongPile_m=0.1] chiều dài tiếp xúc dọc trục cọc bx (m)
 * @param {number} [params.contactArcAngle_deg] góc ôm tiếp xúc trên chu vi cọc (độ) — BẮT BUỘC với 'pile_batten'
 *   (đại diện cho vùng tiếp xúc thực tế giữa mặt trụ cọc và thanh kê; kết quả nhạy với giá trị này)
 * @param {number} [params.gamma_f] hệ số độ tin cậy về tải (mặc định γf tải bản thân theo TCVN 2737)
 */
export function runBT04({
  bt00,
  normalForce_N,
  contactType = 'pile_batten',
  contactLengthAlongPile_m = 0.1,
  contactArcAngle_deg,
  gamma_f = TCVN5574.loads.gamma_f_selfWeight,
}) {
  if (!bt00 || !bt00.valid || !bt00.record?.computed) {
    throw new Error('BT04 yêu cầu kết quả BT00 hợp lệ');
  }
  const N_ser = Number(normalForce_N);
  if (!(N_ser >= 0)) throw new Error('Lực pháp tuyến tiếp xúc normalForce_N phải >= 0');
  if (contactType !== 'pile_batten' && contactType !== 'pile_pile') {
    throw new Error(`contactType không hợp lệ: "${contactType}"`);
  }
  if (contactType === 'pile_batten' && !Number.isFinite(Number(contactArcAngle_deg))) {
    throw new Error('BT04 (cọc–kê) bắt buộc khai báo góc ôm tiếp xúc contactArcAngle_deg (độ); không tự gán giá trị mặc định.');
  }
  const N_c = gamma_f * N_ser; // lực tính toán TTGH I

  const sec = bt00.record.computed.section;
  const conc = bt00.record.computed.concrete;
  const { Do, t, Ag } = sec;
  const bx = Number(contactLengthAlongPile_m);
  if (!(bx > 0 && bx <= sec.L)) {
    throw new Error(`Chiều dài tiếp xúc dọc trục bx = ${bx} m không hợp lệ`);
  }

  // Bề rộng tiếp xúc đàn hồi Hertz (đường): cọc trên mặt phẳng cứng (R_eff = Do/2, E* = E/(1-ν²))
  // hoặc hai cọc cùng vật liệu (R_eff = Do/4, E* = E/(2(1-ν²)))
  const R_eff = contactType === 'pile_pile' ? Do / 4 : Do / 2;
  const E_star = contactType === 'pile_pile'
    ? conc.Eb / (2 * (1 - NU_CONCRETE * NU_CONCRETE))
    : conc.Eb / (1 - NU_CONCRETE * NU_CONCRETE);
  const q_line = N_c / bx; // N/m
  const a_hertz_m = Math.sqrt((4 * q_line * R_eff) / (Math.PI * E_star));
  const b_hertz_m = Math.max(2 * a_hertz_m, 1e-4);

  let bc_chord_m = null;
  let bc_effective_m;
  let widthBasis;
  if (contactType === 'pile_batten') {
    const theta_rad = (Math.max(2, Math.min(60, Number(contactArcAngle_deg))) * Math.PI) / 180;
    bc_chord_m = Do * Math.sin(theta_rad / 2);
    bc_effective_m = Math.max(bc_chord_m, b_hertz_m);
    widthBasis = 'max(dây cung theo góc ôm khai báo, bề rộng Hertz)';
  } else {
    bc_effective_m = b_hertz_m;
    widthBasis = 'Bề rộng tiếp xúc Hertz cọc–cọc (đàn hồi, thiên an toàn)';
  }

  const A_loc_m2 = bx * bc_effective_m;
  const A_batten_cross_section_m2 = 0.1 * 0.1; // 0,01 m²

  // Phân bố áp lực đều tương đương và phân bố elip (Hertz-type)
  const p_avg_Pa = N_c / A_loc_m2;
  const p_max_elliptical_Pa = (4 / Math.PI) * p_avg_Pa;

  // Tích phân số kiểm chứng cân bằng áp lực tiếp xúc: ∫ p(y) * bx dy = N_c
  const nGauss = 60;
  let integralForce_N = 0;
  for (let i = 0; i < nGauss; i++) {
    const phi = -Math.PI / 2 + ((i + 0.5) / nGauss) * Math.PI;
    const dphi = Math.PI / nGauss;
    integralForce_N += p_max_elliptical_Pa * bx * (bc_effective_m / 2) * (Math.cos(phi) ** 2) * dphi;
  }
  const equilibriumRelError = Math.abs(integralForce_N - N_c) / Math.max(N_c, 1);

  // Sức kháng nén cục bộ phía bê tông cọc theo TCVN 5574:2018 Mục 8.1.5
  // Diện tích tính toán lớn nhất mở rộng đối xứng một khoảng t mỗi phía: A_max = min(L, bx + 2t) · min(Do, bc + 2t)
  const LC = TCVN5574.localCompression;
  const A_loc_max_m2 = Math.min(sec.L, bx + 2 * t) * Math.min(Do, bc_effective_m + 2 * t);
  const phi_b = Math.min(LC.phi_b_max, Math.max(LC.phi_b_min, LC.phi_b_coeff * Math.sqrt(Math.max(A_loc_max_m2, A_loc_m2) / A_loc_m2)));
  const Rb_loc_Pa = phi_b * conc.Rb;
  const psi = LC.psi_nonUniform;
  const N_loc_Rd_N = psi * Rb_loc_Pa * A_loc_m2;
  const utilization = N_c / N_loc_Rd_N;

  return deepFreeze({
    code: 'BT04',
    title: 'BT04: Kiểm tra nén cục bộ phía cọc tại vùng tiếp xúc cọc–kê cứng 100×100 mm và cọc–cọc',
    valid: true,
    verified: equilibriumRelError < 1e-3 && A_loc_m2 < Ag && Math.abs(A_loc_m2 - A_batten_cross_section_m2) > 1e-6,
    standard: 'TCVN 5574:2018 Mục 8.1.5',
    timberBattenPolicy: {
      section_m: '0,1 × 0,1 m (100 × 100 mm)',
      crossSectionArea_m2: A_batten_cross_section_m2,
      model: 'rigid_body_no_timber_check',
      timberCheckPerformed: false,
    },
    inputsSI: {
      normalForce_N: N_ser,
      gamma_f,
      designNormalForce_N: N_c,
      contactType,
      bx_m: bx,
      contactArcAngle_deg: contactType === 'pile_batten' ? Number(contactArcAngle_deg) : null,
    },
    contactGeometrySI: {
      widthBasis,
      bc_chord_m,
      b_hertz_m,
      bc_effective_m,
      A_loc_m2,
      A_loc_max_m2,
      Ag_pile_m2: Ag,
    },
    pressuresSI: {
      p_avg_Pa,
      p_max_elliptical_Pa,
      integralForce_N,
      equilibriumRelError,
    },
    capacitySI: {
      phi_b,
      psi,
      Rb_Pa: conc.Rb,
      Rb_loc_Pa,
      N_loc_Rd_N,
      utilization,
      pass: utilization <= 1.0,
      clause: LC.clause,
    },
    validityDomain: {
      model: 'Nén cục bộ TCVN 5574:2018 Mục 8.1.5 kết hợp bề rộng tiếp xúc mặt trụ',
      note:
        contactType === 'pile_batten'
          ? 'Kết quả nhạy với góc ôm tiếp xúc khai báo; không thay thế kiểm tra uốn vòng thành cọc rỗng tại BT05.'
          : 'Bề rộng Hertz đàn hồi cho tiếp xúc cọc–cọc là cận an toàn; chưa xét phân bố lại do ép vỡ cục bộ.',
    },
  });
}

// ---------------------------------------------------------------------------------------------
// Vòng kín đàn hồi: lời giải phương pháp lực tổng quát
// Hệ tọa độ: x ngang (phải +), y đứng (lên +); θ đo từ đỉnh (θ = 0) theo chiều kim đồng hồ.
// ---------------------------------------------------------------------------------------------
const TWO_PI = 2 * Math.PI;
const normAngle = (th) => {
  let a = th % TWO_PI;
  if (a < 0) a += TWO_PI;
  return a;
};
const ringPos = (R, th) => [R * Math.sin(th), R * Math.cos(th)];
const ringTangent = (th) => [Math.cos(th), -Math.sin(th)];
const ringInward = (th) => [-Math.sin(th), -Math.cos(th)];
const cross2 = (a, b) => a[0] * b[1] - a[1] * b[0];

// Gauss–Legendre 8 điểm trên [-1, 1]
const GL8_X = [-0.9602898564975363, -0.7966664774136267, -0.5255324099163290, -0.1834346424956498,
  0.1834346424956498, 0.5255324099163290, 0.7966664774136267, 0.9602898564975363];
const GL8_W = [0.1012285362903763, 0.2223810344533745, 0.3137066458778873, 0.3626837833783620,
  0.3626837833783620, 0.3137066458778873, 0.2223810344533745, 0.1012285362903763];

/**
 * Giải nội lực vòng kín bán kính trung bình R chịu các lực hướng kính điểm {(P_k, θ_k)} (P_k > 0 hướng vào tâm).
 * Nếu hệ lực điểm không tự cân bằng, hợp lực còn lại được cân bằng bởi dòng cắt tiếp tuyến từ thân dầm
 * q(θ) = (G·t(θ))/(π·R) (phân bố dòng cắt của tiết diện vành khăn mỏng chịu lực cắt G).
 * Ẩn số dư (M0, Fx0, Fy0) tại mặt cắt θ = 0⁻ xác định từ điều kiện tương thích (chỉ xét biến dạng uốn).
 *
 * Quy ước dấu đầu ra: M > 0 căng thớ trong; N > 0 kéo vòng.
 */
export function solveClosedRing({ rm_m: R, radialLoads }) {
  const pts = radialLoads
    .filter(l => Math.abs(l.P_N) > 0)
    .map(l => {
      const th = normAngle(l.theta_rad);
      const dir = ringInward(th);
      return { th, P: l.P_N, F: [l.P_N * dir[0], l.P_N * dir[1]], label: l.label };
    })
    .sort((a, b) => a.th - b.th);
  const G = [0, 0];
  for (const p of pts) { G[0] -= p.F[0]; G[1] -= p.F[1]; }

  const A = ringPos(R, 0);

  // Trạng thái do tải (không kể ẩn số dư) tại mặt cắt θ trên vật thể từ 0⁻ đến θ
  const loadState = (th) => {
    const s = ringPos(R, th);
    let M = 0;
    const Fsum = [0, 0];
    for (const p of pts) {
      if (p.th <= th + 1e-15) {
        const ps = ringPos(R, p.th);
        M += cross2([ps[0] - s[0], ps[1] - s[1]], p.F);
        Fsum[0] += p.F[0];
        Fsum[1] += p.F[1];
      }
    }
    const s2 = Math.sin(2 * th);
    const sn = Math.sin(th);
    const Fcum = [
      (G[0] * (th / 2 + s2 / 4) - G[1] * (sn * sn) / 2) / Math.PI,
      (-G[0] * (sn * sn) / 2 + G[1] * (th / 2 - s2 / 4)) / Math.PI,
    ];
    const C1 = -(R / Math.PI) * (G[0] * Math.sin(th) + G[1] * (Math.cos(th) - 1));
    M += C1 - cross2(s, Fcum);
    Fsum[0] += Fcum[0];
    Fsum[1] += Fcum[1];
    return { M, Fsum, s };
  };
  const basis = (th) => {
    const s = ringPos(R, th);
    return [1, s[1] - A[1], A[0] - s[0]]; // hệ số của M0, Fx0, Fy0 trong M(θ)
  };

  // Tích phân Gauss từng đoạn giữa các góc đặt lực (M_load trơn trong mỗi đoạn)
  const breaks = [0, ...pts.map(p => p.th).filter(t => t > 1e-12 && t < TWO_PI - 1e-12), TWO_PI];
  const uniqBreaks = breaks.filter((v, i) => i === 0 || v - breaks[i - 1] > 1e-12);
  const Kmat = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const rhs = [0, 0, 0];
  const nSub = 24;
  for (let b = 0; b < uniqBreaks.length - 1; b++) {
    const a0 = uniqBreaks[b], a1 = uniqBreaks[b + 1];
    const h = (a1 - a0) / nSub;
    for (let k = 0; k < nSub; k++) {
      const c = a0 + (k + 0.5) * h;
      for (let g = 0; g < 8; g++) {
        const th = c + 0.5 * h * GL8_X[g];
        const w = 0.5 * h * GL8_W[g];
        const phi = basis(th);
        const Ml = loadState(th).M;
        for (let i = 0; i < 3; i++) {
          rhs[i] -= w * phi[i] * Ml;
          for (let j = 0; j < 3; j++) Kmat[i][j] += w * phi[i] * phi[j];
        }
      }
    }
  }
  // Giải hệ 3×3 (Cramer)
  const det3 = (m) =>
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = det3(Kmat);
  const X = [0, 1, 2].map(col => det3(Kmat.map((row, r) => row.map((v, cc) => (cc === col ? rhs[r] : v)))) / D);
  const [M0, Fx0, Fy0] = X;

  // Quy ước dấu: mômen tính theo chiều dương ngược kim đồng hồ trên vật thể [0, θ];
  // đổi dấu để M > 0 là căng thớ trong (khớp nghiệm Roark M(0) = +P·R/π cho 2 lực đối tâm).
  const SIGN_INNER_TENSION = -1;

  const at = (theta_rad) => {
    const th = Math.min(normAngle(theta_rad), TWO_PI - 1e-13);
    const st = loadState(th);
    const phi = basis(th);
    const Mraw = M0 * phi[0] + Fx0 * phi[1] + Fy0 * phi[2] + st.M;
    const Fsec = [-(Fx0 + st.Fsum[0]), -(Fy0 + st.Fsum[1])];
    const tng = ringTangent(th);
    const N = Fsec[0] * tng[0] + Fsec[1] * tng[1];
    return { theta_rad: th, M_Nm: SIGN_INNER_TENSION * Mraw, N_N: N };
  };

  // Kiểm tra khép kín: mômen hai phía mặt cắt θ = 0 / 2π phải trùng nhau
  const closureErr = Math.abs(at(TWO_PI - 1e-12).M_Nm - at(0).M_Nm);
  const loadScale = Math.max(1, ...pts.map(p => Math.abs(p.P))) * R;

  return {
    at,
    balancingShearResultant_N: Math.hypot(G[0], G[1]),
    closureRelErr: closureErr / loadScale,
    loadAngles: pts.map(p => p.th),
  };
}

/**
 * Nghiệm Roark/Timoshenko đóng cho vòng chịu 2 lực đối tâm (dùng kiểm chứng bộ giải vòng tổng quát).
 */
export function roarkDiametralRing({ rm_m: R, P_N: P, theta_rad }) {
  const psi = normAngle(theta_rad);
  // Đối xứng: dùng góc tới lực gần nhất trên nửa vòng [0, π]
  const a = psi <= Math.PI ? psi : TWO_PI - psi;
  const M = P * R * (1 / Math.PI - 0.5 * Math.sin(a));
  const N = -0.5 * P * Math.sin(a);
  return { M_Nm: M, N_N: N };
}

/** Tạo hệ lực hướng kính chuẩn theo sơ đồ (giữ tương thích các sơ đồ cũ). */
function buildLegacyRadialLoads(loadCase, P) {
  if (loadCase === 'three_point_triangular') {
    const P_upper = P / Math.sqrt(3);
    return [
      { theta_rad: Math.PI / 6, P_N: P_upper, label: 'Tiếp xúc nghiêng +30°' },
      { theta_rad: (11 * Math.PI) / 6, P_N: P_upper, label: 'Tiếp xúc nghiêng -30°' },
      { theta_rad: Math.PI, P_N: P, label: 'Phản lực đáy 180°' },
    ];
  }
  if (loadCase === 'support_reaction_shear_balanced') {
    return [{ theta_rad: Math.PI, P_N: P, label: 'Phản lực kê đáy 180° (cân bằng bằng dòng cắt thân cọc)' }];
  }
  if (loadCase === 'two_point_diametral') {
    return [
      { theta_rad: 0, P_N: P, label: 'Tải kê trên 0°' },
      { theta_rad: Math.PI, P_N: P, label: 'Phản lực kê dưới 180°' },
    ];
  }
  throw new Error(`loadCase không hợp lệ: "${loadCase}"`);
}

/**
 * BT05 — Kiểm tra ép ngang, uốn vòng và nứt thành cọc rỗng tại mặt cắt `section(x)`.
 *
 * Hai cách khai báo tải (giá trị tiêu chuẩn):
 * 1. radialLoads: [{ theta_rad, P_N, label }] tác dụng trên dải rộng sliceWidth_m (m) — dùng cho hệ xếp cọc;
 * 2. loadCase + normalForce_N (sơ đồ chuẩn 'two_point_diametral' | 'three_point_triangular' |
 *    'support_reaction_shear_balanced') trên dải b_eff = bx + 4t.
 *
 * Sức kháng:
 * - Nứt (TTGH II): Mcrc = Rbt,ser·Wpl − N·W/A (N kéo dương), Wpl = 1,3·W; thớ trong nhân hệ số độ cong Winkler–Bach.
 * - TTGH I: lớn hơn giữa (a) bê tông không cốt thép Rbt·Wpl − γf·N·W/A và (b) cốt đai xoắn chịu kéo khi đai nằm
 *   ở nửa thành phía thớ chịu kéo (đai quấn ngoài vòng thép DƯL nên chỉ góp phần khi thớ ngoài chịu kéo).
 */
export function runBT05({
  bt00,
  x_m,
  normalForce_N = null,
  loadCase = 'two_point_diametral',
  radialLoads = null,
  sliceWidth_m = null,
  contactLengthAlongPile_m = 0.1,
  gamma_f = TCVN5574.loads.gamma_f_selfWeight,
}) {
  if (!bt00 || !bt00.valid || !bt00.record?.computed) {
    throw new Error('BT05 yêu cầu kết quả BT00 hợp lệ');
  }
  const sec = bt00.record.computed.section;
  const conc = bt00.record.computed.concrete;
  const steel = bt00.record.computed.steel;
  const secX = sec.sectionAt(x_m);
  const { t, rm, ro, ri, Ag } = sec;

  let loads;
  let b_eff_m;
  let loadDescription;
  if (Array.isArray(radialLoads)) {
    loads = radialLoads.map(l => ({ theta_rad: Number(l.theta_rad), P_N: Number(l.P_N), label: l.label || '' }));
    if (loads.some(l => !(l.P_N >= 0) || !Number.isFinite(l.theta_rad))) {
      throw new Error('radialLoads phải gồm P_N >= 0 và theta_rad hữu hạn');
    }
    b_eff_m = Number(sliceWidth_m);
    if (!(b_eff_m > 0)) throw new Error('Khi khai báo radialLoads phải có sliceWidth_m > 0');
    loadDescription = 'custom';
  } else {
    const P = Number(normalForce_N);
    if (!(P >= 0)) throw new Error('Lực ép ngang normalForce_N phải >= 0');
    loads = buildLegacyRadialLoads(loadCase, P);
    b_eff_m = Math.min(sec.L, Number(contactLengthAlongPile_m) + 4 * t);
    loadDescription = loadCase;
  }

  const ring = solveClosedRing({ rm_m: rm, radialLoads: loads });

  // Tiết diện thành vòng trên dải b_eff
  const A_wall_m2 = b_eff_m * t;
  const W_wall_m3 = (b_eff_m * t * t) / 6;
  const gammaPl = TCVN5574.cracking.gammaPlastic_rectangular;
  const Wpl_m3 = gammaPl * W_wall_m3;
  const k_curved_inner = 1 + t / (3 * rm); // hệ số độ cong thành dày (Winkler–Bach) tại thớ trong
  const kern_m = W_wall_m3 / A_wall_m2;

  // Cốt đai xoắn tại vùng section(x): bán kính trục dây và diện tích trên dải b_eff
  const r_sw = secX.spiral.radius_m;
  const As_ring_m2 = secX.spiral.asw_per_m_m2_per_m * b_eff_m;
  const Rs_ring = steel.spiral.Rsw_base;
  const rcFlexure = (d) => {
    if (!(d > 0) || !(As_ring_m2 > 0)) return 0;
    const x = Math.min((As_ring_m2 * Rs_ring) / (conc.Rb * b_eff_m), 0.5 * d);
    return Math.min(As_ring_m2 * Rs_ring, conc.Rb * b_eff_m * x) * (d - x / 2);
  };
  // Đai chỉ làm việc chịu kéo khi nằm ở nửa thành phía thớ chịu kéo
  const spiralInInnerHalf = r_sw < rm;
  const M_rc_innerTension_Nm = spiralInInnerHalf ? rcFlexure(ro - r_sw) : 0; // nén ở thớ ngoài
  const M_rc_outerTension_Nm = spiralInInnerHalf ? 0 : rcFlexure(r_sw - ri);  // nén ở thớ trong

  // Quét nội lực vòng trên toàn chu vi (360 điểm + các góc đặt lực)
  const angles = [];
  for (let i = 0; i < 360; i++) angles.push((TWO_PI * i) / 360);
  angles.push(...ring.loadAngles);
  const profile = [];
  let M_inner_max_Nm = 0, M_outer_max_Nm = 0, N_At_M_inner_N = 0, N_At_M_outer_N = 0;
  let uCrackMax = 0, uUlsMax = 0, govCrack = null, govUls = null;
  let sigma_tens_max_Pa = -Infinity, sigma_tens_inner_Pa = -Infinity, sigma_tens_outer_Pa = -Infinity;

  for (const th of angles) {
    const r = ring.at(th);
    profile.push(r);
    const M = r.M_Nm;
    const N = r.N_N;
    const innerTension = M >= 0;
    const kFace = innerTension ? k_curved_inner : 1;
    if (innerTension && M > M_inner_max_Nm) { M_inner_max_Nm = M; N_At_M_inner_N = N; }
    if (!innerTension && -M > M_outer_max_Nm) { M_outer_max_Nm = -M; N_At_M_outer_N = N; }

    const sigma = (kFace * Math.abs(M)) / W_wall_m3 + N / A_wall_m2;
    if (sigma > sigma_tens_max_Pa) sigma_tens_max_Pa = sigma;
    if (innerTension && sigma > sigma_tens_inner_Pa) sigma_tens_inner_Pa = sigma;
    if (!innerTension && sigma > sigma_tens_outer_Pa) sigma_tens_outer_Pa = sigma;

    // TTGH II: Mcrc = Rbt,ser·Wpl − N·kern (N kéo dương)
    const Mcrc = Math.max(1e-9, conc.Rbtn * Wpl_m3 - N * kern_m);
    const uCrack = (kFace * Math.abs(M)) / Mcrc;
    if (uCrack > uCrackMax) { uCrackMax = uCrack; govCrack = { theta_rad: th, M_Nm: M, N_N: N, Mcrc_Nm: Mcrc }; }

    // TTGH I: tải nhân γf; sức kháng = max(bê tông không cốt thép, cốt đai chịu kéo)
    const M_plain = Math.max(1e-9, conc.Rbt * Wpl_m3 - gamma_f * N * kern_m);
    const M_rc = innerTension ? M_rc_innerTension_Nm : M_rc_outerTension_Nm;
    const M_Rd = Math.max(M_plain / kFace, M_rc);
    const uUls = (gamma_f * Math.abs(M)) / M_Rd;
    if (uUls > uUlsMax) { uUlsMax = uUls; govUls = { theta_rad: th, M_Nm: M, N_N: N, M_Rd_Nm: M_Rd }; }
  }

  // Kiểm chứng bộ giải vòng tổng quát với nghiệm Roark (2 lực đối tâm P = 1 N)
  const ringRef = solveClosedRing({ rm_m: rm, radialLoads: [{ theta_rad: 0, P_N: 1 }, { theta_rad: Math.PI, P_N: 1 }] });
  let ringAnalyticalRelError = 0;
  for (const th of [0, Math.PI / 6, Math.PI / 2, (2 * Math.PI) / 3, Math.PI, (3 * Math.PI) / 2]) {
    const num = ringRef.at(th);
    const ana = roarkDiametralRing({ rm_m: rm, P_N: 1, theta_rad: th });
    ringAnalyticalRelError = Math.max(
      ringAnalyticalRelError,
      Math.abs(num.M_Nm - ana.M_Nm) / rm,
      Math.abs(num.N_N - ana.N_N)
    );
  }

  const totalRadial = loads.reduce((s, l) => s + l.P_N, 0);
  const naiveAverageStress_Pa = Math.max(...loads.map(l => l.P_N), 0) / Ag;
  const M_ring_crc_inner_Nm = (conc.Rbtn * Wpl_m3) / k_curved_inner;
  const M_ring_crc_outer_Nm = conc.Rbtn * Wpl_m3;

  return deepFreeze({
    code: 'BT05',
    title: 'BT05: Kiểm tra ép ngang, uốn vòng và nứt thành cọc rỗng theo vùng cốt đai section(x)',
    valid: true,
    verified: ring.closureRelErr < 1e-9 && ringAnalyticalRelError < 1e-9,
    standard: 'Vòng kín đàn hồi (phương pháp lực, đối chứng Roark/Timoshenko) & TCVN 5574:2018',
    sectionZoneAtContact: {
      x_m: secX.x_m,
      zone: secX.zone,
      wireCount: secX.spiral.wireCount,
      diameter_m: secX.spiral.diameter_m,
      pitch_m: secX.spiral.pitch_m,
      spiralRadius_m: r_sw,
      spiralInInnerHalf,
      asw_per_m_m2_per_m: secX.spiral.asw_per_m_m2_per_m,
      longitudinalPrestressAppliedToRing: false,
    },
    inputsSI: {
      x_m,
      loadDescription,
      radialLoads: loads,
      totalRadialService_N: totalRadial,
      gamma_f,
      balancingShearResultant_N: ring.balancingShearResultant_N,
      b_eff_m,
      rm_m: rm,
      t_m: t,
    },
    ringForcesSI: {
      M_inner_max_Nm,
      M_outer_max_Nm,
      N_At_M_inner_N,
      N_At_M_outer_N,
      sigma_tens_inner_Pa,
      sigma_tens_outer_Pa,
      sigma_tens_max_Pa,
      naiveAverageStress_Pa,
      stressAmplificationOverNaiveRA: sigma_tens_max_Pa / Math.max(naiveAverageStress_Pa, 1),
    },
    capacitiesSI: {
      gammaPlastic: gammaPl,
      gammaPlasticClause: TCVN5574.cracking.clause,
      M_ring_crc_Nm: M_ring_crc_inner_Nm,
      M_ring_crc_inner_Nm,
      M_ring_crc_outer_Nm,
      M_ring_Rd_plain_Nm: conc.Rbt * Wpl_m3,
      M_rc_innerTension_Nm,
      M_rc_outerTension_Nm,
      M_ring_Rd_Nm: Math.max(conc.Rbt * Wpl_m3, M_rc_outerTension_Nm, M_rc_innerTension_Nm),
      governingCrack: govCrack,
      governingULS: govUls,
      utilizationCrack: uCrackMax,
      utilizationULS: uUlsMax,
      passCrack: uCrackMax <= 1.0,
      passULS: uUlsMax <= 1.0,
    },
    verification: {
      closureRelErr: ring.closureRelErr,
      ringAnalyticalRelError,
    },
    profile,
    validityDomain: {
      model: 'Vòng kín đàn hồi chỉ xét biến dạng uốn; dải làm việc dọc trục b_eff (bx + 4t tại kê, 1 m với tải đường).',
      limits: 'Sàng lọc trước khi hình thành cơ chế khớp dẻo; không dùng dự ứng lực dọc cho phương vòng.',
    },
  });
}
