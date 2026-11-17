/**
 * section_properties.js — Tính đặc trưng hình học/tiết diện quy đổi, vật liệu TCVN 5574:2018
 * và hàm phân vùng dọc trục section(x) theo hệ đơn vị chuẩn SI (m, kg, s, N, Pa).
 *
 * Nguyên tắc bắt buộc (Plan v0.5.0 & Skill fem-web):
 * - Mọi đại lượng trong lõi tính đều ở hệ SI (m, m², m³, m⁴, kg/m³, kg/m, N/m, Pa).
 * - Tách biệt dữ liệu tham khảo (reference), đầu vào phương án (input) và kết quả tự tính (computed).
 * - Không xét đóng góp của thép dọc gia cường đầu cọc (N2, ØGC, L2).
 * - Giữ phân vùng cốt đai xoắn dọc trục x: vùng đầu cọc (L_dau = k_end * Do) và vùng thân giữa.
 * - Không tự đồng nhất cường độ mẫu trụ (ví dụ 80 MPa D150xH300) với cấp B của TCVN 5574:2018.
 */
import { G_STANDARD, toSI } from '../../core/units.js';

/**
 * Bảng đặc trưng bê tông nặng theo TCVN 5574:2018 (Bảng 6, Bảng 7, Bảng 9, Mục 6.1.3.4, Mục 9.1.8).
 * Giá trị gốc trong bảng tiêu chuẩn tính bằng MPa (Eb bằng GPa = 10³ MPa), khi xuất ra hàm sẽ nhân 10⁶ sang Pa.
 */
export const TCVN_5574_2018_CONCRETE_TABLE = Object.freeze({
  'B15':  Object.freeze({ Rbn_MPa: 11.0, Rbtn_MPa: 1.10, Rb_MPa:  8.5, Rbt_MPa: 0.75, Eb_GPa: 24.0,  eps_b_sh: 0.00020, phi_cr_75: 2.4, phi_cr_40: 3.4, phi_cr_0: 4.8 }),
  'B20':  Object.freeze({ Rbn_MPa: 15.0, Rbtn_MPa: 1.35, Rb_MPa: 11.5, Rbt_MPa: 0.90, Eb_GPa: 27.5,  eps_b_sh: 0.00020, phi_cr_75: 2.0, phi_cr_40: 2.8, phi_cr_0: 4.0 }),
  'B25':  Object.freeze({ Rbn_MPa: 18.5, Rbtn_MPa: 1.55, Rb_MPa: 14.5, Rbt_MPa: 1.05, Eb_GPa: 30.0,  eps_b_sh: 0.00020, phi_cr_75: 1.8, phi_cr_40: 2.5, phi_cr_0: 3.6 }),
  'B30':  Object.freeze({ Rbn_MPa: 22.0, Rbtn_MPa: 1.75, Rb_MPa: 17.0, Rbt_MPa: 1.15, Eb_GPa: 32.5,  eps_b_sh: 0.00020, phi_cr_75: 1.6, phi_cr_40: 2.3, phi_cr_0: 3.2 }),
  'B35':  Object.freeze({ Rbn_MPa: 25.5, Rbtn_MPa: 1.95, Rb_MPa: 19.5, Rbt_MPa: 1.30, Eb_GPa: 34.5,  eps_b_sh: 0.00020, phi_cr_75: 1.5, phi_cr_40: 2.1, phi_cr_0: 3.0 }),
  'B40':  Object.freeze({ Rbn_MPa: 29.0, Rbtn_MPa: 2.10, Rb_MPa: 22.0, Rbt_MPa: 1.40, Eb_GPa: 36.0,  eps_b_sh: 0.00025, phi_cr_75: 1.4, phi_cr_40: 1.9, phi_cr_0: 2.8 }),
  'B45':  Object.freeze({ Rbn_MPa: 32.0, Rbtn_MPa: 2.25, Rb_MPa: 25.0, Rbt_MPa: 1.50, Eb_GPa: 37.0,  eps_b_sh: 0.00030, phi_cr_75: 1.3, phi_cr_40: 1.8, phi_cr_0: 2.6 }),
  'B50':  Object.freeze({ Rbn_MPa: 36.0, Rbtn_MPa: 2.45, Rb_MPa: 27.5, Rbt_MPa: 1.60, Eb_GPa: 38.0,  eps_b_sh: 0.00030, phi_cr_75: 1.2, phi_cr_40: 1.6, phi_cr_0: 2.4 }),
  'B55':  Object.freeze({ Rbn_MPa: 39.5, Rbtn_MPa: 2.60, Rb_MPa: 30.0, Rbt_MPa: 1.70, Eb_GPa: 39.0,  eps_b_sh: 0.00030, phi_cr_75: 1.1, phi_cr_40: 1.5, phi_cr_0: 2.2 }),
  'B60':  Object.freeze({ Rbn_MPa: 43.0, Rbtn_MPa: 2.75, Rb_MPa: 33.0, Rbt_MPa: 1.80, Eb_GPa: 39.5,  eps_b_sh: 0.00030, phi_cr_75: 1.0, phi_cr_40: 1.4, phi_cr_0: 2.0 }),
  'B70':  Object.freeze({ Rbn_MPa: 50.0, Rbtn_MPa: 3.00, Rb_MPa: 37.0, Rbt_MPa: 1.90, Eb_GPa: 41.0,  eps_b_sh: 0.00030, phi_cr_75: 1.0, phi_cr_40: 1.4, phi_cr_0: 2.0 }),
  'B80':  Object.freeze({ Rbn_MPa: 57.0, Rbtn_MPa: 3.30, Rb_MPa: 41.0, Rbt_MPa: 2.10, Eb_GPa: 42.0,  eps_b_sh: 0.00030, phi_cr_75: 1.0, phi_cr_40: 1.4, phi_cr_0: 2.0 }),
  'B90':  Object.freeze({ Rbn_MPa: 64.0, Rbtn_MPa: 3.60, Rb_MPa: 44.0, Rbt_MPa: 2.15, Eb_GPa: 42.5,  eps_b_sh: 0.00030, phi_cr_75: 1.0, phi_cr_40: 1.4, phi_cr_0: 2.0 }),
  'B95':  Object.freeze({ Rbn_MPa: 67.5, Rbtn_MPa: 3.70, Rb_MPa: 45.75, Rbt_MPa: 2.175, Eb_GPa: 42.75, eps_b_sh: 0.00030, phi_cr_75: 1.0, phi_cr_40: 1.4, phi_cr_0: 2.0 }),
  'B100': Object.freeze({ Rbn_MPa: 71.0, Rbtn_MPa: 3.80, Rb_MPa: 47.5, Rbt_MPa: 2.20, Eb_GPa: 43.0,  eps_b_sh: 0.00030, phi_cr_75: 1.0, phi_cr_40: 1.4, phi_cr_0: 2.0 }),
});

