/**
 * stacking_model.js — Mô hình hệ xếp cọc nhiều tầng cho cả 3 sơ đồ bắt buộc (Mốc M3 & M4):
 * - BT10: S2 kê thẳng hàng nhiều tầng (solveS2Stack)
 * - BT11: S2 có lệch kê theo 2 định nghĩa dung sai & 5 kịch bản (solveS2Stack)
 * - BT09: S1 xếp tam giác tỳ trực tiếp — cân bằng 2D nghiêng 30° + tiếp xúc một phía dọc thân trục x
 *         + uốn xiên 2 phương, kiểm tra MỌI hàng cọc (solveS1Stack)
 * - BT12: S3 hỗn hợp ghép các khối qua thanh kê gỗ cứng 100×100 mm trung gian (solveS3Stack),
 *         tải khối trên đi vào hàng đỉnh khối dưới và truyền qua tiếp xúc dọc thân.
 *
 * Tất cả đều tuân thủ Plan v0.5.0:
 * - Lõi tính thuần SI (m, kg, s, N, Pa), ưu tiên TCVN 5574:2018.
 * - Thanh kê gỗ 100 × 100 mm tuyệt đối cứng, nền kho cứng không lún, biên ngang lý tưởng.
 * - Không kiểm tra gỗ/chèn/nền kho; cơ chế giới hạn chỉ đến từ khả năng chịu lực của cọc.
 * - Lực truyền giữa các bộ phận là giá trị tiêu chuẩn; hệ số γf áp dụng trong từng bài kiểm tra TTGH I.
 * - Uốn vòng (BT05) lấy hệ lực hướng kính thực tế tại mặt cắt; phần không tự cân bằng truyền vào thân cọc
 *   bằng dòng cắt — không dùng hệ số kinh nghiệm.
 */
import { solveBeam } from '../../core/fem_solver.js';
import { solveStackedLineContact } from '../../core/contact_solver.js';
import { runBT02 } from './pile_specs.js';
import { runBT03 } from './section_checker.js';
import { runBT04, runBT05 } from './contact_checker.js';
import { TCVN5574 } from './standards/tcvn5574_factors.js';

const BATTEN_WIDTH_M = 0.1;                 // thanh kê gỗ 100 × 100 mm
const CONTACT_ANGLE_RAD = Math.PI / 6;      // lưới tam giác đều: tiếp xúc nghiêng 30° so với phương đứng
const DEFAULT_CONTACT_STIFFNESS = 5e9;      // N/m² — độ cứng phạt tiếp xúc dọc thân
const STIFFNESS_SENSITIVITY_FACTORS = [0.1, 10];
const STIFFNESS_SENSITIVITY_TOL = 0.05;
const LINE_CONTACT_ELEMENTS = 20;

function requireContactAngle(contactArcAngle_deg) {
  if (!Number.isFinite(Number(contactArcAngle_deg))) {
    throw new Error('Thiếu góc ôm tiếp xúc cọc–kê contactArcAngle_deg (độ); không tự gán giá trị mặc định.');
  }
  return Number(contactArcAngle_deg);
}

function governingOf(utilMap) {
  return Object.entries(utilMap)
    .filter(([, v]) => Number.isFinite(v))
    .reduce((b, c) => (c[1] > b[1] ? c : b), ['—', 0]);
}

function sliceWidthAtBatten(sec) {
  return Math.min(sec.L, BATTEN_WIDTH_M + 4 * sec.t);
}

/** Lực cắt lớn nhất theo vùng đai (đầu cọc / thân giữa) từ biểu đồ {x, Q}. */
function zoneShearMaxima(diagram, sec) {
  let end = 0, mid = 0;
  for (const pt of diagram) {
    const isEnd = pt.x <= sec.L_end + 1e-6 || pt.x >= sec.L - sec.L_end - 1e-6;
    if (isEnd) end = Math.max(end, Math.abs(pt.Q));
    else mid = Math.max(mid, Math.abs(pt.Q));
  }
  return { end, mid };
}

/**
 * Kiểm tra phía cọc tại một vị trí thanh kê: nén cục bộ (BT04) và uốn vòng (BT05).
 * radialLoads là hệ lực hướng kính tiêu chuẩn trên dải b_eff; phản lực kê R_bottom_N đặt tại θ = π.
 */
function checkPileAtBatten({ bt00, x_m, R_bottom_N, otherRadialLoads = [], contactArcAngle_deg }) {
  const sec = bt00.record.computed.section;
  const bt04 = runBT04({
    bt00,
    normalForce_N: Math.abs(R_bottom_N),
    contactType: 'pile_batten',
    contactLengthAlongPile_m: BATTEN_WIDTH_M,
    contactArcAngle_deg,
  });
  const bt05 = runBT05({
    bt00,
    x_m,
    radialLoads: [{ theta_rad: Math.PI, P_N: Math.abs(R_bottom_N), label: 'Phản lực kê 180°' }, ...otherRadialLoads],
    sliceWidth_m: sliceWidthAtBatten(sec),
  });
  return { bt04, bt05 };
}

function worseOf(a, b, pick) {
  return pick(a) >= pick(b) ? a : b;
}

/**
 * Sinh tọa độ các mặt kê [layer 0 (đáy), ..., layer n-1 (đỉnh)] cho S2 từ kịch bản lệch kê.
 * Phân biệt rõ 2 định nghĩa mốc sai lệch (Plan Mục 4.1):
 * - 'global_axis': lệch so với trục chuẩn chung (x1_nom, x2_nom)
 * - 'adjacent_layers': lệch tương đối giữa hai mặt kê liên tiếp (cộng dồn theo chiều cao)
 */
export function buildS2SupportOffsets({
  nLayers,
  x1_nom_m,
  x2_nom_m,
  eccentricity_m = 0,
  scenario = 'alternating', // 'zero' | 'single_layer' | 'same_direction' | 'alternating' | 'independent_lines' | 'cumulative'
  toleranceMode = 'global_axis',
  e1_override_m = null,
  e2_override_m = null,
  targetLayer = 1,
}) {
  const e = Number(eccentricity_m);
  const e1Val = e1_override_m !== null ? Number(e1_override_m) : e;
  const e2Val = e2_override_m !== null ? Number(e2_override_m) : e;

  const x1 = new Array(nLayers).fill(x1_nom_m);
  const x2 = new Array(nLayers).fill(x2_nom_m);

  if (scenario === 'zero' || (Math.abs(e1Val) < 1e-12 && Math.abs(e2Val) < 1e-12)) {
    return { x1, x2, scenario: 'zero', toleranceMode };
  }

  if (toleranceMode === 'adjacent_layers' || scenario === 'cumulative') {
    for (let k = 1; k < nLayers; k++) {
      x1[k] = x1[k - 1] + e1Val;
      x2[k] = x2[k - 1] + e2Val;
    }
    return { x1, x2, scenario, toleranceMode };
  }

  for (let k = 1; k < nLayers; k++) {
    if (scenario === 'single_layer') {
      if (k === Math.min(targetLayer, nLayers - 1)) {
        x1[k] = x1_nom_m + e1Val;
        x2[k] = x2_nom_m + e2Val;
      }
    } else if (scenario === 'same_direction') {
      x1[k] = x1_nom_m + e1Val;
      x2[k] = x2_nom_m + e2Val;
    } else if (scenario === 'independent_lines') {
      x1[k] = x1_nom_m + (k % 2 === 1 ? e1Val : 0);
      x2[k] = x2_nom_m + (k % 2 === 1 ? (e2_override_m !== null ? e2Val : 0) : 0);
    } else {
      // 'alternating' (lệch xen kẽ: tầng lẻ dịch vào trong +e / -e, tầng chẵn giữ trục chuẩn)
      const sign = k % 2 === 1 ? 1 : 0;
      x1[k] = x1_nom_m + sign * e1Val;
      x2[k] = x2_nom_m - sign * e2Val;
    }
  }
  return { x1, x2, scenario, toleranceMode };
}

