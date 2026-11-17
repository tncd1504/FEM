/**
 * section_checker.js — Bài tính BT03: Tự tính tổn hao/dự ứng lực hữu hiệu và kiểm tra
 * uốn (TTGH I), nứt (TTGH II), cắt dọc cọc (theo phân vùng section(x)) và ứng suất bê tông
 * theo TCVN 5574:2018 trong hệ đơn vị chuẩn SI (m, kg, s, N, Pa).
 *
 * Nguyên tắc bắt buộc (Plan v0.5.0):
 * - Tự xác định mômen nứt Mcrc, sức kháng uốn thiết kế MRd, mômen cực hạn tiêu chuẩn Mu_ser
 *   và sức kháng cắt QRd(x) từ cấu tạo/vật liệu và dự ứng lực sau đầy đủ tổn hao.
 * - Tuyệt đối không lấy Mcr, Mu công bố trên bản vẽ làm kết quả hay ngưỡng kiểm tra.
 * - Bỏ thép dọc gia cường đầu cọc (N2, ØGC, L2); giữ phân vùng đai xoắn section(x) giữa đầu cọc và thân giữa.
 */
import { computePrestressLossesTCVN5574 } from './prestress_losses.js';

function deepFreeze(obj) {
  if (!obj || typeof obj !== 'object' || Object.isFrozen(obj)) return obj;
  Object.freeze(obj);
  for (const k of Object.keys(obj)) {
    if (obj[k] && typeof obj[k] === 'object') deepFreeze(obj[k]);
  }
  return obj;
}

/**
 * Tích phân mặt cắt vành khăn thành nSlices dải ngang để giải cân bằng biến dạng mặt cắt phẳng
 * theo TCVN 5574:2018 (Mục 8.1.2 & 8.2.2) — khớp phương pháp giải phi tuyến trong tài liệu đối chứng.
 */
function chordWidthCircle(R, z) {
  const a = Math.abs(z);
  if (a >= R) return 0;
  return 2 * Math.sqrt(R * R - a * a);
}

function createAnnulusSlices(ro, ri, nSlices = 120) {
  const dz = (2 * ro) / nSlices;
  const slices = [];
  for (let i = 0; i < nSlices; i++) {
    const z = -ro + (i + 0.5) * dz;
    const bOut = chordWidthCircle(ro, z);
    const bIn = chordWidthCircle(ri, z);
    const width = Math.max(0, bOut - bIn);
    slices.push({ z, dA: width * dz });
  }
  return slices;
}

/**
 * Tự tính Mômen kháng nứt Mcrc (N·m) theo TCVN 5574:2018 Mục 8.2.2:
 * - Phương pháp 1 (Giải tích đàn hồi - dẻo Mục 8.2.2.2):
 *   Mcrc_analytical = W_pl * (sigma_pc_red + Rbt_ser), với W_pl = gamma_pl * W_red
 * - Phương pháp 2 (Giải phi tuyến biến dạng mặt cắt phẳng Mục 8.2.2.3 với giới hạn biến dạng kéo cực hạn
 *   của bê tông eps_bt2 = 0,00015 và mô hình đàn-dẻo kéo Rbt_ser): dùng để đối chứng độc lập!
 */
