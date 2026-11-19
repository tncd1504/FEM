/**
 * m2_verification.js — Bộ kiểm thử tự động & hồi quy cho Mốc M2 (BT03 – BT08).
 *
 * Gồm (1) đối chứng từng khoản tổn hao theo TCVN 5574:2018 Mục 9.1, (2) đối chứng độc lập dạng giải tích đóng
 * cho các sức kháng đã hiệu chỉnh ở v1.1.0 (cắt, nứt, uốn vòng), (3) các trường hợp chặn đầu vào/đường tắt.
 */
import { runBT00, runBT01 } from '../src/modules/xep-coc/pile_specs.js';
import { computePrestressLossesTCVN5574 } from '../src/modules/xep-coc/prestress_losses.js';
import { runBT03 } from '../src/modules/xep-coc/section_checker.js';
import { runBT04, runBT05 } from '../src/modules/xep-coc/contact_checker.js';
import { runBT06, runBT07, runBT08 } from '../src/modules/xep-coc/support_checker.js';

/** Quy trình căng khai báo đầy đủ dùng chung cho các bài kiểm thử (không có mặc định ngầm trong lõi tính). */
export const TEST_PROCESS_INPUT = Object.freeze({
  L_cang_m: 12.0,
  initialStress_MPa: 994,
  anchorSlip_mm: 2.0,
  moldDeformation_mm: 0.0,
  measurementStage: 'before_anchoring',
  deltaT_K: 0,
  zeroDeltaTJustification: 'Thép căng và khuôn thép giữ lực cùng nằm trong hầm sấy (không chênh nhiệt) — giả thiết kiểm thử',
  curingMode: 'steam_chamber_then_natural',
});

const expectThrow = (fn, needle) => {
  try {
    fn();
    return false;
  } catch (err) {
    return needle ? String(err.message).includes(needle) : true;
  }
};

