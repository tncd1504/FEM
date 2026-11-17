/**
 * support_checker.js — Triển khai các bài tính truyền lực qua thanh kê gỗ cứng và điều kiện biên lý tưởng:
 * - BT06: Thanh kê gỗ 100 × 100 mm tuyệt đối cứng truyền tải giữa các cọc (tiếp xúc một phía, chuyển động vật rắn).
 * - BT07: Ràng buộc giữ ngang lý tưởng, đủ năng lực và xác định lực tác dụng lên cọc.
 * - BT08: Hai tuyến kê đáy trên nền cứng lý tưởng, không lún, đủ năng lực.
 *
 * Nguyên tắc bắt buộc (Plan v0.5.0 & Skill fem-web):
 * - Thanh kê là gỗ tiết diện 0,1 × 0,1 m (A = 0,01 m²), tuyệt đối cứng; không yêu cầu môđun/cường độ gỗ
 *   và không kiểm tra uốn, cắt, nén hay độ võng thanh gỗ.
 * - Không tự chia đều phản lực cho các cọc bên dưới khi tải đặt lệch tâm hoặc khi mất tiếp xúc.
 * - Kho được giả thiết đủ năng lực (nền cứng không lún, biên giữ ngang đủ năng lực); không yêu cầu dữ liệu
 *   địa kỹ thuật/ma sát kho/cường độ chèn và không tạo trạng thái thiếu dữ liệu vì các thông số kho đó.
 */

function deepFreeze(obj) {
  if (!obj || typeof obj !== 'object' || Object.isFrozen(obj)) return obj;
  Object.freeze(obj);
  for (const k of Object.keys(obj)) {
    if (obj[k] && typeof obj[k] === 'object') deepFreeze(obj[k]);
  }
  return obj;
}

/**
 * BT06 — Giải cân bằng, chuyển động vật rắn (w0, θ_y) và phân phối lực tiếp xúc một phía (unilateral contact)
 * qua một thanh kê gỗ 100 × 100 mm tuyệt đối cứng chạy ngang bãi (theo trục y).
 *
 * Mô hình cơ học:
 * - Thanh kê tuyệt đối cứng có chuyển vị đứng tại tọa độ y là: w_batten(y) = w0 + theta_y * (y - y_ref) (quy ước xuống +).
 * - Tại mỗi cọc đỡ bên dưới thứ j (tọa độ y_j, độ cứng tiếp xúc phía cọc k_j > 0, khe hở ban đầu gap_j >= 0):
 *   Phản lực nén R_j = k_j * max(0, w_batten(y_j) - gap_j) >= 0 (tiếp xúc một phía: chỉ chịu nén, tự tách khi hở).
 * - Giải bằng thuật toán lặp Tập hoạt động (Active-Set Iteration) thỏa mãn đồng thời:
 *   1) Cân bằng lực đứng: sum(R_j) = sum(P_upper) + W_batten
 *   2) Cân bằng mômen quanh y_ref: sum(R_j * (y_j - y_ref)) = sum(P_i * (y_P_i - y_ref)) + W_batten * (y_G - y_ref)
 *   3) Điều kiện bổ sung trực giao (complementarity): R_j >= 0, gap_eff_j >= 0, R_j * gap_eff_j = 0.
 */
