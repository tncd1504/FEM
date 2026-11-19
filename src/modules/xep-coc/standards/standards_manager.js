/**
 * standards_manager.js — Quản lý hệ tiêu chuẩn mặc định (TCVN 5574:2018) và bộ tiêu chuẩn
 * tham khảo đối chiếu song song (Eurocode 2 — EN 1992-1-1:2004).
 *
 * Nguyên tắc bắt buộc (Skill Mục 4 & Plan Mục 7.3):
 * - Mặc định: primaryStandard = "TCVN", comparisonStandards = [], reportStandards = ["TCVN"].
 * - Bộ tham khảo (EC2) dùng chung dữ liệu vật lý gốc và kịch bản tải nhưng tự xác lập riêng
 *   đặc trưng vật liệu, hệ số tải/vật liệu, tổn hao và sức kháng; tuyệt đối không trộn hệ số
 *   hay ghi đè kết luận chính của TCVN.
 */
import { toSI } from '../../../core/units.js';

export const DEFAULT_STANDARDS_CONFIG = Object.freeze({
  primaryStandard: 'TCVN',
  primaryVersion: 'TCVN 5574:2018 (đối chiếu sản phẩm TCVN 7888:2014)',
  comparisonStandards: [],
  reportStandards: ['TCVN'],
});

/**
 * Chuẩn hóa cấu hình tiêu chuẩn khi lưu/nạp (cấu hình cũ thiếu trường tiêu chuẩn -> mặc định TCVN).
 */
export function normalizeStandardsConfig(cfg = {}) {
  const comp = Array.isArray(cfg.comparisonStandards)
    ? cfg.comparisonStandards.filter((s) => s === 'EC2')
    : [];
  const rep = Array.isArray(cfg.reportStandards) && cfg.reportStandards.length > 0
    ? cfg.reportStandards.filter((s) => s === 'TCVN' || s === 'EC2')
    : ['TCVN'];
  return {
    primaryStandard: 'TCVN', // Luôn giữ TCVN là cơ sở chính
    primaryVersion: 'TCVN 5574:2018',
    comparisonStandards: Array.from(new Set(comp)),
    reportStandards: Array.from(new Set(rep)),
  };
}

/**
 * Tính đối chiếu độc lập cho BT03 theo Eurocode 2 (EN 1992-1-1:2004 — Mục 3.1, 5.10, 6.1, 6.2)
 * với hệ số riêng của EC2 (γ_c = 1,5; γ_s = 1,15; γ_G = 1,35 cho tải trọng bản thân ULS).
 */
