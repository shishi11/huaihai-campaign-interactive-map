
/* APP_SCRIPT_PART2 */
(function(){
"use strict";
const H = window.HH;
const $ = s=>document.querySelector(s);
const $$ = s=>Array.prototype.slice.call(document.querySelectorAll(s));

const shell=$("#mapShell"), cv=$("#mapCv"), pop=$("#unitPop");
const slider=$("#timeSlider"), dateMain=$("#dateMain"), dateWeek=$("#dateWeek");
const evDate=$("#evDate"), evPhase=$("#evPhase"), evTitle=$("#evTitle"), evBody=$("#evBody");
const evQuote=$("#evQuote"), evQuoteText=$("#evQuoteText"), evQuoteSrc=$("#evQuoteSrc");
const evIndex=$("#evIndex"), evList=$("#evList"), playBtn=$("#playBtn"), playTxt=$("#playTxt");
const evCard=$("#evCard"), segBody=$("#segBody");
const evNext=$("#evNext"), evNextK=$("#evNextK"), evNextT=$("#evNextT");
const track=$("#unitTrack"), utK=$("#utK"), utC=$("#utC"), utT=$("#utT"), utD=$("#utD"), utPos=$("#utPos"), utPlay=$("#utPlay"), utX=$("#utX");
const chips=$$(".chip");
let playing=false, timer=null, rows=[], curEv=0, animRAF=null;

/* ---------- 1. 时间刻度 ---------- */
(function ticks(){
  const box=$("#ticks");
  const marks=[0,2,4,6,10,16,18,24,30,34,39,46,55,61,65];
  marks.forEach(d=>{
    const el=document.createElement("i");
    el.className="tick"+(d%5===0?" major":"");
    el.style.left=(d/65*100)+"%";
    box.appendChild(el);
  });
})();

/* ---------- 2. 事件索引 ---------- */
H.EVENTS.forEach((e,i)=>{
  const b=document.createElement("button");
  b.type="button"; b.className="ev-row"; b.dataset.i=i;
  const di=H.dateInfo(e.d);
  b.innerHTML='<span class="d">'+di.m+"."+H.pad2(di.dd)+'</span><span class="n"><b>'+e.t+'</b></span>';
  b.addEventListener("click",()=>{ stopPlay(); applyDay(e.d, i); });
  evList.appendChild(b); rows.push(b);
});

/* ---------- 3. 事件卡 ---------- */
/* 番号别名 → 军标 id（按出现于正文的写法登记，便于在句子里认人） */
const UALIAS = {
  p1:["山东兵团"],
  p2:["华野一纵","第一纵队","一纵","叶飞纵队"],
  p3:["华野四、八纵","华野八纵","华野四纵","第四纵队","第八纵队","八纵"],
  p4:["华野六纵","第六纵队"],
  p5:["华野九纵","第九纵队","九纵"],
  p7:["华野七纵、十纵、十一纵","七纵、十纵、十一纵","华野七纵、十纵","十纵","十一纵"],
  p8:["苏北兵团"],
  p9:["华野三纵、两广纵队","华野三纵","两广纵队","第三纵队","三纵"],
  p10:["中野一、二、三纵","中野一纵","中野二纵","中野三纵","中野主力"],
  p11:["中野四纵","陈赓"],
  p12:["中野六纵"],
  p13:["华野七纵、十三纵","华野七纵","七纵","十三纵"],
  k1:["第七兵团","黄百韬兵团","黄兵团","黄百韬"],
  k2:["第二兵团","邱清泉兵团","邱清泉"],
  k3:["第十三兵团","李弥兵团","李弥"],
  k4:["第十六兵团","孙元良兵团","孙元良"],
  k5:["第十二兵团","黄维兵团","黄维"],
  k6:["第六兵团","李延年兵团","李延年"],
  k7:["第八兵团","刘汝明兵团","刘汝明"],
  k8:["第三绥靖区","何基沣","张克侠"],
  k9:["第一绥靖区"]
};
/* 同一写法可能指华野或中野时，按整段正文里的「华野／中野」定人 */
const SIDE=[
  {w:"四纵", H:"p3", Z:"p11"},
  {w:"六纵", H:"p4", Z:"p12"}
];
const ALIAS=[];
Object.keys(UALIAS).forEach(id=>UALIAS[id].forEach(w=>ALIAS.push({id:id,w:w})));
ALIAS.sort((a,b)=>b.w.length-a.w.length);
const PLAZ=[], PLAZ_SEEN={};
H.CITIES.forEach(c=>{ const w=c.n.replace(/\s+/g,""); if(!PLAZ_SEEN[w]){ PLAZ_SEEN[w]=1; PLAZ.push({w:w,p:c.p}); } });
H.TOWNS.forEach(t=>{ const w=t.n.replace(/\s+/g,""); if(!PLAZ_SEEN[w]){ PLAZ_SEEN[w]=1; PLAZ.push({w:w,p:t.p}); } });
Object.keys(H.P).forEach(k=>{ if(!PLAZ_SEEN[k]){ PLAZ_SEEN[k]=1; PLAZ.push({w:k,p:H.P[k]}); } });
PLAZ.sort((a,b)=>b.w.length-a.w.length);
const esc=s=>s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
let curSents=[];

/* 把一句话拆成可点击段，并标出其中的番号与地名 */
function linkify(txt, ctx){
  const used=new Array(txt.length), marks=[];
  const match=(w,id)=>{
    let i=txt.indexOf(w);
    while(i>=0){
      let free=true;
      for(let k=i;k<i+w.length;k++) if(used[k]){ free=false; break; }
      if(free){
        marks.push({i:i,len:w.length,kind:"u",id:id});
        for(let k=i;k<i+w.length;k++) used[k]=true;
      }
      i=txt.indexOf(w,i+1);
    }
  };
  const matchPlace=(w,p)=>{
    let i=txt.indexOf(w);
    while(i>=0){
      let free=true;
      for(let k=i;k<i+w.length;k++) if(used[k]){ free=false; break; }
      if(free){
        marks.push({i:i,len:w.length,kind:"c",p:p});
        for(let k=i;k<i+w.length;k++) used[k]=true;
      }
      i=txt.indexOf(w,i+1);
    }
  };
  ALIAS.forEach(a=>match(a.w,a.id));
  SIDE.forEach(s=>match(s.w, ctx.z && !ctx.h ? s.Z : s.H));
  PLAZ.forEach(a=>matchPlace(a.w,a.p));
  marks.sort((a,b)=>a.i-b.i);
  let out="", last=0;
  const units=[], places=[];
  marks.forEach(m=>{
    out += esc(txt.slice(last,m.i));
    out += '<b class="ent '+m.kind+'">'+esc(txt.slice(m.i,m.i+m.len))+'</b>';
    last=m.i+m.len;
    if(m.kind==="u"){ if(units.indexOf(m.id)<0) units.push(m.id); }
    else places.push(m.p);
  });
  out += esc(txt.slice(last));
  return {html:out, units:units, places:places};
}
function buildBody(text){
  const blk=String(text).split(/\n/).filter(s=>s.trim().length);
  const ctx={h:text.indexOf("华野")>=0, z:text.indexOf("中野")>=0};
  curSents=[];
  let n=0;
  return blk.map(par=>{
    const parts = par.match(/[^。；]+[。；]?/g) || [par];
    const inner = parts.map(p=>{
      const r=linkify(p,ctx);
      curSents.push(r);
      const k=n++;
      return '<span class="sent" data-k="'+k+'">'+r.html+'</span>';
    }).join("");
    return '<p class="para">'+inner+'</p>';
  }).join("");
}


function renderEvent(i){
  const e=H.EVENTS[i]; if(!e) return;
  const di=H.dateInfo(e.d);
  evDate.textContent = H.pad2(di.m)+"."+H.pad2(di.dd);
  evPhase.textContent = e.d<=16 ? "第一阶段" : (e.d<=39 ? "第二阶段" : "第三阶段");
  evTitle.textContent = e.t;
  const isLong = H.opt.body==="long" && e.db;
  evBody.innerHTML = buildBody(isLong? e.db : e.b);
  evCard.classList.toggle("long", !!isLong);
  if(e.q){
    evQuote.hidden=false;
    evQuoteText.textContent = e.q.x;
    const s=H.SOURCES[e.q.s-1];
    evQuoteSrc.innerHTML = "—— "+(s? ('<a href="'+s.u+'" target="_blank" rel="noopener">'+s.t+'</a>') : "");
  }else{
    evQuote.hidden=true;
  }
  evIndex.textContent=(i+1)+" / "+H.EVENTS.length;
  curEv=i;
  const nxt=H.EVENTS[i+1];
  if(nxt){
    const nd=H.dateInfo(nxt.d);
    evNext.disabled=false;
    evNextK.textContent="下一事件 · "+H.pad2(nd.m)+"."+H.pad2(nd.dd);
    evNextT.textContent=nxt.t;
  }else{
    evNext.disabled=true;
    evNextK.textContent="已是最后一幕";
    evNextT.textContent="淮海战役胜利结束";
  }
  rows.forEach((r,k)=>r.classList.toggle("on",k===i));
  const on=rows[i];
  if(on && evList.scrollTop!==undefined){
    // 用视口坐标差推算行在列表内的位置，避免 offsetParent 不同导致偏移
    const box=evList.getBoundingClientRect();
    const t=on.getBoundingClientRect().top-box.top+evList.scrollTop;
    const h=evList.clientHeight, st=evList.scrollTop;
    if(t<st || t>st+h-40) evList.scrollTop=Math.max(0,t-h/2);
  }
}

/* ---------- 4. 状态应用 ---------- */
function applyDay(d, forceIdx){
  d=Math.round(Math.max(0,Math.min(65,d))*100)/100;
  slider.value=d;
  H.setDay(d);
  const di=H.dateInfo(d);
  dateMain.textContent = di.m+"月"+di.dd+"日";
  dateWeek.textContent = "第 "+di.idx+" 天 · "+di.w;
  let idx=0;
  if(typeof forceIdx==="number") idx=Math.max(0,Math.min(H.EVENTS.length-1,forceIdx));
  else for(let i=0;i<H.EVENTS.length;i++) if(H.EVENTS[i].d<=d) idx=i;
  renderEvent(idx);
  const phase = d<=16?0:(d<=39?1:2);
  chips.forEach((c,k)=>c.classList.toggle("on",k===phase));
  hidePop();
  if(H.solo) H.follow();
  renderTrack();
}

/* ---------- 5. 播放 ---------- */
function stopPlay(){
  playing=false; clearInterval(timer); timer=null;
  playBtn.dataset.on="0"; playTxt.textContent="播放";
}
function startPlay(){
  if(playing) return;
  playing=true; playBtn.dataset.on="1"; playTxt.textContent="暂停";
  const soloU = H.solo ? H.UNITS.find(u=>u.id===H.solo) : null;
  const lo = soloU? soloU.life[0] : 0, hi = soloU? soloU.life[1] : 65;
  if(H.day>=hi || H.day<lo) applyDay(lo);
  timer=setInterval(()=>{
    const d=H.day+0.22;
    if(d>=hi){ applyDay(hi); stopPlay(); return; }
    applyDay(d);
  },90);
}
playBtn.addEventListener("click",()=>{ playing? stopPlay() : startPlay(); renderTrack(); });

/* ---------- 5.5 事件推进：地图连续演变到下一事件 ---------- */
const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
function syncDateOnly(d){
  const di=H.dateInfo(d);
  if(slider) slider.value=d;
  dateMain.textContent=di.m+"月"+di.dd+"日";
  dateWeek.textContent="第 "+di.idx+" 天 · "+di.w;
  const ph=d<=16?0:(d<=39?1:2);
  chips.forEach((c,k)=>c.classList.toggle("on",k===ph));
}
function animTo(target, targetIdx){
  const to=Math.max(0,Math.min(65,Math.round(target*100)/100));
  stopPlay();
  if(animRAF){ cancelAnimationFrame(animRAF); animRAF=null; }
  const from=H.day;
  if(reduceMotion || Math.abs(to-from)<0.02){ applyDay(to, targetIdx); return; }
  const dur=Math.min(2000, Math.max(760, Math.abs(to-from)*78));
  const t0=performance.now();
  const vz=H.view.z, vx=H.view.x, vy=H.view.y;
  const fit = vz>1.02 || Math.abs(vx)>2 || Math.abs(vy)>2;   // 若此前放大过，先拉回全图
  hidePop(); hideTip();
  evNext.dataset.busy="1";
  (function step(now){
    const t=Math.min(1,(now-t0)/dur);
    const e=t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
    const d=from+(to-from)*e;
    H.setDay(d);                       // 军标按日插值移动、箭头随之生长
    if(fit) H.setView(vz+(1-vz)*e, vx*(1-e), vy*(1-e));
    syncDateOnly(d);
    if(t<1){ animRAF=requestAnimationFrame(step); }
    else{ animRAF=null; evNext.dataset.busy=""; applyDay(to, targetIdx); }
  })(t0);
}
evNext.addEventListener("click",()=>{
  if(animRAF) return;
  const nxt=H.EVENTS[curEv+1];
  if(!nxt) return;
  animTo(nxt.d, curEv+1);
});

slider.addEventListener("input",()=>{ stopPlay(); applyDay(parseFloat(slider.value)); });

chips.forEach(c=>c.addEventListener("click",()=>{ stopPlay(); applyDay(parseFloat(c.dataset.d)); }));

/* ---------- 6. 地图交互 ---------- */
const size=()=>H.size;
function zoomAt(x,y,f){
  const v=H.view, W=size().W, hh=size().H;
  const nz=Math.min(3.4,Math.max(.9,v.z*f));
  const bx=(x-v.x-W/2)/v.z+W/2;
  const by=(y-v.y-hh/2)/v.z+hh/2;
  H.setView(nz, x-(bx-W/2)*nz-W/2, y-(by-hh/2)*nz-hh/2);
}
$("#zin").addEventListener("click",()=>{ const W=size().W,h=size().H; zoomAt(W/2,h/2,1.3); });
$("#zout").addEventListener("click",()=>{ const W=size().W,h=size().H; zoomAt(W/2,h/2,0.77); });
$("#zfit").addEventListener("click",()=>{ H.setView(1,0,0); });

cv.addEventListener("wheel",e=>{
  e.preventDefault();
  const r=cv.getBoundingClientRect();
  zoomAt(e.clientX-r.left, e.clientY-r.top, e.deltaY<0?1.16:0.86);
},{passive:false});

const ptrs=new Map();
let dragInfo=null;
cv.addEventListener("pointerdown",e=>{
  if(e.button!==0 && e.pointerType==="mouse") return;
  try{ cv.setPointerCapture(e.pointerId); }catch(err){}
  ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  dragInfo={moved:0,last:{x:e.clientX,y:e.clientY},pinch:null};
  if(ptrs.size===2){
    const a=[...ptrs.values()];
    dragInfo.pinch={d:Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y), cx:(a[0].x+a[1].x)/2, cy:(a[0].y+a[1].y)/2, z:H.view.z};
  }
});
cv.addEventListener("pointermove",e=>{
  if(!ptrs.has(e.pointerId)||!dragInfo) return;
  ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  const r=cv.getBoundingClientRect();
  if(ptrs.size===1){
    const dx=e.clientX-dragInfo.last.x, dy=e.clientY-dragInfo.last.y;
    dragInfo.moved+=Math.abs(dx)+Math.abs(dy);
    dragInfo.last={x:e.clientX,y:e.clientY};
    H.setView(H.view.z, H.view.x+dx, H.view.y+dy);
  }else if(ptrs.size===2 && dragInfo.pinch){
    const a=[...ptrs.values()];
    const nd=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);
    const f=nd/dragInfo.pinch.d;
    dragInfo.moved+=Math.abs(nd-dragInfo.pinch.d);
    zoomAt(dragInfo.pinch.cx-r.left, dragInfo.pinch.cy-r.top, f);
    dragInfo.pinch.d=nd;
  }
});
function endPtr(e){
  if(!ptrs.has(e.pointerId)) return;
  const wasSingle = ptrs.size===1;
  ptrs.delete(e.pointerId);
  if(ptrs.size===0){
    if(wasSingle && dragInfo && dragInfo.moved<8){ pickUnit(e.clientX, e.clientY); }
    dragInfo=null;
  }else{
    dragInfo={moved:99,last:{x:e.clientX,y:e.clientY},pinch:null};
  }
}
cv.addEventListener("pointerup",endPtr);
cv.addEventListener("pointercancel",endPtr);

