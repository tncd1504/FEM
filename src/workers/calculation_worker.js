/**
 * calculation_worker.js — Web Worker chạy tác vụ nặng (BT13 quét miền số tầng–độ lệch
 * và BT14 tối ưu Pareto đa sơ đồ S1/S2/S3) trên luồng nền để tránh treo giao diện trình duyệt.
 */
import { runBT00 } from '../modules/xep-coc/pile_specs.js';
import { runBT13ToleranceScan } from '../modules/xep-coc/tolerance_scan.js';
import { runBT14ParetoOptimizer } from '../modules/xep-coc/optimizer.js';

self.onmessage = (event) => {
  const { taskId, type, payload } = event.data || {};
  try {
    const bt00 = runBT00(payload.pileConfig);
    if (!bt00.valid) {
      self.postMessage({ taskId, ok: false, error: `BT00 chưa hợp lệ: ${(bt00.errors || []).join('; ')}` });
      return;
    }

    if (type === 'RUN_BT13') {
      const result = runBT13ToleranceScan({ bt00, ...payload.scanOptions });
      self.postMessage({ taskId, ok: true, type, result });
      return;
    }

    if (type === 'RUN_BT14') {
      const result = runBT14ParetoOptimizer({ bt00, ...payload.optOptions });
      self.postMessage({ taskId, ok: true, type, result });
      return;
    }

    self.postMessage({ taskId, ok: false, error: `Tác vụ worker không được hỗ trợ: ${type}` });
  } catch (err) {
    self.postMessage({ taskId, ok: false, error: err?.message || String(err) });
  }
};