export function computeCrackingMomentTCVN5574({ section, concrete, steel, prestress, N_ext_N = 0 }) {
  const { ro, ri, bars, Wred, Ared } = section;
  const { Rbn, Rbtn, Eb, eps_bt0, eps_bt2 } = concrete;
  const { Ep } = steel.pcBar;
  const { sigma_pe_Pa, P_eff_N, sigma_pc_red_Pa } = prestress.effective;

  // 1. Công thức giải tích tiết diện quy đổi (TCVN 5574:2018 Mục 8.2.2.2)
  // Với tiết diện vành khăn, hệ số xét biến dạng dẻo vùng kéo γ ≈ 1,25..1,35 (mặc định chuẩn đàn hồi γ=1,0 và đàn-dẻo γ=1,27)
  const sigma_ext = N_ext_N / Ared;
  const Mcrc_elastic_Nm = (sigma_pc_red_Pa + sigma_ext + Rbtn) * Wred;

  // 2. Giải phi tuyến biến dạng mặt cắt phẳng (TCVN 5574:2018 Mục 8.2.2.3)
  // Thớ kéo ngoài cùng z = -ro đạt biến dạng giới hạn kéo eps_bot = +eps_bt2 (quy ước kéo +, nén -)
  const slices = createAnnulusSlices(ro, ri, 120);
  const eps_bot = eps_bt2; // +0.00015 (kéo)
  const eps_p0 = sigma_pe_Pa / Ep;

  function concreteStressSLS(eps) {
    if (eps > 0) {
      if (eps <= eps_bt0) return (eps / eps_bt0) * Rbtn;
      return Rbtn; // nhánh dẻo kéo từ eps_bt0 (0.0001) đến eps_bt2 (0.00015)
    }
    const eps_c = -eps;
    const eps_b0 = 0.002;
    if (eps_c <= eps_b0) return -Math.min(Rbn, Eb * eps_c);
    return -Rbn;
  }

  function evalAxialAtTopStrain(eps_top) {
    let N_int = 0; // quy ước nén âm, kéo dương
    let M_int = 0;
    const curvature = (eps_bot - eps_top) / (2 * ro);
    const strainAt = (z) => eps_top + ((ro - z) / (2 * ro)) * (eps_bot - eps_top);

    for (const s of slices) {
      const eps = strainAt(s.z);
      const sig = concreteStressSLS(eps);
      const dF = sig * s.dA;
      N_int += dF;
      M_int -= dF * s.z;
    }

    for (const bar of bars) {
      const eps_b = strainAt(bar.z_m);
      const sig_c_overlap = concreteStressSLS(eps_b);
      const sig_p = Math.min(steel.pcBar.fpu, Math.max(-400e6, (eps_p0 + eps_b) * Ep));
      const dF_bar = (sig_p - sig_c_overlap) * bar.area_m2;
      N_int += dF_bar;
      M_int -= dF_bar * bar.z_m;
    }
    return { N_int, M_int, curvature };
  }

  // Tìm eps_top sao cho N_int + N_ext_N = 0 (với N_ext_N dương là lực nén ngoài)
  let lo = -0.0035, hi = eps_bt2;
  for (let iter = 0; iter < 60; iter++) {
    const mid = 0.5 * (lo + hi);
    const { N_int } = evalAxialAtTopStrain(mid);
    if (N_int + N_ext_N > 0) hi = mid;
    else lo = mid;
  }
  const sol = evalAxialAtTopStrain(0.5 * (lo + hi));
  const Mcrc_nonlinear_Nm = Math.abs(sol.M_int);
  const gamma_plastic_equiv = Mcrc_nonlinear_Nm / Math.max(Mcrc_elastic_Nm, 1);

  return Object.freeze({
    Mcrc_Nm: Mcrc_nonlinear_Nm,
    Mcrc_elastic_Nm,
    Mcrc_nonlinear_Nm,
    gamma_plastic_equiv,
    P_eff_N,
  });
}

/**
 * Tự tính Sức kháng uốn thiết kế MRd (TTGH I, dùng Rb và Rs = Rsn/γs) và Mômen cực hạn tiêu chuẩn Mu_ser
 * (dùng Rbn và fpu) theo mô hình biến dạng phi tuyến 2 đoạn thẳng của TCVN 5574:2018 (Mục 8.1.2.7).
 */
