/**
 * m2_verification.js — Bộ kiểm thử tự động & hồi quy cho Mốc M2 (BT03 – BT08).
 */
import { runBT00, runBT01 } from '../src/modules/xep-coc/pile_specs.js';
import { computePrestressLossesTCVN5574 } from '../src/modules/xep-coc/prestress_losses.js';
import { runBT03 } from '../src/modules/xep-coc/section_checker.js';
import { runBT04, runBT05 } from '../src/modules/xep-coc/contact_checker.js';
import { runBT06, runBT07, runBT08 } from '../src/modules/xep-coc/support_checker.js';

export async function runM2VerificationSuite(pileSpecsDb) {
  const results = [];
  const assert = (name, cond, detail = '') => {
    results.push({ name, passed: Boolean(cond), detail });
    if (!cond) throw new Error(`Assertion failed: ${name} — ${detail}`);
  };

  // --- M2.T1: Đối chứng từng khoản tổn hao ứng suất trước TCVN 5574:2018 Mục 9.1 ---
  // Cấu hình đối chứng chuẩn: PHC D350A (Do=350, Dp=290, Di=220, 7Ø7.1, B90, L_cang=15m, ΔL2=2mm, ΔT=0K, hầm sấy ζ=0.85)
  const bt00_d350 = runBT00({
    input: {
      unitSystem: 'display_mm_MPa',
      geometry: { Do_mm: 350, Dp_mm: 290, Di_mm: 220, L_m: 12.0 },
      concrete: { gradeB: 'B90', density_kg_m3: 2500, rhGroup: '75' },
      pcReinforcement: { count_N1: 7, diameter_mm: 7.1, fpu_MPa: 1420, fpy_MPa: 1275, Ep_MPa: 200000 },
      spiralZones: {
        endZoneLengthFactor_Do: 2,
        endZone: { wireCount: 2, diameter_mm: 3.0, pitch_mm: 50 },
        midZone: { wireCount: 1, diameter_mm: 3.0, pitch_mm: 100 },
      },
    },
  });

  const lossesRef = computePrestressLossesTCVN5574({
    bt00: bt00_d350,
    processInput: {
      L_cang_m: 15.0,
      anchorSlip_mm: 2.0,
      moldDeformation_mm: 0.0,
      deltaT_K: 0.0,
      zeroDeltaTJustification: 'Thép căng và khuôn/bệ giữ lực nằm cùng trong hầm sấy (không chênh nhiệt)',
      curingMode: 'steam_chamber_then_natural',
      creepStressAreaBasis: 'Ag',
    },
  });

  const errL1 = Math.abs(lossesRef.stage1.loss1_relaxation_Pa / 1e6 - 71.08464313725487);
  const errL4 = Math.abs(lossesRef.stage1.loss4_anchor_Pa / 1e6 - 26.666666666666668);
  const errL5 = Math.abs(lossesRef.stage2.loss5_shrinkage_Pa / 1e6 - 51.0);
  const errL6 = Math.abs(lossesRef.stage2.loss6_creep_Pa / 1e6 - 13.128065803985033);
  const errPe = Math.abs(lossesRef.effective.sigma_pe_Pa / 1e6 - 832.1206243920933);

  assert(
    'M2.T1: BT03 khớp chính xác từng khoản tổn hao Δσ_sp1..Δσ_sp6 và σ_pe theo TCVN 5574:2018 Mục 9.1 (< 1e-11)',
    errL1 < 1e-11 && errL4 < 1e-11 && errL5 < 1e-11 && errL6 < 1e-11 && errPe < 1e-11,
    `σ_pe=${(lossesRef.effective.sigma_pe_Pa / 1e6).toFixed(6)} MPa, Δσ_sp=${(lossesRef.totals.totalLoss_Pa / 1e6).toFixed(6)} MPa`
  );

  // --- M2.T2: Kiểm chứng mốc đo lực/giãn dài, chênh nhiệt ΔT và chặn đường tắt nhập trực tiếp ---
  const lossesAfterAnchor = computePrestressLossesTCVN5574({
    bt00: bt00_d350,
    processInput: {
      L_cang_m: 15.0,
      anchorSlip_mm: 2.0,
      measurementStage: 'after_anchoring',
      deltaT_K: 20.0,
    },
  });
  assert(
    'M2.T2a: Đo lực sau khi chốt neo không trừ lặp Δσ_sp4 (= 0 Pa) và ΔT = 20 K cho Δσ_sp2 = 25 MPa',
    lossesAfterAnchor.stage1.loss4_anchor_Pa === 0 &&
      Math.abs(lossesAfterAnchor.stage1.loss2_temperature_Pa / 1e6 - 25.0) < 1e-12,
    `Δσ_sp4=${lossesAfterAnchor.stage1.loss4_anchor_Pa} Pa, Δσ_sp2=${(lossesAfterAnchor.stage1.loss2_temperature_Pa / 1e6).toFixed(2)} MPa`
  );

  let blockedUnjustifiedZeroDeltaT = false;
  let blockedShortcutSigmaPc = false;
  try {
    computePrestressLossesTCVN5574({ bt00: bt00_d350, processInput: { L_cang_m: 15, deltaT_K: 0, zeroDeltaTJustification: '' } });
  } catch (_) {
    blockedUnjustifiedZeroDeltaT = true;
  }
  try {
    computePrestressLossesTCVN5574({ bt00: bt00_d350, processInput: { L_cang_m: 15, directSigmaPc_MPa: 6.0 } });
  } catch (_) {
    blockedShortcutSigmaPc = true;
  }
  assert(
    'M2.T2b: Chặn tự gán ΔT = 0 khi thiếu giả thiết và chặn đường tắt nhập trực tiếp σ_pc / suy từ cấp tải',
    blockedUnjustifiedZeroDeltaT && blockedShortcutSigmaPc,
    'Blocked unjustified ΔT=0 & direct σ_pc shortcut'
  );

  // --- M2.T3: BT03 — Tự tính Mcrc, MRd, Mu_ser và QRd(x) theo vùng đai section(x), cô lập reference ---
  const p600 = structuredClone(pileSpecsDb.piles.find(p => p.code === 'PHC-A600'));
  p600.templateInput.geometry.L_m = 12.0;
  const bt00_600 = runBT00(p600);
  const bt01_600 = runBT01({ pileRecordOrConfig: bt00_600, x1_m: 2.485, x2_m: 9.515 });
  const bt03_600 = runBT03({ bt00OrConfig: bt00_600, beamResult: bt01_600 });

  // Thay đổi Mcr, Mu công bố và N2/ØGC/L2 trong reference
  const p600Mut = structuredClone(p600);
  p600Mut.reference.publishedMcr_kNm = 9999;
  p600Mut.reference.publishedMu_kNm = 19999;
  p600Mut.reference.nonPrestressedRebarNote = { N2: 50, dGC_mm: 36, L2_mm: 4000 };
  const bt03_600_mut = runBT03({ bt00OrConfig: runBT00(p600Mut), beamResult: bt01_600 });

  assert(
    'M2.T3: BT03 tự tính Mcrc < MRd < Mu_ser, phân biệt QRd vùng đầu cọc > vùng thân giữa và bất biến với reference/N2-ØGC',
    bt03_600.capacitiesSI.Mcrc_Nm < bt03_600.capacitiesSI.MRd_design_Nm &&
      bt03_600.capacitiesSI.MRd_design_Nm < bt03_600.capacitiesSI.Mu_characteristic_Nm &&
      bt03_600.capacitiesSI.QRd_endZone_N > bt03_600.capacitiesSI.QRd_midZone_N &&
      bt03_600.capacitiesSI.MRd_design_Nm === bt03_600_mut.capacitiesSI.MRd_design_Nm &&
      bt03_600.capacitiesSI.Mcrc_Nm === bt03_600_mut.capacitiesSI.Mcrc_Nm,
    `Mcrc=${(bt03_600.capacitiesSI.Mcrc_Nm / 1e3).toFixed(1)} kN·m, MRd=${(bt03_600.capacitiesSI.MRd_design_Nm / 1e3).toFixed(1)} kN·m, QRd_end/mid=${(bt03_600.capacitiesSI.QRd_endZone_N / 1e3).toFixed(1)}/${(bt03_600.capacitiesSI.QRd_midZone_N / 1e3).toFixed(1)} kN`
  );

  // --- M2.T4: BT04 — Nén cục bộ phía cọc tại vùng tiếp xúc với thanh kê gỗ cứng 100×100 mm ---
  const bt04 = runBT04({
    bt00: bt00_600,
    normalForce_N: 120000,
    contactType: 'pile_batten',
    contactLengthAlongPile_m: 0.1,
    contactArcAngle_deg: 20,
  });
  assert(
    'M2.T4: BT04 cân bằng tích phân áp lực bằng lực đặt, A_loc khác Ag và khác 0,01 m², không kiểm tra nén gỗ',
    bt04.verified &&
      bt04.timberBattenPolicy.timberCheckPerformed === false &&
      bt04.pressuresSI.equilibriumRelError < 1e-4,
    `A_loc=${(bt04.contactGeometrySI.A_loc_m2 * 1e4).toFixed(2)} cm², N_loc,Rd=${(bt04.capacitySI.N_loc_Rd_N / 1e3).toFixed(1)} kN, relErr=${bt04.pressuresSI.equilibriumRelError.toExponential(2)}`
  );

  // --- M2.T5: BT05 — Ép ngang, uốn vòng và nứt thành cọc rỗng theo vùng cốt đai section(x) ---
  const bt05End = runBT05({ bt00: bt00_600, x_m: 0.5, normalForce_N: 100000, loadCase: 'two_point_diametral' });
  const bt05Mid = runBT05({ bt00: bt00_600, x_m: 2.485, normalForce_N: 100000, loadCase: 'two_point_diametral' });
  const bt05Tri = runBT05({ bt00: bt00_600, x_m: 2.485, normalForce_N: 100000, loadCase: 'three_point_triangular' });
  assert(
    'M2.T5: BT05 khớp nghiệm vòng đàn hồi Roark (< 1e-13), không lấy σ_pc dọc cho phương vòng, phân biệt vùng đai end/mid',
    bt05End.verified &&
      bt05Mid.verified &&
      bt05Tri.verified &&
      bt05Mid.sectionZoneAtContact.longitudinalPrestressAppliedToRing === false &&
      bt05End.capacitiesSI.M_ring_Rd_Nm > bt05Mid.capacitiesSI.M_ring_Rd_Nm &&
      bt05Mid.ringForcesSI.stressAmplificationOverNaiveRA > 5,
    `ringAnalyticalErr=${bt05Mid.verification.ringAnalyticalRelError.toExponential(2)}, M_Rd_end/mid=${(bt05End.capacitiesSI.M_ring_Rd_Nm / 1e3).toFixed(2)}/${(bt05Mid.capacitiesSI.M_ring_Rd_Nm / 1e3).toFixed(2)} kN·m`
  );

  // --- M2.T6: BT06 — Thanh kê gỗ 100×100 mm tuyệt đối cứng truyền tải một phía (tách hở khi lệch tâm) ---
  // Tải đặt lệch hẳn về bên phải làm các cọc bên trái bị nhấc hở (mất tiếp xúc R_j = 0)
  const bt06Ecc = runBT06({
    battenLength_y_m: 3.0,
    lowerPileCoords_y_m: [0.3, 0.9, 1.5, 2.1, 2.7],
    upperLoads: [{ y_m: 2.55, P_N: 150000 }],
  });
  const activeR = bt06Ecc.reactions.filter(r => r.active).map(r => r.R_N);
  const nonUniform = Math.max(...activeR) - Math.min(...activeR) > 1000;
  assert(
    'M2.T6: BT06 thanh kê gỗ cứng 100×100 mm giải đúng tiếp xúc một phía (tự tách hở khi lệch tâm, không chia đều phản lực)',
    bt06Ecc.verified &&
      bt06Ecc.rigidBodyMotionSI.separatedContactCount >= 2 &&
      nonUniform &&
      bt06Ecc.battenSpecSI.timberStrengthOrDeflectionChecked === false,
    `active=${bt06Ecc.rigidBodyMotionSI.activeContactCount}/5, separated=${bt06Ecc.rigidBodyMotionSI.separatedContactCount}, relForceErr=${bt06Ecc.equilibriumSI.relForceErr.toExponential(2)}`
  );

  // --- M2.T7: BT07 & BT08 — Ràng buộc giữ ngang lý tưởng và kê đáy trên nền cứng không lún ---
  const bt07Ok = runBT07({ Do_m: 0.6, pileWeightPerRow_N: 45000, contactAngleFromVertical_deg: 30, includeIdealSideRestraint: true });
  const bt07NoRestraint = runBT07({ Do_m: 0.6, pileWeightPerRow_N: 45000, includeIdealSideRestraint: false });
  const bt08A = runBT08({ L_m: 12, x1_m: 2.485, x2_m: 9.515, line1TotalLoad_N: 180000, line2TotalLoad_N: 180000 });
  const bt08B = runBT08({
    L_m: 12,
    x1_m: 2.485,
    x2_m: 9.515,
    line1TotalLoad_N: 180000,
    line2TotalLoad_N: 180000,
    optionalWarehouseGroundParams: { bearingCapacity_kPa: 50, subgradeModulus: 1000 },
  });

  assert(
    'M2.T7: BT07 & BT08 cân bằng biên lý tưởng chính xác, báo mất cân bằng khi bỏ chèn biên, và bất biến trước thông số nền kho',
    bt07Ok.verified &&
      bt07NoRestraint.equilibriumValid === false &&
      bt08A.verified &&
      bt08A.outputsSI.R_ground_1_N === bt08B.outputsSI.R_ground_1_N &&
      bt08A.scopePolicy.missingGroundDataBlocksCalculation === false,
    `N_inclined=${(bt07Ok.forcesOnPileSI.N_inclined_contact_N / 1e3).toFixed(2)} kN, H_restraint=${(bt07Ok.forcesOnPileSI.H_ideal_side_restraint_N / 1e3).toFixed(2)} kN`
  );

  return {
    allPassed: results.every(r => r.passed),
    totalTests: results.length,
    passedCount: results.filter(r => r.passed).length,
    results,
  };
}
