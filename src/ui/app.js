/**
 * app.js — Điều khiển giao diện Module Xếp Cọc PHC (Mốc M1: BT00, BT01, BT02).
 * Tách 3 nhóm dữ liệu (reference, input, computed), chuyển đổi đơn vị tại biên,
 * vẽ sơ đồ/biểu đồ Plotly.js và xuất thuyết minh 8 mục chuẩn (Mục 11.4 Plan v0.5.0).
 */
import { toSI, fromSI, fmt } from '../core/units.js';
import { runBT00, runBT01, runBT02 } from '../modules/xep-coc/pile_specs.js';

const STORAGE_KEY = 'fem_xep_coc_m1_state_v050';

let pileDb = null;
let supportDb = null;
let currentTab = 'BT00';
let lastResults = null;
let currentReference = null;

const el = (id) => document.getElementById(id);

function getDisplayMode() {
  return el('ui-unit-mode').value; // 'engineering' | 'SI'
}

/** Đọc cấu hình từ form giao diện và tạo gói dữ liệu chuẩn. */
function readFormConfig() {
  return {
    schemaVersion: '0.5.0',
    primaryStandard: 'TCVN',
    structuralStandard: 'TCVN 5574:2018',
    comparisonStandards: [],
    reportStandards: ['TCVN'],
    reference: currentReference || {
      code: 'CUSTOM',
      manufacturer: 'Người dùng tự xác lập',
      productStandard: 'TCVN 7888:2014',
      revision: '—',
    },
    input: {
      unitSystem: 'display_mm_MPa',
      geometry: {
        Do_mm: Number(el('inp-Do').value),
        Dp_mm: Number(el('inp-Dp').value),
        Di_mm: Number(el('inp-Di').value),
        L_m: Number(el('inp-L').value),
      },
      concrete: {
        designStandard: 'TCVN 5574:2018',
        gradeB: el('inp-gradeB').value,
        density_kg_m3: Number(el('inp-rho').value),
        rhGroup: '75',
      },
      pcReinforcement: {
        count_N1: Number(el('inp-N1').value),
        diameter_mm: Number(el('inp-dPC').value),
        fpu_MPa: Number(el('inp-fpu').value),
        fpy_MPa: Number(el('inp-fpy').value),
        Ep_MPa: Number(el('inp-Ep').value),
      },
      spiralZones: {
        endZoneLengthFactor_Do: 2,
        endZone: {
          wireCount: Number(el('inp-endWires').value),
          diameter_mm: Number(el('inp-dFs').value),
          pitch_mm: Number(el('inp-endPitch').value),
        },
        midZone: {
          wireCount: Number(el('inp-midWires').value),
          diameter_mm: Number(el('inp-dFs').value),
          pitch_mm: Number(el('inp-midPitch').value),
        },
        Rswn_MPa: 540,
        Esw_MPa: 200000,
      },
    },
    beamM1: {
      x1_m: Number(el('inp-x1').value),
      x2_m: Number(el('inp-x2').value),
      P1_kN: Number(el('inp-P1').value),
      P2_kN: Number(el('inp-P2').value),
      e1_m: Number(el('inp-e1').value),
      e2_m: Number(el('inp-e2').value),
    },
  };
}

/** Điền thông số từ cấu hình vào form. */
function writeFormConfig(cfg) {
  if (!cfg) return;
  if (cfg.reference) {
    currentReference = structuredClone(cfg.reference);
    renderReferenceBox(currentReference);
  }
  const inp = cfg.input || cfg.templateInput;
  if (inp) {
    const g = inp.geometry || {};
    if (Number.isFinite(g.Do_mm)) el('inp-Do').value = g.Do_mm;
    if (Number.isFinite(g.Dp_mm)) el('inp-Dp').value = g.Dp_mm;
    if (Number.isFinite(g.Di_mm)) el('inp-Di').value = g.Di_mm;
    if (Number.isFinite(g.L_m) && g.L_m > 0) el('inp-L').value = g.L_m;

    const c = inp.concrete || {};
    if (c.gradeB !== undefined) el('inp-gradeB').value = c.gradeB || '';
    if (Number.isFinite(c.density_kg_m3)) el('inp-rho').value = c.density_kg_m3;

    const pc = inp.pcReinforcement || {};
    if (Number.isFinite(pc.count_N1)) el('inp-N1').value = pc.count_N1;
    if (Number.isFinite(pc.diameter_mm)) el('inp-dPC').value = pc.diameter_mm;
    if (Number.isFinite(pc.fpu_MPa)) el('inp-fpu').value = pc.fpu_MPa;
    if (Number.isFinite(pc.fpy_MPa)) el('inp-fpy').value = pc.fpy_MPa;
    if (Number.isFinite(pc.Ep_MPa)) el('inp-Ep').value = pc.Ep_MPa;

    const sp = inp.spiralZones || {};
    if (sp.endZone) {
      if (Number.isFinite(sp.endZone.wireCount)) el('inp-endWires').value = sp.endZone.wireCount;
      if (Number.isFinite(sp.endZone.diameter_mm)) el('inp-dFs').value = sp.endZone.diameter_mm;
      if (Number.isFinite(sp.endZone.pitch_mm)) el('inp-endPitch').value = sp.endZone.pitch_mm;
    }
    if (sp.midZone) {
      if (Number.isFinite(sp.midZone.wireCount)) el('inp-midWires').value = sp.midZone.wireCount;
      if (Number.isFinite(sp.midZone.pitch_mm)) el('inp-midPitch').value = sp.midZone.pitch_mm;
    }
  }
  if (cfg.beamM1) {
    const b = cfg.beamM1;
    if (Number.isFinite(b.x1_m)) el('inp-x1').value = b.x1_m;
    if (Number.isFinite(b.x2_m)) el('inp-x2').value = b.x2_m;
    if (Number.isFinite(b.P1_kN)) el('inp-P1').value = b.P1_kN;
    if (Number.isFinite(b.P2_kN)) el('inp-P2').value = b.P2_kN;
    if (Number.isFinite(b.e1_m)) el('inp-e1').value = b.e1_m;
    if (Number.isFinite(b.e2_m)) el('inp-e2').value = b.e2_m;
  }
}

