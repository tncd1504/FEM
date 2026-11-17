/**
 * fem_solver.js — Phần tử dầm Euler–Bernoulli 2 nút (uốn trong mặt phẳng x–z).
 *
 * Quy ước (SI): trục x dọc cọc, z thẳng đứng hướng lên.
 *   w  : chuyển vị đứng, dương hướng lên (m)
 *   θ  : góc xoay = dw/dx (rad)
 *   q  : tải phân bố, dương khi hướng XUỐNG (N/m)
 *   P  : tải tập trung, dương khi hướng XUỐNG (N)
 *   R  : phản lực gối, dương khi hướng LÊN (N)
 *   M  : mômen uốn, dương khi căng thớ dưới (võng xuống) (N·m)
 *   Q  : lực cắt, Q = dM/dx (N)
 *
 * Gối là liên kết điểm lý tưởng w = 0 (không cản xoay) — dùng cho bài toán kiểm chứng BT01–BT02.
 * Nghiệm chuyển vị nút của phần tử Hermite là chính xác với tải đều từng đoạn và tải tập trung tại nút;
 * nội lực trong phần tử được phục hồi bằng cân bằng, chuyển vị trong phần tử cộng nghiệm riêng ngàm–ngàm.
 */
import { solveDense } from './linear_solver.js';

const EPS_X = 1e-9; // dung sai gộp tọa độ nút (m)

function uniqSorted(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const out = [];
  for (const x of s) if (!out.length || Math.abs(x - out[out.length - 1]) > EPS_X) out.push(x);
  return out;
}

/**
 * @param {object} model
 * @param {number} model.L chiều dài dầm (m)
 * @param {number|function(number):number} model.EI độ cứng chống uốn (N·m²), hằng số hoặc hàm của x
 * @param {number[]} model.supports tọa độ các gối điểm w=0 (m)
 * @param {{x0:number,x1:number,q:number,label?:string}[]} [model.distributed] tải phân bố đều từng đoạn (N/m, xuống +)
 * @param {{x:number,P:number,label?:string}[]} [model.point] tải tập trung (N, xuống +)
 * @param {number} [model.maxElementLength] chiều dài phần tử tối đa (m); mặc định L/60
 * @param {number[]} [model.extraNodes] nút bổ sung (ví dụ ranh giới vùng tiết diện)
 */
