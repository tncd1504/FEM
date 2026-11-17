/**
 * contact_checker.js — Triển khai Bài tính BT04 (Nén tại vùng tiếp xúc cọc–kê và cọc–cọc)
 * và Bài tính BT05 (Ép ngang, uốn vòng và nứt thành cọc rỗng) theo hệ đơn vị chuẩn SI (m, kg, s, N, Pa).
 *
 * Nguyên tắc bắt buộc (Plan v0.5.0 & Skill fem-web):
 * - Thanh kê gỗ 100 × 100 mm (0,1 × 0,1 m, A = 0,01 m²) được mô hình là vật rắn tuyệt đối cứng;
 *   không kiểm tra nén hay biến dạng gỗ. Chỉ kiểm tra ứng suất/sức kháng nén cục bộ phía cọc.
 * - Không coi diện tiếp xúc bằng diện tích tiết diện cọc Ag hoặc diện tích tiết diện gỗ 0,01 m².
 * - Trong BT05: lấy đúng hàm lượng cốt đai xoắn theo vùng section(x) tại tọa độ tiếp xúc;
 *   dự ứng lực dọc σ_pc không được coi là dự ứng lực vòng; kiểm tra R/A trung bình không thay thế kiểm tra uốn vòng.
 */

function deepFreeze(obj) {
  if (!obj || typeof obj !== 'object' || Object.isFrozen(obj)) return obj;
  Object.freeze(obj);
  for (const k of Object.keys(obj)) {
    if (obj[k] && typeof obj[k] === 'object') deepFreeze(obj[k]);
  }
  return obj;
}

/**
 * BT04 — Kiểm tra nén cục bộ phía cọc tại vùng tiếp xúc cọc–kê (thanh kê gỗ cứng 100×100 mm) hoặc cọc–cọc.
 *
 * @param {object} params
 * @param {object} params.bt00 kết quả BT00 đã kiểm chứng
 * @param {number} params.normalForce_N lực nén pháp tuyến tại vùng tiếp xúc (N, > 0)
 * @param {'pile_batten'|'pile_pile'} [params.contactType='pile_batten'] loại tiếp xúc
 * @param {number} [params.contactLengthAlongPile_m=0.1] chiều dài tiếp xúc dọc trục cọc bx (m); mặc định 0,1 m (thanh kê 100×100 mm)
 * @param {number} [params.contactArcAngle_deg=20] góc ôm tiếp xúc thực tế trên chu vi cọc (độ), dùng khi có vát/đệm tiếp xúc hữu hạn
 */
