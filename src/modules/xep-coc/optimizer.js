/**
 * optimizer.js — Bài tính BT14: So sánh phương án xếp cọc (S1 / S2 / S3) và trích xuất
 * tập phương án Pareto theo khả năng chịu lực của cọc (cơ sở chính TCVN 5574:2018).
 *
 * Nguyên tắc bắt buộc (Plan v0.5.0 Mục 5 & BT14):
 * - So sánh công bằng trên cùng cấu tạo/vật liệu cọc, cùng chiều dài L và điều kiện biên kho lý tưởng.
 * - Các chỉ tiêu chính theo khả năng chịu lực của cọc:
 *     (1) Tối đa hóa số tầng giới hạn theo cọc (nLayers ↑)
 *     (2) Tối đa hóa dung sai đặt kê khảo sát (allowableEccentricity_m ↑)
 *     (3) Tối thiểu hóa mức sử dụng sức kháng lớn nhất ở trạng thái danh định (nominalMaxU ↓)
 * - Không gộp trọng số tùy ý để tuyên bố một phương án tối ưu duy nhất; xuất tập Pareto đầy đủ
 *   và lưu dấu vết loại phương án (rejectedCandidates).
 * - Không dùng diện tích bãi, sức chịu tải nền/chèn/gỗ hay tài nguyên kho làm ràng buộc tối ưu.
 */
import { runBT13ToleranceScan } from './tolerance_scan.js';

/**
 * Kiểm tra xem phương án A có trội hơn (dominate) phương án B trên cả 3 chỉ tiêu hay không:
 *   nLayers (lớn hơn tốt hơn), allowableEccentricity_m (lớn hơn tốt hơn), nominalMaxU (nhỏ hơn tốt hơn).
 */
function dominates(a, b) {
  const betterOrEqN = a.nLayers >= b.nLayers;
  const betterOrEqE = a.allowableEccentricity_m >= b.allowableEccentricity_m - 1e-6;
  const betterOrEqU = a.nominalMaxU <= b.nominalMaxU + 1e-6;
  const strictlyBetter =
    a.nLayers > b.nLayers ||
    a.allowableEccentricity_m > b.allowableEccentricity_m + 1e-4 ||
    a.nominalMaxU < b.nominalMaxU - 1e-4;
  return betterOrEqN && betterOrEqE && betterOrEqU && strictlyBetter;
}

/**
 * BT14 — So sánh toàn bộ ứng viên hợp lệ từ S1, S2 và S3 trong miền tìm kiếm đã khai báo
 * và chọn tập phương án Pareto theo TCVN 5574:2018.
 */
