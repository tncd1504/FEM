/**
 * pile_specs.js — Quản lý dữ liệu cọc tách 3 nhóm (reference / input / computed)
 * và triển khai bộ 3 bài tính độc lập Mốc M1 (BT00, BT01, BT02) kèm nghiệm giải tích đối chứng.
 */
import { G_STANDARD, toSI, fromSI } from '../../core/units.js';
import { solveBeam } from '../../core/fem_solver.js';
import {
  resolveConcreteTCVN5574,
  resolveSteelTCVN5574,
  computeSectionPropertiesSI,
} from './section_properties.js';

/** Khóa sâu (deep freeze) để bảo đảm computed/reference không bị ghi đè. */
function deepFreeze(obj) {
  if (!obj || typeof obj !== 'object' || Object.isFrozen(obj)) return obj;
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val && typeof val === 'object') deepFreeze(val);
  }
  return obj;
}

/**
 * Chuẩn hóa đầu vào phương án cọc (chấp nhận cả hệ hiển thị mm–MPa hoặc hệ SI m–Pa)
 * và tách thành 3 nhóm độc lập: { reference, input, computed, validation }.
 *
 * Mọi thay đổi trong `reference` hoặc thông số thép dọc gia cường đầu cọc (N2, ØGC, L2)
 * hoàn toàn bị cô lập và không ảnh hưởng tới `input` hay `computed`.
 */
