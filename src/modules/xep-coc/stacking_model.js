/**
 * stacking_model.js — Mô hình hệ xếp cọc nhiều tầng cho cả 3 sơ đồ bắt buộc (Mốc M3 & M4):
 * - BT10: S2 kê thẳng hàng nhiều tầng (solveS2Stack)
 * - BT11: S2 có lệch kê theo 2 định nghĩa dung sai & 5 kịch bản (solveS2Stack)
 * - BT09: S1 xếp tam giác tỳ trực tiếp — cân bằng 2D nghiêng 30° + tiếp xúc một phía dọc thân trục x + uốn xiên 2 phương (solveS1Stack)
 * - BT12: S3 hỗn hợp ghép các khối qua thanh kê gỗ cứng 100×100 mm trung gian (solveS3Stack)
 *
 * Tất cả đều tuân thủ Plan v0.5.0:
 * - Lõi tính thuần SI (m, kg, s, N, Pa), ưu tiên TCVN 5574:2018.
 * - Thanh kê gỗ 100 × 100 mm tuyệt đối cứng, nền kho cứng không lún, biên ngang lý tưởng.
 * - Không kiểm tra gỗ/chèn/nền kho; cơ chế giới hạn chỉ đến từ khả năng chịu lực của cọc.
 */
import { solveBeam } from '../../core/fem_solver.js';
import { solveStackedLineContact } from '../../core/contact_solver.js';
import { runBT01, runBT02 } from './pile_specs.js';
import { runBT03 } from './section_checker.js';
import { runBT04, runBT05 } from './contact_checker.js';

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
    // Sai lệch tương đối cộng dồn theo chiều cao: mỗi mặt kê k > 0 lệch thêm (+e1Val, +e2Val) so với mặt kê k-1
    for (let k = 1; k < nLayers; k++) {
      x1[k] = x1[k - 1] + e1Val;
      x2[k] = x2[k - 1] + e2Val;
    }
    return { x1, x2, scenario, toleranceMode };
  }

  // Theo trục chuẩn chung ('global_axis')
  for (let k = 1; k < nLayers; k++) {
    if (scenario === 'single_layer') {
      if (k === Math.min(targetLayer, nLayers - 1)) {
        x1[k] = x1_nom_m + e1Val;
        x2[k] = x2_nom_m + e2Val;
      }
    } else if (scenario === 'same_direction') {
      // Mọi tầng trên dịch cùng một hướng so với kê đáy
      x1[k] = x1_nom_m + e1Val;
      x2[k] = x2_nom_m + e2Val;
    } else if (scenario === 'independent_lines') {
      // Tuyến 1 lệch vào nhịp (+e1), tuyến 2 giữ nguyên hoặc lệch độc lập (e2)
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
 * BT10 & BT11 — Giải hệ S2 nhiều tầng (kê thẳng hàng khi mọi lệch = 0, hoặc có lệch kê).
 *
 * Truyền tải chính xác từ đỉnh (tầng n-1) xuống đáy (tầng 0):
 * - Cọc tầng k tựa trên mặt kê k tại (x1[k], x2[k]).
 * - Nhận 2 phản lực tập trung (R1[k+1], R2[k+1]) từ tầng k+1 đặt tại (x1[k+1], x2[k+1]).
 * - Độ lệch đặt tải trên cọc tầng k là e1_k = x1[k+1] - x1[k], e2_k = x2[k+1] - x2[k].
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
  contactArcAngle_deg = 20,
}) {
  if (!bt00 || !bt00.valid) throw new Error('solveS2Stack yêu cầu BT00 hợp lệ');
  if (!(Number.isInteger(nLayers) && nLayers >= 1)) throw new Error('Số tầng nLayers phải >= 1');

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
      nLayers,
      x1_nom_m: x1Nom,
      x2_nom_m: x2Nom,
      eccentricity_m,
      scenario,
      toleranceMode,
      e1_override_m,
      e2_override_m,
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

  // Giải từ tầng đỉnh k = nLayers - 1 xuống tầng đáy k = 0
  const layers = new Array(nLayers);
  let P1_above = 0;
  let P2_above = 0;
  let xP1_above = x1Arr[nLayers - 1];
  let xP2_above = x2Arr[nLayers - 1];

  // Tính BT03 phần sức kháng 1 lần dùng chung (chỉ phụ thuộc tiết diện & quy trình căng)
  const bt03Template = runBT03({ bt00OrConfig: bt00, processInput });

  for (let k = nLayers - 1; k >= 0; k--) {
    const x1k = x1Arr[k];
    const x2k = x2Arr[k];
    const e1k = k === nLayers - 1 ? 0 : xP1_above - x1k;
    const e2k = k === nLayers - 1 ? 0 : xP2_above - x2k;

    const bt02k = runBT02({
      pileRecordOrConfig: bt00,
      x1_m: x1k,
      x2_m: x2k,
      P1_N: P1_above,
      P2_N: P2_above,
      e1_m: e1k,
      e2_m: e2k,
    });

    const bt03k = runBT03({
      bt00OrConfig: bt00,
      processInput,
      beamResult: bt02k,
    });

    const maxRk = Math.max(Math.abs(bt02k.reactionsSI.R1_fem), Math.abs(bt02k.reactionsSI.R2_fem));
    const maxPAbove = Math.max(Math.abs(P1_above), Math.abs(P2_above));
    // Lực ép ngang vòng (diametral pinching): gồm cặp lực ép trực tiếp từ tầng trên P_above
    // cộng phần uốn vòng do tự trọng bản thân tựa lên gối đáy (hệ số 0,35 theo vòng tựa đáy chịu tự trọng)
    const P_ring_pinch_N = maxPAbove + 0.35 * Math.max(0, maxRk - maxPAbove);
    const bt04k = runBT04({
      bt00,
      normalForce_N: maxRk,
      contactType: 'pile_batten',
      contactLengthAlongPile_m: 0.1,
      contactArcAngle_deg,
    });
    const bt05k = runBT05({
      bt00,
      x_m: x1k,
      normalForce_N: P_ring_pinch_N,
      loadCase: 'two_point_diametral',
      contactLengthAlongPile_m: 0.1,
    });

    const utilMap = {
      ...bt03k.utilization,
      contactLocal: bt04k.capacitySI.utilization,
      ringCrack: bt05k.capacitiesSI.utilizationCrack,
      ringULS: bt05k.capacitiesSI.utilizationULS,
    };
    const gov = Object.entries(utilMap).reduce((b, c) => (c[1] > b[1] ? c : b));

    layers[k] = {
      layerIndex: k + 1, // 1 = đáy, nLayers = đỉnh
      x1_m: x1k,
      x2_m: x2k,
      P1_above_N: P1_above,
      P2_above_N: P2_above,
      e1_m: e1k,
      e2_m: e2k,
      R1_N: bt02k.reactionsSI.R1_fem,
      R2_N: bt02k.reactionsSI.R2_fem,
      M_max_sag_Nm: bt02k.extremaSI.M_max_sag_Nm,
      M_min_hog_Nm: bt02k.extremaSI.M_min_hog_Nm,
      Q_max_abs_N: bt02k.extremaSI.Q_max_abs_N,
      w_max_abs_m: bt02k.extremaSI.w_max_abs_m,
      bt02: bt02k,
      bt03: bt03k,
      bt04: bt04k,
      bt05: bt05k,
      utilization: utilMap,
      governingMechanism: gov[0],
      maxUtilization: gov[1],
      pass: gov[1] <= 1.0,
    };

    P1_above = bt02k.reactionsSI.R1_fem;
    P2_above = bt02k.reactionsSI.R2_fem;
    xP1_above = x1k;
    xP2_above = x2k;
  }

  // Tìm tầng chi phối nhất toàn hệ
  const govLayer = layers.reduce((b, c) => (c.maxUtilization > b.maxUtilization ? c : b));
  const totalPiles = nLayers * pilesPerLayer;
  const totalSystemWeight_N = totalPiles * sec.totalSelfWeight;
  const totalGroundReaction_N = pilesPerLayer * (layers[0].R1_N + layers[0].R2_N);
  const relEquilibriumErr = Math.abs(totalGroundReaction_N - totalSystemWeight_N) / Math.max(totalSystemWeight_N, 1);

  // Dựng tọa độ tâm cọc y–z cho vẽ mặt cắt ngang
  const hz_batten = 0.1; // thanh kê gỗ cứng 100×100 mm
  const crossSectionPiles = [];
  for (let k = 0; k < nLayers; k++) {
    const zCenter = hz_batten + sec.Do / 2 + k * (sec.Do + hz_batten);
    for (let j = 0; j < pilesPerLayer; j++) {
      const yCenter = sec.Do / 2 + j * sec.Do;
      crossSectionPiles.push({ layer: k + 1, col: j + 1, y_m: yCenter, z_m: zCenter, U: layers[k].maxUtilization });
    }
  }

  return {
    scheme: 'S2',
    code: scenario === 'zero' && Math.abs(eccentricity_m) < 1e-12 ? 'BT10' : 'BT11',
    valid: true,
    converged: true,
    verified: relEquilibriumErr < 1e-10 && layers.every(l => l.bt02.verified),
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
    structuralPass: govLayer.maxUtilization <= 1.0,
    equilibriumSI: {
      totalSystemWeight_N,
      totalGroundReaction_N,
      relEquilibriumErr,
    },
    crossSectionPiles,
    prestressRef: bt03Template.prestress,
  };
}

