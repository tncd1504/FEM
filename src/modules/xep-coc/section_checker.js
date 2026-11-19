/**
 * section_checker.js — Bài tính BT03: Tự tính tổn hao/dự ứng lực hữu hiệu và kiểm tra
 * uốn (TTGH I), nứt (TTGH II), cắt dọc cọc (theo phân vùng section(x)) và ứng suất bê tông
 * theo TCVN 5574:2018 trong hệ đơn vị chuẩn SI (m, kg, s, N, Pa).
 *
 * Nguyên tắc bắt buộc (Plan v0.5.0):
 * - Tự xác định mômen nứt Mcrc, sức kháng uốn thiết kế MRd, mômen cực hạn tiêu chuẩn Mu_ser
 *   và sức kháng cắt QRd(x) từ cấu tạo/vật liệu và dự ứng lực sau đầy đủ tổn hao.
 * - Dự ứng lực đưa vào kiểm tra nứt và TTGH I nhân hệ số độ chính xác căng γsp = 0,9 (có lợi).
 * - Tuyệt đối không lấy Mcr, Mu công bố trên bản vẽ làm kết quả hay ngưỡng kiểm tra.
 * - Bỏ thép dọc gia cường đầu cọc (N2, ØGC, L2); giữ phân vùng đai xoắn section(x) giữa đầu cọc và thân giữa.
 * - Quy trình căng (L_cang, σ_sp0, ΔT...) bắt buộc khai báo qua processInput; không tự điền mặc định ngầm.
 */
import { computePrestressLossesTCVN5574 } from './prestress_losses.js';
import { TCVN5574 } from './standards/tcvn5574_factors.js';

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
 * theo TCVN 5574:2018 (Mục 8.1.2 & 8.2.2).
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

/** Biến dạng tại cao độ z của mặt cắt phẳng có biến dạng thớ trên (z = +ro) và thớ dưới (z = -ro). */
function planeStrain(ro, eps_top, eps_bot) {
  return (z) => eps_top + ((ro - z) / (2 * ro)) * (eps_bot - eps_top);
}

/**
 * Biểu đồ trạng thái 3 đoạn thẳng của cốt thép có giới hạn chảy quy ước (TCVN 5574:2018 Mục 6.2):
 * đàn hồi tới σs1 = 0,9·Rs; tăng tuyến tính tới Rs tại εs0 = Rs/Es + 0,002; sau đó nằm ngang.
 * Vùng nén: tuyến tính tới Rsc (≤ 400 MPa).
 */
export function conditionalYieldSteelStress(eps, Rs, Es, Rsc = TCVN5574.steel.Rsc_max_Pa) {
  if (eps < 0) return -Math.min(Rsc, Es * -eps);
  const k1 = TCVN5574.steel.sigma_s1_ratio;
  const eps_s1 = (k1 * Rs) / Es;
  const eps_s0 = Rs / Es + TCVN5574.steel.eps_offset_conditionalYield;
  if (eps <= eps_s1) return Es * eps;
  if (eps < eps_s0) return Rs * (k1 + (1 - k1) * (eps - eps_s1) / (eps_s0 - eps_s1));
  return Rs;
}

/**
 * Tự tính Mômen kháng nứt Mcrc (N·m) theo TCVN 5574:2018 Mục 8.2.2:
 * - Phương pháp chính: biến dạng phi tuyến mặt cắt phẳng (Mục 8.2.2.3), thớ kéo đạt εbt2 = 0,00015,
 *   bê tông kéo đàn–dẻo Rbt,ser.
 * - Đối chứng: công thức đàn hồi Mcrc_el = (σpc + Rbt,ser)·Wred (không xét biến dạng dẻo — cận dưới).
 * Dự ứng lực lấy với γsp = 0,9 (có lợi).
 */