export function runBT04({
  bt00,
  normalForce_N,
  contactType = 'pile_batten',
  contactLengthAlongPile_m = 0.1,
  contactArcAngle_deg = 20,
}) {
  if (!bt00 || !bt00.valid || !bt00.record?.computed) {
    throw new Error('BT04 yêu cầu kết quả BT00 hợp lệ');
  }
  const N_c = Number(normalForce_N);
  if (!(N_c >= 0)) throw new Error('Lực pháp tuyến tiếp xúc normalForce_N phải >= 0');

  const sec = bt00.record.computed.section;
  const conc = bt00.record.computed.concrete;
  const { Do, t, Ag } = sec;
  const bx = Number(contactLengthAlongPile_m);
  if (!(bx > 0 && bx <= sec.L)) {
    throw new Error(`Chiều dài tiếp xúc dọc trục bx = ${bx} m không hợp lệ`);
  }

  // Bề rộng dây cung tiếp xúc bc theo góc ôm tiếp xúc hữu hạn trên mặt trụ bán kính ro = Do/2
  const theta_rad = (Math.max(2, Math.min(60, Number(contactArcAngle_deg))) * Math.PI) / 180;
  const bc_chord_m = Do * Math.sin(theta_rad / 2);

  // Đồng thời tính bề rộng tiếp xúc đàn hồi Hertz lý thuyết (trụ bê tông trên mặt phẳng cứng hoặc trụ–trụ)
  // R_eff = ro (cọc–kê phẳng cứng) hoặc ro/2 (hai cọc cùng đường kính Do)
  const nu_c = 0.2;
  const R_eff = contactType === 'pile_pile' ? Do / 4 : Do / 2;
  const E_star = conc.Eb / (1 - nu_c * nu_c);
  const q_line = N_c / bx; // N/m
  const a_hertz_m = Math.sqrt((4 * q_line * R_eff) / (Math.PI * E_star));
  const b_hertz_m = Math.max(2 * a_hertz_m, 1e-4);

  // Diện tích tiếp xúc tính toán phía bê tông cọc A_loc = bx * bc (luôn nhỏ hơn Ag và khác diện tích mặt cắt gỗ 0,01 m²)
  const bc_effective_m = Math.max(bc_chord_m, b_hertz_m);
  const A_loc_m2 = bx * bc_effective_m;
  const A_batten_cross_section_m2 = 0.1 * 0.1; // 0,01 m²

  // Phân bố áp lực đều tương đương và phân bố elip (Hertz-type) p(y) = p_max * sqrt(1 - (2y/bc)^2)
  const p_avg_Pa = N_c / A_loc_m2;
  const p_max_elliptical_Pa = (4 / Math.PI) * p_avg_Pa;

  // Tích phân số kiểm chứng cân bằng áp lực tiếp xúc: ∫ p(y) * bx dy = N_c
  // Dùng quy tắc tích phân biến đổi lượng giác y = (bc/2) * sin(phi), phi in [-pi/2, pi/2]
  const nGauss = 60;
  let integralForce_N = 0;
  for (let i = 0; i < nGauss; i++) {
    const phi = -Math.PI / 2 + ((i + 0.5) / nGauss) * Math.PI;
    const dphi = Math.PI / nGauss;
    // p(phi) * dy = p_max * cos(phi) * (bc/2) * cos(phi) dphi
    integralForce_N += p_max_elliptical_Pa * bx * (bc_effective_m / 2) * (Math.cos(phi) ** 2) * dphi;
  }
  const equilibriumRelError = Math.abs(integralForce_N - N_c) / Math.max(N_c, 1);

  // Sức kháng nén cục bộ phía bê tông cọc theo TCVN 5574:2018 Mục 8.1.5 (Công thức 112–114)
  // Diện tích tính toán lớn nhất đồng tâm mở rộng theo thành dày t: A_loc,max = (bx + 2t) * min(Do, bc + 2t)
  const A_loc_max_m2 = Math.min(sec.L, bx + 2 * t) * Math.min(2 * t, bc_effective_m + 2 * t);
  const phi_b = Math.min(2.5, Math.max(1.0, 0.8 * Math.sqrt(Math.max(A_loc_max_m2, A_loc_m2) / A_loc_m2)));
  const Rb_loc_Pa = phi_b * conc.Rb;
  const psi = 0.75; // Hệ số xét phân bố áp lực không đều tại mặt tiếp xúc cong (TCVN 5574:2018 Mục 8.1.5)
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
      normalForce_N: N_c,
      contactType,
      bx_m: bx,
      contactArcAngle_deg,
    },
    contactGeometrySI: {
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
    },
    validityDomain: {
      model: 'Nén cục bộ TCVN 5574:2018 Mục 8.1.5 kết hợp tiếp xúc mặt trụ trên thanh kê cứng 100×100 mm',
      note: 'Kiểm tra nén cục bộ bề mặt không thay thế kiểm tra uốn vòng thành cọc rỗng tại BT05.',
    },
  });
}

/**
 * Hàm Green giải tích đóng của vòng tròn đàn hồi kín bán kính trung bình rm (Roark Table 9.2)
 * chịu hệ lực hướng kính tự cân bằng {(P_k, theta_k)} (P_k > 0 hướng vào tâm).
 *
 * Quy ước:
 * - M_ring(theta) > 0 khi căng thớ trong của thành ống (tại điểm đặt lực ép hướng kính).
 * - N_ring(theta) < 0 khi thành ống chịu nén vòng.
 */
