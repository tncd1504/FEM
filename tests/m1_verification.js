/**
 * m1_verification.js — Bộ kiểm thử tự động & hồi quy cho Mốc M1 (BT00, BT01, BT02).
 */
import { toSI, fromSI } from '../src/core/units.js';
import { buildPileRecord, runBT00, runBT01, runBT02 } from '../src/modules/xep-coc/pile_specs.js';

export async function runM1VerificationSuite(pileSpecsDb) {
  const results = [];
  const assert = (name, cond, detail = '') => {
    results.push({ name, passed: Boolean(cond), detail });
    if (!cond) throw new Error(`Assertion failed: ${name} — ${detail}`);
  };

  // --- T1: Kiểm tra thư viện 33 bản vẽ tham khảo Phan Vũ ---
  const piles = pileSpecsDb.piles;
  const rev12 = piles.filter(p => p.reference.revision === '1.2').length;
  const rev22 = piles.filter(p => p.reference.revision === '2.2').length;
  assert(
    'T1.1: Thư viện đủ 33 bản vẽ (24 bản v1.2 D300–D700 và 9 bản v2.2 D800–D1000)',
    piles.length === 33 && rev12 === 24 && rev22 === 9,
    `total=${piles.length}, v1.2=${rev12}, v2.2=${rev22}`
  );

  // Khi chưa nhập L -> phải báo thiếu dữ liệu, không tự gán L
  const samplePresetNoL = buildPileRecord(piles[0]);
  assert(
    'T1.2: Bản vẽ tham khảo chưa nhập L phải ở trạng thái "chưa đủ dữ liệu" (computed = null)',
    samplePresetNoL.validation.valid === false &&
      samplePresetNoL.computed === null &&
      samplePresetNoL.validation.status === 'chưa đủ dữ liệu',
    `status="${samplePresetNoL.validation.status}"`
  );

  // Chạy BT00 cho toàn bộ 33 bản vẽ với L = 12 m
  let all33Verified = true;
  for (const p of piles) {
    const cfg = structuredClone(p);
    cfg.templateInput.geometry.L_m = 12.0;
    const bt00 = runBT00(cfg);
    if (!bt00.valid || !bt00.verified) {
      all33Verified = false;
      break;
    }
  }
  assert('T1.3: Tất cả 33 bản vẽ khi nhập L = 12 m đều chạy BT00 hợp lệ và khớp đối chứng độc lập', all33Verified, '33/33 passed');

  // --- T2: Cô lập reference & Bỏ thép dọc gia cường đầu cọc (N2, ØGC, L2) ---
  const d600Preset = structuredClone(piles.find(p => p.code === 'PHC-A600'));
  d600Preset.templateInput.geometry.L_m = 12.0;
  const bt00Base = runBT00(d600Preset);

  const d600Mutated = structuredClone(d600Preset);
  d600Mutated.reference.publishedMcr_kNm = 123456.0;
  d600Mutated.reference.publishedMu_kNm = 654321.0;
  d600Mutated.reference.publishedInstallLoad_T = 9999.0;
  d600Mutated.reference.nonPrestressedRebarNote = { N2: 40, dGC_mm: 28, L2_mm: 3000 };
  d600Mutated.templateInput.nonPrestressedHeadBars = { N2: 40, dGC_mm: 28, L2_mm: 3000 };
  const bt00Mut = runBT00(d600Mutated);

  assert(
    'T2.1: Thay đổi Mcr, Mu, tải thi công trong reference hoặc thêm N2, ØGC, L2 không làm đổi kết quả tự tính computed',
    bt00Base.summarySI.EIred === bt00Mut.summarySI.EIred &&
      bt00Base.summarySI.Ared === bt00Mut.summarySI.Ared &&
      bt00Base.summarySI.selfWeightPerMeter === bt00Mut.summarySI.selfWeightPerMeter,
    `EIred=${bt00Base.summarySI.EIred.toExponential(6)} N·m²`
  );

  let freezeConfirmed = false;
  try {
    bt00Base.record.computed.section.Ired = 999;
  } catch (_) {
    freezeConfirmed = true;
  }
  assert('T2.2: Nhóm computed chỉ đọc (Object.freeze chặn ghi đè)', freezeConfirmed && bt00Base.record.computed.section.Ired !== 999, 'Object.freeze active');

  // --- T3: Nhất quán đơn vị SI ↔ mm/MPa/kN & phân vùng section(x) ---
  const siDirect = runBT00({
    input: {
      unitSystem: 'SI',
      geometry: { Do_m: 0.6, Dp_m: 0.5, Di_m: 0.4, L_m: 12.0 },
      concrete: { gradeB: 'B60', density_kg_m3: 2500 },
      pcReinforcement: { count_N1: 18, diameter_m: 0.0071, fpu_Pa: 1420e6, fpy_Pa: 1275e6, Ep_Pa: 200e9 },
      spiralZones: {
        endZoneLengthFactor_Do: 2,
        endZone: { wireCount: 2, diameter_m: 0.004, pitch_m: 0.05 },
        midZone: { wireCount: 1, diameter_m: 0.004, pitch_m: 0.10 },
        Rswn_Pa: 540e6,
        Esw_Pa: 200e9,
      },
    },
  });
  const relDiffSI = Math.abs(siDirect.summarySI.EIred - bt00Base.summarySI.EIred) / bt00Base.summarySI.EIred;
  assert('T3.1: Nhập bằng SI (m, Pa) và bằng mm–MPa cho cùng nghiệm SI', relDiffSI < 1e-14, `relDiff=${relDiffSI.toExponential(3)}`);

  const secLeft = bt00Base.record.computed.section.sectionAt(0.6); // < 2*Do = 1.2m -> vùng đầu cọc
  const secMid = bt00Base.record.computed.section.sectionAt(2.49); // vị trí kê 0.207L = 2.485m > 1.2m -> vùng thân giữa!
  assert(
    'T3.2: Phân vùng section(x) nhận diện đúng vùng đầu cọc (2ØFs a50) và vùng thân giữa tại vị trí kê x1≈0.207L (1ØFs a100)',
    secLeft.zone === 'end' &&
      secMid.zone === 'mid' &&
      Math.abs(secLeft.spiral.asw_per_m_m2_per_m / secMid.spiral.asw_per_m_m2_per_m - 4.0) < 1e-12,
    `asw_end / asw_mid = ${(secLeft.spiral.asw_per_m_m2_per_m / secMid.spiral.asw_per_m_m2_per_m).toFixed(2)}`
  );

  // --- T4: BT01 — Cọc đặt trên 2 gối đối xứng tại điểm cân bằng mômen a = ((√2-1)/2)*L ---
  const L = 12.0;
  const aOpt = ((Math.sqrt(2) - 1) / 2) * L; // ~ 2.485281374 m
  const bt01Sym = runBT01({
    pileRecordOrConfig: bt00Base,
    x1_m: aOpt,
    x2_m: L - aOpt,
  });
  const mHogAbs = Math.abs(bt01Sym.extremaSI.M_hog_left_Nm);
  const mSagMid = bt01Sym.extremaSI.M_midspan_Nm;
  const equalMomentRelDiff = Math.abs(mHogAbs - mSagMid) / mHogAbs;
  assert(
    'T4.1: BT01 đối xứng tại a = 0.207107L có |M_gối| = M_nhịp và khớp nghiệm giải tích đóng (< 1e-10)',
    bt01Sym.verified && equalMomentRelDiff < 1e-10,
    `|M_hog|=${(mHogAbs / 1e3).toFixed(4)} kN·m, M_mid=${(mSagMid / 1e3).toFixed(4)} kN·m, maxRelErrM=${bt01Sym.verification.maxRelErrM.toExponential(3)}`
  );

  // --- T5: BT01 — Cọc đặt trên 2 gối bất đối xứng (x1 = 2.1 m, x2 = 9.3 m) ---
  const bt01Asym = runBT01({
    pileRecordOrConfig: bt00Base,
    x1_m: 2.1,
    x2_m: 9.3,
  });
  assert(
    'T5.1: BT01 bất đối xứng (x1=2.1m, x2=9.3m) khớp nghiệm giải tích đóng về R1, R2, M(x), Q(x), w(x)',
    bt01Asym.verified && Math.abs(bt01Asym.reactionsSI.R1_fem - bt01Asym.reactionsSI.R2_fem) > 100,
    `R1=${(bt01Asym.reactionsSI.R1_fem / 1e3).toFixed(3)} kN, R2=${(bt01Asym.reactionsSI.R2_fem / 1e3).toFixed(3)} kN, maxRelErrW=${bt01Asym.verification.maxRelErrW.toExponential(3)}`
  );

  // --- T6: BT02 — Tải tập trung đặt ĐÚNG GỐI lý tưởng (e1 = 0, e2 = 0) ---
  const bt02OnSupport = runBT02({
    pileRecordOrConfig: bt00Base,
    x1_m: 2.4,
    x2_m: 9.6,
    P1_N: toSI(180, 'kN'),
    P2_N: toSI(240, 'kN'),
    e1_m: 0,
    e2_m: 0,
  });
  assert(
    'T6.1: BT02 tải đặt đúng gối (e1=0, e2=0) chỉ tăng phản lực R1+=P1, R2+=P2; tuyệt đối không sinh thêm M(x), w(x)',
    bt02OnSupport.verified &&
      bt02OnSupport.zeroEccentricityCheck.noSpuriousMomentConfirmed &&
      bt02OnSupport.extremaSI.deltaM_max_abs_vs_BT01_Nm < 1e-8,
    `deltaM_max=${bt02OnSupport.extremaSI.deltaM_max_abs_vs_BT01_Nm.toExponential(3)} N·m`
  );

  // --- T7: BT02 — Tải tập trung LỆCH GỐI & tính độc lập của 2 tuyến kê ---
  const P1 = toSI(150, 'kN');
  const P2 = toSI(150, 'kN');
  const bt02Base0 = runBT02({ pileRecordOrConfig: bt00Base, x1_m: 2.4, x2_m: 9.6, P1_N: P1, P2_N: P2, e1_m: 0, e2_m: 0 });
  const bt02Line1 = runBT02({ pileRecordOrConfig: bt00Base, x1_m: 2.4, x2_m: 9.6, P1_N: P1, P2_N: P2, e1_m: 0.35, e2_m: 0 });
  const bt02Line2 = runBT02({ pileRecordOrConfig: bt00Base, x1_m: 2.4, x2_m: 9.6, P1_N: P1, P2_N: P2, e1_m: 0, e2_m: -0.40 });
  const bt02Both  = runBT02({ pileRecordOrConfig: bt00Base, x1_m: 2.4, x2_m: 9.6, P1_N: P1, P2_N: P2, e1_m: 0.35, e2_m: -0.40 });

  // Kiểm tra nguyên lý cộng tác dụng độc lập hai tuyến tại giữa nhịp x = 6.0 m
  const m0 = bt02Base0.comparisonRows.find(r => Math.abs(r.x_m - 6.0) < 1e-6).M_fem_Nm;
  const m1 = bt02Line1.comparisonRows.find(r => Math.abs(r.x_m - 6.0) < 1e-6).M_fem_Nm;
  const m2 = bt02Line2.comparisonRows.find(r => Math.abs(r.x_m - 6.0) < 1e-6).M_fem_Nm;
  const m12 = bt02Both.comparisonRows.find(r => Math.abs(r.x_m - 6.0) < 1e-6).M_fem_Nm;
  const superpositionErr = Math.abs((m12 - m0) - ((m1 - m0) + (m2 - m0)));
  const superpositionRelErr = superpositionErr / Math.max(Math.abs(m12), 1);

  assert(
    'T7.1: BT02 lệch gối khớp nghiệm giải tích và thỏa nguyên lý cộng tác dụng độc lập hai tuyến kê',
    bt02Line1.verified && bt02Line2.verified && bt02Both.verified && superpositionRelErr < 1e-10,
    `superpositionRelErr=${superpositionRelErr.toExponential(3)}, maxRelErrM=${bt02Both.verification.maxRelErrM.toExponential(3)}`
  );

  // --- T8: Kiểm tra hồi quy các trường hợp dữ liệu không hợp lệ ---
  const invalidGeom = buildPileRecord({
    input: {
      unitSystem: 'SI',
      geometry: { Do_m: 0.4, Dp_m: 0.45, Di_m: 0.26, L_m: 10 }, // Dp > Do (sai hình học)
      concrete: { gradeB: 'B60', density_kg_m3: 2500 },
      pcReinforcement: { count_N1: 10, diameter_m: 0.009, fpu_Pa: 1420e6, fpy_Pa: 1275e6, Ep_Pa: 200e9 },
    },
  });
  const invalidConcrete = buildPileRecord({
    input: {
      unitSystem: 'SI',
      geometry: { Do_m: 0.4, Dp_m: 0.32, Di_m: 0.26, L_m: 10 },
      concrete: { gradeB: null, cylinderStrength_MPa: 80, density_kg_m3: 2500 }, // Không chọn cấp B
      pcReinforcement: { count_N1: 10, diameter_m: 0.009, fpu_Pa: 1420e6, fpy_Pa: 1275e6, Ep_Pa: 200e9 },
    },
  });
  assert(
    'T8.1: Chặn dữ liệu hình học sai (Dp > Do) và chặn tự đồng nhất 80 MPa mẫu trụ khi thiếu cấp B',
    invalidGeom.validation.valid === false && invalidConcrete.validation.valid === false,
    'Rejected invalid geometry & unmapped cylinder strength'
  );

  return {
    allPassed: results.every(r => r.passed),
    totalTests: results.length,
    passedCount: results.filter(r => r.passed).length,
    results,
  };
}