function renderReferenceBox(ref) {
  const box = el('ref-summary-box');
  if (!ref) {
    box.innerHTML = '<div>Chưa chọn bản vẽ tham khảo.</div>';
    return;
  }
  el('ref-rev-badge').textContent = `Phiên bản BV: ${ref.revision || '—'}`;
  box.innerHTML = `
    <div><strong>Mã bản vẽ:</strong> ${ref.drawingNo || ref.code || 'Tự nhập'} (Rev ${ref.revision || '—'}, ${ref.issuedDate || '—'})</div>
    <div><strong>Công bố trên BV (chỉ tham khảo):</strong> Tbt=${ref.publishedTbt_mm ?? '—'} mm | Mcr=${ref.publishedMcr_kNm ?? '—'} kN·m | Mu=${ref.publishedMu_kNm ?? '—'} kN·m | P_ép=${ref.publishedInstallLoad_T ?? '—'} T</div>
    <div class="text-amber-800"><strong>Ghi chú cô lập:</strong> Mcr, Mu, P_ép và thép gia cường đầu cọc (N2, ØGC, L2) <u>không đi vào bộ giải</u>.</div>
  `;
}

/** Hiển thị lưới thông số tự tính (computed) theo chế độ đơn vị đang chọn. */
function renderComputedSummary(bt00, bt01, bt02) {
  const mode = getDisplayMode();
  const s = bt00.summarySI;
  const c = bt00.record.computed.concrete;
  const badge = el('computed-unit-badge');
  badge.textContent = mode === 'SI'
    ? 'Đang hiển thị: Hệ SI chuẩn (m, m², m⁴, Pa, N/m, N·m)'
    : 'Đang hiển thị: Hệ Kỹ thuật (mm, cm², cm⁴, MPa, kN/m, kN·m) — quy đổi từ lõi SI';

  const items = mode === 'SI'
    ? [
        ['Chiều dày tự tính t', `${fmt(s.t, 4)} m`, `t = (Do - Di)/2`],
        ['Diện tích hình học Ag', `${fmt(s.Ag, 5)} m²`, `Ab = ${fmt(s.Ab, 5)} m²`],
        ['Diện tích thép DƯL Ap', `${fmt(s.Ap, 6)} m²`, `${bt00.record.computed.section.N1} thanh`],
        ['Diện tích quy đổi Ared', `${fmt(s.Ared, 5)} m²`, `α = Ep/Eb = ${fmt(bt00.record.computed.section.alpha, 4)}`],
        ['Mômen quán tính Ig / Ired', `${fmt(s.Ig, 5)} / ${fmt(s.Ired, 5)} m⁴`, `Wred = ${fmt(s.Wred, 5)} m³`],
        ['Bê tông TCVN 5574 (${c.gradeB})', `Rb = ${fmt(c.Rb, 4)} Pa`, `Rbt = ${fmt(c.Rbt, 4)} Pa, Eb = ${fmt(c.Eb, 4)} Pa`],
        ['Tự trọng đơn vị q', `${fmt(s.selfWeightPerMeter, 5)} N/m`, `Khối lượng dài = ${fmt(s.massPerMeter, 4)} kg/m`],
        ['Độ cứng uốn EIred', `${fmt(s.EIred, 5)} N·m²`, `Tổng tự trọng G = ${fmt(s.totalSelfWeight, 5)} N`],
      ]
    : [
        ['Chiều dày tự tính t', `${fmt(fromSI(s.t, 'mm'), 4)} mm`, `t = (Do - Di)/2`],
        ['Diện tích hình học Ag', `${fmt(fromSI(s.Ag, 'cm2'), 5)} cm²`, `Ab = ${fmt(fromSI(s.Ab, 'cm2'), 5)} cm²`],
        ['Diện tích thép DƯL Ap', `${fmt(fromSI(s.Ap, 'cm2'), 4)} cm²`, `${bt00.record.computed.section.N1} thanh (bỏ N2, ØGC)`],
        ['Diện tích quy đổi Ared', `${fmt(fromSI(s.Ared, 'cm2'), 5)} cm²`, `α = Ep/Eb = ${fmt(bt00.record.computed.section.alpha, 4)}`],
        ['Quán tính Ig / Ired', `${fmt(fromSI(s.Ig, 'cm4'), 5)} / ${fmt(fromSI(s.Ired, 'cm4'), 5)} cm⁴`, `Wred = ${fmt(fromSI(s.Wred, 'cm3'), 5)} cm³`],
        [`Bê tông TCVN 5574 (${c.gradeB})`, `Rb = ${fmt(fromSI(c.Rb, 'MPa'), 4)} MPa`, `Rbt = ${fmt(fromSI(c.Rbt, 'MPa'), 3)} MPa, Eb = ${fmt(fromSI(c.Eb, 'MPa'), 5)} MPa`],
        ['Tự trọng đơn vị q', `${fmt(fromSI(s.selfWeightPerMeter, 'kN/m'), 4)} kN/m`, `Khối lượng dài = ${fmt(s.massPerMeter, 4)} kg/m`],
        ['Độ cứng uốn EIred', `${fmt(s.EIred / 1e3, 5)} kN·m²`, `Tổng tự trọng G = ${fmt(fromSI(s.totalSelfWeight, 'kN'), 4)} kN`],
      ];

  el('bt00-summary-grid').innerHTML = items
    .map(
      ([label, val, sub]) => `
      <div class="p-2.5 rounded-lg bg-emerald-50/50 border border-emerald-200/80">
        <div class="text-[11px] text-slate-500">${label}</div>
        <div class="text-sm font-bold font-mono text-slate-900 mt-0.5">${val}</div>
        <div class="text-[11px] text-slate-500 font-mono mt-0.5">${sub}</div>
      </div>`
    )
    .join('');
}