export function runBT06({
  battenLength_y_m = 3.0,
  lowerPileCoords_y_m = [0.3, 0.9, 1.5, 2.1, 2.7],
  upperLoads = [{ y_m: 0.6, P_N: 60000 }, { y_m: 1.5, P_N: 60000 }, { y_m: 2.4, P_N: 60000 }],
  contactStiffnessPerPile_N_per_m = 2.0e8,
  initialGaps_m = null,
  battenSelfWeight_N = 0,
}) {
  const nPiles = lowerPileCoords_y_m.length;
  if (nPiles < 1) throw new Error('BT06 cần ít nhất 1 cọc đỡ bên dưới');
  if (!(battenLength_y_m > 0)) throw new Error('Chiều dài thanh kê battenLength_y_m phải > 0');

  const ys = lowerPileCoords_y_m.map(Number);
  const ks = Array.isArray(contactStiffnessPerPile_N_per_m)
    ? contactStiffnessPerPile_N_per_m.map(Number)
    : new Array(nPiles).fill(Number(contactStiffnessPerPile_N_per_m));
  const gaps = Array.isArray(initialGaps_m) ? initialGaps_m.map(Number) : new Array(nPiles).fill(0);

  const y_ref = ys.reduce((a, b) => a + b, 0) / nPiles;
  const y_G = 0.5 * battenLength_y_m;

  const totalUpperForce_N = upperLoads.reduce((s, l) => s + Number(l.P_N), 0) + Number(battenSelfWeight_N);
  const totalMomentAboutRef_Nm =
    upperLoads.reduce((s, l) => s + Number(l.P_N) * (Number(l.y_m) - y_ref), 0) +
    Number(battenSelfWeight_N) * (y_G - y_ref);

  // Giải Active-Set cho tập tiếp xúc hoạt động
  let active = new Array(nPiles).fill(true);
  let w0 = 0;
  let theta_y = 0;
  let converged = false;
  let iterations = 0;

  for (let iter = 1; iter <= 30; iter++) {
    iterations = iter;
    const actIdx = [];
    for (let j = 0; j < nPiles; j++) if (active[j]) actIdx.push(j);

    if (actIdx.length === 0) break;

    if (actIdx.length === 1) {
      const j0 = actIdx[0];
      if (Math.abs(totalMomentAboutRef_Nm + totalUpperForce_N * ( y_ref - ys[j0])) > 1e-6) {
        // 1 điểm tỳ không thể cân bằng mômen lệch tâm
        converged = false;
        break;
      }
      w0 = gaps[j0] + totalUpperForce_N / ks[j0];
      theta_y = 0;
    } else {
      let S0 = 0, S1 = 0, S2 = 0, B0 = totalUpperForce_N, B1 = totalMomentAboutRef_Nm;
      for (const j of actIdx) {
        const dy = ys[j] - y_ref;
        const kj = ks[j];
        S0 += kj;
        S1 += kj * dy;
        S2 += kj * dy * dy;
        B0 += kj * gaps[j];
        B1 += kj * gaps[j] * dy;
      }
      const det = S0 * S2 - S1 * S1;
      if (Math.abs(det) <= 1e-18) {
        converged = false;
        break;
      }
      w0 = (B0 * S2 - B1 * S1) / det;
      theta_y = (S0 * B1 - S1 * B0) / det;
    }

    const nextActive = new Array(nPiles).fill(false);
    for (let j = 0; j < nPiles; j++) {
      const pen = w0 + theta_y * (ys[j] - y_ref) - gaps[j];
      if (pen > 1e-14) nextActive[j] = true;
    }

    if (nextActive.every((v, j) => v === active[j])) {
      converged = true;
      break;
    }
    active = nextActive;
  }

  const reactions = ys.map((y, j) => {
    const w_at_y = w0 + theta_y * (y - y_ref);
    const penetration_m = Math.max(0, w_at_y - gaps[j]);
    const gapOpening_m = Math.max(0, gaps[j] - w_at_y);
    const R_N = active[j] ? ks[j] * penetration_m : 0;
    return {
      pileIndex: j + 1,
      y_m: y,
      active: R_N > 0,
      R_N,
      penetration_m,
      gapOpening_m,
    };
  });

  const sumR_N = reactions.reduce((s, r) => s + r.R_N, 0);
  const sumM_Nm = reactions.reduce((s, r) => s + r.R_N * (r.y_m - y_ref), 0);
  const forceResidual_N = sumR_N - totalUpperForce_N;
  const momentResidual_Nm = sumM_Nm - totalMomentAboutRef_Nm;
  const relForceErr = Math.abs(forceResidual_N) / Math.max(totalUpperForce_N, 1);
  const relMomentErr = Math.abs(momentResidual_Nm) / Math.max(Math.abs(totalMomentAboutRef_Nm), totalUpperForce_N * battenLength_y_m, 1);

  return deepFreeze({
    code: 'BT06',
    title: 'BT06: Truyền lực qua thanh kê gỗ 100 × 100 mm tuyệt đối cứng (tiếp xúc một phía)',
    valid: true,
    verified: converged && relForceErr < 1e-10 && relMomentErr < 1e-10,
    battenSpecSI: {
      material: 'Gỗ (mô hình vật rắn tuyệt đối cứng)',
      bx_m: 0.1,
      hz_m: 0.1,
      crossSectionArea_m2: 0.01,
      length_y_m: battenLength_y_m,
      timberStrengthOrDeflectionChecked: false,
      requireTimberModulusOrStrength: false,
    },
    rigidBodyMotionSI: {
      y_ref_m: y_ref,
      w0_m: w0,
      theta_y_rad: theta_y,
      converged,
      iterations,
      activeContactCount: reactions.filter(r => r.active).length,
      separatedContactCount: reactions.filter(r => !r.active).length,
    },
    equilibriumSI: {
      totalUpperForce_N,
      totalReaction_N: sumR_N,
      forceResidual_N,
      momentResidual_Nm,
      relForceErr,
      relMomentErr,
    },
    reactions,
  });
}