/**
 * Tra cứu đặc trưng bê tông thiết kế theo TCVN 5574:2018 (trả về đơn vị SI: Pa).
 * Không tự động biến cường độ mẫu trụ (ví dụ 80 MPa) thành B80 nếu người dùng không khai báo gradeB hoặc quy tắc quy đổi.
 */
export function resolveConcreteTCVN5574(concreteInput = {}) {
  const gradeB = concreteInput.gradeB ? String(concreteInput.gradeB).trim().toUpperCase() : null;
  if (!gradeB || !TCVN_5574_2018_CONCRETE_TABLE[gradeB]) {
    throw new Error(
      `Chưa xác lập cấp độ bền chịu nén B hợp lệ theo TCVN 5574:2018 (nhận được: "${concreteInput.gradeB || ''}"). ` +
      `Không tự đồng nhất cường độ mẫu trụ trên bản vẽ với cấp B khi chưa chọn cấp B thiết kế.`
    );
  }
  const row = TCVN_5574_2018_CONCRETE_TABLE[gradeB];
  const gamma_b1 = Number.isFinite(concreteInput.gamma_b1) ? concreteInput.gamma_b1 : 1.0;
  const rhGroup = concreteInput.rhGroup || '75'; // '75' (>=75%), '40' (40..75%), '0' (<40%)
  const phi_b_cr = rhGroup === '0' ? row.phi_cr_0 : rhGroup === '40' ? row.phi_cr_40 : row.phi_cr_75;

  const Rbn = toSI(row.Rbn_MPa, 'MPa');
  const Rbtn = toSI(row.Rbtn_MPa, 'MPa');
  const Rb = toSI(row.Rb_MPa, 'MPa') * gamma_b1;
  const Rbt = toSI(row.Rbt_MPa, 'MPa') * gamma_b1;
  const Eb = toSI(row.Eb_GPa, 'GPa');
  const transferFactor = Number.isFinite(concreteInput.transferRatioToRb) ? concreteInput.transferRatioToRb : 0.6;
  const Rbp = transferFactor * Rb;

  return Object.freeze({
    standard: 'TCVN 5574:2018',
    clauses: 'Bảng 6, Bảng 7, Bảng 9, Bảng 11, Mục 6.1.3–6.1.4 & Mục 9.1.8',
    gradeB,
    specimenBasis: 'Mẫu lập phương chuẩn 150×150×150 mm (xác suất đảm bảo 95% theo TCVN 5574:2018)',
    cylinderNote: concreteInput.cylinderStrength_MPa
      ? `Cường độ mẫu trụ D150×H300 tham khảo = ${concreteInput.cylinderStrength_MPa} MPa; tính toán sử dụng cấp ${gradeB} đã xác lập.`
      : null,
    gamma_b1,
    Rbn,      // Pa (Rb,ser)
    Rbtn,     // Pa (Rbt,ser)
    Rb,       // Pa
    Rbt,      // Pa
    Rbp,      // Pa (ứng suất nén cho phép khi truyền lực ứng suất trước)
    Eb,       // Pa
    eps_b0: 0.002,
    eps_b2: 0.0035,
    eps_bt0: 0.0001,
    eps_bt2: 0.00015,
    eps_b_sh: row.eps_b_sh,
    phi_b_cr,
    rhGroup,
  });
}

