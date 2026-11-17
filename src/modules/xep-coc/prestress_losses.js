/**
 * prestress_losses.js — Tự tính đầy đủ các khoản tổn hao ứng suất trước và dự ứng lực hữu hiệu
 * theo TCVN 5574:2018 (Mục 9.1.1 – 9.1.9) trong hệ đơn vị chuẩn SI (m, kg, s, N, Pa, K).
 *
 * Quy tắc bắt buộc theo Plan v0.5.0 (Mục 6.3 & 6.3.1) và Skill fem-web (Mục 5):
 * 1. Quy trình sản xuất đã chốt: căng trước bằng máy cơ khí tại nhà máy; cắt thép theo chiều dài
 *    yêu cầu; dưỡng hộ hầm sấy vài giờ → tháo khuôn → dưỡng hộ tự nhiên.
 * 2. Tách biệt chiều dài cọc thành phẩm L, chiều dài thép cắt L_cut và chiều dài làm việc đoạn căng L_cang.
 * 3. Ghi rõ mốc đo lực/giãn dài (trước hay sau đóng neo) để không trừ trùng tổn hao tụt neo Δσ_sp4.
 * 4. Tách biệt căng cơ khí với tổn hao chênh nhiệt Δσ_sp2 lúc dưỡng hộ (TCVN 5574 mục 9.1.4):
 *    không tự suy ΔT = 0 chỉ vì máy căng cơ khí; chỉ nhận ΔT = 0 khi khai báo rõ giả thiết không chênh nhiệt.
 * 5. Hệ số dưỡng hộ nhiệt ζ_heat = 0,85 (mục 9.1.8–9.1.9) áp dụng đúng 1 lần cho co ngót và 1 lần cho từ biến;
 *    dưỡng hộ tự nhiên tiếp theo không xóa lịch sử dưỡng hộ hầm sấy.
 * 6. Tuyệt đối không cho nhập trực tiếp σ_pe, P_eff, σ_pc để bỏ qua tính tổn hao, không lấy 4/6/8/10 MPa
 *    theo cấp tải A/AB/B/C và không suy ngược từ Mcr, Mu trên bản vẽ.
 */
import { toSI, deltaCelsiusToKelvin } from '../../core/units.js';

function deepFreeze(obj) {
  if (!obj || typeof obj !== 'object' || Object.isFrozen(obj)) return obj;
  Object.freeze(obj);
  for (const k of Object.keys(obj)) {
    if (obj[k] && typeof obj[k] === 'object') deepFreeze(obj[k]);
  }
  return obj;
}

/**
 * Tính đầy đủ các khoản tổn hao dự ứng lực theo TCVN 5574:2018 Mục 9.1.
 *
 * @param {object} params
 * @param {object} params.bt00 kết quả đã kiểm chứng từ runBT00
 * @param {object} params.processInput thông số quá trình căng & dưỡng hộ
 */