/* ---------- 7. 军标弹出 ---------- */
function hidePop(){ pop.classList.remove("on"); }
function pickUnit(cx,cy){
  const r=cv.getBoundingClientRect();
  const x=cx-r.left, y=cy-r.top;
  let best=null, geoBest=null;
  H.hits.forEach(h=>{
    const inBox = x>=h.x-3 && x<=h.x+h.w+3 && y>=h.y-3 && y<=h.y+h.h+3;
    if(!inBox) return;
    if(h.geo) geoBest=h;                   // 线名／河名热区优先，未落到军标箱内时先响应
    if(!h.sub && !h.geo) best=h;            // 兵团军标优先，分队不抢点击
    else if(!best && !h.geo) best=h;
  });
  if(geoBest){ hidePop(); flashGeo(geoBest.geo); return; }   // 河名／线名画在军标之上，点它就该闪河
  if(!best){ hidePop(); return; }
  const sub = H.SUBS.find(s=>s.id===best.id);
  const u = sub || H.UNITS.find(v=>v.id===best.id);
  if(!u) return;
  const sideOk = sub ? sub.par[0]==="p" : u.s==="p";
  const title = sub ? (sub.t+" · "+sub.n) : u.n;
  let extra="";
  if(H.day>u.life[1]){
    const di=H.dateInfo(u.life[1]);
    extra='<div class="row">该部已于 '+di.m+"月"+di.dd+"日"+(u.etype||"被歼")+"，图上不再标注。</div>";
  }
  const par = sub ? H.UNITS.find(v=>v.id===sub.par) : null;
  pop.innerHTML='<button class="x" aria-label="关闭">×</button>'
    +'<h4>'+title+'</h4>'
    +'<div class="side" style="color:'+(sideOk?"var(--red)":"var(--blue)")+'">'
      +(sideOk?"人民解放军":"国民党军")+(par?' · 隶属'+par.n:'')+'</div>'
    +'<div class="row"><b>番号</b> '+u.full+'<br><b>主官</b> '+u.cmd+(u.str?'<br><b>兵力</b> '+u.str:'')+'</div>'
    +'<div class="row">'+u.note+'</div>'+extra
    +(!sub?'<button type="button" class="trk">以该兵团视角看战役 →</button>':'');
  pop.classList.add("on");
  const W=size().W, hh=size().H;
  let left = Math.min(W-256, Math.max(8, best.x+best.w+12));
  let top  = Math.min(hh-170, Math.max(8, best.y-6));
  pop.style.left=left+"px"; pop.style.top=top+"px";
  pop.querySelector(".x").addEventListener("click",hidePop);
  const tb=pop.querySelector(".trk");
  if(tb) tb.addEventListener("click",()=>{ startTrack(u.id); });
}