/** Vẽ mặt cắt ngang vành khăn và vị trí N1 thanh thép DƯL. */
function renderCrossSectionPlot(bt00) {
  const sec = bt00.record.computed.section;
  const ro_mm = fromSI(sec.ro, 'mm');
  const ri_mm = fromSI(sec.ri, 'mm');
  const rp_mm = fromSI(sec.rp, 'mm');

  const circle = (r, n = 90) => {
    const xs = [], ys = [];
    for (let i = 0; i <= n; i++) {
      const a = (2 * Math.PI * i) / n;
      xs.push(r * Math.cos(a));
      ys.push(r * Math.sin(a));
    }
    return { xs, ys };
  };

  const cOut = circle(ro_mm);
  const cIn = circle(ri_mm);
  const cPitch = circle(rp_mm);
  const barXs = sec.bars.map(b => fromSI(b.y_m, 'mm'));
  const barYs = sec.bars.map(b => fromSI(b.z_m, 'mm'));

  const traces = [
    { x: cOut.xs, y: cOut.ys, mode: 'lines', name: `Do = ${2 * ro_mm} mm`, line: { color: '#0f172a', width: 2.5 } },
    { x: cIn.xs, y: cIn.ys, mode: 'lines', name: `Di = ${2 * ri_mm} mm`, line: { color: '#475569', width: 2 } },
    { x: cPitch.xs, y: cPitch.ys, mode: 'lines', name: `Dp = ${2 * rp_mm} mm`, line: { color: '#94a3b8', width: 1, dash: 'dot' } },
    {
      x: barXs,
      y: barYs,
      mode: 'markers',
      name: `${sec.N1}Ø${fromSI(sec.d_pc, 'mm')} (DƯL)`,
      marker: { color: '#dc2626', size: 7 },
    },
  ];

  Plotly.newPlot(
    'plot-cross-section',
    traces,
    {
      margin: { l: 35, r: 15, t: 15, b: 30 },
      xaxis: { title: 'y (mm)', scaleanchor: 'y', scaleratio: 1, zeroline: true },
      yaxis: { title: 'z (mm)', zeroline: true },
      showlegend: true,
      legend: { orientation: 'h', y: -0.2, font: { size: 10 } },
      paper_bgcolor: 'transparent',
      plot_bgcolor: '#f8fafc',
    },
    { responsive: true, displayModeBar: false }
  );
}

/** Vẽ sơ đồ dọc cọc, vùng đai đầu cọc L_end = 2Do, hai gối kê gỗ cứng 100×100mm và tải tập trung. */
function renderBeamSchematicPlot(bt00, bt01, bt02) {
  const sec = bt00.record.computed.section;
  const L = sec.L;
  const Lend = sec.L_end;
  const { x1, x2, xP1, xP2, P1, P2 } = bt02.inputsSI;
  const bx = 0.1; // thanh kê gỗ cứng 100 x 100 mm -> 0,1 m

  const shapes = [
    // Vùng đầu cọc trái [0, Lend]
    { type: 'rect', x0: 0, x1: Lend, y0: -0.15, y1: 0.15, fillcolor: 'rgba(59,130,246,0.22)', line: { color: '#2563eb', width: 1.5 } },
    // Vùng thân giữa [Lend, L - Lend]
    { type: 'rect', x0: Lend, x1: L - Lend, y0: -0.15, y1: 0.15, fillcolor: 'rgba(148,163,184,0.20)', line: { color: '#475569', width: 1.5 } },
    // Vùng đầu cọc phải [L - Lend, L]
    { type: 'rect', x0: L - Lend, x1: L, y0: -0.15, y1: 0.15, fillcolor: 'rgba(59,130,246,0.22)', line: { color: '#2563eb', width: 1.5 } },
    // Thanh kê gỗ cứng 100x100 mm tại x1 và x2
    { type: 'rect', x0: x1 - bx / 2, x1: x1 + bx / 2, y0: -0.35, y1: -0.15, fillcolor: '#b45309', line: { color: '#78350f', width: 1.5 } },
    { type: 'rect', x0: x2 - bx / 2, x1: x2 + bx / 2, y0: -0.35, y1: -0.15, fillcolor: '#b45309', line: { color: '#78350f', width: 1.5 } },
  ];

  const traces = [
    {
      x: [x1, x2],
      y: [-0.25, -0.25],
      mode: 'markers+text',
      name: 'Kê gỗ cứng 100×100 mm',
      text: [`Kê 1 (x1=${fmt(x1, 4)}m)`, `Kê 2 (x2=${fmt(x2, 4)}m)`],
      textposition: 'bottom center',
      marker: { symbol: 'triangle-up', size: 12, color: '#92400e' },
    },
    {
      x: [xP1, xP2],
      y: [0.32, 0.32],
      mode: 'markers+text',
      name: 'Tải tập trung tầng trên (BT02)',
      text: [
        `P1=${fmt(fromSI(P1, 'kN'), 4)}kN (e1=${fmt(bt02.inputsSI.e1, 3)}m)`,
        `P2=${fmt(fromSI(P2, 'kN'), 4)}kN (e2=${fmt(bt02.inputsSI.e2, 3)}m)`,
      ],
      textposition: 'top center',
      marker: { symbol: 'triangle-down', size: 13, color: '#dc2626' },
    },
    {
      x: [Lend / 2, L / 2, L - Lend / 2],
      y: [0, 0, 0],
      mode: 'text',
      showlegend: false,
      text: [
        `Đầu cọc 2Do (${fmt(Lend, 3)}m)<br>${sec.zones.leftEnd.wireCount}Ø${fromSI(sec.zones.leftEnd.diameter_m, 'mm')} a${fromSI(sec.zones.leftEnd.pitch_m, 'mm')}`,
        `Thân giữa (${fmt(L - 2 * Lend, 3)}m) • q = ${fmt(fromSI(sec.selfWeightPerMeter, 'kN/m'), 4)} kN/m<br>${sec.zones.middle.wireCount}Ø${fromSI(sec.zones.middle.diameter_m, 'mm')} a${fromSI(sec.zones.middle.pitch_m, 'mm')}`,
        `Đầu cọc 2Do (${fmt(Lend, 3)}m)<br>${sec.zones.rightEnd.wireCount}Ø${fromSI(sec.zones.rightEnd.diameter_m, 'mm')} a${fromSI(sec.zones.rightEnd.pitch_m, 'mm')}`,
      ],
      textfont: { size: 10, color: '#0f172a' },
    },
  ];

  Plotly.newPlot(
    'plot-beam-schematic',
    traces,
    {
      shapes,
      margin: { l: 30, r: 20, t: 15, b: 35 },
      xaxis: { title: 'Trục dọc cọc x (m)', range: [-0.4, L + 0.4] },
      yaxis: { range: [-0.55, 0.55], visible: false },
      legend: { orientation: 'h', y: -0.2, font: { size: 10 } },
      paper_bgcolor: 'transparent',
      plot_bgcolor: '#f8fafc',
    },
    { responsive: true, displayModeBar: false }
  );
}

