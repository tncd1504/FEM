/**
 * m3_m6_verification.js — Bộ kiểm thử tự động & hồi quy cho Mốc M3, M4, M5, M6 (BT09 – BT14 & Standards).
 */
import { runBT00, runBT01 } from '../src/modules/xep-coc/pile_specs.js';
import { runBT03 } from '../src/modules/xep-coc/section_checker.js';
import { runBT07 } from '../src/modules/xep-coc/support_checker.js';
import { solveS1Stack, solveS2Stack, solveS3Stack, solveBottomRowThrust } from '../src/modules/xep-coc/stacking_model.js';
import { runBT13ToleranceScan } from '../src/modules/xep-coc/tolerance_scan.js';
import { runBT14ParetoOptimizer } from '../src/modules/xep-coc/optimizer.js';
import { normalizeStandardsConfig, evaluateBT03Eurocode2Reference } from '../src/modules/xep-coc/standards/standards_manager.js';
import { TEST_PROCESS_INPUT } from './m2_verification.js';

const CONTACT_ANGLE_DEG = 20;

export async function runM3ToM6VerificationSuite(pileSpecsDb) {
  const results = [];
  const assert = (name, cond, detail = '') => {
    results.push({ name, passed: Boolean(cond), detail });
    if (!cond) throw new Error(`Assertion failed: ${name} — ${detail}`);
  };

  const p600 = structuredClone(pileSpecsDb.piles.find(p => p.code === 'PHC-A600'));
  p600.templateInput.geometry.L_m = 12.0;
  const bt00 = runBT00(p600);
  const L = 12.0;
  const x1Opt = ((Math.sqrt(2) - 1) / 2) * L;
  const x2Opt = L - x1Opt;
  const common = { processInput: TEST_PROCESS_INPUT, contactArcAngle_deg: CONTACT_ANGLE_DEG };

  // --- M3.T1: BT10 (S2 kê thẳng hàng 4 tầng) ---
  const bt01 = runBT01({ pileRecordOrConfig: bt00, x1_m: x1Opt, x2_m: x2Opt });
  const s2Straight = solveS2Stack({
    bt00, nLayers: 4, pilesPerLayer: 5, x1_nom_m: x1Opt, x2_nom_m: x2Opt, eccentricity_m: 0, scenario: 'zero', ...common,
  });
  const mDiffBottomVsBT01 = Math.abs(s2Straight.layers[0].M_max_sag_Nm - bt01.extremaSI.M_max_sag_Nm);
  const rRatioBottomVsBT01 = s2Straight.layers[0].R1_N / bt01.reactionsSI.R1_fem;
  assert(
    'M3.T1 (BT10): S2 kê thẳng 4 tầng bảo toàn tải trọng hệ, R1_đáy = 4×R1_BT01 và không tạo mômen uốn giả',
    s2Straight.verified &&
      s2Straight.equilibriumSI.relEquilibriumErr < 1e-10 &&
      mDiffBottomVsBT01 < 1e-7 &&
      Math.abs(rRatioBottomVsBT01 - 4.0) < 1e-10,
    `R1_đáy/R1_BT01=${rRatioBottomVsBT01.toFixed(6)}, ΔM_giả=${mDiffBottomVsBT01.toExponential(2)} N·m, U_max=${s2Straight.maxUtilization.toFixed(3)} (${s2Straight.governingMechanism})`
  );

  // --- M3.T1b: Uốn vòng tại kê S2 lấy lực thực tế: tầng đỉnh chỉ có phản lực (cân bằng dòng cắt), tầng dưới có tải kê trên ---
  const topLayer = s2Straight.layers[3];
  const bottomLayer = s2Straight.layers[0];
  const topLoads = topLayer.bt05.inputsSI.radialLoads;
  const botLoads = bottomLayer.bt05.inputsSI.radialLoads;
  assert(
    'M3.T1b (BT10/BT05): Tầng đỉnh chỉ nhận phản lực kê (cân bằng bằng dòng cắt thân cọc); tầng dưới nhận thêm tải kê trên 0° — không dùng hệ số kinh nghiệm',
    topLoads.length === 1 &&
      topLayer.bt05.inputsSI.balancingShearResultant_N > 0 &&
      botLoads.length === 2 &&
      botLoads.some(l => Math.abs(l.theta_rad) < 1e-12) &&
      Math.abs(bottomLayer.bt04.inputsSI.designNormalForce_N - 1.1 * Math.max(Math.abs(bottomLayer.R1_N), Math.abs(bottomLayer.R2_N))) < 1e-6,
    `U_vòng nứt (đỉnh/đáy)=${topLayer.utilization.ringCrack.toFixed(3)}/${bottomLayer.utilization.ringCrack.toFixed(3)}, U_nén cục bộ đáy=${bottomLayer.utilization.contactLocal.toFixed(3)}`
  );

  // --- M3.T2: BT11 (S2 có lệch kê — kịch bản xen kẽ & cộng dồn) ---
  const s2Alt = solveS2Stack({
    bt00, nLayers: 4, pilesPerLayer: 5, x1_nom_m: x1Opt, x2_nom_m: x2Opt, eccentricity_m: 0.30, scenario: 'alternating', toleranceMode: 'global_axis', ...common,
  });
  const s2Cum = solveS2Stack({
    bt00, nLayers: 4, pilesPerLayer: 5, x1_nom_m: x1Opt, x2_nom_m: x2Opt, eccentricity_m: 0.15, scenario: 'cumulative', toleranceMode: 'adjacent_layers', ...common,
  });
  assert(
    'M3.T2 (BT11): S2 lệch kê xen kẽ & cộng dồn bảo toàn cân bằng hệ và làm tăng rõ mômen uốn tầng dưới',
    s2Alt.verified && s2Cum.verified && s2Alt.layers[0].M_max_sag_Nm > s2Straight.layers[0].M_max_sag_Nm + 5000,
    `M_max(e=0)=${(s2Straight.layers[0].M_max_sag_Nm / 1e3).toFixed(1)} kN·m -> M_max(alt 0.3m)=${(s2Alt.layers[0].M_max_sag_Nm / 1e3).toFixed(1)} kN·m, U=${s2Alt.maxUtilization.toFixed(3)} (${s2Alt.governingMechanism})`
  );

  // --- M4.T0: Lực đẩy ngang hàng đáy cộng dồn qua tiếp xúc cạnh nhau (lời giải đóng) ---
  const thr = solveBottomRowThrust([-3, 1, 0, -1, 3]);
  assert(
    'M4.T0: Lực đẩy ngang hàng đáy: R_biên = −min(tổng tích lũy H), tiếp xúc cạnh S_j ≥ 0, cân bằng ngang toàn hàng',
    thr.R_left_N === 3 &&
      thr.R_right_N === 3 &&
      thr.sideContacts_N.join(',') === '0,1,1,0',
    `R_trái=${thr.R_left_N}, R_phải=${thr.R_right_N}, S=[${thr.sideContacts_N.join(', ')}]`
  );

  // --- M4.T1: BT09 (S1 cụm 3 cọc & đống 4 tầng có tiếp xúc một phía dọc thân + uốn xiên 2 phương, mọi hàng) ---
  const s1ThreePiles = solveS1Stack({ bt00, nLayers: 2, baseCount: 2, x1_m: x1Opt, x2_m: x2Opt, ...common });
  const bt07Ref = runBT07({ Do_m: bt00.summarySI.Do, pileWeightPerRow_N: bt00.summarySI.totalSelfWeight, contactAngleFromVertical_deg: 30 });
  const incErr = Math.abs(s1ThreePiles.forcesSI.maxInclinedContact_N - bt07Ref.forcesOnPileSI.N_inclined_contact_N) / bt07Ref.forcesOnPileSI.N_inclined_contact_N;
  const s1FourLayers = solveS1Stack({ bt00, nLayers: 4, baseCount: 5, x1_m: x1Opt, x2_m: x2Opt, ...common });
  const H_edge_own = Math.abs(s1FourLayers.grid2D[0][0].H_net_N);
  assert(
    'M4.T1 (BT09): S1 khớp lực nghiêng BT07 (< 1e-12), kiểm tra đủ mọi hàng, lực đẩy biên ≥ lực đẩy riêng cọc biên, uốn xiên 2 phương',
    s1ThreePiles.verified &&
      incErr < 1e-12 &&
      s1FourLayers.verified &&
      s1FourLayers.rows.length === 4 &&
      s1FourLayers.rows.every(r => r.bt03 && Number.isFinite(r.maxUtilization)) &&
      s1FourLayers.forcesSI.maxHorizontalRestraint_N >= H_edge_own - 1e-9 &&
      s1FourLayers.forcesSI.M_combined_ser_Nm > s1FourLayers.forcesSI.M_vertical_max_Nm,
    `incErr=${incErr.toExponential(2)}, H_biên=${(s1FourLayers.forcesSI.maxHorizontalRestraint_N / 1e3).toFixed(2)} kN (riêng cọc biên ${(H_edge_own / 1e3).toFixed(2)} kN), hàng chi phối=${s1FourLayers.governingLayerIndex}, U=${s1FourLayers.maxUtilization.toFixed(3)} (${s1FourLayers.governingMechanism})`
  );

  // --- M4.T1b: Khảo sát độ nhạy độ cứng tiếp xúc dọc thân và kiểm tra nén cục bộ cọc–cọc ---
  const sens = s1FourLayers.contactStiffnessSensitivity;
  assert(
    'M4.T1b (BT09): Có khảo sát độ nhạy độ cứng tiếp xúc (×0,1 và ×10) và kiểm tra nén cục bộ cọc–cọc ở các hàng có tiếp xúc',
    sens.evaluated === true &&
      sens.variants.length === 2 &&
      Number.isFinite(sens.maxRelChange) &&
      s1FourLayers.rows.slice(1).every(r => r.bt04PilePile && Number.isFinite(r.utilization.contactLocalPilePile)),
    `ΔM_max theo độ cứng = ${(sens.maxRelChange * 100).toFixed(2)}% (${sens.sensitive ? 'nhạy' : 'ít nhạy'}), U cọc–cọc max=${Math.max(...s1FourLayers.rows.slice(1).map(r => r.utilization.contactLocalPilePile)).toFixed(3)}`
  );

  // --- M4.T2: BT12 (S3 hỗn hợp & đối chứng giới hạn quy về S1 / S2) ---
  const s3Hybrid = solveS3Stack({ bt00, blocks: [2, 2], baseCount: 5, x1_nom_m: x1Opt, x2_nom_m: x2Opt, ...common });
  const s3ToS1 = solveS3Stack({ bt00, blocks: [3], baseCount: 5, x1_nom_m: x1Opt, x2_nom_m: x2Opt, ...common });
  const s1Ref3 = solveS1Stack({ bt00, nLayers: 3, baseCount: 5, x1_m: x1Opt, x2_m: x2Opt, ...common });
  const s3ToS2 = solveS3Stack({ bt00, blocks: [1, 1, 1], baseCount: 5, x1_nom_m: x1Opt, x2_nom_m: x2Opt, ...common });
  const s2Ref3 = solveS2Stack({ bt00, nLayers: 3, pilesPerLayer: 5, x1_nom_m: x1Opt, x2_nom_m: x2Opt, scenario: 'zero', ...common });
  assert(
    'M4.T2 (BT12): S3 [2,2] bảo toàn tải tích lũy qua kê trung gian; S3 [3] quy đúng về S1 và S3 [1,1,1] quy đúng về S2',
    s3Hybrid.verified &&
      s3ToS1.reducedTo === 'S1' &&
      Math.abs(s3ToS1.maxUtilization - s1Ref3.maxUtilization) < 1e-12 &&
      s3ToS2.reducedTo === 'S2' &&
      Math.abs(s3ToS2.maxUtilization - s2Ref3.maxUtilization) < 1e-12,
    `S3[2,2] eqErr=${s3Hybrid.equilibriumSI.relEquilibriumErr.toExponential(2)}, U_S3[2,2]=${s3Hybrid.maxUtilization.toFixed(3)} (${s3Hybrid.governingMechanism})`
  );

  // --- M4.T2b: Tải khối trên đi vào khối dưới: lực đẩy ngang và tải hàng đỉnh tại kê trung gian ---
  const s1TwoRows = solveS1Stack({ bt00, nLayers: 2, baseCount: 5, x1_m: x1Opt, x2_m: x2Opt, ...common });
  const lowerBlock = s3Hybrid.blockResults[0];
  const upperBlock = s3Hybrid.blockResults[1];
  const W_upper = upperBlock.pilesInBlock * bt00.summarySI.totalSelfWeight;
  assert(
    'M4.T2b (BT12): Khối dưới của S3 [2,2] chịu lực đẩy ngang lớn hơn khối độc lập cùng cấu hình; kê trung gian truyền đủ tải khối trên lên hàng đỉnh',
    lowerBlock.detail.bottomRowThrust.R_left_N > s1TwoRows.bottomRowThrust.R_left_N &&
      Math.abs(lowerBlock.loadFromAbove_line1_N + lowerBlock.loadFromAbove_line2_N - W_upper) / W_upper < 1e-12 &&
      lowerBlock.detail.topRowBattenChecks.length === 2,
    `H_biên khối dưới=${(lowerBlock.detail.bottomRowThrust.R_left_N / 1e3).toFixed(2)} kN vs S1 độc lập ${(s1TwoRows.bottomRowThrust.R_left_N / 1e3).toFixed(2)} kN; tải kê trung gian/cọc hàng đỉnh=${(lowerBlock.detail.topRowBattenChecks[0].P_perTopPile_N / 1e3).toFixed(2)} kN`
  );

  // --- M5.T1: BT13 (Quét miền số tầng – độ lệch kê) ---
  const bt13 = runBT13ToleranceScan({
    bt00, scheme: 'S2', nMin: 2, nMax: 5, baseCount: 5, x1_nom_m: x1Opt, x2_nom_m: x2Opt,
    eccMax_m: 0.40, eccStep_m: 0.10, refineSteps: 3, scenario: 'alternating', ...common,
  });
  const scanConsistent = bt13.rowsByLayer.every(r => (r.nominalPass ? r.allowableEccentricity_m !== null : r.allowableEccentricity_m === null));
  assert(
    'M5.T1 (BT13): Quét miền (n, e) kiểm tra danh định trước, chỉ xuất dung sai khi danh định đạt và công bố rõ phạm vi khảo sát',
    bt13.rowsByLayer.length === 4 && scanConsistent && bt13.coverageDisclaimer.includes('dung sai khảo sát'),
    `nMaxNominal=${bt13.maxFeasibleLayersAtNominal}, ` +
      bt13.rowsByLayer.map(r => `n=${r.nLayers}: e_allow=${r.allowableEccentricity_m === null ? '—' : r.allowableEccentricity_m.toFixed(3)} m (${r.nominalMechanism})`).join('; ')
  );

  // --- M5.T2: BT14 (Tập phương án Pareto S1/S2/S3) ---
  const bt14 = runBT14ParetoOptimizer({
    bt00, nMin: 2, nMax: 5, baseCount: 5, x1_nom_m: x1Opt, x2_nom_m: x2Opt, eccMax_m: 0.40, eccStep_m: 0.10, scenario: 'alternating', ...common,
  });
  assert(
    'M5.T2 (BT14): Đánh giá đủ 12 phương án trên 3 chỉ tiêu chịu lực cọc (không gộp trọng số tùy ý, không ràng buộc kho)',
    bt14.totalEvaluated === 12 && bt14.paretoFront.length <= bt14.feasibleCount,
    `evaluated=${bt14.totalEvaluated}, feasible=${bt14.feasibleCount}, pareto=${bt14.paretoFront.length} (${bt14.paretoFront.map(p => p.label).join('; ') || 'không có phương án đạt trong miền khảo sát'})`
  );

  // --- M6.T1: Quản lý tiêu chuẩn mặc định TCVN & đối chiếu song song EC2 ---
  const normLegacy = normalizeStandardsConfig({});
  const bt03TCVN = runBT03({ bt00OrConfig: bt00, processInput: TEST_PROCESS_INPUT, beamResult: bt01 });
  const bt03EC2 = evaluateBT03Eurocode2Reference({ bt00, bt03TCVN, beamResult: bt01 });
  assert(
    'M6.T1 (Standards): Cấu hình cũ mặc định về TCVN; EC2 tính MRd độc lập (parabol–chữ nhật) và không ghi đè kết luận chính TCVN',
    normLegacy.primaryStandard === 'TCVN' &&
      normLegacy.reportStandards.length === 1 &&
      normLegacy.reportStandards[0] === 'TCVN' &&
      bt03EC2.standard === 'EC2' &&
      bt03EC2.loadFactorULS === 1.35 &&
      bt03EC2.role.includes('tham khảo') &&
      Number.isFinite(bt03EC2.capacitiesSI.MRd_design_Nm) &&
      bt03EC2.capacitiesSI.MRd_design_Nm > 0,
    `MRd TCVN/EC2 = ${(bt03TCVN.capacitiesSI.MRd_design_Nm / 1e3).toFixed(1)}/${(bt03EC2.capacitiesSI.MRd_design_Nm / 1e3).toFixed(1)} kN·m; U_bend(TCVN)=${bt03TCVN.utilization.flexureULS.toFixed(3)} vs U_bend(EC2)=${bt03EC2.utilization.flexureULS.toFixed(3)}`
  );

  return {
    allPassed: results.every(r => r.passed),
    totalTests: results.length,
    passedCount: results.filter(r => r.passed).length,
    results,
  };
}