export function solveBeam(model) {
  const { L, EI, supports } = model;
  const distributed = model.distributed || [];
  const point = model.point || [];
  if (!(L > 0)) throw new Error('Chiều dài dầm L phải > 0');
  if (!supports || supports.length < 2) throw new Error('Cần tối thiểu hai gối để dầm ổn định');
  for (const s of supports) if (!(s >= -EPS_X && s <= L + EPS_X)) throw new Error(`Gối x=${s} nằm ngoài dầm`);
  for (const d of distributed) {
    if (!(d.x1 > d.x0)) throw new Error('Đoạn tải phân bố phải có x1 > x0');
    if (d.x0 < -EPS_X || d.x1 > L + EPS_X) throw new Error('Đoạn tải phân bố nằm ngoài dầm');
  }
  for (const p of point) if (p.x < -EPS_X || p.x > L + EPS_X) throw new Error(`Tải tập trung x=${p.x} nằm ngoài dầm`);
  const EIfun = typeof EI === 'function' ? EI : () => EI;

  // --- lưới nút ---
  const hMax = model.maxElementLength || L / 60;
  const key = uniqSorted([0, L, ...supports, ...point.map(p => p.x),
    ...distributed.flatMap(d => [d.x0, d.x1]), ...(model.extraNodes || [])]
    .map(x => Math.min(L, Math.max(0, x))));
  const nodes = [];
  for (let i = 0; i < key.length - 1; i++) {
    const a = key[i], b = key[i + 1];
    const n = Math.max(1, Math.ceil((b - a) / hMax - 1e-12));
    for (let k = 0; k < n; k++) nodes.push(a + (b - a) * k / n);
  }
  nodes.push(L);
  const nn = nodes.length, ndof = 2 * nn;
  const nodeIndex = (x) => {
    let best = 0;
    for (let i = 1; i < nn; i++) if (Math.abs(nodes[i] - x) < Math.abs(nodes[best] - x)) best = i;
    if (Math.abs(nodes[best] - x) > 1e-7) throw new Error('Không tìm thấy nút tại x=' + x);
    return best;
  };

  // --- lắp ráp ---
  const K = Array.from({ length: ndof }, () => new Array(ndof).fill(0));
  const F = new Array(ndof).fill(0);
  const elements = [];
  for (let e = 0; e < nn - 1; e++) {
    const xa = nodes[e], xb = nodes[e + 1], l = xb - xa, xm = (xa + xb) / 2;
    const EIe = EIfun(xm);
    if (!(EIe > 0)) throw new Error(`EI phải > 0 (tại x=${xm})`);
    let q = 0;
    for (const d of distributed) if (xm > d.x0 && xm < d.x1) q += d.q;
    const c = EIe / (l * l * l);
    const ke = [
      [12 * c, 6 * l * c, -12 * c, 6 * l * c],
      [6 * l * c, 4 * l * l * c, -6 * l * c, 2 * l * l * c],
      [-12 * c, -6 * l * c, 12 * c, -6 * l * c],
      [6 * l * c, 2 * l * l * c, -6 * l * c, 4 * l * l * c],
    ];
    // tải nút tương đương của tải đều q (xuống +) theo chiều +w, +θ
    const fe = [-q * l / 2, -q * l * l / 12, -q * l / 2, q * l * l / 12];
    const dofs = [2 * e, 2 * e + 1, 2 * e + 2, 2 * e + 3];
    for (let i = 0; i < 4; i++) {
      F[dofs[i]] += fe[i];
      for (let j = 0; j < 4; j++) K[dofs[i]][dofs[j]] += ke[i][j];
    }
    elements.push({ xa, xb, l, EI: EIe, q, ke, fe, dofs });
  }
  for (const p of point) F[2 * nodeIndex(p.x)] -= p.P;

  // --- điều kiện biên ---
  const fixed = uniqSorted(supports).map(s => 2 * nodeIndex(s));
  const fixedSet = new Set(fixed);
  const free = [];
  for (let i = 0; i < ndof; i++) if (!fixedSet.has(i)) free.push(i);
  const Kff = free.map(i => free.map(j => K[i][j]));
  const Ff = free.map(i => F[i]);
  const uf = solveDense(Kff, Ff);
  const u = new Array(ndof).fill(0);
  free.forEach((i, k) => { u[i] = uf[k]; });

  // --- phản lực (lên +) ---
  const reactions = fixed.map(d => {
    let r = -F[d];
    for (let j = 0; j < ndof; j++) r += K[d][j] * u[j];
    return { x: nodes[d / 2], R: r };
  });

  // --- lực đầu phần tử ---
  for (const el of elements) {
    const ue = el.dofs.map(d => u[d]);
    el.ue = ue;
    el.end = el.ke.map((row, i) => row.reduce((s, v, j) => s + v * ue[j], 0) - el.fe[i]); // [V1,M1,V2,M2]
  }

  /** Nội lực và chuyển vị tại x. side='left' lấy giới hạn trái (khi x trùng nút có bước nhảy). */
  function at(x, side = 'right') {
    let el = null;
    if (side === 'left') {
      el = elements.find(e => x > e.xa + EPS_X && x <= e.xb + EPS_X) || elements[0];
    } else {
      el = elements.find(e => x >= e.xa - EPS_X && x < e.xb - EPS_X) || elements[elements.length - 1];
    }
    const s = Math.min(el.l, Math.max(0, x - el.xa));
    const [V1, M1] = el.end;
    const M = V1 * s - M1 - el.q * s * s / 2;
    const Q = V1 - el.q * s;
    const r = s / el.l, l = el.l;
    const H = [1 - 3 * r * r + 2 * r ** 3, l * (r - 2 * r * r + r ** 3), 3 * r * r - 2 * r ** 3, l * (-r * r + r ** 3)];
    const w = H.reduce((a, h, i) => a + h * el.ue[i], 0) - el.q * s * s * (l - s) * (l - s) / (24 * el.EI);
    return { x, M, Q, w };
  }

  /** Lấy mẫu dày cho biểu đồ, có hai giá trị tại các điểm bước nhảy. */
  function diagram(pointsPerElement = 6) {
    const out = [];
    for (const el of elements) {
      for (let k = 0; k <= pointsPerElement; k++) {
        const x = el.xa + el.l * k / pointsPerElement;
        out.push(at(x, k === pointsPerElement ? 'left' : 'right'));
      }
    }
    return out;
  }

  // --- kiểm tra cân bằng toàn dầm ---
  const totalLoad = distributed.reduce((s, d) => s + d.q * (d.x1 - d.x0), 0) + point.reduce((s, p) => s + p.P, 0);
  const totalReaction = reactions.reduce((s, r) => s + r.R, 0);
  const momentLoad = distributed.reduce((s, d) => s + d.q * (d.x1 - d.x0) * (d.x0 + d.x1) / 2, 0) + point.reduce((s, p) => s + p.P * p.x, 0);
  const momentReaction = reactions.reduce((s, r) => s + r.R * r.x, 0);
  const equilibrium = {
    totalLoad, totalReaction,
    forceResidual: totalReaction - totalLoad,
    momentResidual: momentReaction - momentLoad,
    relForce: Math.abs(totalReaction - totalLoad) / Math.max(Math.abs(totalLoad), 1e-30),
    relMoment: Math.abs(momentReaction - momentLoad) / Math.max(Math.abs(momentLoad), Math.abs(totalLoad) * L, 1e-30),
  };

  return { nodes, u, elements, reactions, at, diagram, equilibrium, nElements: elements.length };
}