export function evaluateClosedRingResponse({ rm_m, radialLoads, theta_rad }) {
  let M = 0; // N·m trên chiều dài dọc trục đang xét
  let N = 0; // N
  let Q = 0; // N

  const twoPi = 2 * Math.PI;
  for (const load of radialLoads) {
    const P = load.P_N;
    let psi = (theta_rad - load.theta_rad) % twoPi;
    if (psi < 0) psi += twoPi;

    const sinPsi = Math.sin(psi);
    const cosPsi = Math.cos(psi);
    const piMinusPsi = Math.PI - psi;

    M += (P * rm_m / twoPi) * (1 + 0.5 * cosPsi - piMinusPsi * sinPsi);
    N += -(P / twoPi) * (0.5 * cosPsi + piMinusPsi * sinPsi);
    Q += -(P / twoPi) * (piMinusPsi * cosPsi - 0.5 * sinPsi);
  }
  return { theta_rad, M_Nm: M, N_N: N, Q_N: Q };
}

/**
 * BT05 — Kiểm tra ép ngang, uốn vòng và nứt thành cọc rỗng tại vùng tiếp xúc `section(x)`.
 *
 * @param {object} params
 * @param {object} params.bt00 kết quả BT00 đã kiểm chứng
 * @param {number} params.x_m tọa độ dọc trục cọc của mặt cắt tiếp xúc (m) để lấy đúng vùng đai sectionAt(x)
 * @param {number} params.normalForce_N lực ép hướng kính tác dụng (N)
 * @param {'two_point_diametral'|'three_point_triangular'} [params.loadCase='two_point_diametral'] sơ đồ lực ép trên vòng
 * @param {number} [params.contactLengthAlongPile_m=0.1] chiều dài thanh kê dọc trục bx (m)
 */
