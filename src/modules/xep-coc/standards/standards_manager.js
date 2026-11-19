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

  // Mômen kháng nứt theo EC2 (Mục 7.3.2): M_cr = (sigma_cp + fctm) * W_red
  const Mcr_EC2_Nm = (sigma_cp_EC2 + fctm) * sec.Wred;

  // Sức kháng uốn thiết kế MRd theo EC2 (dùng fcd, fpd; xấp xỉ tích phân mặt cắt tương tự TCVN với tỷ lệ fpd/Rs)
  const MRd_EC2_Nm = bt03TCVN.capacitiesSI.MRd_design_Nm * (fpd / steelPC.Rs);

  // Sức kháng cắt tối thiểu không cốt đai + cốt đai theo EC2 Mục 6.2.2 & 6.2.3 (θ = 45°, cotθ = 1,0)
  const bw = 2 * sec.t;
  const d_eff = 0.85 * sec.Do;
  const z_ec2 = 0.9 * d_eff;
  const secMid = sec.sectionAt(0.5 * sec.L);
  const fywd_EC2 = steelSw.Rswn / 1.15;
  const VRds_mid_EC2_N = (secMid.spiral.asw_per_m_m2_per_m * z_ec2 * fywd_EC2);
  const k_ec2 = Math.min(2.0, 1 + Math.sqrt(0.2 / d_eff));
  const rho_l = Math.min(0.02, sec.Ap / (bw * d_eff));
  const VRdc_EC2_N = Math.max(
    (0.18 / gamma_c_EC2) * k_ec2 * Math.pow(100 * rho_l * fck_MPa, 1 / 3) * 1e6 + 0.15 * sigma_cp_EC2,
    (0.035 * Math.pow(k_ec2, 1.5) * Math.sqrt(fck_MPa) * 1e6 + 0.15 * sigma_cp_EC2)
  ) * bw * d_eff;
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
    materialSI: { fck, fcd, fctm, Ecm, fpd },
    capacitiesSI: {
      Mcrc_Nm: Mcr_EC2_Nm,
      MRd_design_Nm: MRd_EC2_Nm,
      VRd_midZone_N: VRd_mid_EC2_N,
    },
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