export function computeCrackingMomentTCVN5574({ section, concrete, steel, prestress, N_ext_N = 0 }) {
  const { ro, ri, bars, Wred, Ared } = section;
  const { Rbn, Rbtn, Eb, eps_bt0, eps_bt2 } = concrete;
  const { Ep } = steel.pcBar;
  const { sigma_pe_favourable_Pa, P_eff_favourable_N, sigma_pc_favourable_Pa } = prestress.effective;

  const sigma_ext = N_ext_N / Ared;
  const Mcrc_elastic_Nm = (sigma_pc_favourable_Pa + sigma_ext + Rbtn) * Wred;

  const slices = createAnnulusSlices(ro, ri, 120);
  const eps_bot = eps_bt2; // +0.00015 (kéo)
  const eps_p0 = sigma_pe_favourable_Pa / Ep;

  function concreteStressSLS(eps) {
    if (eps > 0) {
      if (eps <= eps_bt0) return (eps / eps_bt0) * Rbtn;
      return Rbtn; // nhánh dẻo kéo từ eps_bt0 (0.0001) đến eps_bt2 (0.00015)
    }
    const eps_c = -eps;
    if (eps_c <= concrete.eps_b0) return -Math.min(Rbn, Eb * eps_c);
    return -Rbn;
  }

  function evalAxialAtTopStrain(eps_top) {
    let N_int = 0; // quy ước nén âm, kéo dương
    let M_int = 0;
    const strainAt = planeStrain(ro, eps_top, eps_bot);
    for (const s of slices) {
      const dF = concreteStressSLS(strainAt(s.z)) * s.dA;
      N_int += dF;
      M_int -= dF * s.z;
    }
    for (const bar of bars) {
      const eps_b = strainAt(bar.z_m);
      const sig_c_overlap = concreteStressSLS(eps_b);
      const sig_p = Math.min(steel.pcBar.fpu, Math.max(-TCVN5574.steel.Rsc_max_Pa, (eps_p0 + eps_b) * Ep));
      const dF_bar = (sig_p - sig_c_overlap) * bar.area_m2;
      N_int += dF_bar;
      M_int -= dF_bar * bar.z_m;
    }
    return { N_int, M_int };
  }

  // Tìm eps_top sao cho N_int + N_ext_N = 0 (với N_ext_N dương là lực nén ngoài)
  let lo = -concrete.eps_b2, hi = eps_bt2;
  for (let iter = 0; iter < 80; iter++) {
    const mid = 0.5 * (lo + hi);
    const { N_int } = evalAxialAtTopStrain(mid);
    if (N_int + N_ext_N > 0) hi = mid;
    else lo = mid;
  }
  const sol = evalAxialAtTopStrain(0.5 * (lo + hi));
  const Mcrc_nonlinear_Nm = Math.abs(sol.M_int);
  const residualN_rel = Math.abs(sol.N_int + N_ext_N) / Math.max(P_eff_favourable_N, 1);

  return Object.freeze({
    Mcrc_Nm: Mcrc_nonlinear_Nm,
    Mcrc_elastic_Nm,
    Mcrc_nonlinear_Nm,
    gamma_plastic_equiv: Mcrc_nonlinear_Nm / Math.max(Mcrc_elastic_Nm, 1),
    P_eff_favourable_N,
    gamma_sp: prestress.effective.gamma_sp_favourable,
    residualN_rel,
  });
}

/**
 * Tự tính Sức kháng uốn thiết kế MRd (TTGH I) theo mô hình biến dạng phi tuyến (TCVN 5574:2018 Mục 8.1.2):
 * - Bê tông: đoạn tăng tuyến tính tới εb0 = 0,002 rồi nằm ngang tới εb2 = 0,0035 (Rb đã gồm γb1).
 * - Thép DƯL: biểu đồ 3 đoạn thẳng có giới hạn chảy quy ước, tổng biến dạng (εp0 + Δε) ≤ εs2 = 0,015.
 * - Trạng thái giới hạn là trạng thái đến trước: bê tông đạt εb2 hoặc thanh thép chịu kéo nhiều nhất đạt εs2.
 * Dự ứng lực đưa vào với γsp = 0,9.
 */