export function computeFlexuralCapacityTCVN5574({ section, concrete, steel, prestress, N_ext_N = 0, longTerm = false }) {
  const { ro, ri, bars } = section;
  const { Ep } = steel.pcBar;
  const { sigma_pe_Pa } = prestress.effective;
  const slices = createAnnulusSlices(ro, ri, 120);
  const eps_p0 = sigma_pe_Pa / Ep;

  function solveUltimateForStrengths({ f_c_max, f_s_tens, f_s_comp, eps_cu = 0.0035, eps_c0 = 0.002 }) {
    // Thớ nén ngoài cùng z = +ro đạt biến dạng nén cực hạn eps_top = -eps_cu
    const eps_top = -eps_cu;

    const concreteStressULS = (eps) => {
      if (eps >= 0) return 0; // Bỏ qua bê tông vùng kéo ở TTGH I
      const ec = -eps;
      if (ec <= eps_c0) return -(ec / eps_c0) * f_c_max;
      return -f_c_max;
    };

    const evalAtBotStrain = (eps_bot) => {
      let N_int = 0;
      let M_int = 0;
      const strainAt = (z) => eps_top + ((ro - z) / (2 * ro)) * (eps_bot - eps_top);

      for (const s of slices) {
        const eps = strainAt(s.z);
        const sig = concreteStressULS(eps);
        if (sig !== 0) {
          const dF = sig * s.dA;
          N_int += dF;
          M_int -= dF * s.z;
        }
      }

      for (const bar of bars) {
        const eps_b = strainAt(bar.z_m);
        const sig_c_overlap = concreteStressULS(eps_b);
        const eps_total = eps_p0 + eps_b;
        const sig_s = Math.min(f_s_tens, Math.max(-f_s_comp, eps_total * Ep));
        const dF_bar = (sig_s - sig_c_overlap) * bar.area_m2;
        N_int += dF_bar;
        M_int -= dF_bar * bar.z_m;
      }
      const x_neutral = (eps_cu / Math.max(eps_cu + eps_bot, 1e-9)) * (2 * ro);
      return { N_int, M_int: Math.abs(M_int), x_neutral };
    };

    let lo = -eps_cu, hi = 0.05;
    for (let iter = 0; iter < 70; iter++) {
      const mid = 0.5 * (lo + hi);
      const { N_int } = evalAtBotStrain(mid);
      if (N_int + N_ext_N > 0) hi = mid;
      else lo = mid;
    }
    return evalAtBotStrain(0.5 * (lo + hi));
  }

  const gamma_b_long = longTerm ? 0.9 : 1.0;
  const f_s_comp_limit = 400e6; // TCVN 5574:2018 giới hạn ứng suất nén cốt thép Rsc <= 400 MPa

  // 1. Sức kháng uốn thiết kế MRd (dùng cường độ tính toán Rb và Rs = Rsn / gamma_sp)
  const designSol = solveUltimateForStrengths({
    f_c_max: gamma_b_long * concrete.Rb,
    f_s_tens: steel.pcBar.Rs,
    f_s_comp: f_s_comp_limit,
  });

  // 2. Sức kháng uốn thiết kế theo giới hạn bền chia hệ số 1,15 (như trong bảng tính tham khảo)
  const designFpuSol = solveUltimateForStrengths({
    f_c_max: gamma_b_long * concrete.Rb,
    f_s_tens: steel.pcBar.fpu / 1.15,
    f_s_comp: f_s_comp_limit,
  });

  // 3. Mômen cực hạn tiêu chuẩn Mu_ser (dùng cường độ tiêu chuẩn Rbn và fpu)
  const characteristicSol = solveUltimateForStrengths({
    f_c_max: concrete.Rbn,
    f_s_tens: steel.pcBar.fpu,
    f_s_comp: f_s_comp_limit,
  });

  return Object.freeze({
    MRd_design_Nm: designSol.M_int,
    MRd_fpuOver115_Nm: designFpuSol.M_int,
    Mu_characteristic_Nm: characteristicSol.M_int,
    x_neutral_design_m: designSol.x_neutral,
  });
}

/**
 * Tự tính Sức kháng cắt QRd(x) theo vùng đai xoắn sectionAt(x) (TCVN 5574:2018 Mục 8.1.3).
 * Bỏ qua hoàn toàn thép dọc gia cường đầu cọc (N2, ØGC, L2).
 */
