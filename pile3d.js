"use strict";
const el=id=>document.getElementById(id);
const fmt=(v,d=3)=>Number.isFinite(v)?new Intl.NumberFormat("vi-VN",{maximumFractionDigits:d}).format(v):"—";
const exports3d=["exportSolidJson","exportSolidNodes","exportSolidSections","exportSolidRing"];
let mesh3d=null,answer=null,solvedInput=null,stale3d=false,busy3d=false,catalog3d=null;
let yaw=1.13,pitch=.28,zoom=1,drag=null,drawPending=false;
const defaults3d={diameter:600,thickness:100,length:12,young:39.5,poisson:.2,prestress:5,supportA:.2,supportB:.8,supportWidth:.3,supportArc:30,supportShape:"flat",nr3d:2,ntheta3d:48,nz3d:40,elementType:"H8_EAS",grade:"B60"};

function loadRow(angle=60,q=20){
  const tr=document.createElement("tr"),a=document.createElement("input"),v=document.createElement("input"),b=document.createElement("button");
  a.type=v.type="number";a.step=v.step="any";a.required=v.required=true;a.value=angle;v.value=q;
  a.setAttribute("aria-label","Góc lực đường");v.setAttribute("aria-label","Lực đường kN/m");b.type="button";b.className="remove";b.textContent="×";b.setAttribute("aria-label","Xóa lực đường");
  for(const item of[a,v,b]){const td=document.createElement("td");td.append(item);tr.append(td);}b.addEventListener("click",()=>{tr.remove();changed3d();});el("lineLoads").append(tr);
}
function read3d(){
  const n=id=>Number(el(id).value),ro=n("diameter")/2000;
  if(!(ro>0&&n("thickness")>0&&n("thickness")/1000<ro))throw new Error("Chiều dày phải lớn hơn 0 và nhỏ hơn bán kính ngoài.");
  return{r_outer:ro,r_inner:ro-n("thickness")/1000,length:n("length"),E:n("young")*1e9,nu:n("poisson"),prestress:n("prestress")*1e6,
    support_fractions:[n("supportA"),n("supportB")],support_width:n("supportWidth"),support_arc_deg:n("supportArc"),support_shape:el("supportShape").value,
    side_stops:el("sideStops").checked,self_weight:el("selfWeight").checked,nr:n("nr3d"),ntheta:n("ntheta3d"),nz:n("nz3d"),element_type:el("elementType").value,grade:el("grade").value,
    line_loads:[...el("lineLoads").children].map(tr=>({angle_deg:Number(tr.children[0].firstChild.value),value:Number(tr.children[1].firstChild.value)*1000}))};
}
function supportText(){const l=Number(el("length").value);el("supportInfo").textContent=`Gối A: z = ${fmt(l*Number(el("supportA").value))} m · Gối B: z = ${fmt(l*Number(el("supportB").value))} m`;
  el("supportDescription").textContent=el("supportShape").value==="flat"?"Mặt gối nằm ở y = −R. Chỉ các nút khép hết khe hở hình học mới tì; cho phép nhấc và trượt tự do.":"Gối ôm cung tròn phía dưới, tiếp xúc ban đầu sát mặt cọc; chặn hướng ra ngoài, cho phép tách gối và trượt.";}