export function computePrestressLossesTCVN5574({ bt00, processInput = {} }) {
  if (!bt00 || !bt00.valid || !bt00.record?.computed) {
    throw new Error('Cần có kết quả BT00 hợp lệ trước khi tính tổn hao dự ứng lực');
  }

  // Chặn mọi đường tắt nhập trực tiếp ứng suất hữu hiệu hoặc suy từ cấp tải / bản vẽ
  if (
    processInput.directSigmaPc_MPa !== undefined ||
    processInput.directSigmaPe_MPa !== undefined ||
    processInput.directPeff_kN !== undefined ||
    processInput.useClassPresetStress === true ||
    processInput.backCalculateFromMcr === true
  ) {
    throw new Error(
      'Vi phạm quy tắc Plan v0.5.0: Không cho phép nhập trực tiếp σ_pc/σ_pe/P_eff, gán 4/6/8/10 MPa theo cấp tải hay suy ngược từ Mcr/Mu để bỏ qua tính tổn hao.'
    );
  }

  const sec = bt00.record.computed.section;
  const conc = bt00.record.computed.concrete;
  const steel = bt00.record.computed.steel.pcBar;

  const L = sec.L; // chiều dài cọc thành phẩm (m)
  const L_cang = Number(processInput.L_cang_m);
  if (!(L_cang > 0)) {
    throw new Error(
      'Chưa xác lập chiều dài làm việc của đoạn căng L_cang_m (> 0 m). Không tự lấy L_cang bằng chiều dài tối đa trong bảng tra khi chưa khai báo.'
    );
  }

  const delta_L2_m = Number(processInput.anchorSlip_m ?? toSI(processInput.anchorSlip_mm ?? 2.0, 'mm'));
  const delta_L1_m = Number(processInput.moldDeformation_m ?? toSI(processInput.moldDeformation_mm ?? 0.0, 'mm'));
  if (delta_L2_m < 0 || delta_L1_m < 0) {
    throw new Error('Độ tụt neo ΔL2 và biến dạng khuôn/bệ ΔL1 không được âm');
  }

  // Xác định ứng suất căng ban đầu σ_sp0 (Pa) theo TCVN 5574:2018 Mục 9.1.1
  // Giới hạn: σ_sp0 <= min(0,8 * f_py, 0,7 * f_pu) (hoặc 0,8 * R_sn)
  const sigma_sp_limit = steel.sigma_sp_limit; // min(0.8*fpy, 0.7*fpu)
  let sigma_sp0 = NaN;
  let controlBasis = '';

  if (Number.isFinite(processInput.initialStress_Pa)) {
    sigma_sp0 = processInput.initialStress_Pa;
    controlBasis = 'Nhập ứng suất căng ban đầu σ_sp0 (Pa)';
  } else if (Number.isFinite(processInput.initialStress_MPa)) {
    sigma_sp0 = toSI(processInput.initialStress_MPa, 'MPa');
    controlBasis = 'Nhập ứng suất căng ban đầu σ_sp0 (MPa → Pa)';
  } else if (Number.isFinite(processInput.initialForcePerBar_N)) {
    sigma_sp0 = processInput.initialForcePerBar_N / sec.Ap1;
    controlBasis = 'Tính từ lực căng ban đầu trên 1 thanh P0_bar / Ap1';
  } else if (Number.isFinite(processInput.measuredElongation_m)) {
    sigma_sp0 = (processInput.measuredElongation_m / L_cang) * steel.Ep;
    controlBasis = 'Tính từ độ giãn dài kiểm soát ΔL_pull trên chiều dài đoạn căng L_cang';
  } else {
    // Mặc định lấy theo giới hạn tiêu chuẩn min(0,8*Rpy, 0,7*Rpu) khi chọn chế độ giới hạn chuẩn
    const ratio = Number.isFinite(processInput.initialStressRatioToLimit) ? processInput.initialStressRatioToLimit : 1.0;
    sigma_sp0 = ratio * sigma_sp_limit;
    controlBasis = `Lấy bằng ${ratio} × min(0,8·f_py, 0,7·f_pu) theo TCVN 5574:2018 Mục 9.1.1`;
  }

  if (!(sigma_sp0 > 0 && sigma_sp0 <= 1.05 * sigma_sp_limit)) {
    throw new Error(
      `Ứng suất căng ban đầu σ_sp0 = ${(sigma_sp0 / 1e6).toFixed(2)} MPa không hợp lệ hoặc vượt giới hạn cho phép ${(sigma_sp_limit / 1e6).toFixed(2)} MPa`
    );
  }

  const P0 = sigma_sp0 * sec.Ap; // Tổng lực căng ban đầu (N)
  const elongation_elastic_m = (sigma_sp0 / steel.Ep) * L_cang;
  const L_cut = Number.isFinite(processInput.L_cut_m)
    ? processInput.L_cut_m
    : L_cang - elongation_elastic_m;

  // Mốc đo lực/giãn dài: 'before_anchoring' (mặc định) hoặc 'after_anchoring'
  const measurementStage = processInput.measurementStage || 'before_anchoring';
  if (measurementStage !== 'before_anchoring' && measurementStage !== 'after_anchoring') {
    throw new Error(`measurementStage không hợp lệ: "${measurementStage}"`);
  }

  // --- CÁC TỔN HAO THỨ NHẤT (TRƯỚC VÀ KHI TRUYỀN LỰC) ---

  // 1. Tổn hao do chùng ứng suất cốt thép Δσ_sp1 (TCVN 5574:2018 Mục 9.1.3)
  // Hỗ trợ cả công thức (132) cho thép sợi/cáp cường độ cao và công thức (133) cho thép thanh
  const relaxationFormula = processInput.relaxationFormula || 'eq_132_wire'; // 'eq_132_wire' | 'eq_133_bar'
  const curingMode = processInput.curingMode || 'steam_chamber_then_natural';
  // Hệ số xét gia công nhiệt đối với chùng ứng suất (nếu dùng công thức 133 có xét nhiệt)
  let loss1_Pa = 0;
  let loss1_formula = '';
  if (relaxationFormula === 'eq_133_bar') {
    loss1_Pa = Math.max(0, 0.1 * sigma_sp0 - toSI(20, 'MPa'));
    loss1_formula = 'Δσ_sp1 = 0,1·σ_sp0 - 20 MPa — TCVN 5574:2018 Mục 9.1.3 Công thức (133)';
  } else {
    loss1_Pa = Math.max(0, (0.22 * (sigma_sp0 / steel.Rsn) - 0.1) * sigma_sp0);
    loss1_formula = 'Δσ_sp1 = (0,22·σ_sp0/R_sn - 0,1)·σ_sp0 — TCVN 5574:2018 Mục 9.1.3 Công thức (132)';
  }

  // 2. Tổn hao do chênh lệch nhiệt độ Δσ_sp2 (TCVN 5574:2018 Mục 9.1.4 Công thức 134)
  // Δσ_sp2 = 1,25 * Δt (MPa) = 1,25e6 * ΔT (Pa)
  const deltaT_raw = processInput.deltaT_K ?? processInput.deltaT_C;
  if (deltaT_raw === undefined || deltaT_raw === null || !Number.isFinite(Number(deltaT_raw)) || Number(deltaT_raw) < 0) {
    throw new Error(
      'Chưa xác lập độ chênh nhiệt ΔT (K hoặc °C >= 0) giữa thép DƯL và thiết bị nhận lực căng khi dưỡng hộ hầm sấy (TCVN 5574:2018 Mục 9.1.4).'
    );
  }
  const deltaT_K = deltaCelsiusToKelvin(Number(deltaT_raw));
  if (deltaT_K === 0 && !processInput.zeroDeltaTJustification) {
    throw new Error(
      'Theo Plan v0.5.0 Mục 6.3.1: Không tự suy ΔT = 0 chỉ vì căng bằng máy cơ khí. Khi lấy ΔT = 0 K phải ghi rõ giả thiết (zeroDeltaTJustification) rằng thép và khuôn/bệ giữ lực cùng chịu nhiệt trong hầm sấy.'
    );
  }
  const loss2_Pa = toSI(1.25, 'MPa') * deltaT_K;

  // 3. Tổn hao do biến dạng khuôn/bệ căng Δσ_sp3 (TCVN 5574:2018 Mục 9.1.5 Công thức 135)
  const loss3_Pa = (delta_L1_m / L_cang) * steel.Ep;

  // 4. Tổn hao do biến dạng neo của thiết bị căng Δσ_sp4 (TCVN 5574:2018 Mục 9.1.6 Công thức 136)
  // Nếu mốc đo lực/giãn dài thực hiện SAU khi đóng neo ('after_anchoring') thì không trừ lặp Δσ_sp4
  const loss4_Pa = measurementStage === 'after_anchoring' ? 0 : (delta_L2_m / L_cang) * steel.Ep;

  const totalStage1_Pa = loss1_Pa + loss2_Pa + loss3_Pa + loss4_Pa;
  const sigma_sp_afterStage1_Pa = sigma_sp0 - totalStage1_Pa;
  if (sigma_sp_afterStage1_Pa <= 0) {
    throw new Error('Tổng tổn hao thứ nhất vượt quá ứng suất căng ban đầu σ_sp0');
  }

  // Lực dự ứng lực ngay khi truyền lực lên bê tông (sau tổn hao thứ nhất)
  const P_afterStage1_N = sigma_sp_afterStage1_Pa * sec.Ap;
  // Ứng suất nén trong bê tông ở mức trọng tâm cốt thép DƯL (ysp = 0 vì bố trí đối xứng tâm):
  // Theo TCVN 5574:2018 Mục 9.1.9 & tương thích đàn hồi trên tiết diện quy đổi Ared (và đối chiếu trên Ag):
  const sigma_bp_red_Pa = P_afterStage1_N / sec.Ared;
  const sigma_bp_gross_Pa = P_afterStage1_N / sec.Ag;
  const useGrossForCreep = processInput.creepStressAreaBasis === 'Ag';
  const sigma_bp_Pa = useGrossForCreep ? sigma_bp_gross_Pa : sigma_bp_red_Pa;

  // Kiểm tra điều kiện truyền lực ứng suất trước: σ_bp <= R_bp
  const transferStressRatio = sigma_bp_Pa / conc.Rbp;
  const transferCompressionOk = sigma_bp_Pa <= conc.Rbp;

  // --- CÁC TỔN HAO THỨ HAI (SAU KHI TRUYỀN LỰC: CO NGÓT & TỪ BIẾN) ---
  // Hệ số xét chế độ dưỡng hộ nhiệt ở áp suất khí quyển (hầm sấy): ζ_heat = 0,85 (Mục 9.1.8 & 9.1.9)
  // Lưu ý: chỉ áp dụng 1 lần cho mỗi khoản, không nhân lặp, không xóa vì dưỡng hộ tự nhiên tiếp theo.
  const zeta_heat = curingMode === 'natural_only' ? 1.0 : 0.85;

  // 5. Tổn hao do co ngót bê tông Δσ_sp5 (TCVN 5574:2018 Mục 9.1.8 Công thức 139)
  const loss5_Pa = zeta_heat * conc.eps_b_sh * steel.Ep;

  // 6. Tổn hao do từ biến bê tông Δσ_sp6 (TCVN 5574:2018 Mục 9.1.9 Công thức 140)
  // Với cốt thép DƯL bố trí đối xứng tâm (y_s = 0):
  // Δσ_sp6 = ζ_heat * (0,8 * α * φ_b,cr * σ_bp) / (1 + α * μ_sp * (1 + 0,8 * φ_b,cr))
  const alpha = sec.alpha;
  const phi_cr = conc.phi_b_cr;
  const mu_sp = useGrossForCreep ? sec.Ap / sec.Ag : sec.Ap / sec.Ared;
  const ratio_sigma_bp_Rb = sigma_bp_Pa / conc.Rb;
  // Theo TCVN 5574:2018 Mục 9.1.9: khi σ_bp / R_bp <= 0,75 lấy hệ số 0,8; khi > 0,75 xét từ biến phi tuyến
  const creepLinearFactor = 0.8;
  const loss6_Pa =
    zeta_heat *
    ((creepLinearFactor * alpha * phi_cr * sigma_bp_Pa) /
      (1 + alpha * mu_sp * (1 + creepLinearFactor * phi_cr)));

  const totalStage2_Pa = loss5_Pa + loss6_Pa;
  const totalLoss_Pa = totalStage1_Pa + totalStage2_Pa;

  // 7. Ba đại lượng dự ứng lực hữu hiệu tách biệt rõ ràng (SI: Pa và N)
  const sigma_pe_Pa = sigma_sp0 - totalLoss_Pa;
  if (!(sigma_pe_Pa > 0)) {
    throw new Error('Ứng suất hữu hiệu trong thép σ_pe <= 0 sau khi trừ tổng tổn hao');
  }
  const P_eff_N = sigma_pe_Pa * sec.Ap;
  const sigma_pc_net_Pa = P_eff_N / sec.Ab;     // Ứng suất nén trước trong bê tông thuần Ab
  const sigma_pc_red_Pa = P_eff_N / sec.Ared;   // Ứng suất nén trước theo tiết diện quy đổi Ared
  const sigma_pc_gross_Pa = P_eff_N / sec.Ag;   // Ứng suất nén trước theo tiết diện hình học Ag

  const lossTable = [
    {
      id: 'Δσ_sp1',
      stage: 1,
      mechanism: 'Chùng ứng suất cốt thép dự ứng lực (căng cơ học)',
      clause: 'TCVN 5574:2018 Mục 9.1.3',
      formula: loss1_formula,
      inputsSummary: `σ_sp0 = ${(sigma_sp0 / 1e6).toFixed(2)} MPa, R_sn = ${(steel.Rsn / 1e6).toFixed(2)} MPa`,
      value_Pa: loss1_Pa,
      value_MPa: loss1_Pa / 1e6,
    },
    {
      id: 'Δσ_sp2',
      stage: 1,
      mechanism: 'Chênh lệch nhiệt độ giữa thép căng và thiết bị giữ lực khi dưỡng hộ nhiệt',
      clause: 'TCVN 5574:2018 Mục 9.1.4 Công thức (134)',
      formula: 'Δσ_sp2 = 1,25 · ΔT (MPa)',
      inputsSummary: `ΔT = ${deltaT_K} K (${processInput.zeroDeltaTJustification || 'Chênh nhiệt khai báo'})`,
      value_Pa: loss2_Pa,
      value_MPa: loss2_Pa / 1e6,
    },
    {
      id: 'Δσ_sp3',
      stage: 1,
      mechanism: 'Biến dạng khuôn / bệ căng khi căng bằng cơ học',
      clause: 'TCVN 5574:2018 Mục 9.1.5 Công thức (135)',
      formula: 'Δσ_sp3 = (ΔL1 / L_cang) · E_p',
      inputsSummary: `ΔL1 = ${(delta_L1_m * 1e3).toFixed(2)} mm, L_cang = ${L_cang.toFixed(3)} m`,
      value_Pa: loss3_Pa,
      value_MPa: loss3_Pa / 1e6,
    },
    {
      id: 'Δσ_sp4',
      stage: 1,
      mechanism: 'Biến dạng neo / độ tụt neo tại thiết bị giữ lực',
      clause: 'TCVN 5574:2018 Mục 9.1.6 Công thức (136)',
      formula:
        measurementStage === 'after_anchoring'
          ? 'Δσ_sp4 = 0 (đo lực/giãn dài sau khi chốt neo — không trừ lặp)'
          : 'Δσ_sp4 = (ΔL2 / L_cang) · E_p',
      inputsSummary: `ΔL2 = ${(delta_L2_m * 1e3).toFixed(2)} mm, L_cang = ${L_cang.toFixed(3)} m, mốc đo: ${measurementStage}`,
      value_Pa: loss4_Pa,
      value_MPa: loss4_Pa / 1e6,
    },
    {
      id: 'Δσ_sp5',
      stage: 2,
      mechanism: 'Co ngót bê tông (xét lịch sử dưỡng hộ hầm sấy áp suất khí quyển)',
      clause: 'TCVN 5574:2018 Mục 9.1.8 Công thức (139)',
      formula: 'Δσ_sp5 = ζ_heat · ε_b,sh · E_p',
      inputsSummary: `ζ_heat = ${zeta_heat}, ε_b,sh = ${conc.eps_b_sh}, E_p = ${(steel.Ep / 1e9).toFixed(0)} GPa`,
      value_Pa: loss5_Pa,
      value_MPa: loss5_Pa / 1e6,
    },
    {
      id: 'Δσ_sp6',
      stage: 2,
      mechanism: 'Từ biến bê tông (xét lịch sử dưỡng hộ hầm sấy áp suất khí quyển)',
      clause: 'TCVN 5574:2018 Mục 9.1.9 Công thức (140)',
      formula: 'Δσ_sp6 = ζ_heat · (0,8 · α · φ_b,cr · σ_bp) / (1 + α · μ_sp · (1 + 0,8 · φ_b,cr))',
      inputsSummary: `ζ_heat = ${zeta_heat}, α = ${alpha.toFixed(3)}, φ_b,cr = ${phi_cr}, σ_bp = ${(sigma_bp_Pa / 1e6).toFixed(3)} MPa`,
      value_Pa: loss6_Pa,
      value_MPa: loss6_Pa / 1e6,
    },
  ];

  return deepFreeze({
    unitSystem: 'SI',
    standard: 'TCVN 5574:2018 Mục 9.1',
    processTrace: {
      tensionMethod: 'pre_tension_mechanical_factory',
      curingHistory: 'Hầm sấy vài giờ (áp suất khí quyển) → Tháo khuôn → Dưỡng hộ tự nhiên',
      curingMode,
      zeta_heat,
      L_pile_m: L,
      L_cut_m: L_cut,
      L_cang_m: L_cang,
      elongation_elastic_m,
      measurementStage,
      controlBasis,
      deltaT_K,
      zeroDeltaTJustification: processInput.zeroDeltaTJustification || null,
    },
    initial: {
      sigma_sp0_Pa: sigma_sp0,
      sigma_sp_limit_Pa: sigma_sp_limit,
      P0_N: P0,
    },
    stage1: {
      loss1_relaxation_Pa: loss1_Pa,
      loss2_temperature_Pa: loss2_Pa,
      loss3_mold_Pa: loss3_Pa,
      loss4_anchor_Pa: loss4_Pa,
      totalStage1_Pa,
      sigma_sp_afterStage1_Pa,
      P_afterStage1_N,
      sigma_bp_Pa,
      sigma_bp_red_Pa,
      sigma_bp_gross_Pa,
      Rbp_Pa: conc.Rbp,
      transferStressRatio,
      transferCompressionOk,
    },
    stage2: {
      loss5_shrinkage_Pa: loss5_Pa,
      loss6_creep_Pa: loss6_Pa,
      totalStage2_Pa,
    },
    totals: {
      totalLoss_Pa,
      lossRatio: totalLoss_Pa / sigma_sp0,
    },
    effective: {
      sigma_pe_Pa,        // Ứng suất hữu hiệu trong thép DƯL (Pa)
      P_eff_N,            // Lực dự ứng lực hữu hiệu (N)
      sigma_pc_Pa: sigma_pc_net_Pa, // Ứng suất nén trước trong bê tông thuần Ab (Pa)
      sigma_pc_net_Pa,
      sigma_pc_red_Pa,
      sigma_pc_gross_Pa,
    },
    lossTable,
  });
}