export function buildPileRecord(raw = {}) {
  const reference = deepFreeze({
    role: 'reference_only_never_used_in_solver',
    code: raw.reference?.code ?? raw.code ?? 'CUSTOM',
    manufacturer: raw.reference?.manufacturer ?? null,
    productStandard: raw.reference?.productStandard ?? 'TCVN 7888:2014',
    drawingNo: raw.reference?.drawingNo ?? null,
    drawingFile: raw.reference?.drawingFile ?? null,
    revision: raw.reference?.revision ?? null,
    issuedDate: raw.reference?.issuedDate ?? null,
    pileClass: raw.reference?.pileClass ?? null,
    publishedTbt_mm: raw.reference?.publishedTbt_mm ?? null,
    publishedMcr_kNm: raw.reference?.publishedMcr_kNm ?? null,
    publishedMu_kNm: raw.reference?.publishedMu_kNm ?? null,
    publishedInstallLoad_T: raw.reference?.publishedInstallLoad_T ?? null,
    nonPrestressedRebarNote: raw.reference?.nonPrestressedRebarNote ?? null,
  });

  const inp = raw.input ?? raw.templateInput ?? raw;
  const unitMode = inp.unitSystem === 'SI' ? 'SI' : 'display_mm_MPa';
  const geom = inp.geometry ?? inp;
  const conc = inp.concrete ?? {};
  const pc = inp.pcReinforcement ?? {};
  const sp = inp.spiralZones ?? {};

  const lenUnit = unitMode === 'SI' ? 'm' : 'mm';
  const stressUnit = unitMode === 'SI' ? 'Pa' : 'MPa';

  const Do = Number.isFinite(geom.Do_m) ? geom.Do_m : toSI(geom.Do ?? geom.Do_mm, lenUnit);
  const Dp = Number.isFinite(geom.Dp_m) ? geom.Dp_m : toSI(geom.Dp ?? geom.Dp_mm, lenUnit);
  const Di = Number.isFinite(geom.Di_m) ? geom.Di_m : toSI(geom.Di ?? geom.Di_mm, lenUnit);
  // L luôn tính bằng m khi truyền qua L_m, hoặc đổi theo lenUnit nếu truyền qua L
  const L = Number.isFinite(geom.L_m)
    ? geom.L_m
    : Number.isFinite(geom.L)
      ? toSI(geom.L, geom.L_unit || 'm')
      : NaN;

  const N1 = Number(pc.count_N1 ?? pc.N1);
  const d_pc = Number.isFinite(pc.diameter_m)
    ? pc.diameter_m
    : toSI(pc.diameter ?? pc.diameter_mm, lenUnit);
  const fpu = Number.isFinite(pc.fpu_Pa) ? pc.fpu_Pa : toSI(pc.fpu ?? pc.fpu_MPa, stressUnit);
  const fpy = Number.isFinite(pc.fpy_Pa) ? pc.fpy_Pa : toSI(pc.fpy ?? pc.fpy_MPa, stressUnit);
  const Ep = Number.isFinite(pc.Ep_Pa) ? pc.Ep_Pa : toSI(pc.Ep ?? pc.Ep_MPa ?? (unitMode === 'SI' ? 200e9 : 200000), stressUnit);

  const endZoneRaw = sp.endZone ?? {};
  const midZoneRaw = sp.midZone ?? {};
  const spiralEnd = {
    wireCount: Number(endZoneRaw.wireCount ?? 2),
    diameter: Number.isFinite(endZoneRaw.diameter_m)
      ? endZoneRaw.diameter_m
      : toSI(endZoneRaw.diameter ?? endZoneRaw.diameter_mm ?? 3, lenUnit),
    pitch: Number.isFinite(endZoneRaw.pitch_m)
      ? endZoneRaw.pitch_m
      : toSI(endZoneRaw.pitch ?? endZoneRaw.pitch_mm ?? 50, lenUnit),
  };
  const spiralMid = {
    wireCount: Number(midZoneRaw.wireCount ?? 1),
    diameter: Number.isFinite(midZoneRaw.diameter_m)
      ? midZoneRaw.diameter_m
      : toSI(midZoneRaw.diameter ?? midZoneRaw.diameter_mm ?? 3, lenUnit),
    pitch: Number.isFinite(midZoneRaw.pitch_m)
      ? midZoneRaw.pitch_m
      : toSI(midZoneRaw.pitch ?? midZoneRaw.pitch_mm ?? 100, lenUnit),
  };
  const Rswn = Number.isFinite(sp.Rswn_Pa) ? sp.Rswn_Pa : toSI(sp.Rswn ?? sp.Rswn_MPa ?? (unitMode === 'SI' ? 540e6 : 540), stressUnit);
  const Esw = Number.isFinite(sp.Esw_Pa) ? sp.Esw_Pa : toSI(sp.Esw ?? sp.Esw_MPa ?? (unitMode === 'SI' ? 200e9 : 200000), stressUnit);
  const endZoneLengthFactor_Do = Number(sp.endZoneLengthFactor_Do ?? 2);

  const rho = Number(conc.density_kg_m3 ?? conc.rho ?? 2500);
  const gradeB = conc.gradeB ? String(conc.gradeB).trim().toUpperCase() : null;

  // Kiểm tra thiếu dữ liệu bắt buộc
  const missingFields = [];
  if (!(Do > 0)) missingFields.push('geometry.Do');
  if (!(Dp > 0)) missingFields.push('geometry.Dp');
  if (!(Di > 0)) missingFields.push('geometry.Di');
  if (!(L > 0)) missingFields.push('geometry.L_m (chiều dài cọc L > 0 bắt buộc do người dùng nhập)');
  if (!gradeB) missingFields.push('concrete.gradeB (cấp độ bền chịu nén B theo TCVN 5574:2018)');
  if (!(rho > 0)) missingFields.push('concrete.density_kg_m3');
  if (!(Number.isInteger(N1) && N1 >= 3)) missingFields.push('pcReinforcement.count_N1');
  if (!(d_pc > 0)) missingFields.push('pcReinforcement.diameter');
  if (!(fpu > 0 && fpy > 0 && Ep > 0)) missingFields.push('pcReinforcement.(fpu, fpy, Ep)');
  if (!(spiralEnd.diameter > 0 && spiralEnd.pitch > 0 && spiralMid.diameter > 0 && spiralMid.pitch > 0)) {
    missingFields.push('spiralZones.(endZone, midZone)');
  }

  const normalizedInput = deepFreeze({
    unitSystem: 'SI',
    sourceUnitMode: unitMode,
    standardsConfig: {
      primaryStandard: 'TCVN',
      structuralStandard: 'TCVN 5574:2018',
      productReferenceStandard: 'TCVN 7888:2014',
      comparisonStandards: Array.isArray(raw.comparisonStandards) ? [...raw.comparisonStandards] : [],
      reportStandards: Array.isArray(raw.reportStandards) && raw.reportStandards.length ? [...raw.reportStandards] : ['TCVN'],
    },
    geometrySI: { Do, Dp, Di, L },
    concreteSI: {
      designStandard: 'TCVN 5574:2018',
      gradeB,
      density_kg_m3: rho,
      rhGroup: conc.rhGroup || '75',
      // Lưu kho: tải bản thân tác dụng dài hạn → γb1 = 0,9 (TCVN 5574:2018 Mục 6.1.2); ghi đè khi có cơ sở
      loadDuration: conc.loadDuration || 'long_term',
      gamma_b1: Number.isFinite(conc.gamma_b1) ? conc.gamma_b1 : null,
      cylinderStrength_MPa: conc.cylinderStrength_MPa ?? null,
    },
    pcReinforcementSI: {
      count_N1: N1,
      diameter_m: d_pc,
      fpu_Pa: fpu,
      fpy_Pa: fpy,
      Ep_Pa: Ep,
      gamma_sp: pc.gamma_sp ?? 1.2,
      // Phân loại thép DƯL quyết định giới hạn σsp và công thức chùng ứng suất (bắt buộc khi tính tổn hao)
      steelCategory: pc.steelCategory ?? null,
    },
    spiralZonesSI: {
      endZoneLengthFactor_Do,
      endZone: spiralEnd,
      midZone: spiralMid,
      Rswn_Pa: Rswn,
      Esw_Pa: Esw,
    },
    ignoredHeadRebarPolicy: {
      ignoreNonPrestressedHeadBars: true,
      note: 'Bỏ thép dọc gia cường đầu cọc (N2, ØGC, L2) trong tiết diện quy đổi, độ cứng, tổn hao và sức kháng.',
    },
  });

  if (missingFields.length > 0) {
    return deepFreeze({
      reference,
      input: normalizedInput,
      computed: null,
      validation: {
        valid: false,
        status: 'chưa đủ dữ liệu',
        missingFields,
        errors: [`Thiếu dữ liệu đầu vào bắt buộc: ${missingFields.join(', ')}`],
      },
    });
  }

  try {
    const concreteMat = resolveConcreteTCVN5574(normalizedInput.concreteSI);
    const steelMat = resolveSteelTCVN5574(normalizedInput.pcReinforcementSI, normalizedInput.spiralZonesSI);
    const section = computeSectionPropertiesSI({
      Do, Dp, Di, L,
      rho,
      N1, d_pc,
      Eb: concreteMat.Eb,
      Ep: steelMat.pcBar.Ep,
      spiralEnd,
      spiralMid,
      endZoneLengthFactor_Do,
      g: G_STANDARD,
    });

    const computed = deepFreeze({
      unitSystem: 'SI',
      readOnly: true,
      concrete: concreteMat,
      steel: steelMat,
      section,
    });

    return deepFreeze({
      reference,
      input: normalizedInput,
      computed,
      validation: {
        valid: true,
        status: 'hợp lệ',
        missingFields: [],
        errors: [],
      },
    });
  } catch (err) {
    return deepFreeze({
      reference,
      input: normalizedInput,
      computed: null,
      validation: {
        valid: false,
        status: 'dữ liệu không hợp lệ',
        missingFields: [],
        errors: [err.message],
      },
    });
  }
}