function changed3d(){supportText();stale3d=Boolean(answer);el("solidStale").hidden=!stale3d;for(const id of exports3d)el(id).disabled=true;if(mesh3d)message3d("Dữ liệu đã đổi. Bấm Xem lưới hoặc Giải mô hình để cập nhật.");}
function message3d(text,type=""){el("solidMessage").textContent=text;el("solidMessage").className=type;}
function setBusy3d(state){busy3d=state;for(const item of el("solidForm").querySelectorAll("button,input,select"))item.disabled=state;el("solveSolid").textContent=state?"Đang tính…":"Giải mô hình khối 3D";}
async function request3d(solve){
  if(busy3d||!el("solidForm").reportValidity())return;let p;try{p=read3d();}catch(e){message3d(e.message,"error");return;}
  setBusy3d(true);message3d(solve?"Đang lắp phần tử khối và giải tiếp xúc hai gối…":"Đang tạo lưới…");
  try{const response=await fetch(`/api/pile3d/${solve?"solve":"mesh"}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(p)}),body=await response.json();if(!response.ok||!body.ok)throw new Error(body.error||"Không nhận được kết quả từ máy chủ.");
    if(solve){answer=body.result;mesh3d=answer.mesh;solvedInput=p;stale3d=false;showAnswer3d();}else{mesh3d=body.mesh;answer=null;solvedInput=null;stale3d=false;for(const id of["stressPanel","reactionPanel","internalPanel","diagnosticPanel"])el(id).hidden=true;showMetrics3d();}
    el("solidStale").hidden=true;el("sliceIndex").max=mesh3d.nz-1;el("sliceIndex").value=Math.floor(mesh3d.nz/2);
    el("meshInfo").textContent=`${fmt(mesh3d.nnode)} nút · ${fmt(mesh3d.nel)} phần tử · ${mesh3d.nr} lớp dày × ${mesh3d.ntheta} đoạn vòng × ${mesh3d.nz} đoạn dọc thực tế. ${mesh3d.settings.element_type==="H8_EAS"?"H8 cải tiến uốn":"H8 đầy đủ"}. Kéo để xoay; cuộn để thu phóng. Màu ứng suất tại tâm; các cực trị lấy ở điểm Gauss.`;
    message3d(solve?`Đã giải trong ${fmt(answer.summary.solve_time_ms/1000,2)} giây. Chuyển vị và nội lực dùng độ cứng đàn hồi ban đầu.`:"Lưới đã sẵn sàng. Bấm Giải mô hình khối 3D để tính chuyển vị và nội lực.","success");scheduleDraw();
  }catch(e){message3d(e.message+(e instanceof SyntaxError?" Hãy khởi động máy chủ bằng python pile_app.py để nạp API mới.":""),"error");}finally{setBusy3d(false);}
}
function metrics3d(items){el("solidMetrics").replaceChildren(...items.map(([name,value])=>{const div=document.createElement("div"),a=document.createElement("span"),b=document.createElement("strong");div.className="metric";a.textContent=name;b.textContent=value;div.append(a,b);return div;}));}
function showMetrics3d(){if(!mesh3d)return;const c=mesh3d.settings;el("metricsTitle").textContent="Mô hình";metrics3d([["Đường kính ngoài",`${fmt(c.r_outer*2000)} mm`],["Chiều dài",`${fmt(c.length)} m`],["Chiều dày",`${fmt((c.r_outer-c.r_inner)*1000)} mm`],["Gối A",`${fmt((c.support_fractions[0]??0)*c.length)} m`],["Gối B",`${fmt((c.support_fractions[1]??0)*c.length)} m`],["Số phần tử",fmt(mesh3d.nel)]]);}
function tableRow3d(values){const tr=document.createElement("tr");for(const value of values){const td=document.createElement("td");td.textContent=value;tr.append(td);}return tr;}
function showAnswer3d(){
  const s=answer.summary,c=answer.screens;el("metricsTitle").textContent="Kết quả đàn hồi";
  metrics3d([["|Δu|max",`${fmt(s.u_max*1000,5)} mm`],["uy trục cọc nhỏ nhất",`${fmt(s.axis_u_y_min*1000,5)} mm`],["Phản lực đứng gối A",`${fmt(answer.supports[0]?.reaction[1]/1000)} kN`],["Phản lực đứng gối B",`${fmt(answer.supports[1]?.reaction[1]/1000)} kN`],["Kéo chính lớn nhất",`${fmt(s.sigma_tensile_max/1e6)} MPa`],["Nén chính lớn nhất",`${fmt(s.sigma_compressive_max/1e6)} MPa`]]);
  for(const id of["stressPanel","reactionPanel","internalPanel","diagnosticPanel"])el(id).hidden=false;
  el("stressStatus").className=`check-status ${c.eta_cracking>1||c.eta_compression>1?"exceeded":""}`;
  el("stressStatus").textContent=c.eta_cracking>1?"Có dấu hiệu nứt: ứng suất kéo chính vượt Rbt,ser. Cần phân tích sau nứt trước khi kết luận biến dạng sử dụng.":c.eta_compression>1?"Vượt ngưỡng nén trong kiểm tra sàng lọc đàn hồi. Cần đánh giá sức kháng đầy đủ.":!c.elastic_screen_valid?"Có vùng nén vượt phạm vi đàn hồi tuyến tính dùng cho kiểm tra biến dạng.":"Chưa vượt các ngưỡng sàng lọc đang xét. Chưa kết luận đạt toàn bộ TTGH theo TCVN.";
  el("stressRows").replaceChildren(tableRow3d([`Kéo chính / Rbt,ser · ${c.grade}`,`${fmt(s.sigma_tensile_max/1e6)} MPa`,`${fmt(c.Rbt_ser/1e6)} MPa`,fmt(c.eta_cracking)]),tableRow3d(["Nén chính / Rb hiệu dụng",`${fmt(s.sigma_compressive_max/1e6)} MPa`,`${fmt(c.Rb_effective/1e6)} MPa`,fmt(c.eta_compression)]));
  const critical=answer.critical.tension;el("criticalInfo").textContent=`Điểm kéo bất lợi: phần tử ${critical.element_id}, ${critical.point_id}; x = ${fmt(critical.x)} m, y = ${fmt(critical.y)} m, z = ${fmt(critical.z)} m. Nén trước ban đầu tương ứng N₀ = ${fmt(s.initial_axial_force/1000)} kN, đã cộng một lần vào ứng suất tổng.`;
  el("supportRows").replaceChildren(...answer.supports.map(p=>tableRow3d([p.name,fmt(p.center_z),fmt(p.reaction_centroid_z),...p.reaction.map(v=>fmt(v/1000)),p.active_nodes])));
  el("internalRows").replaceChildren(...answer.section_resultants.map(p=>tableRow3d([fmt(p.z),...["N_z","V_x","V_y","M_x","M_y","T_z"].map(k=>fmt(p[k]/1000))])));el("internalCount").textContent=`${answer.section_resultants.length} mặt cắt`;
  const diagnostics=[["Tổng tải đứng",`${fmt(s.total_applied_force[1]/1000,6)} kN`],["Tổng phản lực đứng",`${fmt(s.total_reaction[1]/1000,6)} kN`],["Sai số lực (x, y, z)",s.force_balance.map(v=>v.toExponential(2)).join(" / ")+" N"],["Sai số mô men",s.moment_balance.map(v=>v.toExponential(2)).join(" / ")+" N·m"],["Vòng giải tiếp xúc",s.contact_iterations],["Xuyên gối lớn nhất",`${s.bound_violation.toExponential(2)} m`],["Thể tích lưới",`${fmt(s.volume,6)} m³`],["Năng lượng biến dạng",`${fmt(s.strain_energy)} J`]];
  el("solidDiagnostics").replaceChildren(...diagnostics.flatMap(([name,value])=>{const a=document.createElement("dt"),b=document.createElement("dd");a.textContent=name;b.textContent=value;return[a,b];}));for(const id of exports3d)el(id).disabled=false;
}
function canvas3d(id){const cv=el(id),r=cv.getBoundingClientRect(),dpr=window.devicePixelRatio||1;cv.width=Math.round(r.width*dpr);cv.height=Math.round(r.height*dpr);const ctx=cv.getContext("2d");ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,r.width,r.height);return{ctx,w:r.width,h:r.height};}
function contour(v,min,max){const a=max-min>1e-15?Math.max(0,Math.min(1,(v-min)/(max-min))):.5;return `hsl(${235*(1-a)} 72% ${43+8*Math.sin(a*Math.PI)}%)`;}
function field3d(){
  if(!answer)return{min:0,max:1,unit:"",nodal:null,values:null};const key=el("solidField").value;let values,nodal=false;
  if(key==="u_mag"){values=answer.nodal.u_x.map((x,i)=>Math.hypot(x,answer.nodal.u_y[i],answer.nodal.u_z[i])*1000);nodal=true;}else if(key==="u_y"){values=answer.nodal.u_y.map(v=>v*1000);nodal=true;}else values=answer.element_results.map(p=>p[key]/1e6);
  let min=Infinity,max=-Infinity;for(const v of values){min=Math.min(min,v);max=Math.max(max,v);}return{min,max,unit:nodal?"mm":"MPa",nodal,values};
}
function arrow2d(ctx,from,to,color){const dx=to[0]-from[0],dy=to[1]-from[1],norm=Math.hypot(dx,dy);if(norm<2)return;const ux=dx/norm,uy=dy/norm;ctx.beginPath();ctx.moveTo(from[0],from[1]);ctx.lineTo(to[0],to[1]);ctx.strokeStyle=color;ctx.lineWidth=1.6;ctx.stroke();ctx.beginPath();ctx.moveTo(to[0],to[1]);ctx.lineTo(to[0]-7*ux+3*uy,to[1]-7*uy-3*ux);ctx.lineTo(to[0]-7*ux-3*uy,to[1]-7*uy+3*ux);ctx.closePath();ctx.fillStyle=color;ctx.fill();}
function draw3d(){
  const{ctx,w,h}=canvas3d("solidView");if(!mesh3d)return;const c=mesh3d.settings,coords=mesh3d.coordinates,gain=answer?Math.max(0,Number(el("deformScale").value)||0):0;
  const points=coords.map((p,i)=>answer?p.map((v,j)=>v+gain*answer.nodal[["u_x","u_y","u_z"][j]][i]):p),cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
  const rotate=p=>{const x=cy*p[0]+sy*(p[2]-c.length/2),z=-sy*p[0]+cy*(p[2]-c.length/2);return[x,cp*p[1]-sp*z,sp*p[1]+cp*z];};
  const box=[];for(const x of[-c.r_outer,c.r_outer])for(const y of[-c.r_outer,c.r_outer])for(const z of[0,c.length])box.push(rotate([x,y,z]));
  const xmin=Math.min(...box.map(p=>p[0])),xmax=Math.max(...box.map(p=>p[0])),ymin=Math.min(...box.map(p=>p[1])),ymax=Math.max(...box.map(p=>p[1])),fit=Math.min((w-90)/Math.max(xmax-xmin,.1),(h-100)/Math.max(ymax-ymin,.1))*zoom;
  const screen=p=>{const r=rotate(p);return[w/2+fit*(r[0]-(xmin+xmax)/2),h/2-fit*(r[1]-(ymin+ymax)/2),r[2]];};
  const projected=points.map(screen),faces=[],nt=mesh3d.ntheta,nr=mesh3d.nr,nz=mesh3d.nz,field=field3d();
  for(let k=0;k<nz;k++)for(let ir=0;ir<nr;ir++)for(let j=0;j<nt;j++){
    const owner=(k*nr+ir)*nt+j,e=mesh3d.elements[owner].map(i=>i-1),sets=[];if(ir===0)sets.push([0,4,7,3]);if(ir===nr-1)sets.push([1,2,6,5]);if(k===0)sets.push([0,3,2,1]);if(k===nz-1)sets.push([4,5,6,7]);
    for(const face of sets){const ids=face.map(i=>e[i]);faces.push({ids,owner,depth:ids.reduce((a,i)=>a+projected[i][2],0)/4});}
  }
  faces.sort((a,b)=>a.depth-b.depth);
  for(const face of faces){const ps=face.ids.map(i=>projected[i]);ctx.beginPath();ps.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();const value=answer?(field.nodal?face.ids.reduce((s,i)=>s+field.values[i],0)/4:field.values[face.owner]):0;ctx.fillStyle=answer?contour(value,field.min,field.max):"#245169";ctx.fill();if(el("showWire").checked){ctx.strokeStyle="rgba(165,218,230,.23)";ctx.lineWidth=.55;ctx.stroke();}}
  ctx.font="12px Segoe UI";for(const pad of mesh3d.supports){const p=screen([0,-c.r_outer,pad.center_z]);ctx.beginPath();ctx.moveTo(p[0],p[1]+4);ctx.lineTo(p[0]-9,p[1]+21);ctx.lineTo(p[0]+9,p[1]+21);ctx.closePath();ctx.fillStyle="#e8b660";ctx.fill();ctx.fillText(`${pad.name} · ${fmt(pad.center_z)} m`,p[0]-32,p[1]+38);}
  for(const load of c.line_loads){if(!load.value)continue;const a=load.angle_deg*Math.PI/180,direction=load.value>=0?1:-1;for(let iz=1;iz<=7;iz++){const z=c.length*iz/8,r=c.r_outer+direction*.12;arrow2d(ctx,screen([r*Math.cos(a),r*Math.sin(a),z]),screen([c.r_outer*Math.cos(a),c.r_outer*Math.sin(a),z]),"#a7eee5");}}
  ctx.fillStyle="#a9b8cc";ctx.fillText("z = 0",18,h-16);ctx.fillText(`L = ${fmt(c.length)} m · D${fmt(c.r_outer*2000)}`,w-185,h-16);el("colorMin").textContent=answer?fmt(field.min,4):"Chưa giải";el("colorMax").textContent=answer?fmt(field.max,4):"";el("colorUnit").textContent=field.unit;
}
function drawSlice3d(){
  const{ctx,w,h}=canvas3d("sectionView");if(!mesh3d)return;const k=Math.min(mesh3d.nz-1,Number(el("sliceIndex").value)),c=mesh3d.settings,nt=mesh3d.ntheta,nr=mesh3d.nr,np=mesh3d.nplane,z=(mesh3d.z_planes[k]+mesh3d.z_planes[k+1])/2;
  el("slicePosition").textContent=`z = ${fmt(z)} m`;el("sliceLabel").textContent=`Lớp ${k+1} / ${mesh3d.nz}`;const gain=answer?Number(el("deformScale").value)||0:0,fit=Math.min(w,h)*.36/c.r_outer,screen=p=>[w/2+p[0]*fit,h/2-p[1]*fit];
  const displaced=i=>{const p=mesh3d.coordinates[i],j=i+np;return answer?[p[0]+gain*(answer.nodal.u_x[i]+answer.nodal.u_x[j])/2,p[1]+gain*(answer.nodal.u_y[i]+answer.nodal.u_y[j])/2]:p;};
  const field=field3d();ctx.strokeStyle="#52667a";ctx.setLineDash([4,4]);ctx.lineWidth=1;for(const radius of[c.r_inner,c.r_outer]){ctx.beginPath();ctx.ellipse(w/2,h/2,radius*fit,radius*fit,0,0,2*Math.PI);ctx.stroke();}ctx.setLineDash([]);
  for(let ir=0;ir<nr;ir++)for(let j=0;j<nt;j++){const owner=(k*nr+ir)*nt+j,e=mesh3d.elements[owner].slice(0,4).map(i=>i-1),ps=e.map(i=>screen(displaced(i))),value=answer?(field.nodal?e.reduce((s,i)=>s+(field.values[i]+field.values[i+np])/2,0)/4:field.values[owner]):0;ctx.beginPath();ps.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.fillStyle=answer?contour(value,field.min,field.max):"#245169";ctx.fill();ctx.strokeStyle="#8aa5b650";ctx.lineWidth=.65;ctx.stroke();}
  for(const load of c.line_loads){if(!load.value)continue;const a=load.angle_deg*Math.PI/180,r=c.r_outer,direction=load.value>=0?1:-1;arrow2d(ctx,screen([(r+direction*.09)*Math.cos(a),(r+direction*.09)*Math.sin(a)]),screen([r*Math.cos(a),r*Math.sin(a)]),"#a7eee5");}
  ctx.font="12px Segoe UI";ctx.fillStyle="#a9b8cc";ctx.fillText("+x",w/2+c.r_outer*fit+12,h/2+4);ctx.fillText("+y",w/2+6,h/2-c.r_outer*fit-12);if(mesh3d.supports.some(p=>Math.abs(z-p.center_z)<=p.width/2+1e-9)){ctx.fillStyle="#e8b660";ctx.fillText("Trong miền gối kê",16,h-16);}
}
function drawProfile3d(){
  const{ctx,w,h}=canvas3d("profileView");if(!mesh3d)return;const m={l:64,r:20,t:23,b:37},c=mesh3d.settings,key=el("profileField").value,points=answer?(key==="u_y"?answer.axis_displacements:answer.section_resultants):[],factor=key==="u_y"?1000:.001,values=points.map(p=>p[key]*factor);
  let min=Math.min(0,...values),max=Math.max(0,...values);if(max-min<1e-10){max+=1;min-=1;}const pad=(max-min)*.12;min-=pad;max+=pad;const sx=z=>m.l+z/c.length*(w-m.l-m.r),sy=v=>h-m.b-(v-min)/(max-min)*(h-m.t-m.b);
  for(const p of mesh3d.supports){ctx.fillStyle="#e8b66018";ctx.fillRect(sx(p.center_z-p.width/2),m.t,Math.max(2,p.width/c.length*(w-m.l-m.r)),h-m.t-m.b);}ctx.font="11px Segoe UI";ctx.lineWidth=.7;
  for(let i=0;i<=4;i++){const z=i*c.length/4,x=sx(z),v=min+(max-min)*i/4,y=sy(v);ctx.strokeStyle="#30425b";ctx.beginPath();ctx.moveTo(m.l,y);ctx.lineTo(w-m.r,y);ctx.stroke();ctx.fillStyle="#a9b8cc";ctx.fillText(fmt(v),4,y+4);ctx.fillText(fmt(z),x-8,h-16);}ctx.strokeStyle="#77899f";ctx.beginPath();ctx.moveTo(m.l,sy(0));ctx.lineTo(w-m.r,sy(0));ctx.stroke();
  if(points.length){ctx.strokeStyle="#73d8d0";ctx.lineWidth=2;ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(sx(p.z),sy(values[i])):ctx.moveTo(sx(p.z),sy(values[i])));ctx.stroke();}else{ctx.fillStyle="#a9b8cc";ctx.fillText("Giải mô hình để xem biểu đồ",m.l+20,h/2);}ctx.fillStyle="#a9b8cc";ctx.fillText(key==="u_y"?"mm":key.startsWith("M")||key==="T_z"?"kN·m":"kN",8,14);ctx.fillText("z (m)",w-46,h-2);
}
function scheduleDraw(){if(drawPending)return;drawPending=true;requestAnimationFrame(()=>{drawPending=false;draw3d();drawSlice3d();drawProfile3d();});}
function download3d(name,text,type){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement("a");a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function csv3d(header,rows){const escape=v=>'"'+String(v??"").replaceAll('"','""')+'"';return '\uFEFF'+[header,...rows].map(r=>r.map(escape).join(",")).join("\r\n");}
function canExport3d(){return answer&&!stale3d&&!busy3d;}
el("exportSolidJson").addEventListener("click",()=>{if(canExport3d())download3d("coc-3d-mo-hinh-ket-qua.json",JSON.stringify({input:solvedInput,result:answer},null,2),"application/json");});
el("exportSolidSections").addEventListener("click",()=>{if(!canExport3d())return;const keys=["z","u_x","u_y","u_z","N_z","V_x","V_y","M_x","M_y","T_z"];download3d("coc-3d-noi-luc-doc.csv",csv3d(["z_m","ux_m","uy_m","uz_m","N_N","Vx_N","Vy_N","Mx_Nm","My_Nm","Tz_Nm"],answer.section_resultants.map(p=>keys.map(k=>p[k]))),"text/csv;charset=utf-8");});
el("exportSolidNodes").addEventListener("click",()=>{if(!canExport3d())return;const keys=["u_x","u_y","u_z","reaction_x","reaction_y","reaction_z"];download3d("coc-3d-nut.csv",csv3d(["node_id","x_m","y_m","z_m","ux_m","uy_m","uz_m","Rx_N","Ry_N","Rz_N"],mesh3d.coordinates.map((p,i)=>[i+1,...p,...keys.map(k=>answer.nodal[k][i])])),"text/csv;charset=utf-8");});
el("exportSolidRing").addEventListener("click",()=>{if(!canExport3d())return;const k=Number(el("sliceIndex").value),keys=["theta_deg","N_theta","M_theta","Q_theta","N_z","M_z","N_theta_z"];download3d("coc-3d-noi-luc-vong.csv",csv3d(["z_m","theta_deg","Ntheta_N_per_m","Mtheta_Nm_per_m","Qtheta_N_per_m","Nz_N_per_m","Mz_Nm_per_m","Ntheta_z_N_per_m"],answer.ring_sections[k].map(p=>[answer.section_resultants[k].z,...keys.map(key=>p[key])])),"text/csv;charset=utf-8");});
el("solidForm").addEventListener("submit",e=>{e.preventDefault();request3d(true);});el("solidForm").addEventListener("input",changed3d);el("solidForm").addEventListener("change",changed3d);el("previewMesh").addEventListener("click",()=>request3d(false));el("addLoad").addEventListener("click",()=>{loadRow();changed3d();});
el("resetModel").addEventListener("click",()=>{for(const[id,value]of Object.entries(defaults3d))el(id).value=value;el("selfWeight").checked=el("sideStops").checked=false;el("lineLoads").replaceChildren();loadRow(60,20);loadRow(120,20);supportText();request3d(false);});
el("grade").addEventListener("change",()=>{if(catalog3d)el("young").value=catalog3d.grades[el("grade").value].Eb_GPa;changed3d();});
for(const id of["solidField","deformScale","showWire","sliceIndex","profileField"])el(id).addEventListener("input",scheduleDraw);
el("viewIso").addEventListener("click",()=>{yaw=1.13;pitch=.28;zoom=1;scheduleDraw();});el("viewSide").addEventListener("click",()=>{yaw=Math.PI/2;pitch=0;zoom=1;scheduleDraw();});el("viewEnd").addEventListener("click",()=>{yaw=0;pitch=0;zoom=1;scheduleDraw();});
el("solidView").addEventListener("pointerdown",e=>{drag=[e.clientX,e.clientY];el("solidView").setPointerCapture(e.pointerId);});el("solidView").addEventListener("pointermove",e=>{if(!drag)return;yaw+=(e.clientX-drag[0])*.008;pitch=Math.max(-1.4,Math.min(1.4,pitch+(e.clientY-drag[1])*.008));drag=[e.clientX,e.clientY];scheduleDraw();});el("solidView").addEventListener("pointerup",()=>{drag=null;});el("solidView").addEventListener("pointercancel",()=>{drag=null;});el("solidView").addEventListener("wheel",e=>{e.preventDefault();zoom=Math.max(.3,Math.min(7,zoom*Math.exp(-e.deltaY*.001)));scheduleDraw();},{passive:false});
el("importModel").addEventListener("click",()=>el("modelFile").click());el("modelFile").addEventListener("change",async e=>{try{const file=e.target.files[0];if(!file)return;const content=JSON.parse(await file.text()),p=content.input||content;if(!Number.isFinite(p.r_outer)||!Number.isFinite(p.length))throw new Error("JSON không phải mô hình cọc khối 3D.");const values={diameter:p.r_outer*2000,thickness:(p.r_outer-p.r_inner)*1000,length:p.length,young:p.E/1e9,poisson:p.nu,prestress:p.prestress/1e6,supportA:p.support_fractions?.[0]??.2,supportB:p.support_fractions?.[1]??.8,supportWidth:p.support_width??.3,supportArc:p.support_arc_deg??30,supportShape:p.support_shape??"flat",nr3d:p.nr??2,ntheta3d:p.ntheta??48,nz3d:p.nz??40,elementType:p.element_type??"H8_EAS",grade:p.grade??"B60"};for(const[id,value]of Object.entries(values))el(id).value=typeof value==="number"?Number(value.toPrecision(12)):value;el("sideStops").checked=p.side_stops===true;el("selfWeight").checked=p.self_weight===true;el("lineLoads").replaceChildren();for(const load of p.line_loads||[])loadRow(load.angle_deg,load.value/1000);changed3d();await request3d(false);}catch(error){message3d(error.message,"error");}finally{e.target.value="";}});
new ResizeObserver(scheduleDraw).observe(el("solidView"));loadRow(60,20);loadRow(120,20);supportText();
fetch("/api/pipe/tcvn-materials").then(r=>r.json()).then(c=>{catalog3d=c;el("grade").replaceChildren(...Object.keys(c.grades).map(name=>{const option=document.createElement("option");option.value=option.textContent=name;return option;}));el("grade").value="B60";}).catch(()=>{});request3d(false);