/* ---------- 7.5 图面选项 · 悬停提示 · 正文联动 ---------- */
const hoverTip=document.getElementById("hoverTip");
function hideTip(){ hoverTip.classList.remove("on"); }

function segBind(id, cb){
  const box=document.getElementById(id); if(!box) return;
  box.addEventListener("click", e=>{
    const b=e.target.closest("button"); if(!b) return;
    Array.prototype.forEach.call(box.querySelectorAll("button"), x=>x.classList.toggle("on", x===b));
    hideTip();
    cb(b.dataset.v);
  });
}
segBind("segBase", v=>H.setBase(v));
segBind("segSym", v=>H.setSym(v));
segBind("segBody", v=>{ H.setBody(v); renderEvent(curEv<0?0:curEv); });

cv.addEventListener("pointermove", e=>{
  if(H.opt.sym!=="sym"){ hideTip(); return; }
  if(dragInfo && dragInfo.moved>4){ hideTip(); return; }
  const r=cv.getBoundingClientRect(), x=e.clientX-r.left, y=e.clientY-r.top;
  let hitBest=null;
  H.hits.forEach(h=>{ if(x>=h.x-2&&x<=h.x+h.w+2&&y>=h.y-2&&y<=h.y+h.h+2) hitBest=h; });
  if(!hitBest){ hideTip(); return; }
  const u=H.UNITS.find(v=>v.id===hitBest.id) || H.SUBS.find(v=>v.id===hitBest.id);
  if(!u){ hideTip(); return; }
  hoverTip.textContent=u.n+" · "+u.cmd;
  const tw=hoverTip.offsetWidth||150;
  hoverTip.style.left=Math.min(size().W-tw-10, Math.max(6, hitBest.x+hitBest.w+9))+"px";
  hoverTip.style.top=(hitBest.y+hitBest.h/2)+"px";
  hoverTip.classList.add("on");
});
cv.addEventListener("pointerleave", hideTip);