export function evaluateBT03Eurocode2Reference({ bt00, bt03TCVN, beamResult }) {
  const sec = bt00.record.computed.section;
  const concInput = bt00.record.input.concreteSI;
  const steelPC = bt00.record.computed.steel.pcBar;
  const steelSw = bt00.record.computed.steel.spiral;

  // Quy đổi cấp bê tông sang cường độ mẫu trụ đặc trưng f_ck (EN 1992-1-1 Bảng 3.1):
  // Nếu có cylinderStrength_MPa (80 MPa) dùng trực tiếp, ngược lại ước lượng f_ck ≈ 0,8 * B_value
  const bNum = Number(String(concInput.gradeB || 'B60').replace(/\D/g, '')) || 60;
  const fck_MPa = Number.isFinite(concInput.cylinderStrength_MPa)
    ? Math.min(90, concInput.cylinderStrength_MPa)
    : Math.min(90, 0.8 * bNum);
  const fck = toSI(fck_MPa, 'MPa');
  const gamma_c_EC2 = 1.5;
  const alpha_cc = 1.0;
  const fcd = (alpha_cc * fck) / gamma_c_EC2;
  // EN 1992-1-1 Bảng 3.1: f_ctm = 2.12 * ln(1 + (fck + 8)/10) cho fck > 50 MPa
  const fctm_MPa = fck_MPa > 50
    ? 2.12 * Math.log(1 + (fck_MPa + 8) / 10)
    : 0.3 * Math.pow(fck_MPa, 2 / 3);
  const fctm = toSI(fctm_MPa, 'MPa');
  const Ecm_GPa = 22 * Math.pow((fck_MPa + 8) / 10, 0.3);
  const Ecm = toSI(Ecm_GPa, 'GPa');

  // Cốt thép DƯL theo EN 1992-1-1 Mục 3.3 (γ_s = 1,15, f_pd = f_p0.1k / 1,15)
  const gamma_s_EC2 = 1.15;
  const fpd = steelPC.fpy / gamma_s_EC2;

  // Dự ứng lực hữu hiệu tham chiếu EC2 (từ ứng suất căng ban đầu giới hạn min(0.8*fpu, 0.9*fpy) theo Mục 5.10.2.1
  // trừ tỷ lệ tổn hao tương đương theo Mục 5.10.5 — dùng tổn hao đã tính chuẩn hóa để so sánh công bằng)
  const sigma_p_max_EC2 = Math.min(0.8 * steelPC.fpu, 0.9 * steelPC.fpy);
  const sigma_p0_EC2 = Math.min(bt03TCVN.prestress.initial.sigma_sp0_Pa, sigma_p_max_EC2);
  const lossRatio = bt03TCVN.prestress.totals.lossRatio;
  const sigma_pe_EC2 = sigma_p0_EC2 * (1 - lossRatio);
  const P_eff_EC2 = sigma_pe_EC2 * sec.Ap;
  const sigma_cp_EC2 = P_eff_EC2 / sec.Ared;

  // Mômen kháng nứt theo EC2 (Mục 7.1, 5.10.9): M_cr = (r_inf·σ_cp + f_ctm)·W_red, r_inf = 0,95 (căng trước)
  const r_inf_EC2 = 0.95;
  const Mcr_EC2_Nm = (r_inf_EC2 * sigma_cp_EC2 + fctm) * sec.Wred;

  // Sức kháng uốn thiết kế MRd theo EC2 tính độc lập (Mục 3.1.7 parabol–chữ nhật, Mục 3.3.6 thép DƯL nhánh ngang,
  // giới hạn ε_ud = 0,9·ε_uk với ε_uk = 3,5% — giá trị khuyến nghị), tích phân mặt cắt vành khăn.
  const ecFactor = Math.pow((90 - fck_MPa) / 100, 4);
  const eps_c2 = fck_MPa <= 50 ? 0.002 : (2.0 + 0.085 * Math.pow(fck_MPa - 50, 0.53)) / 1000;
  const eps_cu2 = fck_MPa <= 50 ? 0.0035 : (2.6 + 35 * ecFactor) / 1000;
  const n_pr = fck_MPa <= 50 ? 2.0 : 1.4 + 23.4 * ecFactor;
  const eps_ud = 0.9 * 0.035;
  const MRd_EC2 = (() => {
    const ro = sec.ro, ri = sec.ri;
    const nS = 120, dz = (2 * ro) / nS;
    const slices = [];
    for (let i = 0; i < nS; i++) {
      const z = -ro + (i + 0.5) * dz;
      const w = (Math.abs(z) < ro ? 2 * Math.sqrt(ro * ro - z * z) : 0) - (Math.abs(z) < ri ? 2 * Math.sqrt(ri * ri - z * z) : 0);
      slices.push({ z, dA: Math.max(0, w) * dz });
    }
    const eps_p0 = sigma_pe_EC2 / steelPC.Ep;
    const sigC = (eps) => {
      if (eps >= 0) return 0;
      const ec = -eps;
      return ec < eps_c2 ? -fcd * (1 - Math.pow(1 - ec / eps_c2, n_pr)) : -fcd;
    };
    const sigP = (eps) => (eps >= 0 ? Math.min(fpd, steelPC.Ep * eps) : -Math.min(fpd, steelPC.Ep * -eps));
    const zMin = Math.min(...sec.bars.map(b => b.z_m));
    const evalPlane = (eT, eB) => {
      const st = (z) => eT + ((ro - z) / (2 * ro)) * (eB - eT);
      let N = 0, M = 0;
      for (const s of slices) { const dF = sigC(st(s.z)) * s.dA; N += dF; M -= dF * s.z; }
      for (const b of sec.bars) {
        const e = st(b.z_m);
        const dF = (sigP(eps_p0 + e) - sigC(e)) * b.area_m2;
        N += dF; M -= dF * b.z_m;
      }
      return { N, M: Math.abs(M), maxBar: eps_p0 + st(zMin) };
    };
    let lo = -eps_cu2, hi = 0.05;
    for (let i = 0; i < 80; i++) { const m = 0.5 * (lo + hi); if (evalPlane(-eps_cu2, m).N > 0) hi = m; else lo = m; }
    const solA = evalPlane(-eps_cu2, 0.5 * (lo + hi));
    if (solA.maxBar <= eps_ud) return { M: solA.M, mode: 'concrete_eps_cu2' };
    const eT_target = eps_ud - eps_p0;
    const wB = (ro - zMin) / (2 * ro);
    const bot = (eT) => eT + (eT_target - eT) / wB;
    let lo2 = -eps_cu2, hi2 = eT_target;
    for (let i = 0; i < 80; i++) { const m = 0.5 * (lo2 + hi2); if (evalPlane(m, bot(m)).N > 0) hi2 = m; else lo2 = m; }
    const t = 0.5 * (lo2 + hi2);
    return { M: evalPlane(t, bot(t)).M, mode: 'steel_eps_ud' };
  })();
  const MRd_EC2_Nm = MRd_EC2.M;

  // Sức kháng cắt theo EC2: vùng không nứt do uốn dùng Mục 6.2.2(2) (kéo chính cho cấu kiện DƯL),
  // vùng nứt dùng Mục 6.2.2(1); cốt đai Mục 6.2.3 (cotθ = 1,0). VRd = max(VRd,c ; VRd,s).
  const bw = 2 * sec.t;
  const d_eff = 0.85 * sec.Do;
  const z_ec2 = 0.9 * d_eff;
  const secMid = sec.sectionAt(0.5 * sec.L);
  const fywd_EC2 = steelSw.Rswn / 1.15;
  const VRds_mid_EC2_N = (secMid.spiral.asw_per_m_m2_per_m * z_ec2 * fywd_EC2);
  const k_ec2 = Math.min(2.0, 1 + Math.sqrt(0.2 / d_eff));
  const rho_l = Math.min(0.02, sec.Ap / (bw * d_eff));
  const sigma_cp_shear = Math.min(P_eff_EC2 / sec.Ag, 0.2 * fcd);
  const VRdc_cracked_EC2_N = Math.max(
    (0.18 / gamma_c_EC2) * k_ec2 * Math.pow(100 * rho_l * fck_MPa, 1 / 3) * 1e6 + 0.15 * sigma_cp_shear,
    (0.035 * Math.pow(k_ec2, 1.5) * Math.sqrt(fck_MPa) * 1e6 + 0.15 * sigma_cp_shear)
  ) * bw * d_eff;
  const fctd = (1.0 * 0.7 * fctm) / gamma_c_EC2;
  const S_half_annulus = (2 / 3) * (sec.ro ** 3 - sec.ri ** 3);
  const VRdc_uncracked_EC2_N = ((sec.Ig * bw) / S_half_annulus) * Math.sqrt(fctd * fctd + 1.0 * sigma_cp_shear * fctd);
  const uncrackedInFlexure = bt03TCVN.demandsSI.M_ser_max_Nm <= Mcr_EC2_Nm;
  const VRdc_EC2_N = uncrackedInFlexure ? VRdc_uncracked_EC2_N : VRdc_cracked_EC2_N;
  const VRd_mid_EC2_N = Math.max(VRdc_EC2_N, VRds_mid_EC2_N);

  // Hệ số tải trọng bản thân ULS của EC2 là γ_G = 1,35 (khác 1,1 của TCVN!)
  const gamma_G_EC2 = 1.35;
  const M_ser = bt03TCVN.demandsSI.M_ser_max_Nm;
  const M_Ed_EC2 = gamma_G_EC2 * M_ser;
  const V_Ed_mid_EC2 = (gamma_G_EC2 / 1.1) * bt03TCVN.demandsSI.Q_mid_max_N;

  const utilization = {
    crackingSLS: M_ser / Mcr_EC2_Nm,
    flexureULS: M_Ed_EC2 / MRd_EC2_Nm,
    shearMidZoneULS: V_Ed_mid_EC2 / VRd_mid_EC2_N,
  };
  const maxU = Math.max(...Object.values(utilization));

  return {
    standard: 'EC2',
    role: 'tham khảo / đối chiếu (không thay thế kết luận chính TCVN)',
    version: 'EN 1992-1-1:2004 (Eurocode 2)',
    clauses: 'Bảng 3.1, Mục 3.3, Mục 5.10, Mục 6.2 & Mục 7.3',
    loadFactorULS: gamma_G_EC2,
    materialSI: { fck, fcd, fctm, Ecm, fpd, eps_c2, eps_cu2, n_parabola: n_pr, eps_ud },
    capacitiesSI: {
      Mcrc_Nm: Mcr_EC2_Nm,
      MRd_design_Nm: MRd_EC2_Nm,
      MRd_limitMode: MRd_EC2.mode,
      VRd_midZone_N: VRd_mid_EC2_N,
      VRdc_basis: uncrackedInFlexure ? 'EN 1992-1-1 Mục 6.2.2(2) — vùng không nứt do uốn' : 'EN 1992-1-1 Mục 6.2.2(1) — vùng nứt',
    },
    limitations: [
      'Tổn hao dự ứng lực chưa tính riêng theo EC2 Mục 5.10.4–5.10.6: dùng tỷ lệ tổn hao của bộ TCVN áp lên σp0 giới hạn theo EC2.',
      'f_ck lấy theo cường độ mẫu trụ khai báo, nếu không có thì ước lượng 0,8·B.',
    ],
    demandsSI: {
      M_ser_Nm: M_ser,
      M_Ed_EC2_Nm: M_Ed_EC2,
      V_Ed_mid_EC2_N: V_Ed_mid_EC2,
    },
    utilization,
    maxUtilization: maxU,
    structuralPass: maxU <= 1.0,
    comparisonVsTCVN: {
      note: 'Hệ số tải ULS khác nhau (TCVN γ_f = 1,1 vs EC2 γ_G = 1,35) và hệ số vật liệu khác nhau (TCVN γ_s = 1,2 vs EC2 γ_s = 1,15); giữ nguyên kết luận chính theo TCVN.',
      deltaFlexureU: utilization.flexureULS - bt03TCVN.utilization.flexureULS,
      deltaCrackU: utilization.crackingSLS - bt03TCVN.utilization.crackingSLS,
    },
  };
}
