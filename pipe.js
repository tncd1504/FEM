"use strict";
const $ = id => document.getElementById(id);
let mesh = null, result = null, solvedInput = null, stale = true, busy = false;
let selectedNode = null, lastGeometry = null, screenNodes = [], pendingInput = null;
let concreteCatalog = null;
const num = (v, digits = 4) => (Math.abs(Number(v)) < 0.5*10**(-digits) ? 0 : Number(v)).toLocaleString("vi-VN", {maximumFractionDigits: digits});
const sci = v => Number(v).toExponential(3);
const geometry = p => [p.r_inner, p.r_outer, p.nr, p.ntheta].join("/");
const pipeExtensions = {inputs: null, results: null, draw: null, stale: null};

function setMessage(text, type = "") {
  $("message").textContent = text;
  $("message").className = type;
}
function markChanged() {
  stale = true;
  $("staleBadge").hidden = !result;
  for (const id of ["jsonExport", "nodeExport", "sectionExport", "checkExport"]) $(id).disabled = true;
  if(pipeExtensions.stale)pipeExtensions.stale();
  setMessage("Đầu vào đã thay đổi. Tạo lại lưới nếu đổi hình học; tính lại để cập nhật kết quả.");
  draw();
}
function rowRemove(button) {
  button.addEventListener("click", () => { button.closest("tr, .rule").remove(); markChanged(); });
}
function addPressure(values = {}) {
  const tr = document.createElement("tr");
  tr.innerHTML = `<td><select data-key="boundary" aria-label="Biên đặt áp lực"><option value="outer">Ngoài</option><option value="inner">Trong</option></select></td>
    <td><input data-key="pressure" aria-label="Áp lực MPa" type="number" step="any" value="1" required></td>
    <td><input data-key="start_deg" aria-label="Góc đầu áp lực" type="number" step="any" value="0" required></td>
    <td><input data-key="end_deg" aria-label="Góc cuối áp lực" type="number" step="any" value="360" required></td>
    <td><button class="remove" type="button" aria-label="Xóa áp lực">×</button></td>`;
  for (const [key, value] of Object.entries(values)) tr.querySelector(`[data-key="${key}"]`).value = value;
  rowRemove(tr.querySelector("button"));
  $("pressureRows").append(tr);
}
function addSupport(values = {}) {
  const div = document.createElement("div"); div.className = "rule";
  div.innerHTML = `<div class="rule-top"><label>Đối tượng<select data-key="target"><option value="outer">Biên ngoài</option><option value="inner">Biên trong</option><option value="both">Cả hai biên</option><option value="node">Một nút</option></select></label>
    <label>Số nút<input data-key="node_id" type="number" min="1" step="1" value="1" required></label>
    <button class="remove" type="button" aria-label="Xóa gối">×</button></div>
    <div class="rule-arc"><label>Từ góc (°)<input data-key="start_deg" type="number" step="any" value="0" required></label><label>Đến góc (°)<input data-key="end_deg" type="number" step="any" value="360" required></label></div>
    <div class="rule-values"><label>Phương<select data-key="direction"><option value="r">r</option><option value="t">t</option></select></label>
    <label>Điều kiện<select data-key="kind"><option value="upper">u ≤ giá trị</option><option value="lower">u ≥ giá trị</option><option value="fixed">u = giá trị</option></select></label>
    <label>Giá trị (mm)<input data-key="value" type="number" step="any" value="0" required></label></div>`;
  for (const [key, value] of Object.entries(values)) div.querySelector(`[data-key="${key}"]`).value = value;
  const target = div.querySelector('[data-key="target"]');
  function updateTarget() {
    const node = target.value === "node";
    div.querySelector('[data-key="node_id"]').disabled = !node;
    div.querySelector(".rule-arc").hidden = node;
    for (const field of div.querySelectorAll(".rule-arc input")) field.disabled = node;
  }
  target.addEventListener("change", updateTarget); updateTarget();
  rowRemove(div.querySelector("button")); $("supportRows").append(div);
}
function addLoad(values = {}) {
  const tr = document.createElement("tr");
  tr.innerHTML = `<td><input data-key="node_id" aria-label="Số nút đặt lực" type="number" min="1" step="1" value="${selectedNode || 1}" required></td>
    <td><input data-key="force_r" aria-label="Lực Fr kN/m" type="number" step="any" value="0" required></td>
    <td><input data-key="force_t" aria-label="Lực Ft kN/m" type="number" step="any" value="0" required></td>
    <td><button class="remove" type="button" aria-label="Xóa lực nút">×</button></td>`;
  for (const [key, value] of Object.entries(values)) tr.querySelector(`[data-key="${key}"]`).value = value;
  rowRemove(tr.querySelector("button")); $("loadRows").append(tr);
}
function loadD600Preset() {
  // nr=6 and ntheta=96 put 0, 60, 120, 180 and 270 degrees exactly on nodes.
  const values={ri:200,ro:300,young:39.5,nu:0.2,nr:6,nt:96,concreteGrade:"B60"};
  for(const [id,value] of Object.entries(values))$(id).value=value;
  const nr=Number($("nr").value),nt=Number($("nt").value);
  const outerNode=angle=>nr*nt+Math.round(angle*nt/360)%nt+1;
  $("pressureRows").replaceChildren();
  $("loadRows").replaceChildren();
  $("supportRows").replaceChildren();
  for(const angle of [0,180,270]) {
    addSupport({target:"node",node_id:outerNode(angle),direction:"r",kind:"upper",value:0});
  }
  for(const angle of [60,120])addLoad({node_id:outerNode(angle),force_r:-20,force_t:0});
  mesh=null;selectedNode=null;lastGeometry=null;screenNodes=[];
  $("meshInfo").textContent="Chưa tạo lưới · bộ mặc định D600 × 100";
  updateSelection();showConcrete();markChanged();
  setMessage(`Đã nạp D600 × 100, B60; hai lực hướng tâm 20 kN/m, ba chặn một chiều. Nén trước hữu hiệu đang giữ ${$("prestress").value} MPa; kiểm tra giá trị này trước khi tính.`);
}
function readRow(row) {
  const data = {};
  for (const field of row.querySelectorAll("[data-key]")) {
    if (!field.disabled) data[field.dataset.key] = field.type === "number" ? Number(field.value) : field.value;
  }
  return data;
}
function inputs() {
  return {r_inner: Number($("ri").value) / 1000, r_outer: Number($("ro").value) / 1000,
    E: Number($("young").value) * 1e9, nu: Number($("nu").value),
    prestress: Number($("prestress").value) * 1e6, axial_mode: $("axial").value,
    nr: Number($("nr").value), ntheta: Number($("nt").value),
    pressures: [...$("pressureRows").children].map(row => {const p = readRow(row); p.pressure *= 1e6; return p;}),
    supports: [...$("supportRows").children].map(row => {const s = readRow(row); s.value /= 1000; return s;}),
    nodal_loads: [...$("loadRows").children].map(row => {const f = readRow(row); f.force_r *= 1000; f.force_t *= 1000; return f;}),
    tcvn: {enabled: $("tcvnEnabled").checked, grade: $("concreteGrade").value,
      duration: $("tcvnDuration").value, uls_load_factor: Number($("ulsLoadFactor").value),
      uls_prestress_factor: Number($("ulsPrestressFactor").value), vertical_pour_over_1_5m: $("verticalPour").checked,
      radial_displacement_limit_m: $("radialLimit").value === "" ? null : Number($("radialLimit").value)/1000,
      diameter_change_limit_ratio: $("diameterLimit").value === "" ? null : Number($("diameterLimit").value)/1000,
      limit_basis: $("limitBasis").value},
    ...(pipeExtensions.inputs ? pipeExtensions.inputs() : {})};
}
async function request(endpoint, data) {
  const response = await fetch(endpoint, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(data)});
  let body;
  try { body = await response.json(); } catch { throw new Error("Máy chủ không trả JSON. Hãy chạy python app.py --no-browser và mở /pipe.html."); }
  if (!response.ok || !body.ok) throw new Error(body.error || "Không thực hiện được yêu cầu.");
  return body;
}
async function run(solve) {
  if (busy || !$("modelForm").reportValidity()) return;
  const p = inputs();
  if (!(p.r_inner > 0 && p.r_outer > p.r_inner)) { setMessage("Cần 0 < r < R.", "error"); return; }
  if (lastGeometry !== null && lastGeometry !== geometry(p) && (p.nodal_loads.length || p.supports.some(s => s.target === "node"))) {
    setMessage("Đã đổi lưới và còn dữ liệu theo số nút. Hãy kiểm tra vị trí các nút sau khi tạo lại lưới.");
  }
  busy = true; pendingInput = p; $("solveButton").disabled = $("meshButton").disabled = true;
  setMessage(solve ? "Đang lắp ráp, giải cân bằng và kiểm tra trạng thái chặn…" : "Đang tạo lưới…");
  // Preserve controls disabled by a rule's target when the request completes.
  const fields = [...$("modelForm").querySelectorAll("input,select,button")];
  const disabled = fields.map(f => f.disabled); fields.forEach(f => { f.disabled = true; });
  try {
    const body = await request(solve ? (document.body.dataset.solveUrl || "/api/pipe/solve") : "/api/pipe/mesh", p);
    if(solve && p.tcvn.enabled && !body.result?.tcvn_checks)throw new Error("Máy chủ đang chạy mã cũ, chưa có kiểm tra TCVN. Hãy khởi động lại Python rồi tải lại trang.");
    if (solve) { result = body.result; solvedInput = p; stale = false; mesh = result.mesh; showResult(); }
    else { mesh = body.mesh; if (result && geometry(p) !== geometry(solvedInput)) stale = true; }
    lastGeometry = geometry(p);
    if (selectedNode > mesh.coordinates.length) selectedNode = null;
    $("meshInfo").textContent = `${mesh.coordinates.length} nút · ${mesh.elements.length} phần tử Q4 · nr=${mesh.nr}, nθ=${mesh.ntheta}`;
    if (solve) setMessage(`Đã hội tụ sau ${result.summary.contact_iterations} vòng giải; ${num(result.summary.solve_time_ms, 0)} ms. Kết quả tăng thêm tính từ trạng thái nén trước.`, "success");
    else setMessage("Đã tạo lưới. Nhấn vào một nút để xem số và tọa độ; kiểm tra lại số nút nếu vừa đổi lưới.");
    updateSelection(); draw();
  } catch (error) { markChanged(); setMessage(error.message, "error"); }
  finally {
    fields.forEach((f, i) => { f.disabled = disabled[i]; });
    $("solveButton").disabled = $("meshButton").disabled = false; busy = false; pendingInput = null;
  }
}
function showResult() {
  for (const id of ["summaryPanel", "sectionPanel", "reactionPanel"]) $(id).hidden = false;
  $("staleBadge").hidden = true;
  const s = result.summary;
  const metrics = [["|Δu|max", `${num(s.u_max*1000)} mm`], ["Δur nhỏ nhất", `${num(s.u_r_min*1000)} mm`],
    ["σθ nhỏ nhất (Gauss)", `${num(s.sigma_theta_min/1e6)} MPa`], ["σz tổng nhỏ nhất (Gauss)", `${num(s.sigma_z_min/1e6)} MPa`],
    ["Δεz đồng đều", sci(s.delta_epsilon_z)], ["Số bậc tự do đang tì", s.active_unilateral_dofs]];
  $("metrics").replaceChildren(...metrics.map(([label, value]) => {
    const div = document.createElement("div"); div.className = "metric";
    const span = document.createElement("span"), strong = document.createElement("strong");
    span.textContent = label; strong.textContent = value; div.append(span, strong); return div;
  }));
  const diagnostics = [["Lực dọc ban đầu trên toàn vành khuyên", `${num(s.axial_force_initial/1e6)} MN`],
    ["Gia số lực dọc trên toàn vành khuyên", `${sci(s.axial_force_increment/1000)} kN`],
    ["Lực dọc tổng trên toàn vành khuyên", `${num(s.axial_force_total/1e6)} MN`],
    ["Sai số diện tích so với vành tròn danh nghĩa", `${num(100*Math.abs(s.mesh_area/s.nominal_area-1))} %`],
    ["Sai số cân bằng X / Y", `${sci(s.force_balance_x)} / ${sci(s.force_balance_y)} N/m`],
    ["Sai số cân bằng mômen", `${sci(s.moment_balance)} N`],
    ["Sai số cân bằng tại bậc tự do tự do", `${sci(s.free_residual)} N/m`],
    ["Vi phạm chuyển vị chặn", `${sci(s.bound_violation*1000)} mm`]];
  $("diagnostics").replaceChildren(...diagnostics.flatMap(([label, value]) => {
    const dt = document.createElement("dt"), dd = document.createElement("dd"); dt.textContent = label; dd.textContent = value; return [dt, dd];
  }));
  const tableRow = values => { const tr = document.createElement("tr"); for (const value of values) { const td = document.createElement("td"); td.textContent = value; tr.append(td); } return tr; };
  $("sectionTable").replaceChildren(...result.sections.map(s => tableRow([num(s.theta_deg, 2), ...["N_theta", "M_theta", "Q_theta", "N_z_initial", "delta_N_z", "N_z", "M_z"].map(k => num(s[k]/1000))])));
  const state = value => ({"0": "Tự do / mở", "-1": "Tì giới hạn dưới", "1": "Tì giới hạn trên", "2": "Cưỡng bức"}[value]);
  $("reactionTable").replaceChildren(...result.reactions.map(r => tableRow([r.node_id, num(r.reaction_r/1000), num(r.reaction_t/1000), state(r.state_r), state(r.state_t)])));
  if (!result.reactions.length) $("reactionTable").append(tableRow(["Không khai báo gối; chỉ loại bỏ chuyển động vật rắn."]));
  for (const id of ["jsonExport", "nodeExport", "sectionExport"]) $(id).disabled = false;
  showTcvn();
  if(pipeExtensions.results)pipeExtensions.results(result);
}

