/**
 * m3_m6_verification.js — Bộ kiểm thử tự động & hồi quy cho Mốc M3, M4, M5, M6 (BT09 – BT14 & Standards).
 */
import { runBT00, runBT01 } from '../src/modules/xep-coc/pile_specs.js';
import { runBT03 } from '../src/modules/xep-coc/section_checker.js';
import { runBT07 } from '../src/modules/xep-coc/support_checker.js';
import { solveS1Stack, solveS2Stack, solveS3Stack } from '../src/modules/xep-coc/stacking_model.js';
import { runBT13ToleranceScan } from '../src/modules/xep-coc/tolerance_scan.js';
import { runBT14ParetoOptimizer } from '../src/modules/xep-coc/optimizer.js';
import { normalizeStandardsConfig, evaluateBT03Eurocode2Reference } from '../src/modules/xep-coc/standards/standards_manager.js';

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

  // --- M3.T1: BT10 (S2 kê thẳng hàng 4 tầng) ---
  const bt01 = runBT01({ pileRecordOrConfig: bt00, x1_m: x1Opt, x2_m: x2Opt });
  const s2Straight = solveS2Stack({
    bt00,
    nLayers: 4,
    pilesPerLayer: 5,
    x1_nom_m: x1Opt,
    x2_nom_m: x2Opt,
    eccentricity_m: 0,
    scenario: 'zero',
  });
  const mDiffBottomVsBT01 = Math.abs(s2Straight.layers[0].M_max_sag_Nm - bt01.extremaSI.M_max_sag_Nm);
  const rRatioBottomVsBT01 = s2Straight.layers[0].R1_N / bt01.reactionsSI.R1_fem;
  assert(
    'M3.T1 (BT10): S2 kê thẳng 4 tầng bảo toàn tải trọng hệ, R1_đáy = 4×R1_BT01 và không tạo mômen uốn giả',
    s2Straight.verified &&
      s2Straight.equilibriumSI.relEquilibriumErr < 1e-10 &&
      mDiffBottomVsBT01 < 1e-7 &&
      Math.abs(rRatioBottomVsBT01 - 4.0) < 1e-10,
    `R1_đáy/R1_BT01=${rRatioBottomVsBT01.toFixed(6)}, ΔM_giả=${mDiffBottomVsBT01.toExponential(2)} N·m, relEqErr=${s2Straight.equilibriumSI.relEquilibriumErr.toExponential(2)}`
  );

  // --- M3.T2: BT11 (S2 có lệch kê — kịch bản xen kẽ & cộng dồn) ---
  const s2Alt = solveS2Stack({
    bt00,
    nLayers: 4,
    pilesPerLayer: 5,
    x1_nom_m: x1Opt,
    x2_nom_m: x2Opt,
    eccentricity_m: 0.30,
    scenario: 'alternating',
    toleranceMode: 'global_axis',
  });
  const s2Cum = solveS2Stack({
    bt00,
    nLayers: 4,
    pilesPerLayer: 5,
    x1_nom_m: x1Opt,
    x2_nom_m: x2Opt,
    eccentricity_m: 0.15,
    scenario: 'cumulative',
    toleranceMode: 'adjacent_layers',
  });
  assert(
    'M3.T2 (BT11): S2 lệch kê xen kẽ & cộng dồn bảo toàn cân bằng hệ và làm tăng rõ mômen uốn tầng dưới',
    s2Alt.verified &&
      s2Cum.verified &&
      s2Alt.layers[0].M_max_sag_Nm > s2Straight.layers[0].M_max_sag_Nm + 5000,
    `M_max(e=0)=${(s2Straight.layers[0].M_max_sag_Nm / 1e3).toFixed(1)} kN·m -> M_max(alt 0.3m)=${(s2Alt.layers[0].M_max_sag_Nm / 1e3).toFixed(1)} kN·m`
  );

  // --- M4.T1: BT09 (S1 cụm 3 cọc đối xứng & đống 4 tầng có tiếp xúc một phía dọc thân + uốn xiên 2 phương) ---
  const s1ThreePiles = solveS1Stack({ bt00, nLayers: 2, baseCount: 2, x1_m: x1Opt, x2_m: x2Opt });
  const bt07Ref = runBT07({ Do_m: bt00.summarySI.Do, pileWeightPerRow_N: bt00.summarySI.totalSelfWeight, contactAngleFromVertical_deg: 30 });
  const incErr = Math.abs(s1ThreePiles.forcesSI.maxInclinedContact_N - bt07Ref.forcesOnPileSI.N_inclined_contact_N) / bt07Ref.forcesOnPileSI.N_inclined_contact_N;
  const s1FourLayers = solveS1Stack({ bt00, nLayers: 4, baseCount: 5, x1_m: x1Opt, x2_m: x2Opt });
  assert(
    'M4.T1 (BT09): S1 cụm 3 cọc khớp lực nghiêng BT07 (< 1e-12), tiếp xúc dọc thân hội tụ và xét uốn xiên 2 phương',
    s1ThreePiles.verified &&
      incErr < 1e-12 &&
      s1FourLayers.verified &&
      s1FourLayers.forcesSI.M_combined_ser_Nm > s1FourLayers.forcesSI.M_vertical_max_Nm,
    `incErr=${incErr.toExponential(2)}, M_vert=${(s1FourLayers.forcesSI.M_vertical_max_Nm / 1e3).toFixed(1)} -> M_comb=${(s1FourLayers.forcesSI.M_combined_ser_Nm / 1e3).toFixed(1)} kN·m`
  );

  // --- M4.T2: BT12 (S3 hỗn hợp & đối chứng giới hạn quy về S1 / S2) ---
  const s3Hybrid = solveS3Stack({ bt00, blocks: [2, 2], baseCount: 5, x1_nom_m: x1Opt, x2_nom_m: x2Opt });
  const s3ToS1 = solveS3Stack({ bt00, blocks: [3], baseCount: 5, x1_nom_m: x1Opt, x2_nom_m: x2Opt });
  const s1Ref3 = solveS1Stack({ bt00, nLayers: 3, baseCount: 5, x1_m: x1Opt, x2_m: x2Opt });
  const s3ToS2 = solveS3Stack({ bt00, blocks: [1, 1, 1], baseCount: 5, x1_nom_m: x1Opt, x2_nom_m: x2Opt });
  const s2Ref3 = solveS2Stack({ bt00, nLayers: 3, pilesPerLayer: 5, x1_nom_m: x1Opt, x2_nom_m: x2Opt, scenario: 'zero' });
  assert(
    'M4.T2 (BT12): S3 [2,2] bảo toàn tải tích lũy qua kê trung gian; S3 [3] quy đúng về S1 và S3 [1,1,1] quy đúng về S2',
    s3Hybrid.verified &&
      s3ToS1.reducedTo === 'S1' &&
      Math.abs(s3ToS1.maxUtilization - s1Ref3.maxUtilization) < 1e-12 &&
      s3ToS2.reducedTo === 'S2' &&
      Math.abs(s3ToS2.maxUtilization - s2Ref3.maxUtilization) < 1e-12,
    `S3[2,2] eqErr=${s3Hybrid.equilibriumSI.relEquilibriumErr.toExponential(2)}, U_S3[2,2]=${s3Hybrid.maxUtilization.toFixed(3)}`
  );

  // --- M5.T1: BT13 (Quét miền số tầng – độ lệch kê) ---
  const bt13 = runBT13ToleranceScan({
    bt00,
    scheme: 'S2',
    nMin: 2,
    nMax: 5,
    baseCount: 5,
    x1_nom_m: x1Opt,
    x2_nom_m: x2Opt,
    eccMax_m: 0.40,
    eccStep_m: 0.10,
    refineSteps: 3,
    scenario: 'alternating',
  });
  assert(
    'M5.T1 (BT13): Quét miền (n, e) kiểm tra danh định trước, xác định vùng liên thông và công bố rõ phạm vi khảo sát',
    bt13.rowsByLayer.length === 4 &&
      bt13.maxFeasibleLayersAtNominal >= 2 &&
      bt13.coverageDisclaimer.includes('dung sai khảo sát'),
    `nMaxNominal=${bt13.maxFeasibleLayersAtNominal}, e_allow(2t)=${bt13.rowsByLayer[0].allowableEccentricity_m?.toFixed(3)} m`
  );

  // --- M5.T2: BT14 (Tập phương án Pareto S1/S2/S3) ---
  const bt14 = runBT14ParetoOptimizer({
    bt00,
    nMin: 2,
    nMax: 5,
    baseCount: 5,
    x1_nom_m: x1Opt,
    x2_nom_m: x2Opt,
    eccMax_m: 0.40,
    eccStep_m: 0.10,
    scenario: 'alternating',
  });
  assert(
    'M5.T2 (BT14): Xuất tập Pareto không bị trội trên 3 chỉ tiêu chịu lực cọc (không gộp trọng số tùy ý, không ràng buộc kho)',
    bt14.paretoFront.length >= 1 && bt14.totalEvaluated === 12,
    `evaluated=${bt14.totalEvaluated}, feasible=${bt14.feasibleCount}, pareto=${bt14.paretoFront.length} (${bt14.paretoFront.map(p => p.label).join('; ')})`
  );

  // --- M6.T1: Quản lý tiêu chuẩn mặc định TCVN & đối chiếu song song EC2 ---
  const normLegacy = normalizeStandardsConfig({});
  const bt03TCVN = runBT03({ bt00OrConfig: bt00, beamResult: bt01 });
  const bt03EC2 = evaluateBT03Eurocode2Reference({ bt00, bt03TCVN, beamResult: bt01 });
  assert(
    'M6.T1 (Standards): Cấu hình cũ mặc định về TCVN; đối chiếu EC2 độc lập (γ_G=1,35) không ghi đè kết luận chính TCVN',
    normLegacy.primaryStandard === 'TCVN' &&
      normLegacy.reportStandards.length === 1 &&
      normLegacy.reportStandards[0] === 'TCVN' &&
      bt03EC2.standard === 'EC2' &&
      bt03EC2.loadFactorULS === 1.35 &&
      bt03EC2.role.includes('tham khảo'),
    `U_bend(TCVN)=${bt03TCVN.utilization.flexureULS.toFixed(3)} vs U_bend(EC2)=${bt03EC2.utilization.flexureULS.toFixed(3)}`
  );

  return {
    allPassed: results.every(r => r.passed),
    totalTests: results.length,
    passedCount: results.filter(r => r.passed).length,
    results,
  };
}