/**
 * Xác lập đặc trưng thép dự ứng lực (PC Bar) và thép đai xoắn (Spiral) theo hệ SI (Pa).
 */
export function resolveSteelTCVN5574(pcInput = {}, spiralInput = {}) {
  const fpu = Number.isFinite(pcInput.fpu_Pa) ? pcInput.fpu_Pa : toSI(pcInput.fpu_MPa, 'MPa');
  const fpy = Number.isFinite(pcInput.fpy_Pa) ? pcInput.fpy_Pa : toSI(pcInput.fpy_MPa, 'MPa');
  const Ep  = Number.isFinite(pcInput.Ep_Pa)  ? pcInput.Ep_Pa  : toSI(pcInput.Ep_MPa ?? 200000, 'MPa');
  const gamma_sp = Number.isFinite(pcInput.gamma_sp) ? pcInput.gamma_sp : 1.2; // TCVN 5574:2018 mục 6.2.2.2

  // Theo TCVN 5574:2018 mục 6.2.2.1: Rsn lấy theo giới hạn chảy quy ước Rpy (hoặc 0.85 fpu nếu không có fpy)
  const Rsn = Number.isFinite(fpy) && fpy > 0 ? fpy : 0.85 * fpu;
  const Rs = Rsn / gamma_sp;

  const Rswn = Number.isFinite(spiralInput.Rswn_Pa)
    ? spiralInput.Rswn_Pa
    : toSI(spiralInput.Rswn_MPa ?? 540, 'MPa');
  const gamma_sw = Number.isFinite(spiralInput.gamma_sw) ? spiralInput.gamma_sw : 1.15;
  const coeff_sw = Number.isFinite(spiralInput.workConditionFactor) ? spiralInput.workConditionFactor : 0.8;
  // Rsw dùng cho tính cắt theo TCVN 5574:2018 (kể hệ số điều kiện làm việc cốt đai)
  const Rsw_base = Rswn / gamma_sw;
  const Rsw = Math.min(coeff_sw * Rsw_base, toSI(300, 'MPa'));
  const Esw = Number.isFinite(spiralInput.Esw_Pa)
    ? spiralInput.Esw_Pa
    : toSI(spiralInput.Esw_MPa ?? 200000, 'MPa');

  return Object.freeze({
    pcBar: Object.freeze({
      standard: 'TCVN 6284-3 / JIS G3137 & TCVN 5574:2018 Mục 6.2',
      fpu,       // Pa
      fpy,       // Pa
      Rsn,       // Pa
      Rs,        // Pa
      Ep,        // Pa
      gamma_sp,
      sigma_sp_max_by_Rpy: 0.8 * fpy,
      sigma_sp_max_by_Rpu: 0.7 * fpu,
      sigma_sp_limit: Math.min(0.8 * fpy, 0.7 * fpu), // Pa
    }),
    spiral: Object.freeze({
      standard: 'SWM-C (JIS G 3532) & TCVN 5574:2018',
      Rswn,      // Pa
      Rsw_base,  // Pa (Rswn / gamma_sw)
      Rsw,       // Pa (cường độ tính toán cốt ngang chịu cắt có xét điều kiện làm việc)
      Esw,       // Pa
      gamma_sw,
    }),
  });
}