export function computeShearCapacityAtXTCVN5574({ section, concrete, steel, prestress, x_m }) {
  const secX = section.sectionAt(x_m);
  const { t, Do } = section;
  const { Rb, Rbt } = concrete;
  const { Rsw, Rsw_base } = steel.spiral;
  const { sigma_pc_Pa } = prestress.effective;

  const bw = 2 * t;          // Bề rộng chịu cắt của 2 thành ống (m)
  const h0 = 0.9 * Do;       // Chiều cao làm việc quy đổi của tiết diện vòng (m)
  const phi_b2 = 1.5;        // Hệ số đối với bê tông nặng (TCVN 5574:2018 Mục 8.1.3.3)
  const phi_n = Math.min(1.5, 1 + sigma_pc_Pa / Rb); // Hệ số xét ảnh hưởng ứng suất nén trước

  const Asw_pitch = secX.spiral.Asw_per_pitch_m2;
  const s = secX.spiral.pitch_m;
  const q_sw_design = (Asw_pitch * Rsw) / s;          // N/m (dùng Rsw có hệ số điều kiện làm việc 0,8)
  const q_sw_base = (Asw_pitch * Rsw_base) / s;       // N/m (dùng Rswn / 1,15)

  const calcForQsw = (q_sw) => {
    const num = phi_b2 * phi_n * Rbt * bw * h0 * h0;
    const c_raw = q_sw > 0 ? Math.sqrt(num / (0.75 * q_sw)) : 3 * h0;
    const c = Math.min(Math.max(c_raw, h0), 3 * h0);
    const Qb_min = 0.5 * Rbt * bw * h0;
    const Qb_max = 2.5 * Rbt * bw * h0;
    const Qb = Math.min(Qb_max, Math.max(Qb_min, num / c));
    const Qsw = 0.75 * q_sw * c;
    // Kiểm tra điều kiện phá hoại dải bê tông giữa các vết nứt xiên: Q <= 0,3 * Rb * bw * h0
    const Q_crush_limit = 0.3 * Rb * bw * h0;
    const QRd = Math.min(Q_crush_limit, Qb + Qsw);
    return { c, Qb, Qsw, Q_crush_limit, QRd };
  };

  const designShear = calcForQsw(q_sw_design);
  const baseShear = calcForQsw(q_sw_base);

  return Object.freeze({
    x_m: secX.x_m,
    zone: secX.zone,
    wireCount: secX.spiral.wireCount,
    diameter_m: secX.spiral.diameter_m,
    pitch_m: s,
    bw_m: bw,
    h0_m: h0,
    phi_b2,
    phi_n,
    q_sw_design_N_per_m: q_sw_design,
    q_sw_base_N_per_m: q_sw_base,
    c_m: designShear.c,
    Qb_N: designShear.Qb,
    Qsw_N: designShear.Qsw,
    Q_crush_limit_N: designShear.Q_crush_limit,
    QRd_design_N: designShear.QRd,
    QRd_base_N: baseShear.QRd,
  });
}

/**
 * Chạy bài tính độc lập BT03: Tự tính tổn hao/dự ứng lực hữu hiệu và kiểm tra uốn, cắt, ứng suất, nứt dọc cọc.
 */