function checkValue(value, unit) {
  if(value===null || value===undefined)return "—";
  if(unit==="Pa")return `${num(value/1e6,4)} MPa`;
  if(unit==="m")return `${num(value*1000,5)} mm`;
  if(unit==="ratio")return `${num(value*1000,5)} ‰`;
  return `${num(value,5)} ${unit}`;
}
function showTcvn() {
  const checks=result.tcvn_checks;
  $("tcvnPanel").hidden=!checks; $("checkExport").disabled=!checks;
  for(const option of $("field").querySelectorAll("[data-tcvn-map]"))option.disabled=!checks;
  if($("field").selectedOptions[0].disabled)$("field").value="u_r";
  if(!checks)return;
  $("tcvnStatus").className=`check-status ${checks.summary_status}`;
  $("tcvnStatus").textContent=checks.summary_status==="exceeded" ?
    "Có điều kiện vượt ngưỡng trong phạm vi đang kiểm tra. Xem vị trí và điều khoản bên dưới." :
    "Chưa vượt các ngưỡng đã kiểm tra; vẫn còn điều kiện chưa đánh giá. Chưa kết luận toàn bộ kết cấu đạt TTGH1–TTGH2.";
  const m=checks.material,c=checks.cases.ULS.summary;
  $("tcvnMaterial").textContent=`Bê tông nặng ${m.grade} · Rb = ${num(m.Rb_Pa/1e6)} MPa, Rbt = ${num(m.Rbt_Pa/1e6)} MPa · Rb,ser = ${num(m.Rb_ser_Pa/1e6)} MPa, Rbt,ser = ${num(m.Rbt_ser_Pa/1e6)} MPa · γb1/b2/b3 = ${m.gamma_b1}/${m.gamma_b2}/${m.gamma_b3} → Rb dùng = ${num(m.Rb_effective_Pa/1e6)} MPa · E dùng = ${num(m.E_used_Pa/1e9)} GPa (Bảng 10: ${num(m.Eb_table_Pa/1e9)} GPa).`;
  $("tcvnCaseInfo").textContent=`TTGH1: tải ×${checks.cases.ULS.load_factor}, nén trước ×${checks.cases.ULS.prestress_factor}; ${c.active_unilateral_dofs} bậc tự do đang tì, ${c.contact_iterations} vòng giải. Bảng nội lực phía dưới là trường hợp sử dụng, không phải nội lực đã nhân hệ số.`;
  const states={within_limits:"Trong ngưỡng riêng",exceeded:"Vượt ngưỡng",not_assessed:"Chưa kết luận"};
  $("tcvnTable").replaceChildren(...checks.rows.map(row=>{
    const tr=document.createElement("tr");
    const titles=[`${row.group} · ${row.title}`,checkValue(row.demand,row.unit),checkValue(row.limit,row.unit),row.ratio===null ? "—" : num(row.ratio,4),states[row.status]];
    titles.forEach((text,index)=>{const td=document.createElement("td");td.textContent=text;if(index===4)td.className=row.status;tr.append(td);});
    const where=document.createElement("td"),critical=row.critical;
    let location="";
    if(critical?.element_id)location=`PT ${critical.element_id} / ${critical.point_id}`;
    if(critical?.node_id)location=`Nút ${critical.node_id}`;
    if(critical?.bar_id)location=`Thanh ${critical.bar_id}`;
    if(critical?.theta_deg!==undefined)location+=` · θ=${num(critical.theta_deg,2)}°`;
    where.textContent=location;
    const clause=document.createElement("span");clause.className="sub";clause.textContent=row.clause;where.append(clause);
    const note=document.createElement("span");note.className="sub";note.textContent=row.note;where.append(note);tr.append(where);return tr;
  }));
  const d=checks.deformation;
  $("tcvnStrains").textContent=`|ΔD|max = ${num(d.diameter_change.absolute_m*1000,5)} mm · εnén quy đổi lớn nhất = ${sci(d.equivalent_compressive_strain)} · εgiãn quy đổi lớn nhất = ${sci(d.equivalent_tensile_strain)}. ${d.strain_note}`;
  $("tcvnWarnings").replaceChildren(...checks.warnings.map(text=>{const li=document.createElement("li");li.textContent=text;return li;}));
}