/**
 * Kiểm tra một cọc đơn tựa 2 thanh kê (x1, x2), nhận tải từ thanh kê phía trên tại (xP1, xP2):
 * dầm BT02 → BT03 dọc cọc; BT04 + BT05 tại từng vị trí kê (tải kê trên chỉ tính vào dải b_eff khi nằm trong dải).
 */
function checkSinglePileOnBattens({ bt00, x1, x2, P1_above, P2_above, xP1, xP2, processInput, contactArcAngle_deg }) {
  const sec = bt00.record.computed.section;
  const bt02 = runBT02({
    pileRecordOrConfig: bt00,
    x1_m: x1,
    x2_m: x2,
    P1_N: P1_above,
    P2_N: P2_above,
    e1_m: xP1 - x1,
    e2_m: xP2 - x2,
  });
  const bt03 = runBT03({ bt00OrConfig: bt00, processInput, beamResult: bt02 });

  const halfSlice = 0.5 * sliceWidthAtBatten(sec);
  const atSupport = (xs, R, Ptop, xTop) =>
    checkPileAtBatten({
      bt00,
      x_m: xs,
      R_bottom_N: R,
      otherRadialLoads:
        Ptop > 0 && Math.abs(xTop - xs) <= halfSlice
          ? [{ theta_rad: 0, P_N: Ptop, label: 'Tải kê trên 0° (trong dải b_eff)' }]
          : [],
      contactArcAngle_deg,
    });
  const c1 = atSupport(x1, bt02.reactionsSI.R1_fem, P1_above, xP1);
  const c2 = atSupport(x2, bt02.reactionsSI.R2_fem, P2_above, xP2);
  const bt04 = worseOf(c1.bt04, c2.bt04, r => r.capacitySI.utilization);
  const bt05 = worseOf(c1.bt05, c2.bt05, r => Math.max(r.capacitiesSI.utilizationCrack, r.capacitiesSI.utilizationULS));
  return { bt02, bt03, bt04, bt05 };
}

/**
 * BT10 & BT11 — Giải hệ S2 nhiều tầng (kê thẳng hàng khi mọi lệch = 0, hoặc có lệch kê).
 *
 * Truyền tải chính xác từ đỉnh (tầng n-1) xuống đáy (tầng 0):
 * - Cọc tầng k tựa trên mặt kê k tại (x1[k], x2[k]).
 * - Nhận 2 phản lực tập trung (R1[k+1], R2[k+1]) từ tầng k+1 đặt tại (x1[k+1], x2[k+1]).
 */