export function runBT05({
  bt00,
  x_m,
  normalForce_N,
  loadCase = 'two_point_diametral',
  contactLengthAlongPile_m = 0.1,
}) {
  if (!bt00 || !bt00.valid || !bt00.record?.computed) {
    throw new Error('BT05 yêu cầu kết quả BT00 hợp lệ');
  }
  const P = Number(normalForce_N);
  if (!(P >= 0)) throw new Error('Lực ép ngang normalForce_N phải >= 0');

  const sec = bt00.record.computed.section;
  const conc = bt00.record.computed.concrete;
  const steel = bt00.record.computed.steel;
  const secX = sec.sectionAt(x_m);

  const { Do, Di, t, rm } = sec;
  const bx = Number(contactLengthAlongPile_m);
  // Bề rộng làm việc hữu hiệu dọc trục của vành cọc khi chịu tải qua thanh kê rộng bx:
  // Truyền theo góc 45° qua thành cọc và mở rộng hữu hạn hai bên: b_eff = min(L, bx + 4*t)
  const b_eff_m = Math.min(sec.L, bx + 4 * t);

  // Xây dựng hệ lực hướng kính tự cân bằng {(P_k, theta_k)}
  // theta = 0: đỉnh trên, theta = pi: đáy dưới
  let radialLoads = [];
  if (loadCase === 'three_point_triangular') {
    // Sơ đồ S1/S3: hai lực ép nghiêng ±30° từ hai cọc tầng trên (mỗi lực P_upper = P / sqrt(3))
    // cân bằng với phản lực kê đáy P ở theta = pi: 2 * P_upper * cos(30°) = P
    const P_upper = P / Math.sqrt(3);
    radialLoads = [
      { theta_rad: Math.PI / 6, P_N: P_upper, label: 'Tiếp xúc nghiêng +30°' },
      { theta_rad: (11 * Math.PI) / 6, P_N: P_upper, label: 'Tiếp xúc nghiêng -30°' },
      { theta_rad: Math.PI, P_N: P, label: 'Phản lực đáy 180°' },
    ];
  } else {
    // Sơ đồ S2 (kê thẳng hàng trên/dưới): hai lực ép đối tâm P tại theta = 0 và theta = pi
    radialLoads = [
      { theta_rad: 0, P_N: P, label: 'Tải kê trên 0°' },
      { theta_rad: Math.PI, P_N: P, label: 'Phản lực kê dưới 180°' },
    ];
  }

  // Kiểm tra tự cân bằng của hệ lực hướng kính: sum(P_k cos theta_k) = 0, sum(P_k sin theta_k) = 0
  const sumFx = radialLoads.reduce((s, l) => s + l.P_N * Math.sin(l.theta_rad), 0);
  const sumFz = radialLoads.reduce((s, l) => s + l.P_N * Math.cos(l.theta_rad), 0);
  const selfEquilibriumErr = Math.hypot(sumFx, sumFz) / Math.max(P, 1);

  // Quét nội lực vòng trên toàn chu vi (72 điểm + các góc đặc biệt)
  const profile = [];
  let M_inner_max_Nm = -Infinity; // > 0: căng mặt trong
  let M_outer_max_Nm = -Infinity; // độ lớn mômen âm căng mặt ngoài
  let N_At_M_inner_N = 0;
  let N_At_M_outer_N = 0;

  for (let i = 0; i <= 72; i++) {
    const th = (2 * Math.PI * i) / 72;
    const r = evaluateClosedRingResponse({ rm_m: rm, radialLoads, theta_rad: th });
    profile.push(r);
    if (r.M_Nm > M_inner_max_Nm) {
      M_inner_max_Nm = r.M_Nm;
      N_At_M_inner_N = r.N_N;
    }
    if (-r.M_Nm > M_outer_max_Nm) {
      M_outer_max_Nm = -r.M_Nm;
      N_At_M_outer_N = r.N_N;
    }
  }

  // Đối chứng với nghiệm giải tích kinh điển của vòng chịu 2 lực đối tâm (Roark / Timoshenko):
  // M(0) = P * rm / pi, M(pi/2) = -P * rm * (1/2 - 1/pi), N(pi/2) = -P / 2
  const r0 = evaluateClosedRingResponse({ rm_m: rm, radialLoads: [{ theta_rad: 0, P_N: P }, { theta_rad: Math.PI, P_N: P }], theta_rad: 0 });
  const r90 = evaluateClosedRingResponse({ rm_m: rm, radialLoads: [{ theta_rad: 0, P_N: P }, { theta_rad: Math.PI, P_N: P }], theta_rad: Math.PI / 2 });
  const M0_roark = (P * rm) / Math.PI;
  const M90_roark = -P * rm * (0.5 - 1 / Math.PI);
  const N90_roark = -0.5 * P;
  const ringAnalyticalRelError = Math.max(
    Math.abs(r0.M_Nm - M0_roark) / Math.max(Math.abs(M0_roark), 1e-12),
    Math.abs(r90.M_Nm - M90_roark) / Math.max(Math.abs(M90_roark), 1e-12),
    Math.abs(r90.N_N - N90_roark) / Math.max(Math.abs(N90_roark), 1e-12)
  );

  // Đặc trưng mặt cắt thành vòng trên bề rộng làm việc b_eff_m:
  // Chiều cao tiết diện thành = t, bề rộng = b_eff_m
  // Lưu ý bắt buộc: Dự ứng lực dọc σ_pc KHÔNG tạo dự ứng lực theo phương vòng!
  const A_wall_m2 = b_eff_m * t;
  const W_wall_m3 = (b_eff_m * t * t) / 6;
  // Hệ số xét độ cong thành dày (Winkler–Bach) tại thớ trong: k_in ≈ 1 + t / (3 * rm)
  const k_curved_inner = 1 + t / (3 * rm);
  const sigma_tens_inner_Pa = k_curved_inner * (M_inner_max_Nm / W_wall_m3) + N_At_M_inner_N / A_wall_m2;
  const sigma_tens_outer_Pa = M_outer_max_Nm / W_wall_m3 + N_At_M_outer_N / A_wall_m2;
  const sigma_tens_max_Pa = Math.max(sigma_tens_inner_Pa, sigma_tens_outer_Pa);

  // Giới hạn chống nứt vòng (TTGH II) và sức kháng uốn–nén vòng (TTGH I) có xét cốt đai xoắn tại vùng section(x)
  // Với tiết diện chữ nhật thành dày t chịu uốn, hệ số đàn-dẻo khi nứt γ_pl = 1,5 (Mục 8.2.2 TCVN 5574:2018)
  const f_ct_ring_limit_Pa = 1.5 * conc.Rbtn;
  const M_ring_crc_Nm = (f_ct_ring_limit_Pa * W_wall_m3) / k_curved_inner;

  // Đóng góp của cốt đai xoắn theo vùng section(x) (asw_per_m m²/m) trên bề rộng b_eff_m
  const Asw_in_beff_m2 = secX.spiral.asw_per_m_m2_per_m * b_eff_m;
  const z_lever_m = 0.75 * t;
  const M_ring_rebar_Nm = Asw_in_beff_m2 * steel.spiral.Rsw_base * z_lever_m;
  const M_ring_Rd_Nm = Math.max(M_ring_crc_Nm, M_ring_crc_Nm * (conc.Rbt / conc.Rbtn) + M_ring_rebar_Nm);

  // So sánh với ứng suất trung bình ngây thơ R / A_g để chứng minh kiểm tra R/A không thể thay thế kiểm tra uốn vòng
  const naiveAverageStress_Pa = P / sec.Ag;

  const utilizationCrack = Math.max(M_inner_max_Nm, M_outer_max_Nm) / M_ring_crc_Nm;
  const utilizationULS = Math.max(M_inner_max_Nm, M_outer_max_Nm) / M_ring_Rd_Nm;

  return deepFreeze({
    code: 'BT05',
    title: 'BT05: Kiểm tra ép ngang, uốn vòng và nứt thành cọc rỗng theo vùng cốt đai section(x)',
    valid: true,
    verified: selfEquilibriumErr < 1e-12 && ringAnalyticalRelError < 1e-12,
    standard: 'Lý thuyết vòng đàn hồi (Roark/Timoshenko) & TCVN 5574:2018',
    sectionZoneAtContact: {
      x_m: secX.x_m,
      zone: secX.zone,
      wireCount: secX.spiral.wireCount,
      diameter_m: secX.spiral.diameter_m,
      pitch_m: secX.spiral.pitch_m,
      asw_per_m_m2_per_m: secX.spiral.asw_per_m_m2_per_m,
      longitudinalPrestressAppliedToRing: false,
    },
    inputsSI: {
      x_m,
      normalForce_N: P,
      loadCase,
      bx_m: bx,
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
      M_ring_crc_Nm,
      M_ring_Rd_Nm,
      utilizationCrack,
      utilizationULS,
      passCrack: utilizationCrack <= 1.0,
      passULS: utilizationULS <= 1.0,
    },
    verification: {
      selfEquilibriumErr,
      ringAnalyticalRelError,
      M0_fem: r0.M_Nm,
      M0_roark,
      M90_fem: r90.M_Nm,
      M90_roark,
    },
    profile,
    validityDomain: {
      model: 'Mô hình vòng đàn hồi sàng lọc ép ngang với bề rộng làm việc b_eff = bx + 4t',
      limits: 'Hợp lệ trong miền đàn hồi trước khi hình thành cơ chế khớp dẻo 4 điểm; không dùng dự ứng lực dọc cho phương vòng.',
    },
  });
}