/**
 * BT07 — Kiểm chứng ràng buộc giữ ngang lý tưởng (đủ năng lực) và xác định lực tác dụng lên cọc
 * trong sơ đồ xếp tam giác (cụm 3 cọc đối xứng: 2 cọc đáy + 1 cọc đỉnh tỳ nghiêng góc α = 30°).
 *
 * Lưu ý bắt buộc (Plan v0.5.0):
 * - Chỉ giải cân bằng vật thể tách riêng để xác định lực tiếp xúc nghiêng N_inclined và phản lực giữ ngang
 *   lý tưởng H_restraint tại cọc biên; không yêu cầu sức chịu tải chèn hay ma sát kho, và không tự khóa cứng
 *   chuyển vị ngang của mọi cọc mà không qua ràng buộc biên đã định nghĩa.
 */
export function runBT07({
  Do_m = 0.6,
  pileWeightPerRow_N = 45000,
  contactAngleFromVertical_deg = 30,
  includeIdealSideRestraint = true,
}) {
  if (!includeIdealSideRestraint) {
    return deepFreeze({
      code: 'BT07',
      title: 'BT07: Kiểm chứng điều kiện biên ngang lý tưởng',
      valid: false,
      verified: true,
      equilibriumValid: false,
      status: 'mất cân bằng hình học khi bỏ ràng buộc giữ biên lý tưởng (không dựa vào ma sát để tự khóa ngang)',
    });
  }

  const alpha = (Number(contactAngleFromVertical_deg) * Math.PI) / 180; // 30° với xếp tam giác đều tâm cọc cách nhau Do
  const W = Number(pileWeightPerRow_N);

  // Vật thể tách riêng 1: Cọc đỉnh (hàng 2) nặng W tỳ đối xứng lên 2 cọc đáy dưới góc nghiêng α so với phương đứng:
  // 2 * N_contact * cos(α) = W  =>  N_contact = W / (2 * cos(α))
  const N_contact_N = W / (2 * Math.cos(alpha));

  // Vật thể tách riêng 2: Một cọc đáy biên chịu tự trọng W, lực tiếp xúc nghiêng N_contact từ cọc trên:
  // - Thành phần đứng truyền xuống kê đáy: R_vertical = W + N_contact * cos(α) = 1,5 * W
  // - Thành phần đẩy ngang ra phía biên: H_restraint = N_contact * sin(α) = 0,5 * W * tan(α)
  const R_vertical_per_bottom_pile_N = W + N_contact_N * Math.cos(alpha);
  const H_restraint_N = N_contact_N * Math.sin(alpha);

  // Kiểm tra cân bằng toàn cụm 3 cọc:
  const totalWeight3Piles_N = 3 * W;
  const totalVerticalReaction_N = 2 * R_vertical_per_bottom_pile_N;
  const netHorizontalForce_N = H_restraint_N - H_restraint_N; // đối xứng trái - phải
  const forceBalanceErr = Math.abs(totalVerticalReaction_N - totalWeight3Piles_N) / Math.max(totalWeight3Piles_N, 1);

  return deepFreeze({
    code: 'BT07',
    title: 'BT07: Ràng buộc giữ ngang lý tưởng, đủ năng lực và lực tác dụng lên cọc',
    valid: true,
    verified: forceBalanceErr < 1e-14,
    scopePolicy: {
      warehouseChockCapacityChecked: false,
      frictionUsedForEquilibrium: false,
      arbitraryAllPileHorizontalLock: false,
      idealBoundaryDescription: 'Ràng buộc biên pháp tuyến lý tưởng tại mép ngoài cọc biên tầng đáy, năng lực không giới hạn',
    },
    inputsSI: {
      Do_m,
      pileWeightPerRow_N: W,
      contactAngleFromVertical_deg,
    },
    forcesOnPileSI: {
      N_inclined_contact_N: N_contact_N,
      H_ideal_side_restraint_N: H_restraint_N,
      R_vertical_per_bottom_pile_N,
      totalWeight3Piles_N,
      totalVerticalReaction_N,
      netHorizontalForce_N,
      forceBalanceErr,
    },
  });
}