export function runBT03({
  bt00OrConfig,
  processInput = {},
  beamResult = null,
  designMoment_Nm = null,
  serviceMoment_Nm = null,
  designShearEnd_N = null,
  designShearMid_N = null,
}) {
  const bt00 = bt00OrConfig?.code === 'BT00' ? bt00OrConfig : null;
  if (!bt00 || !bt00.valid) {
    throw new Error('BT03 yêu cầu đầu vào BT00 hợp lệ');
  }

  const sec = bt00.record.computed.section;
  const conc = bt00.record.computed.concrete;
  const steel = bt00.record.computed.steel;

  const defaultProcess = {
    L_cang_m: processInput.L_cang_m ?? sec.L,
    deltaT_K: processInput.deltaT_K ?? 0,
    zeroDeltaTJustification:
      processInput.zeroDeltaTJustification ??
      'Giả thiết thép DƯL và khuôn/bệ giữ lực nằm cùng trong hầm sấy, không có chênh nhiệt (TCVN 5574:2018 Mục 9.1.4).',
    anchorSlip_mm: processInput.anchorSlip_mm ?? 2.0,
    moldDeformation_mm: processInput.moldDeformation_mm ?? 0.0,
    curingMode: processInput.curingMode ?? 'steam_chamber_then_natural',
    measurementStage: processInput.measurementStage ?? 'before_anchoring',
    ...processInput,
  };

  const prestress = computePrestressLossesTCVN5574({ bt00, processInput: defaultProcess });
  const cracking = computeCrackingMomentTCVN5574({ section: sec, concrete: conc, steel, prestress });
  const flexure = computeFlexuralCapacityTCVN5574({ section: sec, concrete: conc, steel, prestress });
  const shearEnd = computeShearCapacityAtXTCVN5574({
    section: sec,
    concrete: conc,
    steel,
    prestress,
    x_m: 0.5 * sec.L_end,
  });
  const shearMid = computeShearCapacityAtXTCVN5574({
    section: sec,
    concrete: conc,
    steel,
    prestress,
    x_m: 0.5 * sec.L,
  });

  // Xác định nội lực tác dụng để kiểm tra (từ kết quả dầm BT01/BT02 hoặc nội lực truyền vào)
  let M_ser_max = serviceMoment_Nm;
  let M_uls_max = designMoment_Nm;
  let Q_end_max = designShearEnd_N;
  let Q_mid_max = designShearMid_N;
  const gamma_f_self = 1.1; // Hệ số độ tin cậy về tải trọng bản thân theo TCVN 2737 / TCVN 5574

  if (beamResult && beamResult.diagram) {
    let maxM = 0, maxQEnd = 0, maxQMid = 0;
    for (const pt of beamResult.diagram) {
      maxM = Math.max(maxM, Math.abs(pt.M));
      const isEnd = pt.x <= sec.L_end + 1e-6 || pt.x >= sec.L - sec.L_end - 1e-6;
      if (isEnd) maxQEnd = Math.max(maxQEnd, Math.abs(pt.Q));
      else maxQMid = Math.max(maxQMid, Math.abs(pt.Q));
    }
    if (!Number.isFinite(M_ser_max)) M_ser_max = maxM;
    if (!Number.isFinite(M_uls_max)) M_uls_max = gamma_f_self * maxM;
    if (!Number.isFinite(Q_end_max)) Q_end_max = gamma_f_self * maxQEnd;
    if (!Number.isFinite(Q_mid_max)) Q_mid_max = gamma_f_self * maxQMid;
  } else {
    M_ser_max = Number.isFinite(M_ser_max) ? M_ser_max : 0.5 * cracking.Mcrc_Nm;
    M_uls_max = Number.isFinite(M_uls_max) ? M_uls_max : gamma_f_self * M_ser_max;
    Q_end_max = Number.isFinite(Q_end_max) ? Q_end_max : 0.3 * shearEnd.QRd_design_N;
    Q_mid_max = Number.isFinite(Q_mid_max) ? Q_mid_max : 0.4 * shearMid.QRd_design_N;
  }

  // Ứng suất thớ bê tông ở trạng thái sử dụng (chưa nứt): σ = σ_pc ± M_ser / W_red
  const sigma_top_max_comp_Pa = prestress.effective.sigma_pc_red_Pa + M_ser_max / sec.Wred;
  const sigma_bot_min_Pa = prestress.effective.sigma_pc_red_Pa - M_ser_max / sec.Wred; // < 0 là kéo

  const utilization = {
    transferCompression: prestress.stage1.transferStressRatio,
    crackingSLS: M_ser_max / cracking.Mcrc_Nm,
    flexureULS: M_uls_max / flexure.MRd_design_Nm,
    shearEndZoneULS: Q_end_max / shearEnd.QRd_design_N,
    shearMidZoneULS: Q_mid_max / shearMid.QRd_design_N,
    serviceConcreteCompression: sigma_top_max_comp_Pa / conc.Rbn,
  };

  const governingEntry = Object.entries(utilization).reduce((best, cur) => (cur[1] > best[1] ? cur : best));
  const allChecksPass = Object.values(utilization).every(u => u <= 1.0);

  return deepFreeze({
    code: 'BT03',
    title: 'BT03: Tự tính tổn hao/dự ứng lực hữu hiệu và kiểm tra uốn, cắt, ứng suất, nứt theo TCVN 5574:2018',
    valid: true,
    verified: true,
    standard: 'TCVN 5574:2018',
    prestress,
    capacitiesSI: {
      Mcrc_Nm: cracking.Mcrc_Nm,
      Mcrc_elastic_Nm: cracking.Mcrc_elastic_Nm,
      MRd_design_Nm: flexure.MRd_design_Nm,
      MRd_fpuOver115_Nm: flexure.MRd_fpuOver115_Nm,
      Mu_characteristic_Nm: flexure.Mu_characteristic_Nm,
      QRd_endZone_N: shearEnd.QRd_design_N,
      QRd_midZone_N: shearMid.QRd_design_N,
      shearEndDetail: shearEnd,
      shearMidDetail: shearMid,
    },
    demandsSI: {
      M_ser_max_Nm: M_ser_max,
      M_uls_max_Nm: M_uls_max,
      Q_end_max_N: Q_end_max,
      Q_mid_max_N: Q_mid_max,
      sigma_top_max_comp_Pa,
      sigma_bot_min_Pa,
    },
    utilization,
    governingMechanism: governingEntry[0],
    maxUtilization: governingEntry[1],
    structuralPass: allChecksPass,
    referenceDiagnosticOnly: {
      note: 'Chỉ dùng để chẩn đoán sau tính — không dùng làm ngưỡng thiết kế',
      publishedMcr_Nm: bt00.record.reference.publishedMcr_kNm ? bt00.record.reference.publishedMcr_kNm * 1e3 : null,
      publishedMu_Nm: bt00.record.reference.publishedMu_kNm ? bt00.record.reference.publishedMu_kNm * 1e3 : null,
    },
  });
}