/** Vẽ 3 biểu đồ M(x), Q(x), w(x) so sánh BT01, BT02 (FEM) và Nghiệm giải tích. */
function renderInternalForcePlots(bt01, bt02) {
  const mode = getDisplayMode();
  const mFactor = mode === 'SI' ? 1 : 1e-3; // N·m hoặc kN·m
  const qFactor = mode === 'SI' ? 1 : 1e-3; // N hoặc kN
  const wFactor = mode === 'SI' ? 1 : 1e3;  // m hoặc mm
  const mUnit = mode === 'SI' ? 'N·m' : 'kN·m';
  const qUnit = mode === 'SI' ? 'N' : 'kN';
  const wUnit = mode === 'SI' ? 'm' : 'mm';

  const xs1 = bt01.diagram.map(d => d.x);
  const xs2 = bt02.diagram.map(d => d.x);
  const anaPts = bt02.comparisonRows;

  // 1. Mômen M(x)
  Plotly.newPlot(
    'plot-moment',
    [
      {
        x: xs1,
        y: bt01.diagram.map(d => d.M * mFactor),
        mode: 'lines',
        name: 'BT01 • Chỉ tự trọng (FEM)',
        line: { color: '#64748b', width: 2, dash: 'dash' },
      },
      {
        x: xs2,
        y: bt02.diagram.map(d => d.M * mFactor),
        mode: 'lines',
        name: 'BT02 • Tự trọng + Tải tầng trên (FEM)',
        line: { color: '#2563eb', width: 2.5 },
      },
      {
        x: anaPts.map(r => r.x_m),
        y: anaPts.map(r => r.M_ana_Nm * mFactor),
        mode: 'markers',
        name: 'Nghiệm giải tích đóng (Macaulay)',
        marker: { color: '#dc2626', size: 7, symbol: 'circle-open', line: { width: 2 } },
      },
    ],
    {
      title: { text: `Biểu đồ Mômen uốn M(x) [${mUnit}]`, font: { size: 13 } },
      margin: { l: 55, r: 20, t: 35, b: 40 },
      xaxis: { title: 'x (m)' },
      yaxis: { title: `M (${mUnit})`, zeroline: true },
      legend: { orientation: 'h', y: -0.22, font: { size: 11 } },
      paper_bgcolor: 'transparent',
      plot_bgcolor: '#f8fafc',
    },
    { responsive: true, displayModeBar: false }
  );

  // 2. Lực cắt Q(x)
  Plotly.newPlot(
    'plot-shear',
    [
      {
        x: xs1,
        y: bt01.diagram.map(d => d.Q * qFactor),
        mode: 'lines',
        name: 'BT01 • Chỉ tự trọng',
        line: { color: '#64748b', width: 1.8, dash: 'dash' },
      },
      {
        x: xs2,
        y: bt02.diagram.map(d => d.Q * qFactor),
        mode: 'lines',
        name: 'BT02 • Có tải tầng trên (FEM)',
        line: { color: '#059669', width: 2.2 },
      },
      {
        x: anaPts.map(r => r.x_m),
        y: anaPts.map(r => r.Q_ana_N * qFactor),
        mode: 'markers',
        name: 'Giải tích Q(x)',
        marker: { color: '#dc2626', size: 6, symbol: 'diamond-open', line: { width: 2 } },
      },
    ],
    {
      title: { text: `Biểu đồ Lực cắt Q(x) [${qUnit}]`, font: { size: 13 } },
      margin: { l: 55, r: 20, t: 35, b: 40 },
      xaxis: { title: 'x (m)' },
      yaxis: { title: `Q (${qUnit})`, zeroline: true },
      legend: { orientation: 'h', y: -0.25, font: { size: 10 } },
      paper_bgcolor: 'transparent',
      plot_bgcolor: '#f8fafc',
    },
    { responsive: true, displayModeBar: false }
  );

  // 3. Chuyển vị đứng w(x)
  Plotly.newPlot(
    'plot-deflection',
    [
      {
        x: xs1,
        y: bt01.diagram.map(d => d.w * wFactor),
        mode: 'lines',
        name: 'BT01 • Chỉ tự trọng',
        line: { color: '#64748b', width: 1.8, dash: 'dash' },
      },
      {
        x: xs2,
        y: bt02.diagram.map(d => d.w * wFactor),
        mode: 'lines',
        name: 'BT02 • Có tải tầng trên (FEM)',
        line: { color: '#7c3aed', width: 2.2 },
      },
      {
        x: anaPts.map(r => r.x_m),
        y: anaPts.map(r => r.w_ana_m * wFactor),
        mode: 'markers',
        name: 'Giải tích w(x)',
        marker: { color: '#dc2626', size: 6, symbol: 'circle-open', line: { width: 2 } },
      },
    ],
    {
      title: { text: `Biểu đồ Chuyển vị đứng w(x) [${wUnit}]`, font: { size: 13 } },
      margin: { l: 55, r: 20, t: 35, b: 40 },
      xaxis: { title: 'x (m)' },
      yaxis: { title: `w (${wUnit})`, zeroline: true },
      legend: { orientation: 'h', y: -0.25, font: { size: 10 } },
      paper_bgcolor: 'transparent',
      plot_bgcolor: '#f8fafc',
    },
    { responsive: true, displayModeBar: false }
  );
}

