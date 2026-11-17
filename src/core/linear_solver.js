/**
 * linear_solver.js — Giải hệ phương trình tuyến tính đặc (dense) cỡ nhỏ.
 * Khử Gauss có chọn phần tử trội theo cột. Dùng cho bài toán dầm một cọc (BT01–BT02).
 * Hệ lớn (nhiều cọc/tiếp xúc) sẽ dùng bộ giải thưa riêng ở các mốc sau.
 */

/**
 * @param {number[][]} A ma trận n×n (không bị sửa)
 * @param {number[]} b vế phải (không bị sửa)
 * @returns {number[]} nghiệm x
 */
export function solveDense(A, b) {
  const n = b.length;
  if (A.length !== n) throw new Error('Kích thước ma trận và vế phải không khớp');
  const M = A.map((row, i) => [...row, b[i]]);
  let scale = 0;
  for (const row of A) for (const v of row) scale = Math.max(scale, Math.abs(v));
  const tiny = (scale || 1) * 1e-14;
  for (let k = 0; k < n; k++) {
    let p = k;
    for (let i = k + 1; i < n; i++) if (Math.abs(M[i][k]) > Math.abs(M[p][k])) p = i;
    if (Math.abs(M[p][k]) <= tiny) {
      throw new Error('Ma trận suy biến: hệ thiếu liên kết hoặc điều kiện biên không hợp lệ');
    }
    if (p !== k) [M[p], M[k]] = [M[k], M[p]];
    const piv = M[k][k];
    for (let i = k + 1; i < n; i++) {
      const f = M[i][k] / piv;
      if (f === 0) continue;
      for (let j = k; j <= n; j++) M[i][j] -= f * M[k][j];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = M[i][n];
    for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j];
    x[i] = s / M[i][i];
  }
  return x;
}