/**
 * Nghiệm giải tích đóng (Macaulay bracket) cho dầm một cọc dài L, độ cứng EI hằng số,
 * đặt trên hai gối điểm lý tưởng w(x1)=0, w(x2)=0 (0 <= x1 < x2 <= L),
 * chịu tải phân bố đều q (N/m, hướng xuống +) và các tải tập trung {(x, P)} (N, hướng xuống +).
 */
export function solveAnalyticalBeamTwoSupports({ L, EI, x1, x2, q = 0, pointLoads = [] }) {
  if (!(L > 0 && EI > 0)) throw new Error('L và EI phải > 0');
  if (!(x1 >= 0 && x2 > x1 && x2 <= L)) throw new Error('Vị trí hai gối phải thỏa 0 <= x1 < x2 <= L');

  const span = x2 - x1;
  let sumP = 0;
  let sumM1 = q * L * (L / 2 - x1);
  for (const p of pointLoads) {
    sumP += p.P;
    sumM1 += p.P * (p.x - x1);
  }
  const R2 = sumM1 / span;
  const R1 = q * L + sumP - R2;

  const pos = (u) => (u > 0 ? u : 0);

  // Hàm g(x) sao cho EI * w(x) = g(x) + C1 * x + C0
  function gVal(x) {
    let v = (q * (x ** 4)) / 24 - (R1 * (pos(x - x1) ** 3)) / 6 - (R2 * (pos(x - x2) ** 3)) / 6;
    for (const p of pointLoads) {
      v += (p.P * (pos(x - p.x) ** 3)) / 6;
    }
    return v;
  }

  const g1 = gVal(x1);
  const g2 = gVal(x2);
  const C1 = -(g2 - g1) / span;
  const C0 = -g1 - C1 * x1;

  function at(x, side = 'right') {
    const isAfter = (xc) => (side === 'left' ? x > xc + 1e-11 : x >= xc - 1e-11);
    let Q = -q * x;
    if (isAfter(x1)) Q += R1;
    if (isAfter(x2)) Q += R2;
    for (const p of pointLoads) {
      if (isAfter(p.x)) Q -= p.P;
    }

    let M = -0.5 * q * x * x + R1 * pos(x - x1) + R2 * pos(x - x2);
    for (const p of pointLoads) {
      M -= p.P * pos(x - p.x);
    }

    // Với quy ước +w hướng lên và +M căng thớ dưới (võng xuống): EI * w''(x) = +M(x) = -g''(x)
    const w = -(gVal(x) + C1 * x + C0) / EI;
    return { x, M, Q, w };
  }

  return { L, EI, x1, x2, q, pointLoads, R1, R2, C1, C0, at };
}