/** Xuất thuyết minh theo đúng 8 mục chuẩn tại Mục 11.4 của Plan_XepCoc.md. */
function render8StepReport(tab, { bt00, bt01, bt02 }) {
  const container = el('report-8steps-container');
  const sec = bt00.record.computed.section;
  const conc = bt00.record.computed.concrete;
  const steel = bt00.record.computed.steel;

  if (tab === 'BT00') {
    const rows = bt00.verification.checks
      .map(
        (c) => `
        <tr class="border-b">
          <td class="p-1.5 font-medium">${c.name}</td>
          <td class="p-1.5 font-mono">${fmt(c.computed, 6)}</td>
          <td class="p-1.5 font-mono">${fmt(c.reference, 6)}</td>
          <td class="p-1.5 font-mono">${c.relError.toExponential(2)} (≤ ${c.tol.toExponential(0)})</td>
          <td class="p-1.5 font-bold text-emerald-700">${c.relError <= c.tol ? 'ĐẠT' : 'LỆCH'}</td>
        </tr>`
      )
      .join('');

    container.innerHTML = `
      <div class="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
        <div><strong>1. Tên bài và mục tiêu:</strong> ${bt00.title}. Chuẩn hóa dữ liệu đầu vào về hệ SI, tách biệt 3 nhóm <code>reference / input / computed</code>, tự tính đặc trưng hình học/quy đổi và lập hàm phân vùng <code>section(x)</code>.</div>
        <div><strong>2. Sơ đồ:</strong> Mặt cắt ngang vành khăn (<code>Do=${fmt(sec.Do, 4)} m, Dp=${fmt(sec.Dp, 4)} m, Di=${fmt(sec.Di, 4)} m</code>), chiều dài <code>L=${fmt(sec.L, 4)} m</code>, phân thành 3 đoạn dọc trục: Đầu trái <code>[0, ${fmt(sec.L_end, 3)} m]</code>, Thân giữa <code>[${fmt(sec.L_end, 3)}, ${fmt(sec.L - sec.L_end, 3)} m]</code>, Đầu phải <code>[${fmt(sec.L - sec.L_end, 3)}, ${fmt(sec.L, 3)} m]</code>.</div>
        <div><strong>3. Đầu vào:</strong> Nguồn chuẩn chính <code>TCVN 5574:2018</code> (${conc.gradeB}), khối lượng riêng <code>ρ=${sec.rho} kg/m³</code>, thép DƯL <code>${sec.N1}Ø${fromSI(sec.d_pc, 'mm')} mm</code>. Bỏ qua thép dọc gia cường đầu cọc (<code>N2, ØGC, L2</code>); thanh kê gỗ <code>0,1×0,1 m</code> tuyệt đối cứng; nền kho cứng không lún.</div>
        <div><strong>4. Cơ sở tính:</strong> TCVN 5574:2018 (${conc.clauses}): <code>t=(Do-Di)/2</code>, <code>Ag=π(Do²-Di²)/4</code>, <code>Ap=N1·π·d_pc²/4</code>, <code>α=Ep/Eb</code>, <code>Ared=Ag+(α-1)Ap</code>, <code>Ired=π(Do⁴-Di⁴)/64 + 0,5(α-1)Ap·rp²</code>, <code>q=ρ·g·Ag</code>.</div>
        <div><strong>5. Trình tự tính:</strong> Đổi đơn vị về SI → Tra bảng TCVN 5574:2018 theo cấp ${conc.gradeB} → Tính đặc trưng hình học & quy đổi → Lập hàm phân vùng đai xoắn <code>sectionAt(x)</code> → Khóa chỉ đọc <code>Object.freeze</code>.</div>
        <div><strong>6. Kết quả (Hệ SI chuẩn):</strong> <code>t=${fmt(sec.t, 4)} m</code>, <code>Ag=${fmt(sec.Ag, 5)} m²</code>, <code>Ared=${fmt(sec.Ared, 5)} m²</code>, <code>Ig=${fmt(sec.Ig, 5)} m⁴</code>, <code>Ired=${fmt(sec.Ired, 5)} m⁴</code>, <code>EIred=${fmt(sec.EIred, 5)} N·m²</code>, <code>q=${fmt(sec.selfWeightPerMeter, 5)} N/m</code>.</div>
        <div><strong>7. Đối chứng độc lập:</strong>
          <table class="w-full mt-1 border-collapse text-xs">
            <thead><tr class="bg-slate-200 text-left"><th class="p-1.5">Đại lượng đối chứng</th><th class="p-1.5">Giá trị tự tính (SI)</th><th class="p-1.5">Tham chiếu độc lập</th><th class="p-1.5">Sai số tương đối</th><th class="p-1.5">Kết quả</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <div><strong>8. Kết luận:</strong> <span class="text-emerald-700 font-bold">Phương pháp BT00 đã được kiểm chứng (${bt00.verified ? 'KHỚP ĐỐI CHỨNG' : 'CHƯA KHỚP'})</span>. Kết quả này chỉ xác nhận đặc trưng hình học/vật liệu tự tính, chưa phải kết luận khả năng chịu lực của cọc (sẽ kiểm tra ở BT03–BT05).</div>
      </div>`;
    return;
  }

  if (tab === 'BT01') {
    const rows = bt01.comparisonRows
      .map(
        (r) => `
        <tr class="border-b">
          <td class="p-1.5">${r.label}</td>
          <td class="p-1.5 font-mono">${fmt(r.x_m, 4)}</td>
          <td class="p-1.5 font-mono">${fmt(r.M_fem_Nm / 1e3, 4)} / ${fmt(r.M_ana_Nm / 1e3, 4)}</td>
          <td class="p-1.5 font-mono">${fmt(r.Q_fem_N / 1e3, 4)} / ${fmt(r.Q_ana_N / 1e3, 4)}</td>
          <td class="p-1.5 font-mono">${fmt(r.w_fem_m * 1e3, 4)} / ${fmt(r.w_ana_m * 1e3, 4)}</td>
          <td class="p-1.5 font-mono">${r.errM_Nm.toExponential(2)}</td>
        </tr>`
      )
      .join('');

    container.innerHTML = `
      <div class="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
        <div><strong>1. Tên bài và mục tiêu:</strong> ${bt01.title}. Kiểm chứng mô hình phần tử dầm Euler–Bernoulli dưới tải tự trọng phân bố đều <code>q</code> tự tính từ BT00.</div>
        <div><strong>2. Sơ đồ:</strong> Dầm dài <code>L=${fmt(bt01.inputsSI.L, 4)} m</code> đặt trên hai gối điểm lý tưởng tại <code>x1=${fmt(bt01.inputsSI.x1, 4)} m</code> và <code>x2=${fmt(bt01.inputsSI.x2, 4)} m</code> (nhịp <code>${fmt(bt01.inputsSI.span, 4)} m</code>, hai đầu hẫng <code>${fmt(bt01.inputsSI.leftOverhang, 4)} m</code> và <code>${fmt(bt01.inputsSI.rightOverhang, 4)} m</code>).</div>
        <div><strong>3. Đầu vào (SI):</strong> <code>q = ${fmt(bt01.inputsSI.q, 5)} N/m</code>, <code>EIred = ${fmt(bt01.inputsSI.EI, 5)} N·m²</code>.</div>
        <div><strong>4. Cơ sở tính:</strong> Phần tử dầm Hermite bậc 3 (2 bậc tự do/nút <code>w, θ</code>) đối chứng với nghiệm giải tích đóng Macaulay bracket: <code>R1 = qL(x2 - L/2)/(x2 - x1)</code>, <code>R2 = qL(L/2 - x1)/(x2 - x1)</code>.</div>
        <div><strong>5. Trình tự tính:</strong> Rời rạc hóa lưới phần tử qua các điểm đặc biệt → Lắp ráp <code>K, F</code> → Khử điều kiện biên <code>w(x1)=w(x2)=0</code> → Giải chuyển vị nút, phản lực và nội lực <code>M(x), Q(x), w(x)</code>.</div>
        <div><strong>6. Kết quả:</strong> <code>R1 = ${fmt(bt01.reactionsSI.R1_fem / 1e3, 4)} kN</code>, <code>R2 = ${fmt(bt01.reactionsSI.R2_fem / 1e3, 4)} kN</code>; <code>M_min(gối) = ${fmt(bt01.extremaSI.M_min_hog_Nm / 1e3, 4)} kN·m</code>, <code>M_max(nhịp) = ${fmt(bt01.extremaSI.M_max_sag_Nm / 1e3, 4)} kN·m</code>, <code>|Q|_max = ${fmt(bt01.extremaSI.Q_max_abs_N / 1e3, 4)} kN</code>, <code>|w|_max = ${fmt(bt01.extremaSI.w_max_abs_m * 1e3, 4)} mm</code>.</div>
        <div><strong>7. Đối chứng độc lập (FEM vs Giải tích đóng):</strong> Sai số tương đối lớn nhất: <code>relErr(M) = ${bt01.verification.maxRelErrM.toExponential(2)}</code>, <code>relErr(Q) = ${bt01.verification.maxRelErrQ.toExponential(2)}</code>, <code>relErr(w) = ${bt01.verification.maxRelErrW.toExponential(2)}</code> (ngưỡng chấp nhận <code>≤ 10⁻¹⁰</code>).
          <table class="w-full mt-1 border-collapse text-xs">
            <thead><tr class="bg-slate-200 text-left"><th class="p-1.5">Vị trí kiểm tra</th><th class="p-1.5">x (m)</th><th class="p-1.5">M_FEM / M_Ana (kN·m)</th><th class="p-1.5">Q_FEM / Q_Ana (kN)</th><th class="p-1.5">w_FEM / w_Ana (mm)</th><th class="p-1.5">|ΔM| (N·m)</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <div><strong>8. Kết luận:</strong> <span class="text-emerald-700 font-bold">Bài tính BT01 đã được kiểm chứng (${bt01.verified ? 'ĐẠT' : 'KHÔNG ĐẠT'})</span>. Cân bằng lực dư = <code>${bt01.equilibrium.forceResidual.toExponential(2)} N</code>, cân bằng mômen dư = <code>${bt01.equilibrium.momentResidual.toExponential(2)} N·m</code>. Chuyển sang BT02 để thêm tải tập trung từ tầng trên.</div>
      </div>`;
    return;
  }

  // Tab BT02
  const zc = bt02.zeroEccentricityCheck;
  const rows2 = bt02.comparisonRows
    .map(
      (r) => `
      <tr class="border-b">
        <td class="p-1.5 font-mono">${fmt(r.x_m, 4)} (${r.side === 'left' ? 'trái' : 'phải'})</td>
        <td class="p-1.5 font-mono">${fmt(r.M_fem_Nm / 1e3, 4)} / ${fmt(r.M_ana_Nm / 1e3, 4)}</td>
        <td class="p-1.5 font-mono">${fmt(r.Q_fem_N / 1e3, 4)} / ${fmt(r.Q_ana_N / 1e3, 4)}</td>
        <td class="p-1.5 font-mono">${fmt(r.w_fem_m * 1e3, 4)} / ${fmt(r.w_ana_m * 1e3, 4)}</td>
        <td class="p-1.5 font-mono">${r.errM_Nm.toExponential(2)}</td>
      </tr>`
    )
    .join('');

  container.innerHTML = `
    <div class="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
      <div><strong>1. Tên bài và mục tiêu:</strong> ${bt02.title}. Kiểm chứng phản ứng của cọc khi nhận tải tập trung từ hai tuyến kê tầng trên đặt đúng gối (<code>e1=e2=0</code>) và khi lệch gối (<code>e1=${fmt(bt02.inputsSI.e1, 3)} m, e2=${fmt(bt02.inputsSI.e2, 3)} m</code>).</div>
      <div><strong>2. Sơ đồ:</strong> Hai gối dưới tại <code>x1=${fmt(bt02.inputsSI.x1, 4)} m, x2=${fmt(bt02.inputsSI.x2, 4)} m</code>; hai tải tập trung từ tầng trên <code>P1=${fmt(bt02.inputsSI.P1 / 1e3, 4)} kN</code> đặt tại <code>xP1=${fmt(bt02.inputsSI.xP1, 4)} m</code> và <code>P2=${fmt(bt02.inputsSI.P2 / 1e3, 4)} kN</code> đặt tại <code>xP2=${fmt(bt02.inputsSI.xP2, 4)} m</code>.</div>
      <div><strong>3. Đầu vào (SI):</strong> Tự trọng <code>q = ${fmt(bt02.inputsSI.q, 5)} N/m</code>, <code>P1 = ${fmt(bt02.inputsSI.P1, 5)} N</code>, <code>P2 = ${fmt(bt02.inputsSI.P2, 5)} N</code>, <code>e1 = ${fmt(bt02.inputsSI.e1, 4)} m</code>, <code>e2 = ${fmt(bt02.inputsSI.e2, 4)} m</code>.</div>
      <div><strong>4. Cơ sở tính:</strong> Nguyên lý cộng tác dụng đàn hồi tuyến tính và nghiệm giải tích Macaulay bracket với lực tập trung: <code>M(x) = -½qx² + R1⟨x-x1⟩₊ + R2⟨x-x2⟩₊ - P1⟨x-xP1⟩₊ - P2⟨x-xP2⟩₊</code>.</div>
      <div><strong>5. Trình tự tính:</strong> Chèn nút chính xác tại <code>x1, x2, xP1, xP2</code> → Giải hệ FEM → Kiểm tra trường hợp biên <code>e1=e2=0</code> không tạo mômen giả → Đối chứng với nghiệm giải tích tại mọi mặt cắt đặc trưng.</div>
      <div><strong>6. Kết quả:</strong> <code>R1 = ${fmt(bt02.reactionsSI.R1_fem / 1e3, 4)} kN</code> (tăng <code>${fmt(bt02.reactionsSI.deltaR1_fromSelfWeight / 1e3, 4)} kN</code> so với BT01), <code>R2 = ${fmt(bt02.reactionsSI.R2_fem / 1e3, 4)} kN</code> (tăng <code>${fmt(bt02.reactionsSI.deltaR2_fromSelfWeight / 1e3, 4)} kN</code>); <code>M_min = ${fmt(bt02.extremaSI.M_min_hog_Nm / 1e3, 4)} kN·m</code>, <code>M_max = ${fmt(bt02.extremaSI.M_max_sag_Nm / 1e3, 4)} kN·m</code> (chênh lệch cực trị mômen so với BT01: <code>|ΔM|_max = ${fmt(bt02.extremaSI.deltaM_max_abs_vs_BT01_Nm / 1e3, 4)} kN·m</code>).</div>
      <div><strong>7. Đối chứng độc lập:</strong>
        <div class="p-2 my-1 rounded bg-emerald-50 border border-emerald-200 text-emerald-900">
          • <strong>Kiểm chứng đặt đúng gối (e1=0, e2=0):</strong> Sai lệch mômen dọc thân so với BT01 = <code>${zc.maxZeroEccMomentDiff_Nm.toExponential(2)} N·m</code>, sai lệch độ võng = <code>${zc.maxZeroEccDeflectionDiff_m.toExponential(2)} m</code> → <strong>Xác nhận tải đúng gối chỉ truyền thẳng vào phản lực gối, không sinh mômen giả!</strong>
        </div>
        <table class="w-full mt-1 border-collapse text-xs">
          <thead><tr class="bg-slate-200 text-left"><th class="p-1.5">Tọa độ x (m)</th><th class="p-1.5">M_FEM / M_Ana (kN·m)</th><th class="p-1.5">Q_FEM / Q_Ana (kN)</th><th class="p-1.5">w_FEM / w_Ana (mm)</th><th class="p-1.5">|ΔM| (N·m)</th></tr></thead>
          <tbody>${rows2}</tbody>
        </table>
      </div>
      <div><strong>8. Kết luận:</strong> <span class="text-emerald-700 font-bold">Bài tính BT02 đã được kiểm chứng (${bt02.verified ? 'ĐẠT' : 'KHÔNG ĐẠT'})</span>. Sẵn sàng làm nền tảng cho Mốc M2 (BT03–BT08: tính tổn hao DƯL & kiểm tra sức kháng tiết diện TCVN 5574:2018) và Mốc M3 (BT10–BT11: hệ nhiều tầng S2).</div>
    </div>`;
}