export function solveS2Stack({
  bt00,
  nLayers = 3,
  pilesPerLayer = 5,
  x1_nom_m,
  x2_nom_m,
  supportX1_perLayer = null,
  supportX2_perLayer = null,
  eccentricity_m = 0,
  scenario = 'zero',
  toleranceMode = 'global_axis',
  e1_override_m = null,
  e2_override_m = null,
  processInput = {},
  contactArcAngle_deg,
}) {
  if (!bt00 || !bt00.valid) throw new Error('solveS2Stack yêu cầu BT00 hợp lệ');
  if (!(Number.isInteger(nLayers) && nLayers >= 1)) throw new Error('Số tầng nLayers phải >= 1');
  const thetaC = requireContactAngle(contactArcAngle_deg);

  const sec = bt00.record.computed.section;
  const L = sec.L;
  const x1Nom = Number.isFinite(x1_nom_m) ? x1_nom_m : ((Math.sqrt(2) - 1) / 2) * L;
  const x2Nom = Number.isFinite(x2_nom_m) ? x2_nom_m : L - x1Nom;

  let x1Arr, x2Arr;
  if (Array.isArray(supportX1_perLayer) && Array.isArray(supportX2_perLayer)) {
    x1Arr = supportX1_perLayer.map(Number);
    x2Arr = supportX2_perLayer.map(Number);
  } else {
    const built = buildS2SupportOffsets({
      nLayers, x1_nom_m: x1Nom, x2_nom_m: x2Nom, eccentricity_m, scenario, toleranceMode, e1_override_m, e2_override_m,
    });
    x1Arr = built.x1;
    x2Arr = built.x2;
  }

  for (let k = 0; k < nLayers; k++) {
    if (!(x1Arr[k] >= 0.05 && x2Arr[k] > x1Arr[k] + 0.1 && x2Arr[k] <= L - 0.05)) {
      return {
        scheme: 'S2',
        code: scenario === 'zero' ? 'BT10' : 'BT11',
        valid: false,
        converged: false,
        structuralPass: false,
        status: 'hình học đặt kê ngoài phạm vi cọc',
        reason: `Mặt kê tầng ${k + 1}: x1=${x1Arr[k].toFixed(3)}m, x2=${x2Arr[k].toFixed(3)}m nằm ngoài giới hạn hợp lệ [0.05, ${(L - 0.05).toFixed(3)}] m`,
      };
    }
  }

  const layers = new Array(nLayers);
  let P1_above = 0;
  let P2_above = 0;
  let xP1_above = x1Arr[nLayers - 1];
  let xP2_above = x2Arr[nLayers - 1];

  for (let k = nLayers - 1; k >= 0; k--) {
    const x1k = x1Arr[k];
    const x2k = x2Arr[k];
    const chk = checkSinglePileOnBattens({
      bt00, x1: x1k, x2: x2k, P1_above, P2_above, xP1: xP1_above, xP2: xP2_above, processInput, contactArcAngle_deg: thetaC,
    });
    const { bt02, bt03, bt04, bt05 } = chk;

    const utilMap = {
      ...bt03.utilization,
      contactLocal: bt04.capacitySI.utilization,
      ringCrack: bt05.capacitiesSI.utilizationCrack,
      ringULS: bt05.capacitiesSI.utilizationULS,
    };
    const gov = governingOf(utilMap);
    const layerPass = gov[1] <= 1.0 && bt03.validityDomain.ok;

    layers[k] = {
      layerIndex: k + 1, // 1 = đáy, nLayers = đỉnh
      x1_m: x1k,
      x2_m: x2k,
      P1_above_N: P1_above,
      P2_above_N: P2_above,
      e1_m: k === nLayers - 1 ? 0 : xP1_above - x1k,
      e2_m: k === nLayers - 1 ? 0 : xP2_above - x2k,
      R1_N: bt02.reactionsSI.R1_fem,
      R2_N: bt02.reactionsSI.R2_fem,
      M_max_sag_Nm: bt02.extremaSI.M_max_sag_Nm,
      M_min_hog_Nm: bt02.extremaSI.M_min_hog_Nm,
      Q_max_abs_N: bt02.extremaSI.Q_max_abs_N,
      w_max_abs_m: bt02.extremaSI.w_max_abs_m,
      bt02,
      bt03,
      bt04,
      bt05,
      utilization: utilMap,
      governingMechanism: bt03.validityDomain.ok ? gov[0] : bt03.governingMechanism,
      maxUtilization: gov[1],
      pass: layerPass,
    };

    P1_above = bt02.reactionsSI.R1_fem;
    P2_above = bt02.reactionsSI.R2_fem;
    xP1_above = x1k;
    xP2_above = x2k;
  }

  const govLayer = layers.reduce((b, c) => (c.maxUtilization > b.maxUtilization ? c : b));
  const totalPiles = nLayers * pilesPerLayer;
  const totalSystemWeight_N = totalPiles * sec.totalSelfWeight;
  const totalGroundReaction_N = pilesPerLayer * (layers[0].R1_N + layers[0].R2_N);
  const relEquilibriumErr = Math.abs(totalGroundReaction_N - totalSystemWeight_N) / Math.max(totalSystemWeight_N, 1);

  const crossSectionPiles = [];
  for (let k = 0; k < nLayers; k++) {
    const zCenter = BATTEN_WIDTH_M + sec.Do / 2 + k * (sec.Do + BATTEN_WIDTH_M);
    for (let j = 0; j < pilesPerLayer; j++) {
      crossSectionPiles.push({ layer: k + 1, col: j + 1, y_m: sec.Do / 2 + j * sec.Do, z_m: zCenter, U: layers[k].maxUtilization });
    }
  }

  return {
    scheme: 'S2',
    code: scenario === 'zero' && Math.abs(eccentricity_m) < 1e-12 ? 'BT10' : 'BT11',
    valid: true,
    converged: true,
    verified:
      relEquilibriumErr < 1e-10 &&
      layers.every(l => l.bt02.verified && l.bt03.verified && l.bt05.verified),
    nLayers,
    pilesPerLayer,
    totalPiles,
    scenario,
    toleranceMode,
    eccentricity_m,
    supportX1_perLayer: x1Arr,
    supportX2_perLayer: x2Arr,
    layers,
    governingLayerIndex: govLayer.layerIndex,
    governingMechanism: govLayer.governingMechanism,
    maxUtilization: govLayer.maxUtilization,
    structuralPass: layers.every(l => l.pass),
    equilibriumSI: { totalSystemWeight_N, totalGroundReaction_N, relEquilibriumErr },
    crossSectionPiles,
    prestressRef: layers[0].bt03.prestress,
  };
}

/**
 * Lực đẩy ngang trên hàng đáy của khối xếp tam giác: các cọc hàng đáy tì cạnh nhau (tiếp xúc chỉ chịu nén S_j ≥ 0)
 * và hai biên ngang lý tưởng ở hai cọc biên. Cân bằng ngang cọc j: S_{j-1} + H_j − S_j = 0 (S_{-1} = R_trái).
 * Chọn R_trái nhỏ nhất để mọi S_j ≥ 0 (tiếp xúc giữa đống mở trước) ⇒ lực đẩy cộng dồn về biên.
 */
export function solveBottomRowThrust(H_net) {
  const m = H_net.length;
  let prefix = 0;
  let minPrefix = 0;
  for (let j = 0; j < m - 1; j++) {
    prefix += H_net[j];
    minPrefix = Math.min(minPrefix, prefix);
  }
  const R_left = Math.max(0, -minPrefix);
  const sideContacts = [];
  let S = R_left;
  for (let j = 0; j < m - 1; j++) {
    S += H_net[j];
    sideContacts.push(Math.max(0, S));
  }
  const R_right = R_left + H_net.reduce((a, b) => a + b, 0);
  return { R_left_N: R_left, R_right_N: R_right, sideContacts_N: sideContacts };
}

/**
 * Khối xếp tam giác (dùng cho S1 và các khối ≥ 2 tầng của S3).
 *
 * 1) Cân bằng lưới tiếp xúc tam giác 2D (30°): lực tiếp xúc nghiêng, tổng lực đứng từng cọc;
 *    lực đẩy ngang hàng đáy cộng dồn qua tiếp xúc cạnh nhau về biên lý tưởng (solveBottomRowThrust).
 * 2) Cột đại diện (trường trung bình theo hàng, chuẩn hóa về cọc đáy chịu lực đứng lớn nhất) giải tiếp xúc một phía
 *    dọc thân trục x; tải khối trên (nếu có) đặt tại vị trí thanh kê trung gian trên hàng đỉnh.
 * 3) Kiểm tra từng hàng: BT03 (cọc đáy gồm uốn xiên 2 phương), BT05 vòng theo tải đường, BT04 cọc–cọc;
 *    hàng đáy kiểm tra thêm BT04/BT05 tại thanh kê cho cọc giữa và cọc biên (có lực chèn biên).
 */