export async function runM2VerificationSuite(pileSpecsDb) {
  const results = [];
  const assert = (name, cond, detail = '') => {
    results.push({ name, passed: Boolean(cond), detail });
    if (!cond) throw new Error(`Assertion failed: ${name} — ${detail}`);
  };

  // --- M2.T1: Đối chứng từng khoản tổn hao ứng suất trước TCVN 5574:2018 Mục 9.1 ---
  // PHC D350 (Do=350, Dp=290, Di=220, 7Ø7.1, B90), thép sợi/cáp (công thức chùng 132), σ_sp0 = 994 MPa,
  // L_cang = 15 m, ΔL2 = 2 mm, ΔT = 0 K có giả thiết, hầm sấy ζ = 0,85
  const d350Input = {
    unitSystem: 'display_mm_MPa',
    geometry: { Do_mm: 350, Dp_mm: 290, Di_mm: 220, L_m: 12.0 },
    concrete: { gradeB: 'B90', density_kg_m3: 2500, rhGroup: '75' },
    pcReinforcement: {
      count_N1: 7, diameter_mm: 7.1, fpu_MPa: 1420, fpy_MPa: 1275, Ep_MPa: 200000,
      steelCategory: 'cold_drawn_wire_or_strand',
    },
    spiralZones: {
      endZoneLengthFactor_Do: 2,
      endZone: { wireCount: 2, diameter_mm: 3.0, pitch_mm: 50 },
      midZone: { wireCount: 1, diameter_mm: 3.0, pitch_mm: 100 },
    },
  };
  const bt00_d350 = runBT00({ input: d350Input });
  const d350Process = {
    ...TEST_PROCESS_INPUT,
    L_cang_m: 15.0,
    creepStressAreaBasis: 'Ag',
  };
  const lossesRef = computePrestressLossesTCVN5574({ bt00: bt00_d350, processInput: d350Process });

  const errL1 = Math.abs(lossesRef.stage1.loss1_relaxation_Pa / 1e6 - 71.08464313725487);
  const errL4 = Math.abs(lossesRef.stage1.loss4_anchor_Pa / 1e6 - 26.666666666666668);
  const errL5 = Math.abs(lossesRef.stage2.loss5_shrinkage_Pa / 1e6 - 51.0);
  const errL6 = Math.abs(lossesRef.stage2.loss6_creep_Pa / 1e6 - 13.128065803985033);
  const errPe = Math.abs(lossesRef.effective.sigma_pe_Pa / 1e6 - 832.1206243920933);

  assert(
    'M2.T1: Khớp chính xác từng khoản tổn hao Δσ_sp1..Δσ_sp6 và σ_pe theo TCVN 5574:2018 Mục 9.1 (< 1e-11)',
    errL1 < 1e-11 && errL4 < 1e-11 && errL5 < 1e-11 && errL6 < 1e-11 && errPe < 1e-11 && !lossesRef.totals.minLossGoverns,
    `σ_pe=${(lossesRef.effective.sigma_pe_Pa / 1e6).toFixed(6)} MPa, Δσ_sp=${(lossesRef.totals.totalLoss_Pa / 1e6).toFixed(6)} MPa`
  );

  // --- M2.T1b: Thép thanh nhiệt luyện dùng công thức chùng (133) và giới hạn σ_sp ≤ 0,9·Rs,n ---
  const bt00_d350_bar = runBT00({ input: { ...d350Input, pcReinforcement: { ...d350Input.pcReinforcement, steelCategory: 'heat_treated_bar' } } });
  const lossesBar = computePrestressLossesTCVN5574({ bt00: bt00_d350_bar, processInput: d350Process });
  const loss1BarExpected_MPa = 0.1 * 994 - 20;
  const rejectAboveWireLimit = expectThrow(
    () => computePrestressLossesTCVN5574({ bt00: bt00_d350, processInput: { ...d350Process, initialStress_MPa: 1100 } }),
    'vượt giới hạn'
  );
  const acceptBarAt1100 = !expectThrow(
    () => computePrestressLossesTCVN5574({ bt00: bt00_d350_bar, processInput: { ...d350Process, initialStress_MPa: 1100 } })
  );
  assert(
    'M2.T1b: Phân loại thép DƯL quyết định công thức chùng (133: 0,1σ−20) và giới hạn σ_sp (0,8 / 0,9·Rs,n)',
    Math.abs(lossesBar.stage1.loss1_relaxation_Pa / 1e6 - loss1BarExpected_MPa) < 1e-9 &&
      Math.abs(lossesBar.initial.sigma_sp_limit_Pa / 1e6 - 0.9 * 1275) < 1e-9 &&
      Math.abs(lossesRef.initial.sigma_sp_limit_Pa / 1e6 - 0.8 * 1275) < 1e-9 &&
      rejectAboveWireLimit &&
      acceptBarAt1100,
    `Δσ_sp1(bar)=${(lossesBar.stage1.loss1_relaxation_Pa / 1e6).toFixed(3)} MPa, giới hạn bar/sợi = ${(lossesBar.initial.sigma_sp_limit_Pa / 1e6).toFixed(1)}/${(lossesRef.initial.sigma_sp_limit_Pa / 1e6).toFixed(1)} MPa`
  );

  // --- M2.T1c: Tổng tổn hao không nhỏ hơn 100 MPa ---
  const lossesLow = computePrestressLossesTCVN5574({
    bt00: bt00_d350,
    processInput: { ...d350Process, initialStress_MPa: 600, measurementStage: 'after_anchoring' },
  });
  assert(
    'M2.T1c: Tổng tổn hao tính được < 100 MPa thì lấy 100 MPa (TCVN 5574:2018 Mục 9.1)',
    lossesLow.totals.minLossGoverns &&
      lossesLow.totals.totalLossComputed_Pa < 100e6 &&
      Math.abs(lossesLow.effective.sigma_pe_Pa - 500e6) < 1e-6,
    `Δσ tính = ${(lossesLow.totals.totalLossComputed_Pa / 1e6).toFixed(2)} MPa → lấy 100 MPa, σ_pe = ${(lossesLow.effective.sigma_pe_Pa / 1e6).toFixed(2)} MPa`
  );

  // --- M2.T2: Mốc đo lực/giãn dài, chênh nhiệt ΔT và chặn đường tắt / mặc định ngầm ---
  const lossesAfterAnchor = computePrestressLossesTCVN5574({
    bt00: bt00_d350,
    processInput: { ...d350Process, measurementStage: 'after_anchoring', deltaT_K: 20.0, zeroDeltaTJustification: '' },
  });
  assert(
    'M2.T2a: Đo lực sau khi chốt neo không trừ lặp Δσ_sp4 (= 0 Pa) và ΔT = 20 K cho Δσ_sp2 = 25 MPa',
    lossesAfterAnchor.stage1.loss4_anchor_Pa === 0 &&
      Math.abs(lossesAfterAnchor.stage1.loss2_temperature_Pa / 1e6 - 25.0) < 1e-12,
    `Δσ_sp4=${lossesAfterAnchor.stage1.loss4_anchor_Pa} Pa, Δσ_sp2=${(lossesAfterAnchor.stage1.loss2_temperature_Pa / 1e6).toFixed(2)} MPa`
  );

  const blockedUnjustifiedZeroDeltaT = expectThrow(
    () => computePrestressLossesTCVN5574({ bt00: bt00_d350, processInput: { ...d350Process, zeroDeltaTJustification: '' } }),
    'ΔT = 0'
  );
  const blockedShortcutSigmaPc = expectThrow(
    () => computePrestressLossesTCVN5574({ bt00: bt00_d350, processInput: { ...d350Process, directSigmaPc_MPa: 6.0 } }),
    'Vi phạm'
  );
  const { initialStress_MPa: _omit, ...noSigmaSp0 } = d350Process;
  const blockedMissingSigmaSp0 = expectThrow(
    () => computePrestressLossesTCVN5574({ bt00: bt00_d350, processInput: noSigmaSp0 }),
    'σ_sp0'
  );
  const blockedMissingLcang = expectThrow(
    () => runBT03({ bt00OrConfig: bt00_d350, processInput: { ...d350Process, L_cang_m: undefined }, serviceMoment_Nm: 1, designMoment_Nm: 1, designShearEnd_N: 1, designShearMid_N: 1 }),
    'L_cang'
  );
  const p600NoCat = structuredClone(pileSpecsDb.piles.find(p => p.code === 'PHC-A600'));
  p600NoCat.templateInput.geometry.L_m = 12.0;
  delete p600NoCat.templateInput.pcReinforcement.steelCategory;
  const blockedMissingCategory = expectThrow(
    () => computePrestressLossesTCVN5574({ bt00: runBT00(p600NoCat), processInput: TEST_PROCESS_INPUT }),
    'phân loại thép'
  );
  assert(
    'M2.T2b: Chặn ΔT = 0 thiếu giả thiết, đường tắt σ_pc, thiếu σ_sp0, thiếu L_cang (không tự lấy = L) và thiếu phân loại thép',
    blockedUnjustifiedZeroDeltaT && blockedShortcutSigmaPc && blockedMissingSigmaSp0 && blockedMissingLcang && blockedMissingCategory,
    `ΔT=${blockedUnjustifiedZeroDeltaT}, σpc=${blockedShortcutSigmaPc}, σsp0=${blockedMissingSigmaSp0}, Lcang=${blockedMissingLcang}, cat=${blockedMissingCategory}`
  );

  // --- M2.T3: BT03 — Tự tính Mcrc, MRd, Mu_ser và QRd(x) theo vùng đai section(x), cô lập reference ---
  const p600 = structuredClone(pileSpecsDb.piles.find(p => p.code === 'PHC-A600'));
  p600.templateInput.geometry.L_m = 12.0;
  const bt00_600 = runBT00(p600);
  const bt01_600 = runBT01({ pileRecordOrConfig: bt00_600, x1_m: 2.485, x2_m: 9.515 });
  const bt03_600 = runBT03({ bt00OrConfig: bt00_600, processInput: TEST_PROCESS_INPUT, beamResult: bt01_600 });

  const p600Mut = structuredClone(p600);
  p600Mut.reference.publishedMcr_kNm = 9999;
  p600Mut.reference.publishedMu_kNm = 19999;
  p600Mut.reference.nonPrestressedRebarNote = { N2: 50, dGC_mm: 36, L2_mm: 4000 };
  const bt03_600_mut = runBT03({ bt00OrConfig: runBT00(p600Mut), processInput: TEST_PROCESS_INPUT, beamResult: bt01_600 });

  assert(
    'M2.T3: BT03 tự tính Mcrc < MRd < Mu_ser, QRd vùng đầu cọc > thân giữa, bất biến với reference/N2-ØGC, nghiệm số hội tụ',
    bt03_600.verified &&
      bt03_600.capacitiesSI.Mcrc_Nm < bt03_600.capacitiesSI.MRd_design_Nm &&
      bt03_600.capacitiesSI.MRd_design_Nm < bt03_600.capacitiesSI.Mu_characteristic_Nm &&
      bt03_600.capacitiesSI.QRd_endZone_N > bt03_600.capacitiesSI.QRd_midZone_N &&
      bt03_600.capacitiesSI.MRd_design_Nm === bt03_600_mut.capacitiesSI.MRd_design_Nm &&
      bt03_600.capacitiesSI.Mcrc_Nm === bt03_600_mut.capacitiesSI.Mcrc_Nm,
    `Mcrc=${(bt03_600.capacitiesSI.Mcrc_Nm / 1e3).toFixed(1)} kN·m, MRd=${(bt03_600.capacitiesSI.MRd_design_Nm / 1e3).toFixed(1)} kN·m (${bt03_600.capacitiesSI.MRd_limitMode}), QRd_end/mid=${(bt03_600.capacitiesSI.QRd_endZone_N / 1e3).toFixed(1)}/${(bt03_600.capacitiesSI.QRd_midZone_N / 1e3).toFixed(1)} kN`
  );

  // --- M2.T3b: Đối chứng độc lập dạng đóng — vật liệu γb1, γsp, Mcrc đàn hồi, εs2 và sức kháng cắt ---
  const conc600 = bt00_600.record.computed.concrete;
  const sec600 = bt00_600.record.computed.section;
  const eff600 = bt03_600.prestress.effective;
  const Mcrc_el_expected = (0.9 * eff600.sigma_pc_red_Pa + conc600.Rbtn) * sec600.Wred;
  const sigmaPcUsesAred = Math.abs(eff600.sigma_pc_Pa - eff600.P_eff_N / sec600.Ared) < 1e-6;

  const shMid = bt03_600.capacitiesSI.shearMidDetail;
  const bw = 2 * sec600.t;
  const h0 = 0.9 * sec600.Do;
  const r = eff600.sigma_pc_favourable_Pa / conc600.Rb;
  const phi_n = r <= 0.25 ? 1 + r : 1.25;
  const num = 1.5 * phi_n * conc600.Rbt * bw * h0 * h0;
  const zoneMid = sec600.zones.middle;
  const qsw = (zoneMid.Asw_per_pitch_m2 * bt00_600.record.computed.steel.spiral.Rsw) / zoneMid.pitch_m;
  const counted = qsw >= 0.25 * conc600.Rbt * bw;
  const Qb = (c) => Math.min(2.5 * conc600.Rbt * bw * h0, Math.max(0.5 * conc600.Rbt * bw * h0, num / c));
  const qUsed = counted ? qsw : 0;
  const Qtot = (c) => Qb(c) + 0.75 * qUsed * Math.min(c, 2 * h0);
  const cands = [h0, 2 * h0, 3 * h0, num / (2.5 * conc600.Rbt * bw * h0), num / (0.5 * conc600.Rbt * bw * h0)];
  if (qUsed > 0) cands.push(Math.sqrt(num / (0.75 * qUsed)));
  const QRd_mid_expected = Math.min(
    0.3 * conc600.Rb * bw * h0,
    ...cands.filter(c => c >= h0 - 1e-12 && c <= 3 * h0 + 1e-12).map(Qtot)
  );
  const shearRelErr = Math.abs(shMid.QRd_design_N - QRd_mid_expected) / QRd_mid_expected;

  assert(
    'M2.T3b: γb1 = 0,9 (tải dài hạn), σ_pc theo Ared, Mcrc đàn hồi với γsp = 0,9, εp ≤ εs2 = 0,015 và QRd,mid khớp lời giải đóng (qsw ≥ 0,25Rbt·b; c ≤ 2h0)',
    Math.abs(conc600.Rb - 0.9 * 33e6) < 1e-6 &&
      conc600.loadDuration === 'long_term' &&
      sigmaPcUsesAred &&
      Math.abs(bt03_600.capacitiesSI.Mcrc_elastic_Nm - Mcrc_el_expected) / Mcrc_el_expected < 1e-12 &&
      bt03_600.capacitiesSI.Mcrc_Nm >= bt03_600.capacitiesSI.Mcrc_elastic_Nm &&
      bt03_600.capacitiesSI.MRd_maxBarTotalStrain <= 0.015 + 1e-9 &&
      shMid.stirrupsCounted === counted &&
      shearRelErr < 2e-3,
    `Rb=${(conc600.Rb / 1e6).toFixed(2)} MPa, Mcrc_el=${(Mcrc_el_expected / 1e3).toFixed(2)} kN·m, εp,max=${bt03_600.capacitiesSI.MRd_maxBarTotalStrain.toFixed(5)}, qsw=${(qsw / 1e3).toFixed(1)} kN/m (kể đai: ${counted}), QRd,mid=${(shMid.QRd_design_N / 1e3).toFixed(2)} vs ${(QRd_mid_expected / 1e3).toFixed(2)} kN`
  );

  // --- M2.T3c: Kiểm tra lúc truyền lực tách khỏi kết luận lưu kho; thiếu cấp truyền lực → "chưa đủ dữ liệu" ---
  const bt03_transfer = runBT03({ bt00OrConfig: bt00_600, processInput: { ...TEST_PROCESS_INPUT, transferGradeB: 'B40' }, beamResult: bt01_600 });
  assert(
    'M2.T3c: Kiểm tra truyền lực tách riêng: thiếu cấp B lúc truyền lực → "chưa đủ dữ liệu"; có B40 → so 15 MPa & 50%B',
    bt03_600.stageChecks.transfer.status === 'chưa đủ dữ liệu' &&
      !('transferCompression' in bt03_600.utilization) &&
      bt03_transfer.stageChecks.transfer.meetsMinimumTransferStrength === true &&
      Math.abs(bt03_transfer.stageChecks.transfer.minRequired_MPa - 30) < 1e-12,
    `transfer(B40): U=${bt03_transfer.stageChecks.transfer.utilization?.toFixed(3)}, trạng thái=${bt03_transfer.stageChecks.transfer.status}`
  );

  // --- M2.T4: BT04 — Nén cục bộ phía cọc (cọc–kê bắt buộc góc ôm; cọc–cọc theo Hertz) ---
  const bt04 = runBT04({ bt00: bt00_600, normalForce_N: 120000, contactType: 'pile_batten', contactLengthAlongPile_m: 0.1, contactArcAngle_deg: 20 });
  const bt04pp = runBT04({ bt00: bt00_600, normalForce_N: 30000, contactType: 'pile_pile', contactLengthAlongPile_m: 0.6 });
  const blockedNoAngle = expectThrow(() => runBT04({ bt00: bt00_600, normalForce_N: 1000, contactType: 'pile_batten' }), 'góc ôm');
  const Amax_expected = Math.min(sec600.L, 0.1 + 2 * sec600.t) * Math.min(sec600.Do, bt04.contactGeometrySI.bc_effective_m + 2 * sec600.t);
  assert(
    'M2.T4: BT04 nhân γf = 1,1, A_loc,max = (bx+2t)·min(Do, bc+2t), cân bằng tích phân áp lực; cọc–cọc theo Hertz; chặn thiếu góc ôm',
    bt04.verified &&
      Math.abs(bt04.inputsSI.designNormalForce_N - 1.1 * 120000) < 1e-9 &&
      Math.abs(bt04.contactGeometrySI.A_loc_max_m2 - Amax_expected) < 1e-15 &&
      bt04.timberBattenPolicy.timberCheckPerformed === false &&
      bt04pp.inputsSI.contactArcAngle_deg === null &&
      bt04pp.contactGeometrySI.bc_effective_m === bt04pp.contactGeometrySI.b_hertz_m &&
      blockedNoAngle,
    `U_kê=${bt04.capacitySI.utilization.toFixed(3)}, U_cọc–cọc=${bt04pp.capacitySI.utilization.toFixed(3)} (b_Hertz=${(bt04pp.contactGeometrySI.b_hertz_m * 1e3).toFixed(2)} mm)`
  );

  // --- M2.T5: BT05 — Bộ giải vòng kín tổng quát, đối chứng Roark, γ = 1,3 và vị trí đai xoắn ---
  const bt05End = runBT05({ bt00: bt00_600, x_m: 0.5, normalForce_N: 100000, loadCase: 'two_point_diametral' });
  const bt05Mid = runBT05({ bt00: bt00_600, x_m: 2.485, normalForce_N: 100000, loadCase: 'two_point_diametral' });
  const bt05Tri = runBT05({ bt00: bt00_600, x_m: 2.485, normalForce_N: 100000, loadCase: 'three_point_triangular' });
  const bt05Shear = runBT05({ bt00: bt00_600, x_m: 2.485, normalForce_N: 100000, loadCase: 'support_reaction_shear_balanced' });
  const M_shear_expected = (3 / (4 * Math.PI)) * 100000 * sec600.rm; // vòng chịu lực điểm cân bằng bằng dòng cắt sinθ
  const b_eff = 0.1 + 4 * sec600.t;
  const Mcrc_outer_expected = 1.3 * conc600.Rbtn * (b_eff * sec600.t * sec600.t) / 6;
  assert(
    'M2.T5: BT05 khớp Roark (< 1e-9), lực điểm cân bằng dòng cắt M = 3PR/(4π), Wpl = 1,3W, đai xoắn ngoài không chịu căng thớ trong',
    bt05End.verified &&
      bt05Mid.verified &&
      bt05Tri.verified &&
      bt05Shear.verified &&
      Math.abs(bt05Shear.ringForcesSI.M_inner_max_Nm - M_shear_expected) / M_shear_expected < 1e-9 &&
      Math.abs(bt05Mid.capacitiesSI.M_ring_crc_outer_Nm - Mcrc_outer_expected) / Mcrc_outer_expected < 1e-12 &&
      bt05Mid.sectionZoneAtContact.longitudinalPrestressAppliedToRing === false &&
      bt05Mid.sectionZoneAtContact.spiralInInnerHalf === false &&
      bt05Mid.capacitiesSI.M_rc_innerTension_Nm === 0 &&
      bt05End.capacitiesSI.M_rc_outerTension_Nm > bt05Mid.capacitiesSI.M_rc_outerTension_Nm &&
      bt05Mid.ringForcesSI.stressAmplificationOverNaiveRA > 5,
    `Roark err=${bt05Mid.verification.ringAnalyticalRelError.toExponential(2)}, M_shear=${(bt05Shear.ringForcesSI.M_inner_max_Nm / 1e3).toFixed(3)} kN·m, U_crack(2 lực)=${bt05Mid.capacitiesSI.utilizationCrack.toFixed(3)}`
  );

  // --- M2.T6: BT06 — Thanh kê gỗ 100×100 mm tuyệt đối cứng truyền tải một phía (tách hở khi lệch tâm) ---
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