function showConcrete() {
  const m=concreteCatalog?.grades[$("concreteGrade").value];
  if(!m)return;
  $("concreteInfo").textContent=`Bảng 7: Rb=${m.Rb_MPa}, Rbt=${m.Rbt_MPa} MPa. Bảng 6: Rb,ser=${m.Rb_ser_MPa}, Rbt,ser=${m.Rbt_ser_MPa} MPa. Bảng 10: Eb=${m.Eb_GPa} GPa. Không tự đổi E đã nhập.`;
}
function updateSelection() {
  if (!mesh || !selectedNode) { $("selection").textContent = "Chưa chọn nút"; return; }
  const [radius, angle] = mesh.polar[selectedNode-1];
  $("selection").textContent = `Nút ${selectedNode} · r=${num(radius*1000, 2)} mm · θ=${num(angle, 2)}°`;
}
function color(value, low, high) {
  const t = high > low ? Math.max(0, Math.min(1, (value-low)/(high-low))) : 0.5;
  return `hsl(${225-210*t} 66% ${43+8*Math.sin(Math.PI*t)}%)`;
}
function draw() {
  const canvas = $("meshCanvas"), box = canvas.getBoundingClientRect();
  const w = box.width, h = box.height, ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(w*ratio); canvas.height = Math.round(h*ratio);
  const ctx = canvas.getContext("2d"); ctx.setTransform(ratio,0,0,ratio,0,0); ctx.clearRect(0,0,w,h);
  if (!mesh) { ctx.fillStyle = "#a9b8cc"; ctx.font = "14px Segoe UI"; ctx.textAlign = "center"; ctx.fillText("Tạo lưới để xem mặt cắt", w/2,h/2); return; }
  const useResult = result && !stale && result.mesh === mesh;
  const exaggeration = Math.max(0, Number($("deformation").value) || 0);
  const points = mesh.coordinates.map(([x,y],i) => useResult ? [x+exaggeration*result.nodal.u_x[i], y+exaggeration*result.nodal.u_y[i]] : [x,y]);
  let radius = 0;
  for (const p of [...mesh.coordinates,...points]) radius = Math.max(radius,Math.abs(p[0]),Math.abs(p[1]));
  const scale = Math.min(w-80,h-95)/(2*radius), cx = w/2, cy = (h-30)/2;
  const screen = ([x,y]) => [cx+x*scale,cy-y*scale];
  screenNodes = mesh.coordinates.map(screen);
  const field = $("field").value;
  let values = null, low = 0, high = 0;
  if (useResult) {
    values = mesh.elements.map((ids,i) => field.startsWith("u_") ? ids.reduce((sum,n) => sum+result.nodal[field][n-1]*1000,0)/ids.length : result.element_results[i][field]/(field.startsWith("eta_") ? 1 : 1e6));
    low = Math.min(...values); high = Math.max(...values);
    if(field.startsWith("eta_")){low=0;high=Math.max(high,1);}
  }
  function polygon(ids, coords) { ctx.beginPath(); ids.forEach((n,j) => { const p = screen(coords[n-1]); if (j) ctx.lineTo(...p); else ctx.moveTo(...p); }); ctx.closePath(); }
  for (const [i,ids] of mesh.elements.entries()) {
    polygon(ids,points); ctx.fillStyle = useResult ? color(values[i],low,high) : "#20334c"; ctx.fill();
    ctx.strokeStyle = useResult ? "#17223577" : "#617590"; ctx.lineWidth = .6; ctx.stroke();
  }
  if (useResult && exaggeration) { ctx.strokeStyle="#acb9c688"; ctx.lineWidth=.5; for (const ids of mesh.elements) { polygon(ids,mesh.coordinates); ctx.stroke(); } }
  if(pipeExtensions.draw)pipeExtensions.draw({ctx,screen,useResult,mesh});
  const p = useResult ? solvedInput : (pendingInput || inputs());
  const inArc = (angle,start=0,end=360) => Math.abs(end-start)>=360-1e-9 || ((angle-start)%360+360)%360<=((end-start)%360+360)%360+1e-9;
  const shownSupports = useResult ? result.resolved_supports : p.supports.map(s => ({...s,node_ids:s.target==="node" ? [s.node_id] :
    (s.target==="both" ? [...mesh.inner_nodes,...mesh.outer_nodes] : mesh[s.target+"_nodes"]).filter(n=>inArc(mesh.polar[n-1][1],s.start_deg,s.end_deg))}));
  const reactions = new Map(useResult ? result.reactions.map(r=>[r.node_id,r]) : []);
  const marked = new Set();
  for (const support of shownSupports) for (const n of support.node_ids) {
    if(marked.has(n)) continue; marked.add(n);
    if (!points[n-1]) continue;
    const position=screen(points[n-1]), r=reactions.get(n), active=r && (r.state_r || r.state_t);
    ctx.fillStyle=active ? "#73f0b4" : "#92a3b9"; ctx.fillRect(position[0]-2,position[1]-2,4,4);
  }
  function arrow(head, dx, dy, tint) {
    const norm=Math.hypot(dx,dy); if(!norm)return; dx/=norm;dy/=norm;
    ctx.strokeStyle=tint;ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(head[0]-19*dx,head[1]-19*dy);ctx.lineTo(...head);
    ctx.moveTo(head[0]-6*dx-3*dy,head[1]-6*dy+3*dx);ctx.lineTo(...head);ctx.lineTo(head[0]-6*dx+3*dy,head[1]-6*dy-3*dx);ctx.stroke();
  }
  for(const pressure of p.pressures) {
    if(!pressure.pressure)continue;
    const boundary=pressure.boundary==="inner" ? mesh.inner_nodes : mesh.outer_nodes;
    const eligible=boundary.filter((n,j)=>inArc((j+.5)*360/mesh.ntheta,pressure.start_deg,pressure.end_deg));
    const stride=Math.max(1,Math.ceil(eligible.length/14));
    for(let j=0;j<eligible.length;j+=stride) {
      const n=eligible[j]-1,angle=mesh.polar[n][1]*Math.PI/180;
      const sign=Math.sign(pressure.pressure)*(pressure.boundary==="inner" ? 1 : -1);
      arrow(screen(points[n]),sign*Math.cos(angle),-sign*Math.sin(angle),"#73d8d0");
    }
  }
  for(const load of p.nodal_loads) {
    const n=load.node_id-1;if(!points[n])continue;
    const angle=mesh.polar[n][1]*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
    arrow(screen(points[n]),c*load.force_r-s*load.force_t,-s*load.force_r-c*load.force_t,"#ffd28b");
  }
  const labels = $("nodeLabels").checked;
  ctx.font="9px Segoe UI"; ctx.textAlign="left";
  if (labels) for (const [i,p] of screenNodes.entries()) { ctx.fillStyle="#fff"; ctx.fillText(String(i+1),p[0]+3,p[1]-3); }
  if(selectedNode && screenNodes[selectedNode-1]) {const p=screenNodes[selectedNode-1]; ctx.strokeStyle="#fff";ctx.lineWidth=2;ctx.beginPath();ctx.arc(p[0],p[1],6,0,2*Math.PI);ctx.stroke();}
  ctx.fillStyle="#a9b8cc";ctx.font="11px Segoe UI";ctx.fillText("+X →",w-55,cy+14);ctx.fillText("+Y ↑",cx+9,23);
  ctx.fillText(`r = ${num(mesh.polar[0][0]*1000,0)} mm`,12,h-48);
  if (useResult) {
    const x=65,y=h-29,width=Math.max(60,w-130),gradient=ctx.createLinearGradient(x,0,x+width,0);
    for(let j=0;j<=10;j++)gradient.addColorStop(j/10,color(low+(high-low)*j/10,low,high));
    ctx.fillStyle=gradient;ctx.fillRect(x,y,width,9);ctx.fillStyle="#dbe6f5";
    ctx.textAlign="left";ctx.fillText(num(low,5),x,y-6);ctx.textAlign="right";ctx.fillText(num(high,5),x+width,y-6);
    ctx.textAlign="center";ctx.fillText($("field").selectedOptions[0].textContent,x+width/2,y+23);
  }
}
function save(name, content, type) {
  const url=URL.createObjectURL(new Blob([content],{type})), a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function csv(headers, rows) {
  const cell=value=>{const text=value===null||value===undefined?"":String(value);return /[",\r\n]/.test(text)?`"${text.replaceAll('"','""')}"`:text;};
  return "\ufeff"+[headers,...rows].map(row=>row.map(cell).join(",")).join("\r\n");
}
$("checkExport").addEventListener("click",()=>{
  if(!result?.tcvn_checks||stale)return;
  const rows=result.tcvn_checks.rows.map(r=>[r.id,r.group,r.title,r.demand,r.limit,r.ratio,r.unit,r.status,r.clause,r.critical?.element_id,r.critical?.point_id,r.critical?.node_id,r.critical?.theta_deg,r.note]);
  save("ong-dai-kiem-tra-tcvn.csv",csv(["id","group","condition","demand_SI","limit_SI","ratio","unit_SI","status","clause","element_id","point_id","node_id","theta_deg","note"],rows),"text/csv;charset=utf-8");
});
$("jsonExport").addEventListener("click",()=>{if(result&&!stale)save("ong-dai-mo-hinh-ket-qua.json",JSON.stringify({input:solvedInput,result},null,2),"application/json");});
$("sectionExport").addEventListener("click",()=>{
  if(!result||stale)return;
  const keys=["theta_deg","N_theta","M_theta","Q_theta","N_z_initial","delta_N_z","N_z","M_z"];
  save("ong-dai-noi-luc.csv",csv(["theta_deg","Ntheta_N_per_m","Mtheta_Nm_per_m","Qtheta_N_per_m","Nz_initial_N_per_m","delta_Nz_N_per_m","Nz_total_N_per_m","Mz_total_Nm_per_m"],result.sections.map(s=>keys.map(k=>s[k]))),"text/csv;charset=utf-8");
});
$("nodeExport").addEventListener("click",()=>{
  if(!result||stale)return;
  const reactions=new Map(result.reactions.map(r=>[r.node_id,r]));
  const rows=result.mesh.coordinates.map(([x,y],i)=>{const r=reactions.get(i+1);return[i+1,x,y,result.nodal.u_r[i],result.nodal.u_t[i],result.nodal.u_x[i],result.nodal.u_y[i],r?.reaction_r||0,r?.reaction_t||0];});
  save("ong-dai-nut-phan-luc.csv",csv(["node_id","x_m","y_m","delta_ur_m","delta_ut_m","delta_ux_m","delta_uy_m","delta_Rr_N_per_m","delta_Rt_N_per_m"],rows),"text/csv;charset=utf-8");
});
$("modelForm").addEventListener("submit",event=>{event.preventDefault();run(true);});
$("modelForm").addEventListener("input",markChanged);
$("modelForm").addEventListener("change",()=>{draw();});
$("meshButton").addEventListener("click",()=>run(false));
$("addPressure").addEventListener("click",()=>{addPressure();markChanged();});
$("addSupport").addEventListener("click",()=>{addSupport();markChanged();});
$("addLoad").addEventListener("click",()=>{addLoad();markChanged();});
$("presetD600").addEventListener("click",loadD600Preset);
$("supportSelected").addEventListener("click",()=>{
  if(!selectedNode){setMessage("Hãy tạo lưới rồi nhấn chọn một nút trên hình.");return;}
  addSupport({target:"node",node_id:selectedNode});markChanged();
});
for(const id of ["field","deformation","nodeLabels"])$(id).addEventListener("input",draw);
$("meshCanvas").addEventListener("click",event=>{
  if(!mesh||busy)return;
  const rect=event.currentTarget.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;
  let distance=20,selected=null;
  screenNodes.forEach(([px,py],i)=>{const d=Math.hypot(px-x,py-y);if(d<distance){distance=d;selected=i+1;}});
  selectedNode=selected;updateSelection();draw();
});
new ResizeObserver(draw).observe($("meshCanvas"));
$("tcvnEnabled").addEventListener("change",()=>{$("tcvnFields").disabled=!$("tcvnEnabled").checked;});
$("concreteGrade").addEventListener("change",showConcrete);
$("useTableE").addEventListener("click",()=>{const m=concreteCatalog?.grades[$("concreteGrade").value];if(m){$("young").value=m.Eb_GPa;markChanged();}});
fetch("/api/pipe/tcvn-materials").then(response=>{if(!response.ok)throw new Error();return response.json();}).then(data=>{concreteCatalog=data;showConcrete();}).catch(()=>{$("concreteInfo").textContent="Chưa đọc được danh mục TCVN. Hãy khởi động lại máy chủ Python với mã mới rồi tải lại trang.";});
loadD600Preset();