function solveTriangularBlock({
  bt00,
  nRows,
  mBase,
  x1,
  x2,
  topLoadsPerTopPile = [], // [{ x_m, P_N }] tải tập trung trên mỗi cọc hàng đỉnh (giá trị tiêu chuẩn)
  processInput,
  contactArcAngle_deg,
  contactStiffnessPerMeter = DEFAULT_CONTACT_STIFFNESS,
  runStiffnessSensitivity = true,
}) {
  const sec = bt00.record.computed.section;
  const L = sec.L;
  const W_pile = sec.totalSelfWeight;
  const q_pile = sec.selfWeightPerMeter;
  const cosA = Math.cos(CONTACT_ANGLE_RAD);
  const sinA = Math.sin(CONTACT_ANGLE_RAD);
  const topLoadSum = topLoadsPerTopPile.reduce((s, p) => s + p.P_N, 0);

  // 1. Lưới 2D
  const grid = [];
  for (let k = 0; k < nRows; k++) {
    const mk = mBase - k;
    grid.push(Array.from({ length: mk }, (_, j) => ({
      layer: k + 1,
      col: j + 1,
      V_fromAbove_N: k === nRows - 1 ? topLoadSum : 0,
      H_net_N: 0,
      N_inclined_fromLeftUpper_N: 0,
      N_inclined_fromRightUpper_N: 0,
      R_bottom_vertical_N: 0,
      H_restraint_N: 0,
      V_total_N: 0,
    })));
  }
  for (let k = nRows - 1; k >= 0; k--) {
    for (let j = 0; j < grid[k].length; j++) {
      const cell = grid[k][j];
      const V_tot = W_pile + cell.V_fromAbove_N;
      cell.V_total_N = V_tot;
      if (k > 0) {
        const N_inc = V_tot / (2 * cosA);
        const H_push = N_inc * sinA;
        grid[k - 1][j].V_fromAbove_N += 0.5 * V_tot;
        grid[k - 1][j].N_inclined_fromRightUpper_N += N_inc;
        grid[k - 1][j].H_net_N -= H_push;
        grid[k - 1][j + 1].V_fromAbove_N += 0.5 * V_tot;
        grid[k - 1][j + 1].N_inclined_fromLeftUpper_N += N_inc;
        grid[k - 1][j + 1].H_net_N += H_push;
      } else {
        cell.R_bottom_vertical_N = V_tot;
      }
    }
  }
  const thrust = solveBottomRowThrust(grid[0].map(c => c.H_net_N));
  grid[0][0].H_restraint_N = thrust.R_left_N;
  grid[0][grid[0].length - 1].H_restraint_N = thrust.R_right_N;
  const edgeThrust_N = Math.max(thrust.R_left_N, thrust.R_right_N);

  const totalPiles = grid.reduce((s, r) => s + r.length, 0);
  const totalLoad_N = totalPiles * W_pile + grid[nRows - 1].length * topLoadSum;
  const totalBottomReaction_N = grid[0].reduce((s, c) => s + c.R_bottom_vertical_N, 0);
  const maxBottomPileVertical_N = Math.max(...grid[0].map(c => c.R_bottom_vertical_N));
  const maxInclinedContact_N = Math.max(
    0,
    ...grid.flat().map(c => Math.max(c.N_inclined_fromLeftUpper_N, c.N_inclined_fromRightUpper_N))
  );

  // 2. Cột đại diện: tải trung bình theo hàng (row total / mBase), chuẩn hóa về cọc đáy chi phối
  const layerQ = [];
  for (let k = 0; k < nRows; k++) layerQ.push(q_pile * (grid[k].length / mBase));
  const colPointLoads = topLoadsPerTopPile.map(p => ({
    layer: nRows - 1,
    x: p.x_m,
    P: (p.P_N * grid[nRows - 1].length) / mBase,
  }));
  const rawColWeight = layerQ.reduce((s, q) => s + q * L, 0) + colPointLoads.reduce((s, p) => s + p.P, 0);
  const scaleFactor = maxBottomPileVertical_N / Math.max(rawColWeight, 1);
  const scaledQ = layerQ.map(q => q * scaleFactor);
  const scaledPoints = colPointLoads.map(p => ({ ...p, P: p.P * scaleFactor }));

  const solveColumn = (kc) => solveStackedLineContact({
    L,
    layerEI: new Array(nRows).fill(sec.EIred),
    layerQ: scaledQ,
    bottomSupports: [x1, x2],
    pointLoads: scaledPoints,
    nElements: LINE_CONTACT_ELEMENTS,
    contactStiffnessPerMeter: kc,
  });
  const col = solveColumn(contactStiffnessPerMeter);

  // Khảo sát độ nhạy độ cứng tiếp xúc (Plan Mục 9): thay kc ×0,1 và ×10
  const maxAbsMAll = (sol) => Math.max(...sol.layerResults.map(r => r.maxAbsM_Nm));
  let stiffnessSensitivity = { evaluated: false };
  if (runStiffnessSensitivity) {
    const base = maxAbsMAll(col);
    const variants = STIFFNESS_SENSITIVITY_FACTORS.map(f => {
      const s = solveColumn(contactStiffnessPerMeter * f);
      return { factor: f, maxAbsM_Nm: maxAbsMAll(s), relChange: Math.abs(maxAbsMAll(s) - base) / Math.max(base, 1) };
    });
    const maxRel = Math.max(...variants.map(v => v.relChange));
    stiffnessSensitivity = {
      evaluated: true,
      baseStiffness_N_per_m2: contactStiffnessPerMeter,
      baseMaxAbsM_Nm: base,
      variants,
      maxRelChange: maxRel,
      sensitive: maxRel > STIFFNESS_SENSITIVITY_TOL,
      note: maxRel > STIFFNESS_SENSITIVITY_TOL
        ? 'Nội lực nhạy với độ cứng tiếp xúc (> 5%) — cần hiệu chỉnh độ cứng tiếp xúc bằng mô hình/thí nghiệm.'
        : 'Nội lực ít nhạy với độ cứng tiếp xúc (≤ 5%) trong dải ×0,1 … ×10.',
    };
  }

  // 3a. Uốn ngang cọc biên hàng đáy do lực đẩy cộng dồn (giữ bằng biên lý tưởng tại x1, x2)
  const horizBeam = solveBeam({
    L,
    EI: sec.EIred,
    supports: [x1, x2],
    distributed: [{ x0: 0, x1: L, q: edgeThrust_N / L }],
    maxElementLength: L / 40,
  });
  const horizDiagram = horizBeam.diagram(4);
  const maxMy_horiz = Math.max(...horizDiagram.map(p => Math.abs(p.M)));
  const horizShear = zoneShearMaxima(horizDiagram, sec);

  // Cường độ tiếp xúc đường lớn nhất ở mỗi giao diện (N/m, theo phương đứng của cột đại diện)
  const interfaceMax = col.interfaces.map(itf => {
    let best = itf.contacts[0];
    for (const c of itf.contacts) if (c.force_N > best.force_N) best = c;
    const maxIntensity = Math.max(...itf.contacts.map(c => c.lineIntensity_N_per_m));
    const tribLen = best.lineIntensity_N_per_m > 0 ? best.force_N / best.lineIntensity_N_per_m : 0;
    return { maxIntensity_N_per_m: maxIntensity, maxNodeForce_N: best.force_N, tribLen_m: tribLen, x_m: best.x_m };
  });
  const intensityNear = (itfIndex, xs) => {
    const itf = col.interfaces[itfIndex];
    if (!itf) return 0;
    let best = itf.contacts[0];
    for (const c of itf.contacts) if (Math.abs(c.x_m - xs) < Math.abs(best.x_m - xs)) best = c;
    return best.lineIntensity_N_per_m;
  };
  const toInclined = (verticalIntensity) => verticalIntensity / (2 * cosA);

  // Kiểm tra nén cục bộ cọc–cọc tại giao diện chi phối
  const pilePileLocal = interfaceMax.map(im =>
    im.maxNodeForce_N > 0 && im.tribLen_m > 0
      ? runBT04({
          bt00,
          normalForce_N: toInclined(im.maxNodeForce_N),
          contactType: 'pile_pile',
          contactLengthAlongPile_m: im.tribLen_m,
        })
      : null
  );

  // 3b. Kiểm tra từng hàng
  const rows = [];
  for (let k = 0; k < nRows; k++) {
    const lr = col.layerResults[k];
    const vShear = zoneShearMaxima(lr.diagram, sec);
    const isBottom = k === 0;
    const M_ser = isBottom ? Math.hypot(lr.maxAbsM_Nm, maxMy_horiz) : lr.maxAbsM_Nm;
    const Q_end = isBottom ? Math.hypot(vShear.end, horizShear.end) : vShear.end;
    const Q_mid = isBottom ? Math.hypot(vShear.mid, horizShear.mid) : vShear.mid;
    const gf = TCVN5574.loads.gamma_f_selfWeight;
    const bt03 = runBT03({
      bt00OrConfig: bt00,
      processInput,
      serviceMoment_Nm: M_ser,
      designMoment_Nm: gf * M_ser,
      designShearEnd_N: gf * Q_end,
      designShearMid_N: gf * Q_mid,
    });

    // Uốn vòng theo tải đường (dải 1 m) tại vị trí cường độ lớn nhất
    const I_up = k < nRows - 1 ? interfaceMax[k].maxIntensity_N_per_m : 0;
    const I_down = k > 0 ? interfaceMax[k - 1].maxIntensity_N_per_m : 0;
    const lineLoads = [];
    if (I_up > 0) {
      lineLoads.push({ theta_rad: CONTACT_ANGLE_RAD, P_N: toInclined(I_up), label: 'Tiếp xúc cọc trên +30°' });
      lineLoads.push({ theta_rad: -CONTACT_ANGLE_RAD, P_N: toInclined(I_up), label: 'Tiếp xúc cọc trên -30°' });
    }
    if (I_down > 0) {
      lineLoads.push({ theta_rad: Math.PI - CONTACT_ANGLE_RAD, P_N: toInclined(I_down), label: 'Tiếp xúc cọc dưới 150°' });
      lineLoads.push({ theta_rad: Math.PI + CONTACT_ANGLE_RAD, P_N: toInclined(I_down), label: 'Tiếp xúc cọc dưới 210°' });
    }
    const xLine = interfaceMax[Math.min(k, nRows - 2)]?.x_m ?? 0.5 * L;
    const bt05Line = lineLoads.length
      ? runBT05({ bt00, x_m: xLine, radialLoads: lineLoads, sliceWidth_m: 1.0 })
      : null;

    // Nén cục bộ cọc–cọc ở giao diện trên/dưới của hàng
    const localCandidates = [k < nRows - 1 ? pilePileLocal[k] : null, k > 0 ? pilePileLocal[k - 1] : null].filter(Boolean);
    const bt04PilePile = localCandidates.length
      ? localCandidates.reduce((b, c) => (c.capacitySI.utilization > b.capacitySI.utilization ? c : b))
      : null;

    // Hàng đáy: kiểm tra tại thanh kê cho cọc giữa (2 tiếp xúc trên) và cọc biên (1 tiếp xúc trên + cạnh + chèn biên)
    let battenChecks = null;
    if (isBottom) {
      const R_support_max = Math.max(...col.bottomReactions.map(r => Math.abs(r.R_N)));
      const xGov = col.bottomReactions.reduce((b, r) => (Math.abs(r.R_N) > Math.abs(b.R_N) ? r : b)).x_m;
      const b_eff = sliceWidthAtBatten(sec);
      const I_atSupport = nRows > 1 ? intensityNear(0, xGov) : 0;
      const F_up_slice = toInclined(I_atSupport) * b_eff;
      const interior = checkPileAtBatten({
        bt00,
        x_m: xGov,
        R_bottom_N: R_support_max,
        otherRadialLoads: F_up_slice > 0
          ? [
              { theta_rad: CONTACT_ANGLE_RAD, P_N: F_up_slice, label: 'Tiếp xúc cọc trên +30° (dải b_eff)' },
              { theta_rad: -CONTACT_ANGLE_RAD, P_N: F_up_slice, label: 'Tiếp xúc cọc trên -30° (dải b_eff)' },
            ]
          : [],
        contactArcAngle_deg,
      });

      // Cọc biên trái (j = 0): tỷ lệ theo lực đứng của cọc biên so với cọc chi phối
      const edge = grid[0][0];
      const ratioEdge = edge.R_bottom_vertical_N / Math.max(maxBottomPileVertical_N, 1);
      const meanIntensity0 = nRows > 1 ? col.interfaces[0].totalContactForce_N / L : 0;
      const concentration = meanIntensity0 > 0 ? I_atSupport / meanIntensity0 : 1;
      const F_up_edge = (edge.N_inclined_fromRightUpper_N / L) * concentration * b_eff;
      const S0 = thrust.sideContacts_N[0] ?? 0;
      const edgeLoads = [];
      if (F_up_edge > 0) edgeLoads.push({ theta_rad: CONTACT_ANGLE_RAD, P_N: F_up_edge, label: 'Tiếp xúc cọc trên (phía trong) +30°' });
      if (S0 > 0) edgeLoads.push({ theta_rad: Math.PI / 2, P_N: (S0 / L) * b_eff, label: 'Tiếp xúc cạnh cọc kề 90°' });
      if (thrust.R_left_N > 0) edgeLoads.push({ theta_rad: (3 * Math.PI) / 2, P_N: 0.5 * thrust.R_left_N, label: 'Chèn biên lý tưởng 270° (1/2 lực đẩy, mỗi tuyến kê)' });
      const edgeCheck = checkPileAtBatten({
        bt00,
        x_m: xGov,
        R_bottom_N: ratioEdge * R_support_max,
        otherRadialLoads: edgeLoads,
        contactArcAngle_deg,
      });
      battenChecks = {
        interior,
        edge: edgeCheck,
        R_support_max_N: R_support_max,
        x_support_m: xGov,
      };
    }

    const ringCandidates = [bt05Line, battenChecks?.interior.bt05, battenChecks?.edge.bt05].filter(Boolean);
    const ringGov = ringCandidates.length
      ? ringCandidates.reduce((b, c) =>
          Math.max(c.capacitiesSI.utilizationCrack, c.capacitiesSI.utilizationULS) >
          Math.max(b.capacitiesSI.utilizationCrack, b.capacitiesSI.utilizationULS) ? c : b)
      : null;
    const battenLocal = battenChecks
      ? worseOf(battenChecks.interior.bt04, battenChecks.edge.bt04, r => r.capacitySI.utilization)
      : null;

    const utilization = {
      ...bt03.utilization,
      contactLocal: battenLocal ? battenLocal.capacitySI.utilization : undefined,
      contactLocalPilePile: bt04PilePile ? bt04PilePile.capacitySI.utilization : undefined,
      ringCrack: ringGov ? ringGov.capacitiesSI.utilizationCrack : undefined,
      ringULS: ringGov ? ringGov.capacitiesSI.utilizationULS : undefined,
    };
    const gov = governingOf(utilization);
    rows.push({
      layerIndex: k + 1,
      pilesInRow: grid[k].length,
      M_ser_Nm: M_ser,
      Q_end_ser_N: Q_end,
      Q_mid_ser_N: Q_mid,
      lineIntensityUp_N_per_m: I_up,
      lineIntensityDown_N_per_m: I_down,
      bt03,
      bt04: battenLocal ?? bt04PilePile,
      bt04PilePile,
      bt05: ringGov,
      battenChecks,
      utilization,
      governingMechanism: bt03.validityDomain.ok ? gov[0] : bt03.governingMechanism,
      maxUtilization: gov[1],
      pass: gov[1] <= 1.0 && bt03.validityDomain.ok,
    });
  }

  const govRow = rows.reduce((b, c) => (c.maxUtilization > b.maxUtilization ? c : b));
  const relEquilibriumErr = Math.abs(totalBottomReaction_N - totalLoad_N) / Math.max(totalLoad_N, 1);
  const R_perSupport_bottom_N = Math.max(...col.bottomReactions.map(r => Math.abs(r.R_N)));
  const bottomBeam = col.layerResults[0];

  return {
    grid,
    thrust,
    totalPiles,
    totalLoad_N,
    totalBottomReaction_N,
    maxBottomPileVertical_N,
    maxInclinedContact_N,
    edgeThrust_N,
    R_perSupport_bottom_N,
    col,
    stiffnessSensitivity,
    maxMy_horiz,
    bottomBeam,
    rows,
    govRow,
    relEquilibriumErr,
    allRowsPass: rows.every(r => r.pass),
  };
}