/**
 * BT09 — Giải sơ đồ S1 (xếp tam giác tỳ trực tiếp, chỉ tầng đáy đặt trên 2 thanh kê gỗ cứng 100×100 mm
 * và ràng buộc giữ ngang lý tưởng tại cọc biên tầng đáy).
 *
 * Quy trình 2 tầng cơ học chuẩn xác:
 * 1) Cân bằng lưới tiếp xúc tam giác 2D (góc nghiêng α = 30°): xác định lực tiếp xúc nghiêng N_L, N_R,
 *    tổng lực đứng V(k,j) và lực đẩy ngang H(k,j) lên từng cọc và phản lực biên lý tưởng H_restraint.
 * 2) Tương thích tiếp xúc một phía dọc thân trục x (solveStackedLineContact) trên cột cọc chi phối
 *    để bắt hiện tượng tách hở dọc thân & tập trung lực gần gối đáy (x1, x2), đồng thời tính uốn xiên 2 phương
 *    M_comb = sqrt(Mz² + My²) cho cọc biên chịu lực đẩy ngang.
 */
export function solveS1Stack({
  bt00,
  nLayers = 2,
  baseCount = null,
  x1_m = null,
  x2_m = null,
  processInput = {},
  contactArcAngle_deg = 20,
}) {
  if (!bt00 || !bt00.valid) throw new Error('solveS1Stack yêu cầu BT00 hợp lệ');
  if (!(Number.isInteger(nLayers) && nLayers >= 2)) throw new Error('S1 cần tối thiểu 2 tầng (cụm 3 cọc)');

  const mBase = Number.isInteger(baseCount) && baseCount >= nLayers ? baseCount : nLayers;
  const sec = bt00.record.computed.section;
  const L = sec.L;
  const x1 = Number.isFinite(x1_m) ? x1_m : ((Math.sqrt(2) - 1) / 2) * L;
  const x2 = Number.isFinite(x2_m) ? x2_m : L - x1;
  const W_pile = sec.totalSelfWeight; // N
  const q_pile = sec.selfWeightPerMeter; // N/m
  const alpha = Math.PI / 6; // 30° đối với lưới tam giác đều (tâm cách nhau Do)
  const cosA = Math.cos(alpha);
  const sinA = Math.sin(alpha);

  // 1. Giải cân bằng tiếp xúc nghiêng 2D từ tầng đỉnh k = nLayers - 1 xuống tầng đáy k = 0
  // Hàng k có m_k = mBase - k cọc (j = 0 .. m_k - 1).
  // Cọc (k, j) khi k > 0 tựa lên 2 cọc tầng dưới: (k-1, j) ở bên trái và (k-1, j+1) ở bên phải.
  const grid = [];
  for (let k = 0; k < nLayers; k++) {
    const mk = mBase - k;
    grid.push(
      Array.from({ length: mk }, (_, j) => ({
        layer: k + 1,
        col: j + 1,
        V_fromAbove_N: 0,
        H_net_N: 0,
        N_inclined_fromLeftUpper_N: 0,
        N_inclined_fromRightUpper_N: 0,
        R_bottom_vertical_N: 0,
        H_restraint_N: 0,
      }))
    );
  }

  for (let k = nLayers - 1; k >= 0; k--) {
    const row = grid[k];
    for (let j = 0; j < row.length; j++) {
      const cell = row[j];
      const V_tot = W_pile + cell.V_fromAbove_N;
      if (k > 0) {
        // Truyền đối xứng xuống 2 cọc đỡ bên dưới (k-1, j) và (k-1, j+1)
        const N_inc = V_tot / (2 * cosA);
        const V_half = 0.5 * V_tot;
        const H_push = N_inc * sinA;
        // Cọc trái (k-1, j) bị đẩy sang trái (-H_push)
        grid[k - 1][j].V_fromAbove_N += V_half;
        grid[k - 1][j].N_inclined_fromRightUpper_N += N_inc;
        grid[k - 1][j].H_net_N -= H_push;
        // Cọc phải (k-1, j+1) bị đẩy sang phải (+H_push)
        grid[k - 1][j + 1].V_fromAbove_N += V_half;
        grid[k - 1][j + 1].N_inclined_fromLeftUpper_N += N_inc;
        grid[k - 1][j + 1].H_net_N += H_push;
      } else {
        // Tầng đáy (k = 0): truyền xuống 2 thanh kê đáy và ràng buộc biên ngang lý tưởng
        cell.R_bottom_vertical_N = V_tot;
        cell.H_restraint_N = Math.abs(cell.H_net_N);
      }
    }
  }

  // Kiểm tra cân bằng tổng thể 2D
  const totalPiles = grid.reduce((s, r) => s + r.length, 0);
  const totalSystemWeight_N = totalPiles * W_pile;
  const totalBottomReaction_N = grid[0].reduce((s, c) => s + c.R_bottom_vertical_N, 0);
  const maxHorizontalRestraint_N = Math.max(...grid[0].map(c => c.H_restraint_N));
  const maxBottomPileVertical_N = Math.max(...grid[0].map(c => c.R_bottom_vertical_N));
  const maxInclinedContact_N = Math.max(
    ...grid.flat().map(c => Math.max(c.N_inclined_fromLeftUpper_N, c.N_inclined_fromRightUpper_N))
  );

  // 2. Giải bài toán tiếp xúc một phía dọc thân trục x (solveStackedLineContact)
  // Xét cột tương đương từ tầng đáy lên đỉnh với hệ số tải mỗi tầng tương ứng sự tích lũy hình học tam giác
  const layerEI = new Array(nLayers).fill(sec.EIred);
  const layerQ = [];
  for (let k = 0; k < nLayers; k++) {
    // Mật độ tự trọng trung bình trên 1 đường truyền đứng ở tầng k (sao cho tổng tải cột = maxBottomPileVertical_N)
    const rowAvgRatio = grid[k].length / mBase;
    layerQ.push(q_pile * rowAvgRatio);
  }
  // Chuẩn hóa nhẹ layerQ để tổng tải dọc trục của cột đại diện khớp chính xác tải trên cọc đáy chi phối
  const rawColWeight = layerQ.reduce((s, q) => s + q * L, 0);
  const scaleFactor = maxBottomPileVertical_N / Math.max(rawColWeight, 1);
  const scaledLayerQ = layerQ.map(q => q * scaleFactor);

  const lineContactSol = solveStackedLineContact({
    L,
    layerEI,
    layerQ: scaledLayerQ,
    bottomSupports: [x1, x2],
    nElements: 20,
    contactStiffnessPerMeter: 5e9,
  });

  // 3. Xét uốn theo phương ngang (trục y) cho cọc biên đáy chịu lực đẩy ngang H_restraint phân bố dọc thân
  // và giữ biên lý tưởng tại vị trí kê đáy x1, x2
  const q_horiz_edge = maxHorizontalRestraint_N / L;
  const horizBeamSol = solveBeam({
    L,
    EI: sec.EIred,
    supports: [x1, x2],
    distributed: [{ x0: 0, x1: L, q: q_horiz_edge }],
    maxElementLength: L / 40,
  });
  let maxMy_horiz = 0, maxQy_horiz = 0;
  for (const pt of horizBeamSol.diagram(4)) {
    maxMy_horiz = Math.max(maxMy_horiz, Math.abs(pt.M));
    maxQy_horiz = Math.max(maxQy_horiz, Math.abs(pt.Q));
  }

  // Kết hợp uốn xiên 2 phương (Mz từ tiếp xúc dọc thân + My từ đẩy ngang) cho cọc đáy chi phối
  const bottomBeam = lineContactSol.layerResults[0];
  const M_combined_ser_Nm = Math.hypot(bottomBeam.maxAbsM_Nm, maxMy_horiz);
  const Q_combined_ser_N = Math.hypot(bottomBeam.maxAbsQ_N, maxQy_horiz);

  const bt03Gov = runBT03({
    bt00OrConfig: bt00,
    processInput,
    serviceMoment_Nm: M_combined_ser_Nm,
    designMoment_Nm: 1.1 * M_combined_ser_Nm,
    designShearEnd_N: 1.1 * Q_combined_ser_N,
    designShearMid_N: 1.1 * Q_combined_ser_N,
  });

  // Phản lực tại 1 gối đáy của cọc chi phối
  const R_perSupport_bottom_N = Math.max(...lineContactSol.bottomReactions.map(r => Math.abs(r.R_N)));
  const P_above_S1_perSupport_N = Math.max(0, R_perSupport_bottom_N - 0.5 * W_pile);
  const P_ring_S1_N = P_above_S1_perSupport_N + 0.35 * (0.5 * W_pile);
  const bt04Gov = runBT04({
    bt00,
    normalForce_N: R_perSupport_bottom_N,
    contactType: 'pile_batten',
    contactLengthAlongPile_m: 0.1,
    contactArcAngle_deg,
  });
  const bt05Gov = runBT05({
    bt00,
    x_m: x1,
    normalForce_N: P_ring_S1_N,
    loadCase: 'three_point_triangular',
    contactLengthAlongPile_m: 0.1,
  });

  const utilMap = {
    ...bt03Gov.utilization,
    contactLocal: bt04Gov.capacitySI.utilization,
    ringCrack: bt05Gov.capacitiesSI.utilizationCrack,
    ringULS: bt05Gov.capacitiesSI.utilizationULS,
  };
  const gov = Object.entries(utilMap).reduce((b, c) => (c[1] > b[1] ? c : b));

  // Dựng tọa độ tâm cọc mặt cắt y–z (hàng k cao hơn hàng k-1 một đoạn Do * cos(30°))
  const hz_batten = 0.1;
  const dz_row = sec.Do * cosA;
  const crossSectionPiles = [];
  for (let k = 0; k < nLayers; k++) {
    const zCenter = hz_batten + sec.Do / 2 + k * dz_row;
    const mk = mBase - k;
    for (let j = 0; j < mk; j++) {
      const yCenter = sec.Do / 2 + k * (sec.Do / 2) + j * sec.Do;
      crossSectionPiles.push({ layer: k + 1, col: j + 1, y_m: yCenter, z_m: zCenter, U: gov[1] });
    }
  }

  const relEquilibriumErr = Math.abs(totalBottomReaction_N - totalSystemWeight_N) / Math.max(totalSystemWeight_N, 1);

  return {
    scheme: 'S1',
    code: 'BT09',
    valid: true,
    converged: lineContactSol.converged,
    verified:
      lineContactSol.converged &&
      relEquilibriumErr < 1e-12 &&
      lineContactSol.equilibrium.relForceErr < 1e-10,
    nLayers,
    baseCount: mBase,
    totalPiles,
    x1_m: x1,
    x2_m: x2,
    grid2D: grid,
    forcesSI: {
      totalSystemWeight_N,
      totalBottomReaction_N,
      maxBottomPileVertical_N,
      maxInclinedContact_N,
      maxHorizontalRestraint_N,
      R_perSupport_bottom_N,
      M_vertical_max_Nm: bottomBeam.maxAbsM_Nm,
      M_horizontal_max_Nm: maxMy_horiz,
      M_combined_ser_Nm,
      Q_combined_ser_N,
    },
    lineContactSummary: {
      converged: lineContactSol.converged,
      iterations: lineContactSol.iterations,
      interface0_activeNodes: lineContactSol.interfaces[0].activeCount,
      interface0_separatedNodes: lineContactSol.interfaces[0].separatedCount,
      relForceErr: lineContactSol.equilibrium.relForceErr,
    },
    bottomLayerDiagram: bottomBeam.diagram,
    bt03: bt03Gov,
    bt04: bt04Gov,
    bt05: bt05Gov,
    utilization: utilMap,
    governingLayerIndex: 1,
    governingMechanism: gov[0],
    maxUtilization: gov[1],
    structuralPass: gov[1] <= 1.0,
    crossSectionPiles,
  };
}