export function computeFlexuralCapacityTCVN5574({ section, concrete, steel, prestress, N_ext_N = 0 }) {
  const { ro, ri, bars } = section;
  const { Ep } = steel.pcBar;
  const slices = createAnnulusSlices(ro, ri, 120);
  const eps_p0 = prestress.effective.sigma_pe_favourable_Pa / Ep;
  const eps_cu = concrete.eps_b2;
  const eps_c0 = concrete.eps_b0;
  const eps_s2 = TCVN5574.steel.eps_s2_conditionalYield;
  const zBarMin = Math.min(...bars.map(b => b.z_m)); // thanh chịu kéo nhiều nhất (thớ dưới)

  function solveUltimate({ f_c_max, Rs_tens }) {
    const concreteStressULS = (eps) => {
      if (eps >= 0) return 0; // Bỏ qua bê tông vùng kéo ở TTGH I
      const ec = -eps;
      if (ec <= eps_c0) return -(ec / eps_c0) * f_c_max;
      return -f_c_max;
    };

    const evalPlane = (eps_top, eps_bot) => {
      let N_int = 0;
      let M_int = 0;
      const strainAt = planeStrain(ro, eps_top, eps_bot);
      for (const s of slices) {
        const sig = concreteStressULS(strainAt(s.z));
        if (sig !== 0) {
          const dF = sig * s.dA;
          N_int += dF;
          M_int -= dF * s.z;
        }
      }
      for (const bar of bars) {
        const eps_b = strainAt(bar.z_m);
        const sig_c_overlap = concreteStressULS(eps_b);
        const sig_s = conditionalYieldSteelStress(eps_p0 + eps_b, Rs_tens, Ep);
        const dF_bar = (sig_s - sig_c_overlap) * bar.area_m2;
        N_int += dF_bar;
        M_int -= dF_bar * bar.z_m;
      }
      return {
        N_int,
        M_int: Math.abs(M_int),
        maxBarTotalStrain: eps_p0 + strainAt(zBarMin),
        eps_top,
        eps_bot,
      };
    };

    // Trạng thái A: bê tông thớ trên đạt εb2, tìm eps_bot cân bằng lực dọc
    let lo = -eps_cu, hi = 0.05;
    for (let iter = 0; iter < 80; iter++) {
      const mid = 0.5 * (lo + hi);
      if (evalPlane(-eps_cu, mid).N_int + N_ext_N > 0) hi = mid;
      else lo = mid;
    }
    const solA = evalPlane(-eps_cu, 0.5 * (lo + hi));
    if (solA.maxBarTotalStrain <= eps_s2) {
      return { ...solA, mode: 'concrete_crushing_eps_b2', residualN: Math.abs(solA.N_int + N_ext_N) };
    }

    // Trạng thái B: thanh thép chịu kéo nhiều nhất đạt εs2, tìm eps_top cân bằng lực dọc
    const e_target = eps_s2 - eps_p0;
    const w = (ro - zBarMin) / (2 * ro);
    const botFromTop = (eps_top) => eps_top + (e_target - eps_top) / w;
    let lo2 = -eps_cu, hi2 = e_target;
    for (let iter = 0; iter < 80; iter++) {
      const mid = 0.5 * (lo2 + hi2);
      if (evalPlane(mid, botFromTop(mid)).N_int + N_ext_N > 0) hi2 = mid;
      else lo2 = mid;
    }
    const tB = 0.5 * (lo2 + hi2);
    const solB = evalPlane(tB, botFromTop(tB));
    return { ...solB, mode: 'steel_strain_limit_eps_s2', residualN: Math.abs(solB.N_int + N_ext_N) };
  }

  const designSol = solveUltimate({ f_c_max: concrete.Rb, Rs_tens: steel.pcBar.Rs });
  const designFpuSol = solveUltimate({ f_c_max: concrete.Rb, Rs_tens: steel.pcBar.fpu / 1.15 });
  const characteristicSol = solveUltimate({ f_c_max: concrete.Rbn, Rs_tens: steel.pcBar.fpu });

  const P_ref = Math.max(prestress.effective.P_eff_favourable_N, 1);
  return Object.freeze({
    MRd_design_Nm: designSol.M_int,
    MRd_fpuOver115_Nm: designFpuSol.M_int,
    Mu_characteristic_Nm: characteristicSol.M_int,
    designLimitMode: designSol.mode,
    designMaxBarTotalStrain: designSol.maxBarTotalStrain,
    eps_s2,
    designResidualN_rel: designSol.residualN / P_ref,
    strainLimitsValidated: concrete.strainLimitsValidated !== false,
  });
}

/** Hệ số φn xét ảnh hưởng ứng suất nén trước σcp (TCVN 5574:2018 Mục 8.1.3) — dạng từng đoạn. */
function phiNForCompression(sigma_cp, Rb) {
  const r = Math.max(0, sigma_cp / Rb);
  if (r <= 0.25) return 1 + r;
  if (r <= 0.75) return 1.25;
  return Math.max(0, 5 * (1 - r));
}

/**
 * Tự tính Sức kháng cắt QRd(x) theo vùng đai xoắn sectionAt(x) (TCVN 5574:2018 Mục 8.1.3).
 * - Tiết diện vành khăn quy về 2 thành: b = 2t, h0 = 0,9·Do (giả thiết công bố).
 * - Cốt ngang chỉ được kể khi qsw ≥ 0,25·Rbt·b; Qsw = φsw·qsw·min(c, 2h0).
 * - Kiểm tra với hình chiếu c bất lợi nhất trong [h0; 3h0] (tác động lấy bằng lực cắt lớn nhất trong vùng).
 * - Đai xoắn tính 1 nhánh/bước trên tiết diện (thiên an toàn; chưa kể nhánh đối diện).
 * Bỏ qua hoàn toàn thép dọc gia cường đầu cọc (N2, ØGC, L2).
 */