/**
 * BT00 — Chuẩn hóa cấu tạo cọc, phân vùng section(x), vật liệu và nguồn;
 * kiểm chứng độc lập hình học, đơn vị SI ↔ mm/MPa/kN và tính bất biến trước reference / N2-ØGC-L2.
 */
export function runBT00(rawConfig) {
  const rec = buildPileRecord(rawConfig);
  if (!rec.validation.valid) {
    return {
      code: 'BT00',
      valid: false,
      status: rec.validation.status,
      record: rec,
      errors: rec.validation.errors,
    };
  }

  const { Do, Dp, Di, L, t, Ag, Ab, Ap, Ared, Ig, Ired, Wg, Wred, EIg, EIred, selfWeightPerMeter, massPerMeter } =
    rec.computed.section;
  const { Eb, Rbn, Rb, Rbtn, Rbt } = rec.computed.concrete;
  const { Ep, fpu, fpy, Rs } = rec.computed.steel.pcBar;

  // Đối chứng 1: Công thức độc lập theo bán kính ngoài/trong ro, ri
  const ro = Do / 2, ri = Di / 2, rp = Dp / 2;
  const t_ref = ro - ri;
  const Ag_ref = Math.PI * (ro * ro - ri * ri);
  const Ig_ref = (Math.PI / 4) * (ro ** 4 - ri ** 4);
  const Ap_ref = rec.computed.section.N1 * Math.PI * ((rec.computed.section.d_pc / 2) ** 2);
  const alpha_ref = Ep / Eb;
  const Ared_ref = Ag_ref + (alpha_ref - 1) * Ap_ref;
  const Ired_ref = Ig_ref + 0.5 * (alpha_ref - 1) * Ap_ref * (rp ** 2);
  const q_ref = rec.computed.section.rho * G_STANDARD * Ag_ref;

  // Đối chứng 2: Tạo bản ghi thứ hai bằng hệ đơn vị mm–MPa và thay đổi dữ liệu reference + N2/ØGC/L2
  const mutatedRefRecord = buildPileRecord({
    reference: {
      ...rec.reference,
      publishedMcr_kNm: 999999,
      publishedMu_kNm: 888888,
      publishedInstallLoad_T: 777777,
      nonPrestressedRebarNote: { N2: 99, dGC_mm: 32, L2_mm: 5000 },
    },
    input: {
      unitSystem: 'display_mm_MPa',
      geometry: {
        Do_mm: fromSI(Do, 'mm'),
        Dp_mm: fromSI(Dp, 'mm'),
        Di_mm: fromSI(Di, 'mm'),
        L_m: L,
      },
      concrete: {
        gradeB: rec.input.concreteSI.gradeB,
        density_kg_m3: rec.input.concreteSI.density_kg_m3,
        rhGroup: rec.input.concreteSI.rhGroup,
        loadDuration: rec.input.concreteSI.loadDuration,
      },
      pcReinforcement: {
        steelCategory: rec.input.pcReinforcementSI.steelCategory,
        count_N1: rec.computed.section.N1,
        diameter_mm: fromSI(rec.computed.section.d_pc, 'mm'),
        fpu_MPa: fromSI(fpu, 'MPa'),
        fpy_MPa: fromSI(fpy, 'MPa'),
        Ep_MPa: fromSI(Ep, 'MPa'),
      },
      spiralZones: {
        endZoneLengthFactor_Do: rec.computed.section.endZoneLengthFactor_Do,
        endZone: {
          wireCount: rec.input.spiralZonesSI.endZone.wireCount,
          diameter_mm: fromSI(rec.input.spiralZonesSI.endZone.diameter, 'mm'),
          pitch_mm: fromSI(rec.input.spiralZonesSI.endZone.pitch, 'mm'),
        },
        midZone: {
          wireCount: rec.input.spiralZonesSI.midZone.wireCount,
          diameter_mm: fromSI(rec.input.spiralZonesSI.midZone.diameter, 'mm'),
          pitch_mm: fromSI(rec.input.spiralZonesSI.midZone.pitch, 'mm'),
        },
      },
    },
  });

  const relErr = (a, b) => Math.abs(a - b) / Math.max(Math.abs(b), 1e-30);
  const checks = [
    { name: 'Chiều dày thành t = (Do - Di)/2', computed: t, reference: t_ref, relError: relErr(t, t_ref), tol: 1e-14 },
    { name: 'Diện tích hình học Ag (m²)', computed: Ag, reference: Ag_ref, relError: relErr(Ag, Ag_ref), tol: 1e-14 },
    { name: 'Mômen quán tính hình học Ig (m⁴)', computed: Ig, reference: Ig_ref, relError: relErr(Ig, Ig_ref), tol: 1e-14 },
    { name: 'Diện tích quy đổi Ared (m²)', computed: Ared, reference: Ared_ref, relError: relErr(Ared, Ared_ref), tol: 1e-14 },
    { name: 'Mômen quán tính quy đổi Ired (m⁴)', computed: Ired, reference: Ired_ref, relError: relErr(Ired, Ired_ref), tol: 1e-14 },
    { name: 'Tự trọng đơn vị chiều dài q (N/m)', computed: selfWeightPerMeter, reference: q_ref, relError: relErr(selfWeightPerMeter, q_ref), tol: 1e-14 },
    {
      name: 'Bất biến khi đổi đơn vị mm–MPa ↔ SI và sửa reference / N2-ØGC-L2',
      computed: EIred,
      reference: mutatedRefRecord.computed.section.EIred,
      relError: relErr(EIred, mutatedRefRecord.computed.section.EIred),
      tol: 1e-13,
    },
  ];
  const allPassed = checks.every(c => c.relError <= c.tol);

  return {
    code: 'BT00',
    title: 'BT00: Chuẩn hóa cấu tạo cọc, phân vùng section(x), vật liệu TCVN 5574:2018 và hệ đơn vị SI',
    valid: true,
    verified: allPassed,
    record: rec,
    sectionZonesSample: {
      atLeftEnd: rec.computed.section.sectionAt(0.5 * rec.computed.section.L_end),
      atMidSpan: rec.computed.section.sectionAt(0.5 * L),
      atRightEnd: rec.computed.section.sectionAt(L - 0.5 * rec.computed.section.L_end),
    },
    summarySI: {
      Do, Dp, Di, t, L,
      Ag, Ab, Ap, Ared,
      Ig, Ired, Wg, Wred,
      Eb, Ep, Rbn, Rb, Rbtn, Rbt, fpu, fpy, Rs,
      EIg, EIred,
      massPerMeter,
      selfWeightPerMeter,
      totalSelfWeight: rec.computed.section.totalSelfWeight,
    },
    verification: {
      passed: allPassed,
      maxRelError: Math.max(...checks.map(c => c.relError)),
      checks,
    },
  };
}