/**
 * BT12 — Giải sơ đồ S3 hỗn hợp: ghép các khối xếp trực tiếp `blocks` (ví dụ [2, 2] hoặc [3, 2, 3])
 * qua các mặt có cặp thanh kê gỗ cứng 100×100 mm trung gian.
 *
 * Kiểm chứng giới hạn bắt buộc (Plan Mục 9 & BT12):
 * - Nếu blocks = [n] (1 khối duy nhất, n >= 2): quy về đúng S1 (BT09)!
 * - Nếu blocks = [1, 1, ..., 1] (mỗi khối 1 tầng): quy về đúng S2 (BT10 / BT11)!
 * - Thanh kê trung gian truyền toàn bộ tải tích lũy từ các khối trên xuống khối dưới.
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
  contactArcAngle_deg = 20,
}) {
  if (!bt00 || !bt00.valid) throw new Error('solveS3Stack yêu cầu BT00 hợp lệ');
  if (!Array.isArray(blocks) || blocks.length < 1 || blocks.some(b => !Number.isInteger(b) || b < 1)) {
    throw new Error('blocks của S3 phải là mảng số nguyên dương (ví dụ [2, 2] hoặc [3, 2, 3])');
  }

  const totalLayers = blocks.reduce((a, b) => a + b, 0);
  const sec = bt00.record.computed.section;
  const L = sec.L;
  const x1Nom = Number.isFinite(x1_nom_m) ? x1_nom_m : ((Math.sqrt(2) - 1) / 2) * L;
  const x2Nom = Number.isFinite(x2_nom_m) ? x2_nom_m : L - x1Nom;

  // Trường hợp giới hạn 1: blocks = [n] (n >= 2) -> quy về đúng S1
  if (blocks.length === 1 && blocks[0] >= 2) {
    const s1 = solveS1Stack({
      bt00,
      nLayers: blocks[0],
      baseCount,
      x1_m: x1Nom,
      x2_m: x2Nom,
      processInput,
      contactArcAngle_deg,
    });
    return { ...s1, scheme: 'S3', code: 'BT12', blocks, reducedTo: 'S1' };
  }

  // Trường hợp giới hạn 2: mọi khối chỉ có 1 tầng [1, 1, ..., 1] -> quy về đúng S2
  if (blocks.every(b => b === 1)) {
    const s2 = solveS2Stack({
      bt00,
      nLayers: blocks.length,
      pilesPerLayer: baseCount,
      x1_nom_m: x1Nom,
      x2_nom_m: x2Nom,
      eccentricity_m,
      scenario,
      toleranceMode,
      processInput,
      contactArcAngle_deg,
    });
    return { ...s2, scheme: 'S3', code: 'BT12', blocks, reducedTo: 'S2' };
  }

  // Trường hợp S3 tổng quát: nhiều khối, có ít nhất 1 khối >= 2 tầng và ít nhất 1 mặt kê trung gian
  // Mỗi mặt kê nằm dưới khối b (b = 0 là kê đáy, b = 1..blocks.length-1 là mặt kê trung gian)
  const nBlocks = blocks.length;
  const { x1: x1Blocks, x2: x2Blocks } = buildS2SupportOffsets({
    nLayers: nBlocks,
    x1_nom_m: x1Nom,
    x2_nom_m: x2Nom,
    eccentricity_m,
    scenario,
    toleranceMode,
  });

  // Kiểm tra hình học khả thi: mỗi khối b có bLayers = blocks[b] tầng xếp tam giác -> cần đủ số cọc hàng đáy của khối
  const maxBlockLayers = Math.max(...blocks);
  const mBase = Math.max(baseCount, maxBlockLayers);

  // Giải tích lũy từ khối đỉnh b = nBlocks - 1 xuống khối đáy b = 0
  const blockResults = new Array(nBlocks);
  let P1_fromAboveBlock_perPile = 0;
  let P2_fromAboveBlock_perPile = 0;
  let xP1_above = x1Blocks[nBlocks - 1];
  let xP2_above = x2Blocks[nBlocks - 1];
  let totalPiles = 0;

  for (let b = nBlocks - 1; b >= 0; b--) {
    const bLayers = blocks[b];
    const x1b = x1Blocks[b];
    const x2b = x2Blocks[b];
    const e1b = b === nBlocks - 1 ? 0 : xP1_above - x1b;
    const e2b = b === nBlocks - 1 ? 0 : xP2_above - x2b;

    // Số cọc trong khối b (tầng đáy khối có mBase cọc, giảm dần 1 cọc mỗi tầng nếu bLayers > 1)
    let pilesInBlock = 0;
    for (let k = 0; k < bLayers; k++) pilesInBlock += mBase - k;
    totalPiles += pilesInBlock;

    // Giải riêng nội lực của khối b (nếu bLayers >= 2 dùng S1, nếu bLayers === 1 dùng dầm BT02)
    // Cộng thêm tải tập trung truyền qua thanh kê trung gian từ khối phía trên!
    const blockSelfWeightPerBottomCol = (pilesInBlock / mBase) * sec.totalSelfWeight;
    const bt02Transferred = runBT02({
      pileRecordOrConfig: bt00,
      x1_m: x1b,
      x2_m: x2b,
      P1_N: P1_fromAboveBlock_perPile,
      P2_N: P2_fromAboveBlock_perPile,
      e1_m: e1b,
      e2_m: e2b,
    });

    let blockOwnSol = null;
    let M_ser_Nm = Math.max(Math.abs(bt02Transferred.extremaSI.M_max_sag_Nm), Math.abs(bt02Transferred.extremaSI.M_min_hog_Nm));
    let Q_ser_N = bt02Transferred.extremaSI.Q_max_abs_N;
    let ringCase = 'two_point_diametral';

    if (bLayers >= 2) {
      blockOwnSol = solveS1Stack({
        bt00,
        nLayers: bLayers,
        baseCount: mBase,
        x1_m: x1b,
        x2_m: x2b,
        processInput,
        contactArcAngle_deg,
      });
      // Cộng tác dụng phần tăng mômen do lệch kê trung gian vào mômen uốn xiên của khối S1
      const deltaM_ecc = bt02Transferred.extremaSI.deltaM_max_abs_vs_BT01_Nm;
      M_ser_Nm = Math.max(M_ser_Nm, blockOwnSol.forcesSI.M_combined_ser_Nm + deltaM_ecc);
      Q_ser_N = Math.max(Q_ser_N, blockOwnSol.forcesSI.Q_combined_ser_N);
      ringCase = 'three_point_triangular';
    }

    // Tổng phản lực trên 1 cọc đáy khối b tại 2 tuyến kê (bảo toàn 100% tải tích lũy qua thanh kê trung gian!)
    const R1_block_self = 0.5 * blockSelfWeightPerBottomCol;
    const R2_block_self = 0.5 * blockSelfWeightPerBottomCol;
    const R1_out_perPile = R1_block_self + bt02Transferred.reactionsSI.deltaR1_fromSelfWeight;
    const R2_out_perPile = R2_block_self + bt02Transferred.reactionsSI.deltaR2_fromSelfWeight;
    const maxR_block = Math.max(Math.abs(R1_out_perPile), Math.abs(R2_out_perPile));
    const P_above_block = Math.max(0, maxR_block - 0.5 * sec.totalSelfWeight);
    const P_ring_block = P_above_block + 0.35 * (0.5 * sec.totalSelfWeight);

    const bt03b = runBT03({
      bt00OrConfig: bt00,
      processInput,
      serviceMoment_Nm: M_ser_Nm,
      designMoment_Nm: 1.1 * M_ser_Nm,
      designShearEnd_N: 1.1 * Q_ser_N,
      designShearMid_N: 1.1 * Q_ser_N,
    });
    const bt04b = runBT04({
      bt00,
      normalForce_N: maxR_block,
      contactType: 'pile_batten',
      contactLengthAlongPile_m: 0.1,
      contactArcAngle_deg,
    });
    const bt05b = runBT05({
      bt00,
      x_m: x1b,
      normalForce_N: P_ring_block,
      loadCase: ringCase,
      contactLengthAlongPile_m: 0.1,
    });

    const utilMap = {
      ...bt03b.utilization,
      contactLocal: bt04b.capacitySI.utilization,
      ringCrack: bt05b.capacitiesSI.utilizationCrack,
      ringULS: bt05b.capacitiesSI.utilizationULS,
    };
    const gov = Object.entries(utilMap).reduce((best, cur) => (cur[1] > best[1] ? cur : best));

    blockResults[b] = {
      blockIndex: b + 1,
      layersInBlock: bLayers,
      pilesInBlock,
      x1_m: x1b,
      x2_m: x2b,
      e1_m: e1b,
      e2_m: e2b,
      R1_out_perPile_N: R1_out_perPile,
      R2_out_perPile_N: R2_out_perPile,
      M_ser_Nm,
      Q_ser_N,
      utilization: utilMap,
      governingMechanism: gov[0],
      maxUtilization: gov[1],
      pass: gov[1] <= 1.0,
    };

    // Tải tích lũy truyền nguyên vẹn xuống khối bên dưới qua cặp thanh kê trung gian
    P1_fromAboveBlock_perPile = R1_out_perPile;
    P2_fromAboveBlock_perPile = R2_out_perPile;
    xP1_above = x1b;
    xP2_above = x2b;
  }

  const govBlock = blockResults.reduce((b, c) => (c.maxUtilization > b.maxUtilization ? c : b));
  const totalSystemWeight_N = totalPiles * sec.totalSelfWeight;
  const totalGroundReaction_N = mBase * (blockResults[0].R1_out_perPile_N + blockResults[0].R2_out_perPile_N);
  const relEquilibriumErr = Math.abs(totalGroundReaction_N - totalSystemWeight_N) / Math.max(totalSystemWeight_N, 1);

  // Dựng tọa độ tâm cọc y–z cho S3
  const hz_batten = 0.1;
  const dz_row = sec.Do * Math.cos(Math.PI / 6);
  const crossSectionPiles = [];
  let zBase = 0;
  let globalLayer = 0;
  for (let b = 0; b < nBlocks; b++) {
    zBase += hz_batten; // mặt kê dưới khối b
    const bLayers = blocks[b];
    for (let k = 0; k < bLayers; k++) {
      globalLayer++;
      const zCenter = zBase + sec.Do / 2 + k * dz_row;
      const mk = mBase - k;
      for (let j = 0; j < mk; j++) {
        const yCenter = sec.Do / 2 + k * (sec.Do / 2) + j * sec.Do;
        crossSectionPiles.push({
          block: b + 1,
          layer: globalLayer,
          col: j + 1,
          y_m: yCenter,
          z_m: zCenter,
          U: blockResults[b].maxUtilization,
        });
      }
    }
    zBase += sec.Do + (bLayers - 1) * dz_row;
  }

  return {
    scheme: 'S3',
    code: 'BT12',
    valid: true,
    converged: true,
    verified: relEquilibriumErr < 1e-10,
    blocks,
    nLayers: totalLayers,
    baseCount: mBase,
    totalPiles,
    reducedTo: null,
    blockResults,
    governingBlockIndex: govBlock.blockIndex,
    governingMechanism: govBlock.governingMechanism,
    maxUtilization: govBlock.maxUtilization,
    structuralPass: govBlock.maxUtilization <= 1.0,
    equilibriumSI: {
      totalSystemWeight_N,
      totalGroundReaction_N,
      relEquilibriumErr,
    },
    crossSectionPiles,
  };
}