export function computeShearCapacityAtXTCVN5574({ section, concrete, steel, prestress, x_m }) {
  const secX = section.sectionAt(x_m);
  const { t, Do } = section;
  const { Rb, Rbt } = concrete;
  const { Rsw, Rsw_base } = steel.spiral;
  const S = TCVN5574.shear;
  const sigma_cp = prestress.effective.sigma_pc_favourable_Pa;

  const bw = 2 * t;
  const h0 = 0.9 * Do;
  const phi_b2 = S.phi_b2;
  const phi_n = phiNForCompression(sigma_cp, Rb);

  const Asw_pitch = secX.spiral.Asw_per_pitch_m2;
  const s = secX.spiral.pitch_m;
  const q_sw_min = S.qswMinRatio * Rbt * bw;

  const calcForQsw = (q_sw_raw) => {
    const counted = q_sw_raw >= q_sw_min;
    const q_sw = counted ? q_sw_raw : 0;
    const num = phi_b2 * phi_n * Rbt * bw * h0 * h0;
    const Qb_min = S.Qb_min_factor * Rbt * bw * h0;
    const Qb_max = S.Qb_max_factor * Rbt * bw * h0;
    const Q_crush_limit = S.crushFactor * Rb * bw * h0;
    const cMin = S.cMinFactor_h0 * h0;
    const cMax = S.cMaxFactor_h0 * h0;
    const nScan = 240;
    let best = null;
    for (let i = 0; i <= nScan; i++) {
      const c = cMin + ((cMax - cMin) * i) / nScan;
      const Qb = Math.min(Qb_max, Math.max(Qb_min, num / c));
      const Qsw = S.phi_sw * q_sw * Math.min(c, S.cSwMaxFactor_h0 * h0);
      const Qsum = Qb + Qsw;
      if (!best || Qsum < best.Qsum) best = { c, Qb, Qsw, Qsum };
    }
    return {
      stirrupsCounted: counted,
      q_sw_raw,
      q_sw_used: q_sw,
      c: best.c,
      Qb: best.Qb,
      Qsw: best.Qsw,
      Q_crush_limit,
      QRd: Math.min(Q_crush_limit, best.Qsum),
    };
  };

  const designShear = calcForQsw((Asw_pitch * Rsw) / s);
  const baseShear = calcForQsw((Asw_pitch * Rsw_base) / s);

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
    sigma_cp_Pa: sigma_cp,
    q_sw_min_N_per_m: q_sw_min,
    q_sw_design_N_per_m: designShear.q_sw_raw,
    stirrupsCounted: designShear.stirrupsCounted,
    c_m: designShear.c,
    Qb_N: designShear.Qb,
    Qsw_N: designShear.Qsw,
    Q_crush_limit_N: designShear.Q_crush_limit,
    QRd_design_N: designShear.QRd,
    QRd_base_N: baseShear.QRd,
    clause: S.clause,
  });
}