export function runBT14ParetoOptimizer({
  bt00,
  nMin = 2,
  nMax = 7,
  baseCount = 6,
  x1_nom_m = null,
  x2_nom_m = null,
  eccMax_m = 0.50,
  eccStep_m = 0.05,
  requiredMinEccentricity_m = 0.0,
  scenario = 'alternating',
  toleranceMode = 'global_axis',
  processInput = {},
  contactArcAngle_deg,
}) {
  if (!bt00 || !bt00.valid) throw new Error('BT14 yêu cầu BT00 hợp lệ');
  if (!Number.isFinite(Number(contactArcAngle_deg))) {
    throw new Error('BT14 thiếu góc ôm tiếp xúc cọc–kê contactArcAngle_deg (độ); không tự gán giá trị mặc định.');
  }

  const scanS1 = runBT13ToleranceScan({
    bt00, scheme: 'S1', nMin, nMax, baseCount, x1_nom_m, x2_nom_m, eccMax_m, eccStep_m, scenario, toleranceMode, processInput, contactArcAngle_deg,
  });
  const scanS2 = runBT13ToleranceScan({
    bt00, scheme: 'S2', nMin, nMax, baseCount, x1_nom_m, x2_nom_m, eccMax_m, eccStep_m, scenario, toleranceMode, processInput, contactArcAngle_deg,
  });
  const scanS3 = runBT13ToleranceScan({
    bt00, scheme: 'S3', nMin, nMax, baseCount, x1_nom_m, x2_nom_m, eccMax_m, eccStep_m, scenario, toleranceMode, processInput, contactArcAngle_deg,
  });

  const allCandidates = [];
  const feasibleCandidates = [];
  const rejectedCandidates = [];

  for (const scan of [scanS1, scanS2, scanS3]) {
    for (const row of scan.rowsByLayer) {
      const label =
        scan.scheme === 'S3'
          ? `S3 [${row.blocks.join(',')}] (${row.nLayers} tầng)`
          : `${scan.scheme} (${row.nLayers} tầng)`;

      const cand = {
        id: `${scan.scheme}-N${row.nLayers}${row.blocks ? '-' + row.blocks.join('_') : ''}`,
        label,
        scheme: scan.scheme,
        nLayers: row.nLayers,
        blocks: row.blocks,
        nominalPass: row.nominalPass,
        nominalMaxU: row.nominalMaxU,
        nominalMechanism: row.nominalMechanism,
        allowableEccentricity_m: row.allowableEccentricity_m ?? 0,
        reachedSurveyUpperBound: row.reachedSurveyUpperBound,
        limitingMechanismAtBoundary: row.limitingMechanismAtBoundary,
        storageComplianceNote:
          scan.scheme === 'S2'
            ? 'Có tấm kê giữa mọi tầng (đối chiếu riêng điều kiện lưu kho TCVN 7888)'
            : 'Có tiếp xúc trực tiếp giữa các tầng (đối chiếu riêng quy định tấm kê TCVN 7888)',
      };
      allCandidates.push(cand);

      if (!row.nominalPass) {
        rejectedCandidates.push({
          ...cand,
          rejectionReason: `Không đạt kiểm tra cọc ở trạng thái danh định (U = ${row.nominalMaxU?.toFixed(3)}, cơ chế: ${row.nominalMechanism})`,
        });
      } else if (cand.allowableEccentricity_m < requiredMinEccentricity_m - 1e-9) {
        rejectedCandidates.push({
          ...cand,
          rejectionReason: `Dung sai đặt kê khảo sát (${(cand.allowableEccentricity_m * 1e3).toFixed(0)} mm) nhỏ hơn yêu cầu (${(requiredMinEccentricity_m * 1e3).toFixed(0)} mm)`,
        });
      } else {
        feasibleCandidates.push(cand);
      }
    }
  }

  // Trích xuất tập Pareto không bị trội trong miền tìm kiếm đã khai báo
  const paretoFront = feasibleCandidates.filter(
    (cand) => !feasibleCandidates.some((other) => other.id !== cand.id && dominates(other, cand))
  );

  // Sắp xếp tập Pareto theo số tầng giảm dần rồi theo dung sai giảm dần
  paretoFront.sort((a, b) => b.nLayers - a.nLayers || b.allowableEccentricity_m - a.allowableEccentricity_m || a.nominalMaxU - b.nominalMaxU);

  return {
    code: 'BT14',
    title: 'BT14: So sánh phương án S1/S2/S3 và tập phương án Pareto theo khả năng chịu cọc (TCVN 5574:2018)',
    standard: 'TCVN 5574:2018',
    searchSpaceScope: {
      nMin, nMax, eccMax_m, eccStep_m, requiredMinEccentricity_m, scenario, toleranceMode,
      optimalityNote: 'Tập Pareto tốt nhất trong miền tìm kiếm đã khai báo (không gộp trọng số tùy ý, không ràng buộc diện tích/năng lực kho).',
    },
    scans: { S1: scanS1, S2: scanS2, S3: scanS3 },
    totalEvaluated: allCandidates.length,
    feasibleCount: feasibleCandidates.length,
    rejectedCount: rejectedCandidates.length,
    paretoFront,
    feasibleCandidates,
    rejectedCandidates,
  };
}