function triangularCrossSection(sec, nRows, mBase, zBase, rowsU, extra = {}) {
  const dz_row = sec.Do * Math.cos(CONTACT_ANGLE_RAD);
  const out = [];
  for (let k = 0; k < nRows; k++) {
    const zCenter = zBase + sec.Do / 2 + k * dz_row;
    for (let j = 0; j < mBase - k; j++) {
      out.push({ ...extra, layer: (extra.layerOffset ?? 0) + k + 1, col: j + 1, y_m: sec.Do / 2 + k * (sec.Do / 2) + j * sec.Do, z_m: zCenter, U: rowsU[k] });
    }
  }
  return out;
}

/**
 * BT09 — Giải sơ đồ S1 (xếp tam giác tỳ trực tiếp, chỉ tầng đáy đặt trên 2 thanh kê gỗ cứng 100×100 mm
 * và ràng buộc giữ ngang lý tưởng tại cọc biên tầng đáy). Kiểm tra mọi hàng cọc.
 */
export function solveS1Stack({
  bt00,
  nLayers = 2,
  baseCount = null,
  x1_m = null,
  x2_m = null,
  processInput = {},
  contactArcAngle_deg,
  runStiffnessSensitivity = true,
}) {
  if (!bt00 || !bt00.valid) throw new Error('solveS1Stack yêu cầu BT00 hợp lệ');
  if (!(Number.isInteger(nLayers) && nLayers >= 2)) throw new Error('S1 cần tối thiểu 2 tầng (cụm 3 cọc)');
  const thetaC = requireContactAngle(contactArcAngle_deg);

  const mBase = Number.isInteger(baseCount) && baseCount >= nLayers ? baseCount : nLayers;
  const sec = bt00.record.computed.section;
  const L = sec.L;
  const x1 = Number.isFinite(x1_m) ? x1_m : ((Math.sqrt(2) - 1) / 2) * L;
  const x2 = Number.isFinite(x2_m) ? x2_m : L - x1;

  const blk = solveTriangularBlock({
    bt00, nRows: nLayers, mBase, x1, x2, processInput, contactArcAngle_deg: thetaC, runStiffnessSensitivity,
  });
  const gov = blk.govRow;
  const bottomRow = blk.rows[0];

  return {
    scheme: 'S1',
    code: 'BT09',
    valid: true,
    converged: blk.col.converged,
    verified:
      blk.col.converged &&
      blk.relEquilibriumErr < 1e-12 &&
      blk.col.equilibrium.relForceErr < 1e-10 &&
      blk.rows.every(r => r.bt03.verified && (!r.bt05 || r.bt05.verified)),
    nLayers,
    baseCount: mBase,
    totalPiles: blk.totalPiles,
    x1_m: x1,
    x2_m: x2,
    grid2D: blk.grid,
    bottomRowThrust: blk.thrust,
    forcesSI: {
      totalSystemWeight_N: blk.totalLoad_N,
      totalBottomReaction_N: blk.totalBottomReaction_N,
      maxBottomPileVertical_N: blk.maxBottomPileVertical_N,
      maxInclinedContact_N: blk.maxInclinedContact_N,
      maxHorizontalRestraint_N: blk.edgeThrust_N,
      R_perSupport_bottom_N: blk.R_perSupport_bottom_N,
      M_vertical_max_Nm: blk.bottomBeam.maxAbsM_Nm,
      M_horizontal_max_Nm: blk.maxMy_horiz,
      M_combined_ser_Nm: bottomRow.M_ser_Nm,
      Q_combined_ser_N: Math.max(bottomRow.Q_end_ser_N, bottomRow.Q_mid_ser_N),
    },
    lineContactSummary: {
      converged: blk.col.converged,
      iterations: blk.col.iterations,
      interface0_activeNodes: blk.col.interfaces[0].activeCount,
      interface0_separatedNodes: blk.col.interfaces[0].separatedCount,
      relForceErr: blk.col.equilibrium.relForceErr,
    },
    contactStiffnessSensitivity: blk.stiffnessSensitivity,
    bottomLayerDiagram: blk.bottomBeam.diagram,
    rows: blk.rows,
    bt03: gov.bt03,
    bt04: gov.bt04,
    bt05: gov.bt05,
    utilization: gov.utilization,
    governingLayerIndex: gov.layerIndex,
    governingMechanism: gov.governingMechanism,
    maxUtilization: gov.maxUtilization,
    structuralPass: blk.allRowsPass,
    crossSectionPiles: triangularCrossSection(sec, nLayers, mBase, BATTEN_WIDTH_M, blk.rows.map(r => r.maxUtilization)),
  };
}

