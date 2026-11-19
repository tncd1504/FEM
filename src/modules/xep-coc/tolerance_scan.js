/**
 * tolerance_scan.js — Bài tính BT13: Khảo sát miền số tầng (n) – độ lệch kê (e)
 * theo khả năng chịu lực của cọc (cơ sở chính TCVN 5574:2018, biên kho lý tưởng).
 *
 * Nguyên tắc bắt buộc (Plan v0.5.0 Mục 4.2 & BT13):
 * - Giải trạng thái danh định (e = 0) trước; nếu danh định không đạt thì không xuất dung sai đạt.
 * - Không mặc định đáp ứng đơn điệu để tìm kiếm nhị phân mù quáng: quét lưới tuần tự từ e = 0
 *   để xác định vùng chấp nhận liên thông chứa trạng thái danh định, sau đó tinh chỉnh biên.
 * - Phân biệt rõ "dung sai khảo sát theo kịch bản đã tính" với "bao dung sai toàn miền".
 * - Không đưa diện tích bãi, sức chịu tải nền/chèn/gỗ hay lún kho vào cơ chế giới hạn.
 */
import { solveS1Stack, solveS2Stack, solveS3Stack } from './stacking_model.js';

/**
 * Đánh giá một điểm (scheme, nLayers, blocks, eccentricity_m) trên cùng điều kiện cọc.
 */
function evaluatePoint({
  bt00,
  scheme,
  nLayers,
  blocks,
  baseCount,
  x1_nom_m,
  x2_nom_m,
  eccentricity_m,
  scenario,
  toleranceMode,
  processInput,
  contactArcAngle_deg,
}) {
  if (scheme === 'S1') {
    // S1 không có kê trung gian; lệch kê chỉ áp dụng ở sơ đồ có mặt kê nhiều tầng (S2/S3)
    // Với S1, khảo sát dịch chuyển vị trí 2 thanh kê đáy so với vị trí danh định x1_nom, x2_nom
    const res = solveS1Stack({
      bt00,
      nLayers,
      baseCount: Math.max(baseCount, nLayers),
      x1_m: x1_nom_m + eccentricity_m,
      x2_m: x2_nom_m - eccentricity_m,
      processInput,
      contactArcAngle_deg,
    });
    return res;
  }
  if (scheme === 'S3') {
    const res = solveS3Stack({
      bt00,
      blocks,
      baseCount,
      x1_nom_m,
      x2_nom_m,
      eccentricity_m,
      scenario,
      toleranceMode,
      processInput,
      contactArcAngle_deg,
    });
    return res;
  }
  return solveS2Stack({
    bt00,
    nLayers,
    pilesPerLayer: baseCount,
    x1_nom_m,
    x2_nom_m,
    eccentricity_m,
    scenario,
    toleranceMode,
    processInput,
    contactArcAngle_deg,
  });
}

/**
 * BT13 — Quét bản đồ miền chấp nhận (n, e) và tìm độ lệch kê cho phép theo từng số tầng n.
 */