/**
 * BT01 — Một cọc đặt trên hai gối (x1, x2), có hai đoạn hẫng, chỉ chịu tự trọng q tự tính từ BT00.
 * Giải bằng phần tử hữu hạn dầm Euler–Bernoulli (fem_solver.js) và đối chứng với nghiệm giải tích đóng.
 */
export function runBT01({ pileRecordOrConfig, x1_m, x2_m, useReducedSection = true, nElementsMin = 60 }) {
  const bt00 = pileRecordOrConfig?.code === 'BT00' ? pileRecordOrConfig : runBT00(pileRecordOrConfig);
  if (!bt00.valid) throw new Error(`BT00 chưa hợp lệ: ${(bt00.errors || []).join('; ')}`);

  const sec = bt00.record.computed.section;
  const L = sec.L;
  const x1 = Number(x1_m);
  const x2 = Number(x2_m);
  if (!(x1 >= 0 && x2 > x1 && x2 <= L)) {
    throw new Error(`Vị trí hai gối x1=${x1} m, x2=${x2} m phải thỏa 0 <= x1 < x2 <= L (${L} m)`);
  }

  const EI = useReducedSection ? sec.EIred : sec.EIg;
  const q = sec.selfWeightPerMeter;

  const fem = solveBeam({
    L,
    EI,
    supports: [x1, x2],
    distributed: [{ x0: 0, x1: L, q, label: 'Tự trọng cọc q' }],
    extraNodes: [sec.L_end, L - sec.L_end, (x1 + x2) / 2, L / 2],
    maxElementLength: L / nElementsMin,
  });

  const ana = solveAnalyticalBeamTwoSupports({ L, EI, x1, x2, q, pointLoads: [] });

  const xMid = (x1 + x2) / 2;
  // Tọa độ có Q = 0 trong nhịp [x1, x2]: Q(x) = -q*x + R1 = 0 => x_Mmax = R1 / q
  const xZeroShear = Math.min(x2, Math.max(x1, ana.R1 / q));

  const samplePoints = [
    { label: 'Đầu mút trái x = 0', x: 0, side: 'right' },
    { label: 'Trái gối 1 (x1⁻)', x: x1, side: 'left' },
    { label: 'Phải gối 1 (x1⁺)', x: x1, side: 'right' },
    { label: 'Giữa nhịp hai gối (x1+x2)/2', x: xMid, side: 'right' },
    { label: 'Điểm cực trị nhịp Q=0', x: xZeroShear, side: 'right' },
    { label: 'Trái gối 2 (x2⁻)', x: x2, side: 'left' },
    { label: 'Phải gối 2 (x2⁺)', x: x2, side: 'right' },
    { label: 'Đầu mút phải x = L', x: L, side: 'left' },
  ];

  const comparisonRows = samplePoints.map(pt => {
    const f = fem.at(pt.x, pt.side);
    const a = ana.at(pt.x, pt.side);
    return {
      label: pt.label,
      x_m: pt.x,
      M_fem_Nm: f.M,
      M_ana_Nm: a.M,
      errM_Nm: Math.abs(f.M - a.M),
      Q_fem_N: f.Q,
      Q_ana_N: a.Q,
      errQ_N: Math.abs(f.Q - a.Q),
      w_fem_m: f.w,
      w_ana_m: a.w,
      errW_m: Math.abs(f.w - a.w),
    };
  });

  const M_scale = Math.max(q * L * L, 1);
  const Q_scale = Math.max(q * L, 1);
  const w_scale = Math.max((q * (L ** 4)) / EI, 1e-12);

  const relErrR1 = Math.abs(fem.reactions[0].R - ana.R1) / Q_scale;
  const relErrR2 = Math.abs(fem.reactions[1].R - ana.R2) / Q_scale;
  const maxRelErrM = Math.max(...comparisonRows.map(r => r.errM_Nm / M_scale));
  const maxRelErrQ = Math.max(...comparisonRows.map(r => r.errQ_N / Q_scale));
  const maxRelErrW = Math.max(...comparisonRows.map(r => r.errW_m / w_scale));

  const isSymmetric = Math.abs(x1 - (L - x2)) <= 1e-9;
  const symReactionDiff = isSymmetric ? Math.abs(fem.reactions[0].R - fem.reactions[1].R) / Q_scale : 0;

  const tol = 1e-10;
  const passed =
    relErrR1 <= tol &&
    relErrR2 <= tol &&
    maxRelErrM <= tol &&
    maxRelErrQ <= tol &&
    maxRelErrW <= tol &&
    fem.equilibrium.relForce <= tol &&
    fem.equilibrium.relMoment <= tol &&
    symReactionDiff <= tol;

  const diagram = fem.diagram(6);
  let maxSagMoment = -Infinity, minHogMoment = Infinity, maxAbsShear = 0, maxAbsDeflection = 0;
  for (const d of diagram) {
    if (d.M > maxSagMoment) maxSagMoment = d.M;
    if (d.M < minHogMoment) minHogMoment = d.M;
    if (Math.abs(d.Q) > maxAbsShear) maxAbsShear = Math.abs(d.Q);
    if (Math.abs(d.w) > maxAbsDeflection) maxAbsDeflection = Math.abs(d.w);
  }

  return {
    code: 'BT01',
    title: 'BT01: Một cọc đặt trên hai gối, có hai đoạn hẫng, chỉ chịu tự trọng',
    valid: true,
    verified: passed,
    bt00,
    inputsSI: { L, x1, x2, span: x2 - x1, leftOverhang: x1, rightOverhang: L - x2, EI, q, useReducedSection },
    reactionsSI: {
      R1_fem: fem.reactions[0].R,
      R2_fem: fem.reactions[1].R,
      R1_ana: ana.R1,
      R2_ana: ana.R2,
    },
    extremaSI: {
      M_hog_left_Nm: fem.at(x1, 'left').M,
      M_hog_right_Nm: fem.at(x2, 'right').M,
      M_midspan_Nm: fem.at(xMid, 'right').M,
      M_max_sag_Nm: maxSagMoment,
      M_min_hog_Nm: minHogMoment,
      Q_max_abs_N: maxAbsShear,
      w_midspan_m: fem.at(xMid, 'right').w,
      w_leftTip_m: fem.at(0, 'right').w,
      w_rightTip_m: fem.at(L, 'left').w,
      w_max_abs_m: maxAbsDeflection,
    },
    equilibrium: fem.equilibrium,
    diagram,
    comparisonRows,
    verification: {
      passed,
      tol,
      relErrR1,
      relErrR2,
      maxRelErrM,
      maxRelErrQ,
      maxRelErrW,
      isSymmetric,
      symReactionDiff,
    },
  };
}

