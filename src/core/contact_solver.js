/**
 * contact_solver.js — Bộ giải hệ nhiều dầm có tiếp xúc một phía (unilateral contact — chỉ chịu nén,
 * cho phép tách hở) dọc theo trục cọc x bằng thuật toán lặp Tập hoạt động (Active-Set Iteration).
 *
 * Quy ước (SI):
 * - Trục x dọc cọc [0, L], z hướng lên.
 * - w_k(x) > 0 hướng lên; tải phân bố q_k > 0 hướng xuống.
 * - Tại mặt tiếp xúc giữa tầng dưới k và tầng trên k+1 ở nút x_i:
 *     độ thâm nhập (penetration) = w_k(x_i) - w_{k+1}(x_i)
 *     nếu > 0: tiếp xúc hoạt động, lực nén F_c = kc * (w_k - w_{k+1}) > 0 (đẩy dầm dưới xuống, đẩy dầm trên lên)
 *     nếu <= 0: tách hở, F_c = 0, khe hở gap = w_{k+1} - w_k >= 0.
 *
 * Phục vụ rời rạc hóa tiếp xúc đường dọc thân cho S1 (BT09) và các khối xếp trực tiếp của S3 (BT12).
 */
import { solveDense } from './linear_solver.js';

const EPS_X = 1e-9;

function uniqSorted(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const out = [];
  for (const x of s) if (!out.length || Math.abs(x - out[out.length - 1]) > EPS_X) out.push(x);
  return out;
}

/**
 * Giải hệ nLayers dầm chồng đứng trên nhau có tiếp xúc một phía dọc trục x.
 *
 * @param {object} params
 * @param {number} params.L chiều dài cọc (m)
 * @param {number[]} params.layerEI độ cứng uốn EI của từng tầng [tầng 0 (đáy), ..., tầng n-1 (đỉnh)] (N·m²)
 * @param {number[]} params.layerQ tải phân bố đều q của từng tầng (N/m, hướng xuống +)
 * @param {number[]} params.bottomSupports vị trí hai gối đáy [x1, x2] trên tầng 0 (m)
 * @param {{layer:number, x:number, P:number}[]} [params.pointLoads] tải tập trung bổ sung (N, hướng xuống +)
 * @param {number} [params.nElements=24] số phần tử dầm mỗi cọc (đủ mịn để bắt tách hở dọc thân, vẫn nhanh cho dense solver)
 * @param {number} [params.contactStiffnessPerMeter=5e9] độ cứng tiếp xúc phân bố dọc thân (N/m²)
 * @param {number} [params.maxIter=25] số vòng lặp Active-Set tối đa
 */