export function runBT13ToleranceScan({
  bt00,
  scheme = 'S2', // 'S1' | 'S2' | 'S3'
  nMin = 2,
  nMax = 8,
  baseCount = 6,
  blocksGenerator = null, // cho S3: hàm (n) => mảng blocks, mặc định chia khối [2, 2, ...]
  x1_nom_m = null,
  x2_nom_m = null,
  eccMax_m = 0.60,
  eccStep_m = 0.05,
  refineSteps = 4,
  scenario = 'alternating',
  toleranceMode = 'global_axis',
  processInput = {},
  contactArcAngle_deg = 20,
}) {
  if (!bt00 || !bt00.valid) throw new Error('BT13 yêu cầu BT00 hợp lệ');
  const sec = bt00.record.computed.section;
  const L = sec.L;
  const x1Nom = Number.isFinite(x1_nom_m) ? x1_nom_m : ((Math.sqrt(2) - 1) / 2) * L;
  const x2Nom = Number.isFinite(x2_nom_m) ? x2_nom_m : L - x1Nom;

  const eccGrid = [];
  const nSteps = Math.max(1, Math.round(eccMax_m / eccStep_m));
  for (let i = 0; i <= nSteps; i++) {
    eccGrid.push(Number((i * eccStep_m).toFixed(6)));
  }

  const defaultBlocksForN = (n) => {
    if (n <= 2) return [n];
    const out = [];
    let rem = n;
    while (rem > 0) {
      if (rem === 3) { out.push(3); rem = 0; }
      else if (rem >= 2) { out.push(2); rem -= 2; }
      else { out.push(1); rem -= 1; }
    }
    return out;
  };

  const rowsByLayer = [];
  const heatmapMatrixU = [];
  const heatmapLayerLabels = [];

  for (let n = nMin; n <= nMax; n++) {
    const blocks = scheme === 'S3' ? (blocksGenerator ? blocksGenerator(n) : defaultBlocksForN(n)) : null;
    const gridCells = [];
    let nominalRes = null;
    let connectedPassMaxEcc = null;
    let firstFailEcc = null;
    let firstFailMechanism = null;
    let connectedBroken = false;

    for (const e of eccGrid) {
      const res = evaluatePoint({
        bt00,
        scheme,
        nLayers: n,
        blocks,
        baseCount,
        x1_nom_m: x1Nom,
        x2_nom_m: x2Nom,
        eccentricity_m: e,
        scenario: e === 0 ? 'zero' : scenario,
        toleranceMode,
        processInput,
        contactArcAngle_deg,
      });

      const U = res.valid ? res.maxUtilization : 9.99;
      const pass = Boolean(res.valid && res.converged && res.structuralPass);
      gridCells.push({
        nLayers: n,
        eccentricity_m: e,
        valid: res.valid,
        pass,
        maxUtilization: U,
        governingMechanism: res.governingMechanism || res.status || 'invalid',
      });

      if (e === 0) {
        nominalRes = res;
        if (pass) {
          connectedPassMaxEcc = 0;
        } else {
          connectedBroken = true;
          firstFailEcc = 0;
          firstFailMechanism = res.governingMechanism || res.status;
        }
      } else if (!connectedBroken) {
        if (pass) {
          connectedPassMaxEcc = e;
        } else {
          connectedBroken = true;
          firstFailEcc = e;
          firstFailMechanism = res.governingMechanism || res.status;
        }
      }
    }

    // Tinh chỉnh biên vùng chấp nhận liên thông nếu tìm thấy điểm chuyển từ đạt -> không đạt
    let refinedAllowableEcc_m = connectedPassMaxEcc;
    let reachedSurveyUpperBound = false;
    if (connectedPassMaxEcc !== null && firstFailEcc !== null && firstFailEcc > connectedPassMaxEcc) {
      let lo = connectedPassMaxEcc;
      let hi = firstFailEcc;
      for (let r = 0; r < refineSteps; r++) {
        const mid = 0.5 * (lo + hi);
        const resMid = evaluatePoint({
          bt00,
          scheme,
          nLayers: n,
          blocks,
          baseCount,
          x1_nom_m: x1Nom,
          x2_nom_m: x2Nom,
          eccentricity_m: mid,
          scenario,
          toleranceMode,
          processInput,
          contactArcAngle_deg,
        });
        if (resMid.valid && resMid.converged && resMid.structuralPass) {
          lo = mid;
        } else {
          hi = mid;
          firstFailMechanism = resMid.governingMechanism || firstFailMechanism;
        }
      }
      refinedAllowableEcc_m = lo;
    } else if (connectedPassMaxEcc !== null && firstFailEcc === null) {
      reachedSurveyUpperBound = true;
    }

    rowsByLayer.push({
      nLayers: n,
      blocks,
      nominalPass: Boolean(nominalRes?.valid && nominalRes?.structuralPass),
      nominalMaxU: nominalRes?.valid ? nominalRes.maxUtilization : null,
      nominalMechanism: nominalRes?.governingMechanism || nominalRes?.status || '—',
      allowableEccentricity_m: refinedAllowableEcc_m,
      reachedSurveyUpperBound,
      limitingMechanismAtBoundary: firstFailMechanism || (nominalRes?.governingMechanism ?? '—'),
      coverageNote:
        refinedAllowableEcc_m === null
          ? 'Trạng thái danh định không đạt — không xuất dung sai đạt'
          : reachedSurveyUpperBound
            ? `Đạt tới biên khảo sát e_max = ${eccMax_m} m (chưa kết luận vượt ngoài miền khảo sát)`
            : 'Dung sai khảo sát theo kịch bản đã tính (vùng liên thông chứa e = 0)',
      gridCells,
    });

    heatmapLayerLabels.push(`${n} tầng`);
    heatmapMatrixU.push(gridCells.map(c => Number(Math.min(c.maxUtilization, 2.5).toFixed(4))));
  }

  const maxFeasibleLayersAtNominal = rowsByLayer
    .filter(r => r.nominalPass)
    .reduce((mx, r) => Math.max(mx, r.nLayers), 0);

  return {
    code: 'BT13',
    title: `BT13: Khảo sát miền số tầng – độ lệch kê cho sơ đồ ${scheme} (TCVN 5574:2018)`,
    standard: 'TCVN 5574:2018',
    scheme,
    scenario,
    toleranceMode,
    surveyDomain: { nMin, nMax, eccMax_m, eccStep_m, x1_nom_m: x1Nom, x2_nom_m: x2Nom },
    coverageDisclaimer:
      'Kết quả là dung sai khảo sát theo kịch bản sai lệch đã chọn, không phải bao dung sai toàn miền nếu chưa chứng minh bao phủ mọi tổ hợp sai lệch.',
    maxFeasibleLayersAtNominal,
    rowsByLayer,
    heatmap: {
      xEccentricity_m: eccGrid,
      yLayerLabels: heatmapLayerLabels,
      zMaxUtilization: heatmapMatrixU,
    },
  };
}