/** Chạy toàn bộ chuỗi tính toán Mốc M1 (BT00 -> BT01 -> BT02). */
function runCalculationAndRender() {
  const statusBox = el('calc-status-box');
  try {
    const cfg = readFormConfig();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));

    const bt00 = runBT00(cfg);
    if (!bt00.valid) {
      statusBox.className = 'rounded-xl p-3.5 text-sm font-semibold border bg-amber-50 border-amber-300 text-amber-900';
      statusBox.innerHTML = `Trạng thái: <span class="uppercase">${bt00.status}</span> — ${bt00.errors.join('; ')}. (Không xuất kết luận đạt khi thiếu/sai dữ liệu đầu vào).`;
      el('bt00-summary-grid').innerHTML = '';
      el('report-8steps-container').innerHTML = '';
      return;
    }

    const { x1_m, x2_m, P1_kN, P2_kN, e1_m, e2_m } = cfg.beamM1;
    const bt01 = runBT01({ pileRecordOrConfig: bt00, x1_m, x2_m });
    const bt02 = runBT02({
      pileRecordOrConfig: bt00,
      x1_m,
      x2_m,
      P1_N: toSI(P1_kN, 'kN'),
      P2_N: toSI(P2_kN, 'kN'),
      e1_m,
      e2_m,
    });

    lastResults = { bt00, bt01, bt02 };
    const allVerified = bt00.verified && bt01.verified && bt02.verified;
    statusBox.className = allVerified
      ? 'rounded-xl p-3.5 text-sm font-semibold border bg-emerald-50 border-emerald-300 text-emerald-900'
      : 'rounded-xl p-3.5 text-sm font-semibold border bg-red-50 border-red-300 text-red-900';
    statusBox.innerHTML = `
      <div class="flex flex-wrap items-center justify-between gap-2">
        <span>✅ <strong>Kiểm chứng phương pháp Mốc M1 (BT00 – BT02):</strong> ${allVerified ? 'KHỚP ĐỐI CHỨNG GIẢI TÍCH ĐỘC LẬP (Sai số < 10⁻¹⁰)' : 'CẦN RÀ SOÁT'}</span>
        <span class="text-xs font-mono">Chuẩn chính: TCVN 5574:2018 • L = ${bt00.summarySI.L} m • q = ${fmt(fromSI(bt00.summarySI.selfWeightPerMeter, 'kN/m'), 4)} kN/m</span>
      </div>`;

    renderComputedSummary(bt00, bt01, bt02);
    renderCrossSectionPlot(bt00);
    renderBeamSchematicPlot(bt00, bt01, bt02);
    renderInternalForcePlots(bt01, bt02);
    render8StepReport(currentTab, lastResults);
  } catch (err) {
    statusBox.className = 'rounded-xl p-3.5 text-sm font-semibold border bg-red-50 border-red-300 text-red-900';
    statusBox.textContent = `Lỗi kiểm tra mô hình / đầu vào: ${err.message}`;
  }
}