/* 句子里提到的河名／线名（含俗称），返回可用于 flashGeo 的名字 */
const GEO_WORDS = (H.LINELBL||[]).map(o=>o.t).concat(["津浦路","陇海路","运河","京杭大运河"]);
function geoNameIn(txt){
  const t=String(txt).replace(/\s+/g,"");
  for(let i=0;i<GEO_WORDS.length;i++) if(t.indexOf(GEO_WORDS[i])>=0) return GEO_WORDS[i];
  return null;
}
evBody.addEventListener("click", e=>{  const s=e.target.closest(".sent"); if(!s) return;
  const info=curSents[+s.dataset.k]; if(!info) return;
  const units=[];
  info.units.forEach(id=>{
    const u=H.UNITS.find(v=>v.id===id); if(!u) return;
    if(H.day>=u.life[0] && H.day<=u.life[1]) units.push({id:id, s:u.s, p:H.pathPos(u,H.day)});
  });
  const pts=units.map(o=>o.p).concat(info.places);
  // 句子里出现河名／线名（浍河、津浦线、徐永公路…）时，让图上那条线自己也闪一下
  const gname = geoNameIn(s.textContent);
  if(gname) H.flashGeo(gname);
  if(!pts.length){ if(!gname) return; }
  Array.prototype.forEach.call(evBody.querySelectorAll(".sent"), x=>x.classList.remove("act"));
  s.classList.add("act");
  hideTip();
  H.flashAt(units, info.places);
  H.focus(pts);
});

