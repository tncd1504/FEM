"use strict";
let steelCatalog=null;
function reinforcementInputs(){
  return {reinforcement:{longitudinal_count:Number($("longCount").value),longitudinal_diameter:Number($("longDiameter").value)/1000,
    longitudinal_grade:$("longGrade").value,hoop_diameter:Number($("hoopDiameter").value)/1000,
    hoop_pitch:Number($("hoopPitch").value)/1000,hoop_grade:$("hoopGrade").value,
    cover:Number($("steelCover").value)/1000,E_s:Number($("steelE").value)*1e9,
    longitudinal_start_deg:Number($("longStart").value),initial_longitudinal_stress:Number($("steelInitial").value)*1e6},
    compare_plain:$("comparePlain").checked};
}
function showSteelMaterial(){
  if(!steelCatalog)return;
  const l=steelCatalog.grades[$("longGrade").value],h=steelCatalog.grades[$("hoopGrade").value];
  $("steelMaterialInfo").textContent=`Thép dọc: Rs=${l.Rs_MPa}, Rsc ngắn hạn=${l.Rsc_short_MPa}, Rsn=${l.Rsn_MPa} MPa. Đai: Rs=${h.Rs_MPa}, Rsn=${h.Rsn_MPa} MPa. Kiểm tra lực vòng trực tiếp dùng Rs; chưa kiểm tra cắt theo Rsw.`;
}
function showSteelResults(output){
  const steel=output.reinforcement;if(!steel)return;
  $("steelResultPanel").hidden=false;
  const s=output.summary,st=steel.summary;
  $("steelMetrics").replaceChildren(...[
    ["Diện tích thép dọc",`${num(st.longitudinal_area*1e6,2)} mm²`],
    ["Ah / bước đai",`${num(st.hoop_area_per_axial_length*1e6,2)} mm²/m`],
    ["ΔPz bê tông",`${num(s.axial_force_increment_concrete/1000,4)} kN`],
    ["ΔPz thép dọc",`${num(s.axial_force_increment_steel/1000,4)} kN`],
    ["Năng lượng thép / tổng",`${num(100*s.strain_energy_increment_steel/(s.strain_energy_increment||1),2)} %`],
    ["Δεz thép dọc = Δεz bê tông",sci(st.delta_epsilon_longitudinal)]
  ].map(([label,value])=>{const d=document.createElement("div");d.className="metric";const a=document.createElement("span"),b=document.createElement("strong");a.textContent=label;b.textContent=value;d.append(a,b);return d;}));
  const comparison=output.comparison_plain;
  $("steelComparison").textContent=comparison ? `Đối chiếu cùng tải/gối: |Δu|max không kể thép = ${num(comparison.summary.u_max*1000,6)} mm; có thép = ${num(s.u_max*1000,6)} mm; thay đổi ${num(comparison.displacement_change_percent,3)} %. ${comparison.note}` : "Đã tắt giải đối chiếu không kể thép.";
  const row=values=>{const tr=document.createElement("tr");values.forEach(v=>{const td=document.createElement("td");td.textContent=v;tr.append(td);});return tr;};
  $("longSteelTable").replaceChildren(...steel.longitudinal_results.map(p=>row([p.bar_id,num(p.theta_deg,2),num(p.radius*1000,2),sci(p.strain_increment),num(p.initial_stress/1e6),num(p.stress_increment/1e6),num(p.stress_total/1e6),num(p.force_per_bar/1000)])));
  $("hoopSteelTable").replaceChildren(...steel.hoop_results.map(p=>row([p.element_id,p.sector+1,sci(p.strain_increment),num(p.stress_total/1e6)])));
  $("steelResultNote").textContent=steel.section_convention;
  $("steelExport").disabled=false;
}
function drawReinforcement({ctx,screen,mesh}){
  const raw=reinforcementInputs().reinforcement;
  const ro=mesh.polar[mesh.outer_nodes[0]-1][0],ri=mesh.polar[0][0];
  const rh=ro-raw.cover-raw.hoop_diameter/2,rl=ro-raw.cover-raw.hoop_diameter-raw.longitudinal_diameter/2;
  if(raw.hoop_diameter>0&&rh>ri&&rh<ro){
    ctx.beginPath();for(let j=0;j<=mesh.ntheta;j++){const a=j*2*Math.PI/mesh.ntheta,p=screen([rh*Math.cos(a),rh*Math.sin(a)]);if(j)ctx.lineTo(...p);else ctx.moveTo(...p);}
    ctx.strokeStyle="#ffcc74";ctx.lineWidth=2;ctx.setLineDash([5,3]);ctx.stroke();ctx.setLineDash([]);
  }
  if(rl>ri&&rl<ro&&raw.longitudinal_count>0){
    for(let j=0;j<Math.min(raw.longitudinal_count,200);j++){const a=(raw.longitudinal_start_deg+j*360/raw.longitudinal_count)*Math.PI/180,p=screen([rl*Math.cos(a),rl*Math.sin(a)]);ctx.beginPath();ctx.arc(...p,3,0,2*Math.PI);ctx.fillStyle="#ffb76e";ctx.fill();}
  }
}
pipeExtensions.inputs=reinforcementInputs;
pipeExtensions.results=showSteelResults;
pipeExtensions.draw=drawReinforcement;
pipeExtensions.stale=()=>{$("steelExport").disabled=true;};
$("steelExport").addEventListener("click",()=>{
  if(!result?.reinforcement||stale)return;
  const steel=result.reinforcement;
  const rows=[...steel.longitudinal_results.map(p=>["longitudinal",p.bar_id,"",p.theta_deg,p.strain_increment,p.initial_stress,p.stress_increment,p.stress_total,p.force_per_bar]),
    ...steel.hoop_results.map(p=>["hoop","",p.element_id,"",p.strain_increment,0,p.stress_increment,p.stress_total,""])];
  save("coc-d600-thep.csv",csv(["family","bar_id","element_id","theta_deg","delta_strain","initial_stress_Pa","delta_stress_Pa","total_stress_Pa","force_per_long_bar_N"],rows),"text/csv;charset=utf-8");
});
for(const id of ["longGrade","hoopGrade"])$(id).addEventListener("change",showSteelMaterial);
fetch("/api/pipe-rc/steel-materials").then(r=>{if(!r.ok)throw new Error();return r.json();}).then(c=>{steelCatalog=c;showSteelMaterial();}).catch(()=>{$("steelMaterialInfo").textContent="Khởi động lại máy chủ Python để nạp bộ giải cốt thép.";});
draw();