/**
 * Chạy bài tính độc lập BT03: Tự tính tổn hao/dự ứng lực hữu hiệu và kiểm tra uốn, cắt, ứng suất, nứt dọc cọc.
 * processInput bắt buộc chứa dữ liệu căng/dưỡng hộ (L_cang_m, σ_sp0, ΔT và giả thiết nếu ΔT = 0...).
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
  const gamma_f = TCVN5574.loads.gamma_f_selfWeight;

  const prestress = computePrestressLossesTCVN5574({ bt00, processInput });
  const cracking = computeCrackingMomentTCVN5574({ section: sec, concrete: conc, steel, prestress });
  const flexure = computeFlexuralCapacityTCVN5574({ section: sec, concrete: conc, steel, prestress });
  const shearEnd = computeShearCapacityAtXTCVN5574({ section: sec, concrete: conc, steel, prestress, x_m: 0.5 * sec.L_end });
  const shearMid = computeShearCapacityAtXTCVN5574({ section: sec, concrete: conc, steel, prestress, x_m: 0.5 * sec.L });

  // Xác định nội lực tác dụng (từ kết quả dầm BT01/BT02 hoặc nội lực truyền vào ở trạng thái tiêu chuẩn)
  let M_ser_max = serviceMoment_Nm;
  let M_uls_max = designMoment_Nm;
  let Q_end_max = designShearEnd_N;
  let Q_mid_max = designShearMid_N;

  if (beamResult && beamResult.diagram) {
    let maxM = 0, maxQEnd = 0, maxQMid = 0;
    for (const pt of beamResult.diagram) {
      maxM = Math.max(maxM, Math.abs(pt.M));
      const isEnd = pt.x <= sec.L_end + 1e-6 || pt.x >= sec.L - sec.L_end - 1e-6;
      if (isEnd) maxQEnd = Math.max(maxQEnd, Math.abs(pt.Q));
      else maxQMid = Math.max(maxQMid, Math.abs(pt.Q));
    }
    if (!Number.isFinite(M_ser_max)) M_ser_max = maxM;
    if (!Number.isFinite(M_uls_max)) M_uls_max = gamma_f * maxM;
    if (!Number.isFinite(Q_end_max)) Q_end_max = gamma_f * maxQEnd;
    if (!Number.isFinite(Q_mid_max)) Q_mid_max = gamma_f * maxQMid;
  }
  if (![M_ser_max, M_uls_max, Q_end_max, Q_mid_max].every(Number.isFinite)) {
    throw new Error('BT03 thiếu nội lực tác dụng: cần beamResult (BT01/BT02) hoặc serviceMoment/designMoment/designShear.');
  }

  // Ứng suất thớ bê tông ở trạng thái sử dụng (chưa nứt): σ = σ_pc ± M_ser / W_red
  const sigma_top_max_comp_Pa = prestress.effective.sigma_pc_red_Pa + M_ser_max / sec.Wred;
  const sigma_bot_min_Pa = prestress.effective.sigma_pc_favourable_Pa - M_ser_max / sec.Wred; // < 0 là kéo

  const utilization = {
    crackingSLS: M_ser_max / cracking.Mcrc_Nm,
    flexureULS: M_uls_max / flexure.MRd_design_Nm,
    shearEndZoneULS: Q_end_max / shearEnd.QRd_design_N,
    shearMidZoneULS: Q_mid_max / shearMid.QRd_design_N,
    serviceConcreteCompression: sigma_top_max_comp_Pa / conc.Rbn,
  };

  const governingEntry = Object.entries(utilization).reduce((best, cur) => (cur[1] > best[1] ? cur : best));
  const allChecksPass = Object.values(utilization).every(u => u <= 1.0);
  const validityDomainOk = flexure.strainLimitsValidated;
  const numericResidualOk = cracking.residualN_rel < 1e-6 && flexure.designResidualN_rel < 1e-6;

  return deepFreeze({
    code: 'BT03',
    title: 'BT03: Tự tính tổn hao/dự ứng lực hữu hiệu và kiểm tra uốn, cắt, ứng suất, nứt theo TCVN 5574:2018',
    valid: true,
    verified: numericResidualOk,
    standard: 'TCVN 5574:2018',
    factors: {
      gamma_f,
      gamma_f_clause: TCVN5574.loads.clause,
      gamma_sp_favourable: prestress.effective.gamma_sp_favourable,
      gamma_b1: conc.gamma_b1,
      gamma_b1_clause: conc.gamma_b1_clause,
    },
    prestress,
    capacitiesSI: {
      Mcrc_Nm: cracking.Mcrc_Nm,
      Mcrc_elastic_Nm: cracking.Mcrc_elastic_Nm,
      MRd_design_Nm: flexure.MRd_design_Nm,
      MRd_limitMode: flexure.designLimitMode,
      MRd_maxBarTotalStrain: flexure.designMaxBarTotalStrain,
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
    // Kiểm tra giai đoạn truyền lực (sản xuất) — tách khỏi kết luận lưu kho
    stageChecks: {
      transfer: prestress.transferCheck,
    },
    numericChecks: {
      crackingResidualN_rel: cracking.residualN_rel,
      flexureResidualN_rel: flexure.designResidualN_rel,
    },
    validityDomain: {
      ok: validityDomainOk,
      note: validityDomainOk
        ? 'Biến dạng giới hạn bê tông εb0, εb2 áp dụng trong miền cấp B ≤ B60.'
        : `Cấp ${conc.gradeB} > B60: chưa hiệu chỉnh εb0, εb2 cho bê tông cường độ cao — không xuất kết luận đạt.`,
    },
    governingMechanism: validityDomainOk ? governingEntry[0] : 'ngoài miền hiệu lực (B > B60)',
    maxUtilization: governingEntry[1],
    structuralPass: allChecksPass && validityDomainOk,
    referenceDiagnosticOnly: {
      note: 'Chỉ dùng để chẩn đoán sau tính — không dùng làm ngưỡng thiết kế',
      publishedMcr_Nm: bt00.record.reference.publishedMcr_kNm ? bt00.record.reference.publishedMcr_kNm * 1e3 : null,
      publishedMu_Nm: bt00.record.reference.publishedMu_kNm ? bt00.record.reference.publishedMu_kNm * 1e3 : null,
    },
  });
}