/* ---------- 7.6 兵团视角追踪 ---------- */
function cmdFor(id, day){
  const arr=(H.COMMANDS||{})[id]||[];
  let cur=null, n=0;
  arr.forEach((c,i)=>{ if(c.d<=day+0.001){ cur=c; n=i+1; } });
  return {cur:cur, n:n, total:arr.length};
}
function renderTrack(){
  const id=H.solo;
  if(!id){ track.hidden=true; return; }
  const u=H.UNITS.find(v=>v.id===id);
  if(!u){ track.hidden=true; return; }
  track.hidden=false;
  utK.textContent=u.n;
  utC.textContent=u.cmd;
  const c=cmdFor(id,H.day);
  const d0=H.dateInfo(u.life[0]), d1=H.dateInfo(u.life[1]);
  if(c.cur){
    const di=H.dateInfo(c.cur.d);
    utD.textContent=di.m+"."+H.pad2(di.dd)+(c.cur.s?" 令":"");
    utT.textContent=c.cur.t;
    utT.title = c.cur.s ? ("见资料来源 "+c.cur.s) : "";
  }else{
    utD.textContent="暂无";
    utT.textContent="本阶段未查到明确电令记录。";
    utT.title="";
  }
  utPos.textContent="命令 "+c.n+"/"+c.total+" · 图上存续 "+d0.m+"."+H.pad2(d0.dd)+"—"+d1.m+"."+H.pad2(d1.dd);
  utPlay.textContent = playing ? "暂停跟随" : "跟随播放";
}
function startTrack(id){
  const u=H.UNITS.find(v=>v.id===id); if(!u) return;
  stopPlay(); hidePop(); hideTip();
  H.setSolo(id);
  applyDay(Math.max(u.life[0], Math.min(u.life[1], H.day)));
  renderTrack();
}
utX.addEventListener("click",()=>{ stopPlay(); H.setSolo(null); renderTrack(); });
utPlay.addEventListener("click",()=>{
  if(playing){ stopPlay(); renderTrack(); return; }
  startPlay(); renderTrack();
});
H.track = startTrack;   // 供外部调用（页面内按钮亦走此入口）