export function solveStackedLineContact({
  L,
  layerEI,
  layerQ,
  bottomSupports,
  pointLoads = [],
  nElements = 24,
  contactStiffnessPerMeter = 5e9,
  maxIter = 25,
}) {
  const nLayers = layerEI.length;
  if (nLayers < 2) throw new Error('solveStackedLineContact cần ít nhất 2 tầng dầm');
  if (!bottomSupports || bottomSupports.length < 2) throw new Error('Cần ít nhất 2 gối đáy');

  const key = uniqSorted([
    0,
    L,
    ...bottomSupports,
    ...pointLoads.map(p => p.x),
  ].map(x => Math.min(L, Math.max(0, x))));

  const hMax = L / nElements;
  const nodes = [];
  for (let i = 0; i < key.length - 1; i++) {
    const a = key[i], b = key[i + 1];
    const n = Math.max(1, Math.ceil((b - a) / hMax - 1e-12));
    for (let k = 0; k < n; k++) nodes.push(a + (b - a) * k / n);
  }
  nodes.push(L);
  const nn = nodes.length;
  const dofPerBeam = 2 * nn;
  const totalDof = nLayers * dofPerBeam;

  const nodeIndex = (x) => {
    let best = 0;
    for (let i = 1; i < nn; i++) if (Math.abs(nodes[i] - x) < Math.abs(nodes[best] - x)) best = i;
    return best;
  };

  // Chiều dài ảnh hưởng (tributary length) tại mỗi nút để gán độ cứng lò xo tiếp xúc nút kc_i = k_line * L_trib_i
  const tribLen = new Array(nn).fill(0);
  for (let e = 0; e < nn - 1; e++) {
    const l = nodes[e + 1] - nodes[e];
    tribLen[e] += 0.5 * l;
    tribLen[e + 1] += 0.5 * l;
  }

  // Ma trận độ cứng cơ sở của các dầm rời và vector tải trọng ngoài
  const Kbase = Array.from({ length: totalDof }, () => new Array(totalDof).fill(0));
  const Fbase = new Array(totalDof).fill(0);
  const elemMeta = [];

  for (let lay = 0; lay < nLayers; lay++) {
    const EI = layerEI[lay];
    const q = layerQ[lay];
    const baseDof = lay * dofPerBeam;
    const layElems = [];
    for (let e = 0; e < nn - 1; e++) {
      const l = nodes[e + 1] - nodes[e];
      const c = EI / (l * l * l);
      const ke = [
        [12 * c, 6 * l * c, -12 * c, 6 * l * c],
        [6 * l * c, 4 * l * l * c, -6 * l * c, 2 * l * l * c],
        [-12 * c, -6 * l * c, 12 * c, -6 * l * c],
        [6 * l * c, 2 * l * l * c, -6 * l * c, 4 * l * l * c],
      ];
      const fe = [-q * l / 2, -q * l * l / 12, -q * l / 2, q * l * l / 12];
      const dofs = [baseDof + 2 * e, baseDof + 2 * e + 1, baseDof + 2 * e + 2, baseDof + 2 * e + 3];
      for (let i = 0; i < 4; i++) {
        Fbase[dofs[i]] += fe[i];
        for (let j = 0; j < 4; j++) Kbase[dofs[i]][dofs[j]] += ke[i][j];
      }
      layElems.push({ xa: nodes[e], xb: nodes[e + 1], l, EI, q, ke, fe, dofs });
    }
    elemMeta.push(layElems);
  }

  for (const p of pointLoads) {
    const d = p.layer * dofPerBeam + 2 * nodeIndex(p.x);
    Fbase[d] -= p.P;
  }

  // Điều kiện biên gối đáy trên tầng 0
  const fixedDofs = uniqSorted(bottomSupports).map(s => 2 * nodeIndex(s));
  const fixedSet = new Set(fixedDofs);
  const freeDofs = [];
  for (let i = 0; i < totalDof; i++) if (!fixedSet.has(i)) freeDofs.push(i);

  // Active-Set cho các cặp tiếp xúc (interface k giữa tầng k và k+1, tại nút i)
  const nInterfaces = nLayers - 1;
  let active = Array.from({ length: nInterfaces }, () => new Array(nn).fill(true));
  let u = new Array(totalDof).fill(0);
  let converged = false;
  let iterations = 0;

  for (let iter = 1; iter <= maxIter; iter++) {
    iterations = iter;
    const K = Kbase.map(row => [...row]);

    for (let k = 0; k < nInterfaces; k++) {
      for (let i = 0; i < nn; i++) {
        if (!active[k][i]) continue;
        const kc = contactStiffnessPerMeter * tribLen[i];
        const dLow = k * dofPerBeam + 2 * i;
        const dUp = (k + 1) * dofPerBeam + 2 * i;
        K[dLow][dLow] += kc;
        K[dUp][dUp] += kc;
        K[dLow][dUp] -= kc;
        K[dUp][dLow] -= kc;
      }
    }

    const Kff = freeDofs.map(i => freeDofs.map(j => K[i][j]));
    const Ff = freeDofs.map(i => Fbase[i]);
    const uf = solveDense(Kff, Ff);
    u = new Array(totalDof).fill(0);
    freeDofs.forEach((d, idx) => { u[d] = uf[idx]; });

    let changed = false;
    const nextActive = Array.from({ length: nInterfaces }, () => new Array(nn).fill(false));
    for (let k = 0; k < nInterfaces; k++) {
      for (let i = 0; i < nn; i++) {
        const wLow = u[k * dofPerBeam + 2 * i];
        const wUp = u[(k + 1) * dofPerBeam + 2 * i];
        const pen = wLow - wUp; // > 0 là nén
        nextActive[k][i] = pen > -1e-13;
        if (nextActive[k][i] !== active[k][i]) changed = true;
      }
    }
    active = nextActive;
    if (!changed) {
      converged = true;
      break;
    }
  }

  // Trích xuất lực tiếp xúc tại mỗi giao diện & phản lực gối đáy
  const interfaces = [];
  for (let k = 0; k < nInterfaces; k++) {
    const contacts = [];
    let totalContactForce_N = 0;
    let activeCount = 0;
    for (let i = 0; i < nn; i++) {
      const wLow = u[k * dofPerBeam + 2 * i];
      const wUp = u[(k + 1) * dofPerBeam + 2 * i];
      const kc = contactStiffnessPerMeter * tribLen[i];
      const pen = Math.max(0, wLow - wUp);
      const gap = Math.max(0, wUp - wLow);
      const Fc = active[k][i] ? kc * pen : 0;
      if (Fc > 0) activeCount++;
      totalContactForce_N += Fc;
      contacts.push({
        x_m: nodes[i],
        active: Fc > 0,
        force_N: Fc,
        lineIntensity_N_per_m: tribLen[i] > 0 ? Fc / tribLen[i] : 0,
        gap_m: gap,
      });
    }
    interfaces.push({
      lowerLayer: k,
      upperLayer: k + 1,
      activeCount,
      separatedCount: nn - activeCount,
      totalContactForce_N,
      contacts,
    });
  }

  // Phản lực gối đáy (lên +)
  const Kfinal = Kbase.map(row => [...row]);
  for (let k = 0; k < nInterfaces; k++) {
    for (let i = 0; i < nn; i++) {
      if (!active[k][i]) continue;
      const kc = contactStiffnessPerMeter * tribLen[i];
      const dLow = k * dofPerBeam + 2 * i;
      const dUp = (k + 1) * dofPerBeam + 2 * i;
      Kfinal[dLow][dLow] += kc;
      Kfinal[dUp][dUp] += kc;
      Kfinal[dLow][dUp] -= kc;
      Kfinal[dUp][dLow] -= kc;
    }
  }
  const bottomReactions = fixedDofs.map(d => {
    let r = -Fbase[d];
    for (let j = 0; j < totalDof; j++) r += Kfinal[d][j] * u[j];
    return { x_m: nodes[d / 2], R_N: r };
  });

  // Nội lực M(x), Q(x), w(x) cho từng tầng dầm
  const layerResults = [];
  for (let lay = 0; lay < nLayers; lay++) {
    const elems = elemMeta[lay];
    let maxSagM = -Infinity, minHogM = Infinity, maxAbsQ = 0, maxAbsW = 0;
    const diagram = [];
    for (const el of elems) {
      const ue = el.dofs.map(d => u[d]);
      const end = el.ke.map((row, i) => row.reduce((s, v, j) => s + v * ue[j], 0) - el.fe[i]);
      const [V1, M1] = end;
      for (const s of [0, el.l / 2, el.l]) {
        const x = el.xa + s;
        const M = V1 * s - M1 - 0.5 * el.q * s * s;
        const Q = V1 - el.q * s;
        const r = s / el.l;
        const H = [1 - 3 * r * r + 2 * r ** 3, el.l * (r - 2 * r * r + r ** 3), 3 * r * r - 2 * r ** 3, el.l * (-r * r + r ** 3)];
        const w = H.reduce((a, h, i) => a + h * ue[i], 0) - (el.q * s * s * (el.l - s) * (el.l - s)) / (24 * el.EI);
        if (M > maxSagM) maxSagM = M;
        if (M < minHogM) minHogM = M;
        if (Math.abs(Q) > maxAbsQ) maxAbsQ = Math.abs(Q);
        if (Math.abs(w) > maxAbsW) maxAbsW = Math.abs(w);
        diagram.push({ x, M, Q, w });
      }
    }
    layerResults.push({
      layer: lay,
      maxSagM_Nm: maxSagM,
      minHogM_Nm: minHogM,
      maxAbsM_Nm: Math.max(Math.abs(maxSagM), Math.abs(minHogM)),
      maxAbsQ_N: maxAbsQ,
      maxAbsW_m: maxAbsW,
      diagram,
    });
  }

  const totalLoad_N = layerQ.reduce((s, q) => s + q * L, 0) + pointLoads.reduce((s, p) => s + p.P, 0);
  const totalReaction_N = bottomReactions.reduce((s, r) => s + r.R_N, 0);
  const relForceErr = Math.abs(totalReaction_N - totalLoad_N) / Math.max(totalLoad_N, 1);

  return {
    converged,
    iterations,
    nLayers,
    nodes,
    bottomReactions,
    interfaces,
    layerResults,
    equilibrium: {
      totalLoad_N,
      totalReaction_N,
      forceResidual_N: totalReaction_N - totalLoad_N,
      relForceErr,
    },
  };
}