/**
 * BT02 — Một cọc nhận thêm tải tập trung từ tầng trên (P1 tại xP1 = x1 + e1, P2 tại xP2 = x2 + e2).
 * Kiểm chứng:
 * 1) Khi đặt đúng gối lý tưởng (e1 = 0, e2 = 0): chỉ tăng phản lực R1 += P1, R2 += P2;
 *    nội lực M(x), Q(x) và độ võng w(x) dọc thân cọc GIỮ NGUYÊN bằng BT01 (không sinh mômen giả).
 * 2) Khi lệch gối (e1 != 0 hoặc e2 != 0): khớp tuyệt đối nghiệm giải tích Macaulay bracket & nguyên lý cộng tác dụng.
 * 3) Tính độc lập của hai tuyến kê (lệch riêng tuyến 1 hoặc tuyến 2).
 */
export function runBT02({
  pileRecordOrConfig,
  x1_m,
  x2_m,
  P1_N = 0,
  P2_N = 0,
  e1_m = 0,
  e2_m = 0,
  useReducedSection = true,
  nElementsMin = 60,
}) {
  const bt01 = runBT01({ pileRecordOrConfig, x1_m, x2_m, useReducedSection, nElementsMin });
  const { L, x1, x2, EI, q } = bt01.inputsSI;
  const sec = bt01.bt00.record.computed.section;

  const xP1 = x1 + Number(e1_m);
  const xP2 = x2 + Number(e2_m);
  if (xP1 < 0 || xP1 > L || xP2 < 0 || xP2 > L) {
    throw new Error(`Vị trí đặt tải tập trung xP1=${xP1} m, xP2=${xP2} m nằm ngoài chiều dài cọc [0, ${L}] m`);
  }

  const pointLoads = [];
  if (Math.abs(P1_N) > 0) pointLoads.push({ x: xP1, P: Number(P1_N), label: 'P1 (tuyến kê 1)' });
  if (Math.abs(P2_N) > 0) pointLoads.push({ x: xP2, P: Number(P2_N), label: 'P2 (tuyến kê 2)' });

  const fem = solveBeam({
    L,
    EI,
    supports: [x1, x2],
    distributed: [{ x0: 0, x1: L, q, label: 'Tự trọng cọc q' }],
    point: pointLoads,
    extraNodes: [sec.L_end, L - sec.L_end, (x1 + x2) / 2, L / 2],
    maxElementLength: L / nElementsMin,
  });

  const ana = solveAnalyticalBeamTwoSupports({ L, EI, x1, x2, q, pointLoads });

  // Bài toán con đặt đúng gối (e1=0, e2=0) với cùng P1, P2 để đối chứng không sinh mômen giả
  const femExactOnSupports = solveBeam({
    L,
    EI,
    supports: [x1, x2],
    distributed: [{ x0: 0, x1: L, q, label: 'Tự trọng cọc q' }],
    point: [
      ...(Math.abs(P1_N) > 0 ? [{ x: x1, P: Number(P1_N) }] : []),
      ...(Math.abs(P2_N) > 0 ? [{ x: x2, P: Number(P2_N) }] : []),
    ],
    extraNodes: [sec.L_end, L - sec.L_end, (x1 + x2) / 2, L / 2],
    maxElementLength: L / nElementsMin,
  });

  const F_scale = Math.max(q * L + Math.abs(P1_N) + Math.abs(P2_N), 1);
  const M_scale = Math.max(F_scale * L, 1);
  const w_scale = Math.max((F_scale * (L ** 3)) / EI, 1e-12);

  // Kiểm tra trường hợp đặt đúng gối (zero-eccentricity): M(x) và w(x) phải trùng hệt BT01!
  const testXs = [0, 0.5 * x1, x1, x1 + 0.25 * (x2 - x1), 0.5 * (x1 + x2), x1 + 0.75 * (x2 - x1), x2, 0.5 * (x2 + L), L];
  let maxZeroEccMomentDiff = 0;
  let maxZeroEccDeflectionDiff = 0;
  for (const tx of testXs) {
    const f0 = femExactOnSupports.at(tx, 'right');
    const fSelf = bt01.bt00 ? solveAnalyticalBeamTwoSupports({ L, EI, x1, x2, q, pointLoads: [] }).at(tx, 'right') : null;
    maxZeroEccMomentDiff = Math.max(maxZeroEccMomentDiff, Math.abs(f0.M - fSelf.M));
    maxZeroEccDeflectionDiff = Math.max(maxZeroEccDeflectionDiff, Math.abs(f0.w - fSelf.w));
  }
  const zeroEccR1Diff = Math.abs(femExactOnSupports.reactions[0].R - (bt01.reactionsSI.R1_ana + P1_N));
  const zeroEccR2Diff = Math.abs(femExactOnSupports.reactions[1].R - (bt01.reactionsSI.R2_ana + P2_N));

  // Đối chứng FEM vs Giải tích ở trạng thái lệch gối hiện tại (e1, e2)
  const checkCoords = Array.from(new Set([0, x1, xP1, 0.5 * (x1 + x2), xP2, x2, L])).sort((a, b) => a - b);
  const comparisonRows = [];
  for (const xc of checkCoords) {
    for (const side of ['left', 'right']) {
      const f = fem.at(xc, side);
      const a = ana.at(xc, side);
      comparisonRows.push({
        x_m: xc,
        side,
        M_fem_Nm: f.M,
        M_ana_Nm: a.M,
        errM_Nm: Math.abs(f.M - a.M),
        Q_fem_N: f.Q,
        Q_ana_N: a.Q,
        errQ_N: Math.abs(f.Q - a.Q),
        w_fem_m: f.w,
        w_ana_m: a.w,
        errW_m: Math.abs(f.w - a.w),
      });
    }
  }

  const relErrR1 = Math.abs(fem.reactions[0].R - ana.R1) / F_scale;
  const relErrR2 = Math.abs(fem.reactions[1].R - ana.R2) / F_scale;
  const maxRelErrM = Math.max(...comparisonRows.map(r => r.errM_Nm / M_scale));
  const maxRelErrQ = Math.max(...comparisonRows.map(r => r.errQ_N / F_scale));
  const maxRelErrW = Math.max(...comparisonRows.map(r => r.errW_m / w_scale));

  const tol = 1e-10;
  const passed =
    relErrR1 <= tol &&
    relErrR2 <= tol &&
    maxRelErrM <= tol &&
    maxRelErrQ <= tol &&
    maxRelErrW <= tol &&
    maxZeroEccMomentDiff / M_scale <= tol &&
    maxZeroEccDeflectionDiff / w_scale <= tol &&
    zeroEccR1Diff / F_scale <= tol &&
    zeroEccR2Diff / F_scale <= tol &&
    fem.equilibrium.relForce <= tol &&
    fem.equilibrium.relMoment <= tol;

  const diagram = fem.diagram(6);
  let maxSagMoment = -Infinity, minHogMoment = Infinity, maxAbsShear = 0, maxAbsDeflection = 0;
  for (const d of diagram) {
    if (d.M > maxSagMoment) maxSagMoment = d.M;
    if (d.M < minHogMoment) minHogMoment = d.M;
    if (Math.abs(d.Q) > maxAbsShear) maxAbsShear = Math.abs(d.Q);
    if (Math.abs(d.w) > maxAbsDeflection) maxAbsDeflection = Math.abs(d.w);
  }

  return {
    code: 'BT02',
    title: 'BT02: Một cọc nhận tải tập trung từ tầng trên, đặt đúng gối và lệch gối',
    valid: true,
    verified: passed,
    bt00: bt01.bt00,
    bt01,
    inputsSI: {
      L, x1, x2, EI, q,
      P1: Number(P1_N), P2: Number(P2_N),
      e1: Number(e1_m), e2: Number(e2_m),
      xP1, xP2,
    },
    reactionsSI: {
      R1_fem: fem.reactions[0].R,
      R2_fem: fem.reactions[1].R,
      R1_ana: ana.R1,
      R2_ana: ana.R2,
      deltaR1_fromSelfWeight: fem.reactions[0].R - bt01.reactionsSI.R1_fem,
      deltaR2_fromSelfWeight: fem.reactions[1].R - bt01.reactionsSI.R2_fem,
    },
    extremaSI: {
      M_at_x1_Nm: fem.at(x1, 'right').M,
      M_at_x2_Nm: fem.at(x2, 'left').M,
      M_at_xP1_Nm: fem.at(xP1, 'right').M,
      M_at_xP2_Nm: fem.at(xP2, 'left').M,
      M_max_sag_Nm: maxSagMoment,
      M_min_hog_Nm: minHogMoment,
      deltaM_max_abs_vs_BT01_Nm: Math.max(
        Math.abs(maxSagMoment - bt01.extremaSI.M_max_sag_Nm),
        Math.abs(minHogMoment - bt01.extremaSI.M_min_hog_Nm)
      ),
      Q_max_abs_N: maxAbsShear,
      w_max_abs_m: maxAbsDeflection,
    },
    zeroEccentricityCheck: {
      R1_exactOnSupport_N: femExactOnSupports.reactions[0].R,
      R2_exactOnSupport_N: femExactOnSupports.reactions[1].R,
      zeroEccR1Diff_N: zeroEccR1Diff,
      zeroEccR2Diff_N: zeroEccR2Diff,
      maxZeroEccMomentDiff_Nm: maxZeroEccMomentDiff,
      maxZeroEccDeflectionDiff_m: maxZeroEccDeflectionDiff,
      noSpuriousMomentConfirmed: maxZeroEccMomentDiff / M_scale <= tol,
    },
    equilibrium: fem.equilibrium,
    diagram,
    comparisonRows,
    verification: {
      passed,
      tol,
      relErrR1,
      relErrR2,
      maxRelErrM,
      maxRelErrQ,
      maxRelErrW,
    },
  };
}