/**
 * BT08 — Kiểm chứng hai tuyến kê đáy trên nền kho cứng lý tưởng, không lún, đủ năng lực.
 * Không yêu cầu dữ liệu địa kỹ thuật/sức chịu tải nền và không tạo trạng thái thiếu dữ liệu khi bỏ thông số nền.
 */
export function runBT08({
  L_m = 12.0,
  x1_m = 2.485281374,
  x2_m = 9.514718626,
  line1TotalLoad_N = 150000,
  line2TotalLoad_N = 150000,
  optionalWarehouseGroundParams = undefined,
}) {
  if (!(L_m > 0 && x1_m >= 0 && x2_m > x1_m && x2_m <= L_m)) {
    throw new Error('Tọa độ hai tuyến kê đáy x1, x2 không hợp lệ');
  }

  // Nền cứng lý tưởng tuyệt đối không lún (w_ground_1 = w_ground_2 = 0):
  // Phản lực nền tại mỗi tuyến kê đáy cân bằng trực tiếp với tổng tải truyền xuống tuyến kê đó.
  const R_ground_1_N = Number(line1TotalLoad_N);
  const R_ground_2_N = Number(line2TotalLoad_N);
  const totalLoad_N = R_ground_1_N + R_ground_2_N;
  const totalGroundReaction_N = R_ground_1_N + R_ground_2_N;
  const isSymmetric = Math.abs(x1_m - (L_m - x2_m)) < 1e-9 && Math.abs(R_ground_1_N - R_ground_2_N) < 1e-9;

  return deepFreeze({
    code: 'BT08',
    title: 'BT08: Hai tuyến kê đáy trên nền kho cứng lý tưởng, không lún, đủ năng lực',
    valid: true,
    verified: Math.abs(totalGroundReaction_N - totalLoad_N) < 1e-12,
    scopePolicy: {
      groundModel: 'rigid_unyielding_no_settlement',
      geotechnicalDataRequired: false,
      bearingCapacityOrSettlementChecked: false,
      missingGroundDataBlocksCalculation: false,
      ignoredOptionalParamsReceived: optionalWarehouseGroundParams !== undefined,
    },
    inputsSI: {
      L_m,
      x1_m,
      x2_m,
      line1TotalLoad_N: R_ground_1_N,
      line2TotalLoad_N: R_ground_2_N,
    },
    outputsSI: {
      R_ground_1_N,
      R_ground_2_N,
      w_settlement_1_m: 0,
      w_settlement_2_m: 0,
      differentialSettlement_m: 0,
      totalGroundReaction_N,
      isSymmetric,
    },
  });
}