/**
 * BT12 — Giải sơ đồ S3 hỗn hợp: ghép các khối xếp trực tiếp `blocks` (ví dụ [2, 2] hoặc [3, 2, 3])
 * qua các mặt có cặp thanh kê gỗ cứng 100×100 mm trung gian.
 *
 * - blocks = [n] (n ≥ 2): quy về đúng S1 (BT09); blocks = [1, 1, ..., 1]: quy về đúng S2 (BT10/BT11).
 * - Thanh kê trung gian đặt trên hàng đỉnh của khối dưới tại vị trí kê của khối trên; tải tuyến chia đều cho
 *   các cọc hàng đỉnh (thanh kê cứng, sơ đồ đối xứng) và truyền xuống qua tiếp xúc dọc thân.
 * - Tổng tải mỗi tuyến kê dưới khối được xác định từ cân bằng tĩnh học của cả khối (bảo toàn 100% tải tích lũy).
 */
export function solveS3Stack({
  bt00,
  blocks = [2, 2],
  baseCount = 5,
  x1_nom_m = null,
  x2_nom_m = null,
  eccentricity_m = 0,
  scenario = 'zero',
  toleranceMode = 'global_axis',
  processInput = {},
  contactArcAngle_deg,
  runStiffnessSensitivity = true,
}) {
  if (!bt00 || !bt00.valid) throw new Error('solveS3Stack yêu cầu BT00 hợp lệ');
  if (!Array.isArray(blocks) || blocks.length < 1 || blocks.some(b => !Number.isInteger(b) || b < 1)) {
    throw new Error('blocks của S3 phải là mảng số nguyên dương (ví dụ [2, 2] hoặc [3, 2, 3])');
  }
  const thetaC = requireContactAngle(contactArcAngle_deg);

  const totalLayers = blocks.reduce((a, b) => a + b, 0);
  const sec = bt00.record.computed.section;
  const L = sec.L;
  const W_pile = sec.totalSelfWeight;
  const x1Nom = Number.isFinite(x1_nom_m) ? x1_nom_m : ((Math.sqrt(2) - 1) / 2) * L;
  const x2Nom = Number.isFinite(x2_nom_m) ? x2_nom_m : L - x1Nom;

  if (blocks.length === 1 && blocks[0] >= 2) {
    const s1 = solveS1Stack({
      bt00, nLayers: blocks[0], baseCount, x1_m: x1Nom, x2_m: x2Nom, processInput, contactArcAngle_deg: thetaC, runStiffnessSensitivity,
    });
    return { ...s1, scheme: 'S3', code: 'BT12', blocks, reducedTo: 'S1' };
  }
  if (blocks.every(b => b === 1)) {
    const s2 = solveS2Stack({
      bt00, nLayers: blocks.length, pilesPerLayer: baseCount, x1_nom_m: x1Nom, x2_nom_m: x2Nom,
      eccentricity_m, scenario, toleranceMode, processInput, contactArcAngle_deg: thetaC,
    });
    return { ...s2, scheme: 'S3', code: 'BT12', blocks, reducedTo: 'S2' };
  }

  const nBlocks = blocks.length;
  const { x1: x1Blocks, x2: x2Blocks } = buildS2SupportOffsets({
    nLayers: nBlocks, x1_nom_m: x1Nom, x2_nom_m: x2Nom, eccentricity_m, scenario, toleranceMode,
  });
  for (let b = 0; b < nBlocks; b++) {
    if (!(x1Blocks[b] >= 0.05 && x2Blocks[b] > x1Blocks[b] + 0.1 && x2Blocks[b] <= L - 0.05)) {
      return {
        scheme: 'S3', code: 'BT12', valid: false, converged: false, structuralPass: false,
        status: 'hình học đặt kê ngoài phạm vi cọc',
        reason: `Mặt kê dưới khối ${b + 1}: x1=${x1Blocks[b].toFixed(3)}m, x2=${x2Blocks[b].toFixed(3)}m`,
      };
    }
  }
  const mBase = Math.max(baseCount, Math.max(...blocks));

  const blockResults = new Array(nBlocks);
  let P1_tot_above = 0; // tổng tải tuyến kê 1 từ khối trên (N)
  let P2_tot_above = 0;
  let xP1_above = x1Blocks[nBlocks - 1];
  let xP2_above = x2Blocks[nBlocks - 1];
  let totalPiles = 0;
  let allConverged = true;
  let allVerified = true;

  for (let b = nBlocks - 1; b >= 0; b--) {
    const bLayers = blocks[b];
    const x1b = x1Blocks[b];
    const x2b = x2Blocks[b];
    let pilesInBlock = 0;
    for (let k = 0; k < bLayers; k++) pilesInBlock += mBase - k;
    totalPiles += pilesInBlock;
    const W_blk = pilesInBlock * W_pile;

    let utilMap;
    let blockPass;
    let govMech;
    let detail;
    let M_ser_Nm;
    let Q_ser_N;

    if (bLayers === 1) {
      // Khối 1 hàng (mBase cọc) tựa trên cặp kê: mỗi cọc nhận 1/mBase tải tuyến từ khối trên
      const chk = checkSinglePileOnBattens({
        bt00, x1: x1b, x2: x2b,
        P1_above: P1_tot_above / mBase, P2_above: P2_tot_above / mBase,
        xP1: xP1_above, xP2: xP2_above, processInput, contactArcAngle_deg: thetaC,
      });
      utilMap = {
        ...chk.bt03.utilization,
        contactLocal: chk.bt04.capacitySI.utilization,
        ringCrack: chk.bt05.capacitiesSI.utilizationCrack,
        ringULS: chk.bt05.capacitiesSI.utilizationULS,
      };
      const g = governingOf(utilMap);
      blockPass = g[1] <= 1.0 && chk.bt03.validityDomain.ok;
      govMech = chk.bt03.validityDomain.ok ? g[0] : chk.bt03.governingMechanism;
      M_ser_Nm = Math.max(Math.abs(chk.bt02.extremaSI.M_max_sag_Nm), Math.abs(chk.bt02.extremaSI.M_min_hog_Nm));
      Q_ser_N = chk.bt02.extremaSI.Q_max_abs_N;
      allVerified = allVerified && chk.bt02.verified && chk.bt03.verified && chk.bt05.verified;
      detail = { type: 'single_row', bt02: chk.bt02, bt03: chk.bt03, bt04: chk.bt04, bt05: chk.bt05 };
    } else {
      const mTop = mBase - bLayers + 1;
      const topLoads = [];
      if (P1_tot_above > 0) topLoads.push({ x_m: xP1_above, P_N: P1_tot_above / mTop });
      if (P2_tot_above > 0) topLoads.push({ x_m: xP2_above, P_N: P2_tot_above / mTop });
      const blk = solveTriangularBlock({
        bt00, nRows: bLayers, mBase, x1: x1b, x2: x2b, topLoadsPerTopPile: topLoads,
        processInput, contactArcAngle_deg: thetaC, runStiffnessSensitivity,
      });
      allConverged = allConverged && blk.col.converged;
      allVerified = allVerified && blk.relEquilibriumErr < 1e-10 && blk.col.equilibrium.relForceErr < 1e-10;

      // Hàng đỉnh khối dưới tại thanh kê trung gian: tải kê tập trung + tiếp xúc cọc dưới trong dải b_eff
      const topChecks = topLoads.map(tl => {
        const I_down = bLayers > 1
          ? (() => {
              const itf = blk.col.interfaces[bLayers - 2];
              let best = itf.contacts[0];
              for (const c of itf.contacts) if (Math.abs(c.x_m - tl.x_m) < Math.abs(best.x_m - tl.x_m)) best = c;
              return best.lineIntensity_N_per_m;
            })()
          : 0;
        const F_down_slice = (I_down / (2 * Math.cos(CONTACT_ANGLE_RAD))) * sliceWidthAtBatten(sec);
        const bt04 = runBT04({
          bt00, normalForce_N: tl.P_N, contactType: 'pile_batten', contactLengthAlongPile_m: BATTEN_WIDTH_M, contactArcAngle_deg: thetaC,
        });
        const bt05 = runBT05({
          bt00,
          x_m: Math.min(L, Math.max(0, tl.x_m)),
          radialLoads: [
            { theta_rad: 0, P_N: tl.P_N, label: 'Thanh kê trung gian 0°' },
            ...(F_down_slice > 0
              ? [
                  { theta_rad: Math.PI - CONTACT_ANGLE_RAD, P_N: F_down_slice, label: 'Tiếp xúc cọc dưới 150°' },
                  { theta_rad: Math.PI + CONTACT_ANGLE_RAD, P_N: F_down_slice, label: 'Tiếp xúc cọc dưới 210°' },
                ]
              : []),
          ],
          sliceWidth_m: sliceWidthAtBatten(sec),
        });
        return { x_m: tl.x_m, P_perTopPile_N: tl.P_N, bt04, bt05 };
      });
      const topU = topChecks.reduce((mx, c) => Math.max(
        mx, c.bt04.capacitySI.utilization, c.bt05.capacitiesSI.utilizationCrack, c.bt05.capacitiesSI.utilizationULS), 0);

      const gRow = blk.govRow;
      utilMap = { ...gRow.utilization };
      if (topChecks.length) {
        utilMap.topRowBattenLocal = Math.max(...topChecks.map(c => c.bt04.capacitySI.utilization));
        utilMap.topRowBattenRingCrack = Math.max(...topChecks.map(c => c.bt05.capacitiesSI.utilizationCrack));
        utilMap.topRowBattenRingULS = Math.max(...topChecks.map(c => c.bt05.capacitiesSI.utilizationULS));
      }
      const g = governingOf(utilMap);
      blockPass = blk.allRowsPass && topU <= 1.0;
      govMech = gRow.bt03.validityDomain.ok ? g[0] : gRow.bt03.governingMechanism;
      M_ser_Nm = Math.max(...blk.rows.map(r => r.M_ser_Nm));
      Q_ser_N = Math.max(...blk.rows.map(r => Math.max(r.Q_end_ser_N, r.Q_mid_ser_N)));
      detail = {
        type: 'triangular_block',
        rows: blk.rows,
        bottomRowThrust: blk.thrust,
        contactStiffnessSensitivity: blk.stiffnessSensitivity,
        topRowBattenChecks: topChecks,
        bottomLayerDiagram: blk.bottomBeam.diagram,
      };
    }

    // Tổng tải tuyến kê dưới khối b từ cân bằng tĩnh học của cả khối
    const P_tot = P1_tot_above + P2_tot_above;
    const R2_tot = (W_blk * (L / 2 - x1b) + P1_tot_above * (xP1_above - x1b) + P2_tot_above * (xP2_above - x1b)) / (x2b - x1b);
    const R1_tot = W_blk + P_tot - R2_tot;
    const g = governingOf(utilMap);

    blockResults[b] = {
      blockIndex: b + 1,
      layersInBlock: bLayers,
      pilesInBlock,
      x1_m: x1b,
      x2_m: x2b,
      e1_m: b === nBlocks - 1 ? 0 : xP1_above - x1b,
      e2_m: b === nBlocks - 1 ? 0 : xP2_above - x2b,
      loadFromAbove_line1_N: P1_tot_above,
      loadFromAbove_line2_N: P2_tot_above,
      R1_out_total_N: R1_tot,
      R2_out_total_N: R2_tot,
      R1_out_perPile_N: R1_tot / mBase,
      R2_out_perPile_N: R2_tot / mBase,
      M_ser_Nm,
      Q_ser_N,
      utilization: utilMap,
      governingMechanism: govMech,
      maxUtilization: g[1],
      pass: blockPass,
      detail,
    };

    P1_tot_above = R1_tot;
    P2_tot_above = R2_tot;
    xP1_above = x1b;
    xP2_above = x2b;
  }

  const govBlock = blockResults.reduce((b, c) => (c.maxUtilization > b.maxUtilization ? c : b));
  const totalSystemWeight_N = totalPiles * W_pile;
  const totalGroundReaction_N = blockResults[0].R1_out_total_N + blockResults[0].R2_out_total_N;
  const relEquilibriumErr = Math.abs(totalGroundReaction_N - totalSystemWeight_N) / Math.max(totalSystemWeight_N, 1);

  const crossSectionPiles = [];
  let zBase = 0;
  let globalLayer = 0;
  const dz_row = sec.Do * Math.cos(CONTACT_ANGLE_RAD);
  for (let b = 0; b < nBlocks; b++) {
    zBase += BATTEN_WIDTH_M;
    const bLayers = blocks[b];
    const det = blockResults[b].detail;
    const rowsU = det.type === 'triangular_block' ? det.rows.map(r => r.maxUtilization) : [blockResults[b].maxUtilization];
    crossSectionPiles.push(...triangularCrossSection(sec, bLayers, mBase, zBase, rowsU, { block: b + 1, layerOffset: globalLayer }));
    globalLayer += bLayers;
    zBase += sec.Do + (bLayers - 1) * dz_row;
  }

  return {
    scheme: 'S3',
    code: 'BT12',
    valid: true,
    converged: allConverged,
    verified: allVerified && relEquilibriumErr < 1e-10,
    blocks,
    nLayers: totalLayers,
    baseCount: mBase,
    totalPiles,
    reducedTo: null,
    blockResults,
    governingBlockIndex: govBlock.blockIndex,
    governingMechanism: govBlock.governingMechanism,
    maxUtilization: govBlock.maxUtilization,
    structuralPass: blockResults.every(r => r.pass),
    equilibriumSI: { totalSystemWeight_N, totalGroundReaction_N, relEquilibriumErr },
    crossSectionPiles,
  };
}