/* ---------- 8. 资料来源列表 ---------- */
(function src(){
  const ol=$("#srcList");
  H.SOURCES.forEach(s=>{
    const li=document.createElement("li");
    li.innerHTML='<span>'+s.t+' — <a href="'+s.u+'" target="_blank" rel="noopener">'+s.u.replace(/^https?:\/\//,"")+'</a></span>';
    ol.appendChild(li);
  });
})();

/* ---------- 9. 史料折叠 ---------- */
$$(".doc-btn").forEach(b=>{
  b.addEventListener("click",()=>{
    const d=b.parentElement;
    const open=d.classList.contains("open");
    $$(".doc").forEach(x=>x.classList.remove("open"));
    if(!open) d.classList.add("open");
  });
});
$$(".doc").forEach((d,i)=>{
  d.querySelector(".doc-btn").setAttribute("aria-expanded","false");
});

/* ---------- 10. 图表 ---------- */
function charts(){
  if(!window.echarts) return;
  const base={
    textStyle:{fontFamily:H.FONT_SANS,color:"#4b4437"},
    animationDuration:520,
    grid:{left:4,right:16,top:26,bottom:26,containLabel:true}
  };
  const axis={
    axisLine:{lineStyle:{color:"#b3a687"}},
    axisTick:{show:false},
    axisLabel:{color:"#4b4437",fontSize:11,fontFamily:H.FONT_SANS}
  };
  const el1=document.getElementById("chartPhase");
  const c1=echarts.init(el1,null,{renderer:"canvas"});
  c1.setOption(Object.assign({},base,{
    tooltip:{trigger:"axis",backgroundColor:"#f2ecdd",borderColor:"#b3a687",borderWidth:1,
      textStyle:{color:"#201d18",fontSize:12,fontFamily:H.FONT_SANS},
      formatter:p=>p[0].name.replace(/\n/g," ")+"："+p[0].value+" 万人"},
    xAxis:Object.assign({type:"category",
      data:["第一阶段\n11.6—11.22","第二阶段\n11.23—12.15","第三阶段\n12.16—1.10"]},axis),
    yAxis:Object.assign({type:"value",max:30,splitNumber:3,
      splitLine:{lineStyle:{color:"#dfd7bf",type:"dashed"}},
      axisLabel:{color:"#7a7160",fontSize:10,fontFamily:H.FONT_NUM}}),
    series:[{
      type:"bar",data:[17.8,12,26.2],barWidth:"46%",
      itemStyle:{color:"#9c2f24"},
      label:{show:true,position:"top",color:"#7c241c",fontSize:12,fontFamily:H.FONT_NUM,formatter:p=>p.value},
      emphasis:{itemStyle:{color:"#7c241c"}}
    }]
  }));
  const el2=document.getElementById("chartThree");
  const c2=echarts.init(el2,null,{renderer:"canvas"});
  c2.setOption(Object.assign({},base,{
    grid:{left:4,right:8,top:34,bottom:24,containLabel:true},
    legend:{top:0,right:0,itemWidth:10,itemHeight:8,textStyle:{color:"#4b4437",fontSize:10.5,fontFamily:H.FONT_SANS}},
    tooltip:{trigger:"axis",backgroundColor:"#f2ecdd",borderColor:"#b3a687",borderWidth:1,
      textStyle:{color:"#201d18",fontSize:12,fontFamily:H.FONT_SANS}},
    xAxis:Object.assign({type:"category",data:["辽沈","淮海","平津"]},axis),
    yAxis:Object.assign({type:"value",max:60,splitNumber:3,
      splitLine:{lineStyle:{color:"#dfd7bf",type:"dashed"}},
      axisLabel:{color:"#7a7160",fontSize:10,fontFamily:H.FONT_NUM}}),
    series:[
      {name:"歼敌",type:"bar",data:[47.2,55.5,52.1],barWidth:"26%",itemStyle:{color:"#9c2f24"},
       label:{show:true,position:"top",color:"#7c241c",fontSize:11,fontFamily:H.FONT_NUM}},
      {name:"我军伤亡",type:"bar",data:[6.9,13.4,3.9],barWidth:"26%",itemStyle:{color:"#8a6b34"},
       label:{show:true,position:"top",color:"#6d5327",fontSize:10,fontFamily:H.FONT_NUM}}
    ]
  }));
  window.addEventListener("resize",()=>{ c1.resize(); c2.resize(); });
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(()=>{ c1.resize(); c2.resize(); });
}

/* ---------- 11. 目录高亮 ---------- */
(function nav(){
  const links=$$(".rail a");
  const secs=links.map(a=>document.querySelector(a.getAttribute("href"))).filter(Boolean);
  const io=new IntersectionObserver(es=>{
    es.forEach(en=>{
      if(en.isIntersecting){
        const i=secs.indexOf(en.target);
        links.forEach((a,k)=>a.classList.toggle("on",k===i));
      }
    });
  },{rootMargin:"-45% 0px -50% 0px"});
  secs.forEach(s=>io.observe(s));
})();

/* ---------- 12. 启动 ---------- */
function boot(){
  H.resize();
  // 窄屏默认「军标符号」：小屏字压字，符号更干净，点按看番号
  const cw=document.getElementById("mapCv").clientWidth;
  if(cw && cw<560){
    H.setSym("sym");
    const box=document.getElementById("segSym");
    if(box) Array.prototype.forEach.call(box.querySelectorAll("button"), x=>x.classList.toggle("on", x.dataset.v==="sym"));
  }
  H.setDay(0);
  applyDay(0);
  charts();
  const hint=document.getElementById("mapHint");
  if(window.matchMedia("(hover:none)").matches) hint.textContent="双指缩放 · 单指拖动";
  if(window.ResizeObserver){
    new ResizeObserver(()=>H.resize()).observe(shell);
  }else{
    window.addEventListener("resize",()=>H.resize());
  }
}
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",boot);
else boot();
window.addEventListener("load",()=>H.resize());
})();