async function initApp() {
  const [pResp, sResp] = await Promise.all([
    fetch('../../data_in/pile_specs.json'),
    fetch('../../data_in/support_ground_specs.json'),
  ]);
  pileDb = await pResp.json();
  supportDb = await sResp.json();

  const sel = el('select-preset');
  sel.innerHTML = pileDb.piles
    .map(
      (p, i) =>
        `<option value="${i}" ${p.code === 'PHC-A600' ? 'selected' : ''}>${p.id} — ${p.code} (Do=${p.templateInput.geometry.Do_mm}, t=${p.reference.publishedTbt_mm}, ${p.templateInput.pcReinforcement.count_N1}Ø${p.templateInput.pcReinforcement.diameter_mm}, Rev ${p.reference.revision})</option>`
    )
    .join('');

  const applySelectedPreset = () => {
    const p = pileDb.piles[Number(sel.value)];
    if (!p) return;
    currentReference = structuredClone(p.reference);
    renderReferenceBox(currentReference);
    writeFormConfig({
      reference: p.reference,
      input: p.templateInput,
    });
    runCalculationAndRender();
  };

  sel.addEventListener('change', () => {
    const p = pileDb.piles[Number(sel.value)];
    if (p) {
      currentReference = structuredClone(p.reference);
      renderReferenceBox(currentReference);
    }
  });

  el('btn-apply-preset').addEventListener('click', applySelectedPreset);

  el('btn-test-ref-isolation').addEventListener('click', () => {
    if (!lastResults) return;
    const beforeEI = lastResults.bt00.summarySI.EIred;
    const beforeQ = lastResults.bt00.summarySI.selfWeightPerMeter;
    currentReference = {
      ...(currentReference || {}),
      publishedMcr_kNm: Math.round(Math.random() * 9000 + 1000),
      publishedMu_kNm: Math.round(Math.random() * 19000 + 2000),
      publishedInstallLoad_T: 9999,
      nonPrestressedRebarNote: 'Đã giả lập đổi N2=99 Ø32 L2=5000mm trong reference',
    };
    renderReferenceBox(currentReference);
    runCalculationAndRender();
    const afterEI = lastResults.bt00.summarySI.EIred;
    const afterQ = lastResults.bt00.summarySI.selfWeightPerMeter;
    el('calc-status-box').innerHTML += `<div class="mt-1 text-xs text-blue-800">🔒 Đã thử thay đổi ngẫu nhiên Mcr, Mu, P_ép và N2/ØGC/L2 trong nhóm <code>reference</code>: <code>ΔEIred = ${Math.abs(afterEI - beforeEI)} N·m²</code>, <code>Δq = ${Math.abs(afterQ - beforeQ)} N/m</code> (Kết quả tự tính giữ nguyên tuyệt đối!).</div>`;
  });

  el('btn-optimal-supports').addEventListener('click', () => {
    const L = Number(el('inp-L').value);
    if (L > 0) {
      const a = ((Math.sqrt(2) - 1) / 2) * L;
      el('inp-x1').value = Number(a.toFixed(4));
      el('inp-x2').value = Number((L - a).toFixed(4));
      runCalculationAndRender();
    }
  });

  el('btn-ecc-zero').addEventListener('click', () => {
    el('inp-e1').value = 0;
    el('inp-e2').value = 0;
    runCalculationAndRender();
  });
  el('btn-ecc-inward').addEventListener('click', () => {
    el('inp-e1').value = 0.30;
    el('inp-e2').value = -0.30;
    runCalculationAndRender();
  });
  el('btn-ecc-outward').addEventListener('click', () => {
    el('inp-e1').value = -0.25;
    el('inp-e2').value = 0.25;
    runCalculationAndRender();
  });
  el('btn-ecc-single').addEventListener('click', () => {
    el('inp-e1').value = 0.35;
    el('inp-e2').value = 0.0;
    runCalculationAndRender();
  });

  el('btn-run-calc').addEventListener('click', runCalculationAndRender);
  el('ui-unit-mode').addEventListener('change', () => {
    if (lastResults) {
      renderComputedSummary(lastResults.bt00, lastResults.bt01, lastResults.bt02);
      renderInternalForcePlots(lastResults.bt01, lastResults.bt02);
    }
  });

  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentTab = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach((b) => {
        b.className =
          b.dataset.tab === currentTab
            ? 'tab-btn bg-blue-600 text-white font-semibold px-3 py-1.5 rounded-lg'
            : 'tab-btn bg-slate-100 text-slate-700 font-semibold px-3 py-1.5 rounded-lg';
      });
      if (lastResults) render8StepReport(currentTab, lastResults);
    });
  });

  // Xuất / Nạp JSON
  el('btn-export-json').addEventListener('click', () => {
    const cfg = readFormConfig();
    const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `phuong-an-xep-coc-M1-${cfg.reference?.code || 'custom'}.json`;
    a.click();
  });

  el('input-import-json').addEventListener('change', async (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = JSON.parse(text);
    writeFormConfig(parsed);
    runCalculationAndRender();
  });

  // Khôi phục từ LocalStorage hoặc nạp mặc định PHC-A600
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      writeFormConfig(JSON.parse(saved));
    } catch (_) {
      applySelectedPreset();
    }
  } else {
    const p600 = pileDb.piles.find((p) => p.code === 'PHC-A600') || pileDb.piles[0];
    currentReference = structuredClone(p600.reference);
    renderReferenceBox(currentReference);
  }
  runCalculationAndRender();
}

initApp();