/**
 * Tự tính toàn bộ đặc trưng hình học & tiết diện quy đổi theo SI (m, m², m³, m⁴, kg/m, N/m, N·m²).
 * Bỏ qua hoàn toàn thép dọc gia cường đầu cọc (N2, ØGC, L2).
 *
 * @param {object} siInput đầu vào đã đổi sang SI:
 *   { Do, Dp, Di, L, rho, N1, d_pc, Eb, Ep, spiralEnd, spiralMid, endZoneLengthFactor_Do }
 */
export function computeSectionPropertiesSI(siInput) {
  const {
    Do, Dp, Di, L,
    rho, N1, d_pc,
    Eb, Ep,
    spiralEnd, spiralMid,
    endZoneLengthFactor_Do = 2,
    g = G_STANDARD,
  } = siInput;

  if (!(Do > 0 && Di > 0 && Dp > 0)) {
    throw new Error('Các đường kính Do, Dp, Di phải > 0');
  }
  if (!(Di < Dp && Dp < Do)) {
    throw new Error(`Hình học không hợp lệ: phải thỏa Di (${Di} m) < Dp (${Dp} m) < Do (${Do} m)`);
  }
  if (!(L > 0)) {
    throw new Error('Chiều dài cọc L (do người dùng nhập) bắt buộc phải > 0');
  }
  if (!(Number.isInteger(N1) && N1 >= 3)) {
    throw new Error('Số lượng thanh thép dự ứng lực N1 phải là số nguyên >= 3');
  }
  if (!(d_pc > 0)) {
    throw new Error('Đường kính thanh thép dự ứng lực d_pc phải > 0');
  }
  if (!(Eb > 0 && Ep > 0)) {
    throw new Error('Môđun đàn hồi Eb và Ep phải > 0');
  }
  if (!(rho > 0)) {
    throw new Error('Khối lượng riêng bê tông cọc rho phải > 0 (kg/m³)');
  }

  // 1. Kích thước hình học tự tính (m)
  const t = (Do - Di) / 2;
  const ro = Do / 2;
  const ri = Di / 2;
  const rm = (Do - t) / 2;
  const rp = Dp / 2;
  const coverOuter = ro - rp - d_pc / 2;
  const coverInner = rp - ri - d_pc / 2;
  if (coverOuter <= 0 || coverInner <= 0) {
    throw new Error('Vòng bố trí thép Dp làm thanh thép DƯL vượt ra ngoài thành bê tông');
  }

  // 2. Diện tích hình học, diện tích thép DƯL và diện tích bê tông thuần (m²)
  const Ag = (Math.PI / 4) * (Do * Do - Di * Di);
  const Ap1 = (Math.PI / 4) * d_pc * d_pc;
  const Ap = N1 * Ap1;
  const Ab = Ag - Ap;
  if (Ab <= 0) throw new Error('Diện tích thép DƯL vượt quá diện tích tiết diện cọc');

  // 3. Tọa độ từng thanh thép DƯL trên vòng tròn bán kính rp (bỏ qua N2, ØGC, L2)
  const bars = [];
  let sumZ2 = 0;
  for (let k = 0; k < N1; k++) {
    const angle = (2 * Math.PI * k) / N1;
    const y = rp * Math.sin(angle);
    const z = rp * Math.cos(angle);
    sumZ2 += z * z;
    bars.push(Object.freeze({ index: k + 1, angle_rad: angle, y_m: y, z_m: z, area_m2: Ap1 }));
  }

  // 4. Mômen quán tính (m⁴) và môđun chống uốn (m³)
  const Ig = (Math.PI / 64) * (Do ** 4 - Di ** 4);
  const Ip_ring = Ap1 * sumZ2; // = 0.5 * Ap * rp² chính xác với mọi N1 >= 3
  const Ip_self = N1 * (Math.PI / 64) * (d_pc ** 4);
  const Ip_total = Ip_ring + Ip_self;
  const Ib = Ig - Ip_ring;

  const alpha = Ep / Eb;
  const Ared = Ag + (alpha - 1) * Ap; // = Ab + alpha * Ap
  const Ired = Ig + (alpha - 1) * Ip_ring; // khớp công thức chuẩn PI/64*(Do^4-Di^4) + 0.5*(alpha-1)*Ap*rp^2
  const Ired_withBarSelf = Ig + (alpha - 1) * Ip_total;

  const Wg = (2 * Ig) / Do;
  const Wred = (2 * Ired) / Do;
  const rg_gyration = Math.sqrt(Ig / Ag);
  const rred_gyration = Math.sqrt(Ired / Ared);

  // 5. Độ cứng chống uốn đàn hồi ban đầu (N·m²)
  const EIg = Eb * Ig;
  const EIred = Eb * Ired;

  // 6. Khối lượng dài (kg/m), trọng lượng thể tích (N/m³) và tự trọng phân bố đều q (N/m)
  const gamma = rho * g;             // N/m³
  const massPerMeter = rho * Ag;     // kg/m
  const totalMass = massPerMeter * L;// kg
  const selfWeightPerMeter = gamma * Ag; // N/m
  const totalSelfWeight = selfWeightPerMeter * L; // N

  // Kiểm tra độc lập khối lượng tách riêng bê tông thuần + thép DƯL (rho_steel = 7850 kg/m³)
  const rho_steel = 7850;
  const massPerMeter_composite = rho * Ab + rho_steel * Ap;

  // 7. Phân vùng dọc trục cọc section(x): vùng đầu cọc L_end = min(L/2, k_end * Do) và vùng thân giữa
  const L_end = Math.min(L / 2, endZoneLengthFactor_Do * Do);
  const makeSpiralZone = (z, zoneName) => {
    const nWires = z.wireCount;
    const d_sw = z.diameter;
    const s = z.pitch;
    const Asw1 = (Math.PI / 4) * d_sw * d_sw;
    const Asw_per_pitch = nWires * Asw1;
    const asw_per_m = s > 0 ? Asw_per_pitch / s : 0; // m²/m (trên 1 mặt cắt thành)
    return Object.freeze({
      zone: zoneName,
      wireCount: nWires,
      diameter_m: d_sw,
      pitch_m: s,
      Asw1_m2: Asw1,
      Asw_per_pitch_m2: Asw_per_pitch,
      asw_per_m_m2_per_m: asw_per_m,
      nonPrestressedRebarIncluded: false,
      As_nonPrestressed_m2: 0,
    });
  };

  const endZoneProps = makeSpiralZone(spiralEnd, 'end');
  const midZoneProps = makeSpiralZone(spiralMid, 'mid');

  /**
   * Trả về đặc trưng tiết diện và cốt đai tại tọa độ dọc trục x (0 <= x <= L).
   */
  function sectionAt(x) {
    if (!(x >= -1e-9 && x <= L + 1e-9)) {
      throw new Error(`Tọa độ x = ${x} m nằm ngoài chiều dài cọc [0, ${L}] m`);
    }
    const xc = Math.min(L, Math.max(0, x));
    const isEnd = xc <= L_end + 1e-9 || xc >= L - L_end - 1e-9;
    const spiral = isEnd ? endZoneProps : midZoneProps;
    return Object.freeze({
      x_m: xc,
      zone: spiral.zone,
      isEndZone: isEnd,
      t_m: t,
      Ag_m2: Ag,
      Ab_m2: Ab,
      Ap_m2: Ap,
      Ared_m2: Ared,
      Ig_m4: Ig,
      Ired_m4: Ired,
      Wg_m3: Wg,
      Wred_m3: Wred,
      EIg_Nm2: EIg,
      EIred_Nm2: EIred,
      spiral,
      nonPrestressedRebarIgnored: true,
    });
  }

  return Object.freeze({
    unitSystem: 'SI',
    L,
    Do, Dp, Di, t,
    ro, ri, rm, rp,
    coverOuter, coverInner,
    N1, d_pc,
    Ag, Ab, Ap1, Ap,
    alpha,
    Ared,
    Ig, Ib, Ip_ring, Ip_self, Ip_total,
    Ired, Ired_withBarSelf,
    Wg, Wred,
    rg_gyration, rred_gyration,
    Eb, Ep,
    EIg, EIred,
    rho, g, gamma,
    massPerMeter,
    massPerMeter_composite,
    totalMass,
    selfWeightPerMeter,
    totalSelfWeight,
    endZoneLengthFactor_Do,
    L_end,
    zones: Object.freeze({
      leftEnd: Object.freeze({ x0: 0, x1: L_end, ...endZoneProps }),
      middle: Object.freeze({ x0: L_end, x1: L - L_end, ...midZoneProps }),
      rightEnd: Object.freeze({ x0: L - L_end, x1: L, ...endZoneProps }),
    }),
    bars: Object.freeze(bars),
    nonPrestressedRebarIgnored: true,
    sectionAt,
  });
}
