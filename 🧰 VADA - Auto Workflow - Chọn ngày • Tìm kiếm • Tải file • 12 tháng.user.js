// ==UserScript==
// @name         🧰 VADA | Auto Workflow | Chọn ngày → Tìm kiếm → Tải file | 12 tháng
// @namespace    vada.chrome.workflow
// @version      2.2.1
// @description  Chọn nhanh ngày, ghi nhớ nút tìm/tải, chạy tự động theo tháng, hot-load bản mới không cần F5
// @match        https://hoadondientu.gdt.gov.vn/*
// @grant        none
// @run-at       document-idle
// @icon         https://raw.githubusercontent.com/datphuho88-dev/tampermonkey-scripts/main/vada-auto-workflow-icon.svg
// @updateURL    https://raw.githubusercontent.com/datphuho88-dev/tampermonkey-scripts/main/%F0%9F%A7%B0%20VADA%20-%20Auto%20Workflow%20-%20Ch%E1%BB%8Dn%20ng%C3%A0y%20%E2%80%A2%20T%C3%ACm%20ki%E1%BA%BFm%20%E2%80%A2%20T%E1%BA%A3i%20file%20%E2%80%A2%2012%20th%C3%A1ng.user.js
// @downloadURL  https://raw.githubusercontent.com/datphuho88-dev/tampermonkey-scripts/main/%F0%9F%A7%B0%20VADA%20-%20Auto%20Workflow%20-%20Ch%E1%BB%8Dn%20ng%C3%A0y%20%E2%80%A2%20T%C3%ACm%20ki%E1%BA%BFm%20%E2%80%A2%20T%E1%BA%A3i%20file%20%E2%80%A2%2012%20th%C3%A1ng.user.js
// ==/UserScript==

(function () {
  'use strict';

  const SCRIPT_VERSION = '2.2.1';
  const RAW_URL = 'https://raw.githubusercontent.com/datphuho88-dev/tampermonkey-scripts/main/%F0%9F%A7%B0%20VADA%20-%20Auto%20Workflow%20-%20Ch%E1%BB%8Dn%20ng%C3%A0y%20%E2%80%A2%20T%C3%ACm%20ki%E1%BA%BFm%20%E2%80%A2%20T%E1%BA%A3i%20file%20%E2%80%A2%2012%20th%C3%A1ng.user.js';
  const INSTANCE_KEY = '__VADA_AUTO_WORKFLOW_INSTANCE__';
  const PANEL_ID='vada-auto-panel', LAUNCHER_ID='vada-auto-launcher';
  const PAGE_KEY='VADA_AUTO_WORKFLOW:'+location.hostname+location.pathname;
  const POS_KEY=PAGE_KEY+':PANEL_POSITION';
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  let running=false, stopRequested=false, initTimer=null, captureCleanup=null;

  try { window[INSTANCE_KEY]?.destroy?.(); } catch {}

  const pad=n=>String(n).padStart(2,'0');
  const isoDate=(y,m,d)=>`${y}-${pad(m)}-${pad(d)}`;
  const lastDay=(m,y)=>new Date(y,m,0).getDate();
  const dmyFromISO=v=>{if(!v)return'';const[y,m,d]=v.split('-');return`${d}/${m}/${y}`};
  const visible=el=>{if(!el)return false;const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'&&+s.opacity!==0};
  const text=el=>(el?.innerText||el?.textContent||'').trim();
  const cssEscape=v=>window.CSS?.escape?CSS.escape(v):String(v).replace(/([^\w-])/g,'\\$1');

  function defaults(){const n=new Date(),y=n.getFullYear(),m=n.getMonth()+1;return{targets:{date1:null,date2:null,search:null,download:null},delays:{afterDates:0,afterSearch:2000,afterDownload:1200},single:{date1:isoDate(y,m,1),date2:isoDate(y,m,lastDay(m,y))},batchYear:y,hidden:false}}
  function load(){const d=defaults();try{const x=JSON.parse(localStorage.getItem(PAGE_KEY)||'null');if(!x)return d;return{...d,...x,targets:{...d.targets,...(x.targets||{})},delays:{...d.delays,...(x.delays||{})},single:{...d.single,...(x.single||{})}}}catch{return d}}
  let state=load();
  const save=()=>localStorage.setItem(PAGE_KEY,JSON.stringify(state));

  function status(msg,type='info'){const el=document.querySelector('#vada-status');if(!el)return;el.textContent=msg;el.style.color=({info:'#444',success:'#15803d',warning:'#d97706',error:'#dc2626'})[type]||'#444'}

  async function hotReload(){
    if(running){status('⏳ Hãy dừng tiến trình trước khi LOAD bản mới','warning');return}
    status('🔄 Đang tải code mới nhất từ GitHub...','info');
    try{
      const res=await fetch(RAW_URL+(RAW_URL.includes('?')?'&':'?')+'_='+Date.now(),{cache:'no-store',credentials:'omit'});
      if(!res.ok)throw new Error(`HTTP ${res.status}`);
      const source=await res.text();
      const m=source.match(/\/\/\s*@version\s+([^\s]+)/);
      const remoteVersion=m?.[1]||'?';
      const runtime=source.replace(/\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==\s*/,'');
      if(!runtime.trim())throw new Error('Không đọc được phần code chạy');
      status(`⚡ Đang chạy bản ${remoteVersion}...`,'success');
      setTimeout(()=>{
        try{new Function(runtime)()}catch(err){console.error(err);alert('VADA LOAD lỗi: '+err.message)}
      },50);
    }catch(e){console.error(e);status('❌ LOAD thất bại: '+e.message,'error')}
  }

  function unique(sel){try{return document.querySelectorAll(sel).length===1}catch{return false}}
  function selectorFor(el){
    if(el.id){const s='#'+cssEscape(el.id);if(unique(s))return s}
    const tag=el.tagName.toLowerCase();
    for(const a of ['data-testid','data-id','name','placeholder','aria-label','title']){const v=el.getAttribute(a);if(!v)continue;const s=`${tag}[${a}="${cssEscape(v)}"]`;if(unique(s))return s}
    const cls=[...el.classList].filter(c=>c.length<50&&!/\d{6,}/.test(c)).slice(0,3);
    if(cls.length){const s=tag+cls.map(c=>'.'+cssEscape(c)).join('');if(unique(s))return s}
    const path=[];let cur=el;
    while(cur&&cur!==document.body&&path.length<7){let p=cur.tagName.toLowerCase();if(cur.id){p+='#'+cssEscape(cur.id);path.unshift(p);break}const par=cur.parentElement;if(par){const same=[...par.children].filter(x=>x.tagName===cur.tagName);if(same.length>1)p+=`:nth-of-type(${same.indexOf(cur)+1})`}path.unshift(p);cur=par}
    return path.join(' > ')
  }

  function normalize(el,role){
    if(!el)return null;
    if(role==='date1'||role==='date2'){
      if(el.tagName==='INPUT')return el;
      const w=el.closest('.ant-calendar-picker');if(w?.querySelector('input'))return w.querySelector('input');
      const near=el.closest('label,div,span')?.querySelector('input');if(near)return near;
    }
    return el.closest('button,a,input,[role="button"],.ant-btn')||el;
  }
  function locator(el,role){el=normalize(el,role);if(!el)return null;return{selector:selectorFor(el),tag:el.tagName.toLowerCase(),text:text(el),placeholder:el.getAttribute('placeholder')||''}}
  function resolve(loc){
    if(!loc)return null;
    if(loc.selector){try{const a=[...document.querySelectorAll(loc.selector)];const v=a.find(visible);if(v)return v;if(a[0])return a[0]}catch{}}
    if(loc.placeholder){const x=[...document.querySelectorAll('input')].find(e=>visible(e)&&e.getAttribute('placeholder')===loc.placeholder);if(x)return x}
    if(loc.text){const x=[...document.querySelectorAll(loc.tag||'button,a,div,span')].find(e=>visible(e)&&text(e)===loc.text);if(x)return x}
    return null;
  }
  const roleNames={date1:'Ngày 1',date2:'Ngày 2',search:'Tìm kiếm',download:'Tải về'};
  const resolveRole=r=>resolve(state.targets[r]);

  function capture(role){
    captureCleanup?.();
    status(`🎯 Bấm vào "${roleNames[role]}" trên trang`,'warning');
    document.body.style.cursor='crosshair';let last=null;
    const move=e=>{if(e.target.closest('#'+PANEL_ID)||e.target.closest('#'+LAUNCHER_ID))return;if(last)last.style.outline=last.dataset.vadaOldOutline||'';const t=normalize(e.target,role);if(!t)return;t.dataset.vadaOldOutline=t.style.outline||'';t.style.outline='3px solid red';last=t};
    const click=e=>{if(e.target.closest('#'+PANEL_ID)||e.target.closest('#'+LAUNCHER_ID))return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();const t=normalize(e.target,role);if(!t)return;state.targets[role]=locator(t,role);save();cleanup();status(`✅ Đã lưu ${roleNames[role]}`,'success');refreshTargets()};
    const key=e=>{if(e.key==='Escape'){cleanup();status('Đã hủy chọn')}};
    function cleanup(){document.body.style.cursor='';document.removeEventListener('mousemove',move,true);document.removeEventListener('click',click,true);document.removeEventListener('keydown',key,true);if(last)last.style.outline=last.dataset.vadaOldOutline||'';captureCleanup=null}
    captureCleanup=cleanup;
    document.addEventListener('mousemove',move,true);document.addEventListener('click',click,true);document.addEventListener('keydown',key,true);
  }

  function nativeSet(input,value){const d=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value');d?.set?d.set.call(input,value):input.value=value}
  function inputEvents(input,value){input.dispatchEvent(new InputEvent('input',{bubbles:true,composed:true,inputType:'insertText',data:value}));input.dispatchEvent(new Event('change',{bubbles:true,composed:true}))}
  function enter(input){for(const t of ['keydown','keypress','keyup'])input.dispatchEvent(new KeyboardEvent(t,{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true}))}
  function antPopupInput(){for(const c of [...document.querySelectorAll('.ant-calendar')].filter(visible)){const i=c.querySelector('input.ant-calendar-input');if(i&&visible(i))return i}return null}
  async function setAntDate(main,dmy){main.focus();main.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));main.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));main.click();await sleep(250);let p=null;for(let i=0;i<15&&!p;i++){p=antPopupInput();if(!p)await sleep(100)}if(!p)return false;p.focus();nativeSet(p,'');inputEvents(p,'');await sleep(30);nativeSet(p,dmy);inputEvents(p,dmy);await sleep(60);enter(p);await sleep(300);return main.value===dmy}
  async function setDateRole(role,iso){
    let t=resolveRole(role);if(!t)throw new Error(`Không tìm thấy ${roleNames[role]}`);if(t.tagName!=='INPUT'){const i=t.querySelector('input');if(i)t=i}if(t.tagName!=='INPUT')throw new Error(`${roleNames[role]} không phải ô nhập ngày`);
    const dmy=dmyFromISO(iso),ant=t.closest('.ant-calendar-picker')||t.classList.contains('ant-calendar-input');if(ant&&await setAntDate(t,dmy))return true;
    if(t.type==='date'){nativeSet(t,iso);inputEvents(t,iso);t.blur();return true}
    t.focus();nativeSet(t,'');inputEvents(t,'');await sleep(20);nativeSet(t,dmy);inputEvents(t,dmy);enter(t);t.blur();await sleep(100);return true;
  }

  async function clickEl(el){if(!el)return false;try{el.scrollIntoView({block:'center',behavior:'instant'})}catch{}el.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));el.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));el.click();return true}
  function clickable(el){return !!el&&visible(el)&&!el.disabled&&el.getAttribute('aria-disabled')!=='true'}
  async function waitRole(role,timeout=12000){const s=Date.now();while(Date.now()-s<timeout){const e=resolveRole(role);if(clickable(e))return e;await sleep(200)}return null}
  function validate(){const m=['date1','date2','search','download'].filter(r=>!state.targets[r]).map(r=>roleNames[r]);if(m.length){status('❌ Chưa chọn: '+m.join(', '),'error');return false}return true}

  async function runOne(from,to,label=''){
    if(stopRequested)return false;status(`${label} - đang điền ngày 1...`);await setDateRole('date1',from);if(stopRequested)return false;
    status(`${label} - đang điền ngày 2...`);await setDateRole('date2',to);if(state.delays.afterDates)await sleep(state.delays.afterDates);if(stopRequested)return false;
    const s=await waitRole('search',5000);if(!s)throw new Error('Không tìm thấy nút Tìm kiếm');status(`${label} - đang bấm Tìm kiếm...`);await clickEl(s);await sleep(state.delays.afterSearch);if(stopRequested)return false;
    const d=await waitRole('download',15000);if(!d)throw new Error('Không tìm thấy nút Tải về');status(`${label} - đang Tải về...`);await clickEl(d);if(state.delays.afterDownload)await sleep(state.delays.afterDownload);return true;
  }
  async function runSingle(){if(running||!validate())return;const f=state.single?.date1,t=state.single?.date2;if(!f||!t){status('❌ Chưa chọn khoảng ngày','error');return}running=true;stopRequested=false;refreshRun();try{await runOne(f,t,'Chạy 1 lần');if(!stopRequested)status('✅ Hoàn tất','success')}catch(e){console.error(e);status('❌ '+e.message,'error')}finally{running=false;refreshRun()}}
  async function runAll(){if(running||!validate())return;const y=+document.querySelector('#vada-batch-year')?.value;if(!y||y<2000||y>2100){status('❌ Năm không hợp lệ','error');return}state.batchYear=y;save();running=true;stopRequested=false;refreshRun();try{for(let m=1;m<=12&&!stopRequested;m++){const f=isoDate(y,m,1),t=isoDate(y,m,lastDay(m,y));status(`Tháng ${m}/12 - ${dmyFromISO(f)} → ${dmyFromISO(t)}`);await runOne(f,t,`Tháng ${m}/12`)}status(stopRequested?'⏹ Đã dừng':`✅ Đã chạy đủ 12 tháng năm ${y}`,stopRequested?'warning':'success')}catch(e){console.error(e);status('❌ '+e.message,'error')}finally{running=false;refreshRun()}}
  function stop(){if(!running){status('Không có tiến trình đang chạy');return}stopRequested=true;status('⏹ Đang dừng...','warning')}

  function testTargets(){const colors={date1:'#ef4444',date2:'#2563eb',search:'#f59e0b',download:'#16a34a'};let n=0;for(const r in colors){const e=resolveRole(r);if(e){n++;e.style.outline=`4px solid ${colors[r]}`;setTimeout(()=>e.style.outline='',3000)}}status(`Tìm thấy ${n}/4 thành phần`,n===4?'success':'warning')}
  function clearTargets(){if(running)return;state.targets={date1:null,date2:null,search:null,download:null};save();refreshTargets();status('Đã xóa 4 thành phần đã lưu')}

  function button(label,fn,color='#2563eb'){const b=document.createElement('button');b.type='button';b.textContent=label;b.style.cssText=`border:0;border-radius:7px;padding:8px 10px;margin:3px;cursor:pointer;background:${color};color:#fff;font-size:12px;font-weight:600;white-space:nowrap`;b.addEventListener('click',async e=>{e.preventDefault();e.stopPropagation();await fn()});return b}
  function refreshTargets(){for(const r of ['date1','date2','search','download']){const b=document.querySelector('#vada-target-'+r);if(!b)continue;const ok=!!state.targets[r];b.textContent=(ok?'✅ ':'🎯 ')+roleNames[r];b.style.background=ok?'#15803d':'#2563eb'}}
  function refreshRun(){for(const [id,en] of [['#vada-run-single',!running],['#vada-run-all',!running],['#vada-stop',running]]){const b=document.querySelector(id);if(b){b.disabled=!en;b.style.opacity=en?'1':'.45'}}}
  function delaySelect(value,vals){const s=document.createElement('select');s.style.cssText='padding:5px;border:1px solid #bbb;border-radius:5px;min-width:75px';for(const ms of vals){const o=document.createElement('option');o.value=ms;o.textContent=ms===0?'0 giây':ms/1000+' giây';o.selected=+value===ms;s.appendChild(o)}return s}

  function showLauncher(){if(document.querySelector('#'+LAUNCHER_ID))return;const b=document.createElement('button');b.id=LAUNCHER_ID;b.textContent=`VADA v${SCRIPT_VERSION}`;b.style.cssText='position:fixed;right:15px;bottom:15px;z-index:2147483647;border:0;border-radius:9px;padding:10px 14px;background:#a0520e;color:#fff;font-size:13px;font-weight:bold;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.3)';b.onclick=()=>{b.remove();const p=document.querySelector('#'+PANEL_ID);p?p.style.display='block':createPanel();state.hidden=false;save()};document.body.appendChild(b)}
  function hidePanel(){const p=document.querySelector('#'+PANEL_ID);if(p)p.style.display='none';state.hidden=true;save();showLauncher()}
  function restorePos(p){try{const x=JSON.parse(localStorage.getItem(POS_KEY)||'null');if(!x||typeof x.left!=='number'||typeof x.top!=='number')return;const ml=Math.max(0,innerWidth-Math.min(p.offsetWidth||460,innerWidth)),mt=Math.max(0,innerHeight-45);p.style.left=Math.min(Math.max(0,x.left),ml)+'px';p.style.top=Math.min(Math.max(0,x.top),mt)+'px';p.style.right='auto';p.style.bottom='auto'}catch{}}
  function draggable(p,h){h.style.cursor='move';h.addEventListener('mousedown',e=>{if(e.button!==0||e.target.tagName==='BUTTON'||e.target.tagName==='SPAN'||e.target.closest('button'))return;e.preventDefault();const r=p.getBoundingClientRect(),sx=e.clientX,sy=e.clientY,sl=r.left,st=r.top;p.style.left=sl+'px';p.style.top=st+'px';p.style.right='auto';p.style.bottom='auto';const move=ev=>{const ml=Math.max(0,innerWidth-p.offsetWidth),mt=Math.max(0,innerHeight-45);p.style.left=Math.min(Math.max(0,sl+ev.clientX-sx),ml)+'px';p.style.top=Math.min(Math.max(0,st+ev.clientY-sy),mt)+'px'};const up=()=>{document.removeEventListener('mousemove',move);document.removeEventListener('mouseup',up);const q=p.getBoundingClientRect();localStorage.setItem(POS_KEY,JSON.stringify({left:Math.round(q.left),top:Math.round(q.top)}))};document.addEventListener('mousemove',move);document.addEventListener('mouseup',up)})}

  function createPanel(){
    document.querySelector('#'+PANEL_ID)?.remove();
    const p=document.createElement('div');p.id=PANEL_ID;p.style.cssText='position:fixed;right:16px;bottom:16px;width:460px;max-height:88vh;overflow:auto;padding:13px;background:#fff;border:1px solid #bbb;border-radius:12px;box-shadow:0 6px 28px rgba(0,0,0,.30);z-index:2147483647;font-family:Arial,sans-serif;font-size:13px;color:#222';
    const h=document.createElement('div');h.style.cssText='display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;cursor:move;user-select:none';
    const titleWrap=document.createElement('div');titleWrap.style.cssText='display:flex;align-items:center;gap:7px';const title=document.createElement('b');title.textContent='VADA Auto Workflow';const ver=document.createElement('span');ver.textContent=`v${SCRIPT_VERSION}`;ver.style.cssText='font-size:11px;padding:2px 6px;border-radius:10px;background:#eef2ff;color:#3730a3;font-weight:700';titleWrap.append(title,ver);
    const ctl=document.createElement('div');ctl.style.cssText='display:flex;align-items:center';const loadBtn=button('↻ LOAD',hotReload,'#0f766e');loadBtn.title='Tải và chạy code mới nhất từ GitHub, không cần F5';loadBtn.style.padding='5px 8px';const min=document.createElement('span');min.textContent='−';min.title='Ẩn';min.style.cssText='cursor:pointer;font-size:24px;margin:0 12px;font-weight:bold';min.onclick=e=>{e.stopPropagation();hidePanel()};const close=document.createElement('span');close.textContent='×';close.style.cssText='cursor:pointer;font-size:22px;font-weight:bold';close.onclick=()=>p.remove();ctl.append(loadBtn,min,close);h.append(titleWrap,ctl);p.appendChild(h);

    const s1=document.createElement('div');s1.style.cssText='border-top:1px solid #ddd;padding-top:9px';s1.innerHTML='<b>1. Chọn thành phần trên trang</b>';const grid=document.createElement('div');grid.style.cssText='display:grid;grid-template-columns:1fr 1fr;margin-top:5px';for(const r of ['date1','date2','search','download']){const b=button('',()=>capture(r));b.id='vada-target-'+r;grid.appendChild(b)}s1.appendChild(grid);s1.append(button('🔍 Kiểm tra',testTargets,'#555'),button('Xóa cấu hình',clearTargets,'#991b1b'));p.appendChild(s1);

    const s2=document.createElement('div');s2.style.cssText='border-top:1px solid #ddd;margin-top:8px;padding-top:9px';s2.innerHTML='<b>2. Chạy một khoảng ngày</b>';
    const yr=document.createElement('div');yr.style.cssText='display:flex;align-items:center;gap:6px;margin-top:7px';yr.append('Năm: ');const ys=document.createElement('select');ys.id='vada-quick-year';ys.style.cssText='padding:5px 8px;border:1px solid #bbb;border-radius:5px';const now=new Date(),cy=now.getFullYear(),cm=now.getMonth()+1;for(let y=cy+1;y>=cy-5;y--){const o=document.createElement('option');o.value=o.textContent=y;o.selected=y===cy;ys.appendChild(o)}yr.appendChild(ys);s2.appendChild(yr);
    function quick(f,t){state.single={date1:f,date2:t};save();status(`✅ ${dmyFromISO(f)} → ${dmyFromISO(t)}`,'success')}
    const common=document.createElement('div');common.style.cssText='display:flex;flex-wrap:wrap;margin-top:6px';common.append(button('Hôm nay',()=>{const d=new Date(),v=isoDate(d.getFullYear(),d.getMonth()+1,d.getDate());quick(v,v)},'#555'),button('7 ngày',()=>{const t=new Date(),f=new Date();f.setDate(t.getDate()-6);quick(isoDate(f.getFullYear(),f.getMonth()+1,f.getDate()),isoDate(t.getFullYear(),t.getMonth()+1,t.getDate()))},'#555'),button('30 ngày',()=>{const t=new Date(),f=new Date();f.setDate(t.getDate()-29);quick(isoDate(f.getFullYear(),f.getMonth()+1,f.getDate()),isoDate(t.getFullYear(),t.getMonth()+1,t.getDate()))},'#555'),button('Tháng này',()=>quick(isoDate(cy,cm,1),isoDate(cy,cm,lastDay(cm,cy))),'#555'),button('Tháng trước',()=>{let y=cy,m=cm-1;if(m===0){m=12;y--}quick(isoDate(y,m,1),isoDate(y,m,lastDay(m,y)))},'#555'));s2.appendChild(common);
    const qs=[['Q1',[1,2,3],'#2563eb'],['Q2',[4,5,6],'#15803d'],['Q3',[7,8,9],'#2563eb'],['Q4',[10,11,12],'#15803d']],updates=[];
    for(const[q,months,color]of qs){const row=document.createElement('div');row.style.cssText='display:flex;align-items:center;flex-wrap:wrap;margin-top:3px';const l=document.createElement('b');l.textContent=q+':';l.style.width='28px';row.appendChild(l);for(const m of months){const b=button('',()=>{const y=+ys.value;quick(isoDate(y,m,1),isoDate(y,m,lastDay(m,y)))},color);const u=()=>{const y=+ys.value;b.textContent=`T${m} (1-${lastDay(m,y)})`;b.style.background=(m===cm&&y===cy)?'#dc2626':color;b.title=(m===cm&&y===cy)?'Tháng hiện tại':''};u();updates.push(u);row.appendChild(b)}row.appendChild(button('Cả quý',()=>{const y=+ys.value,a=months[0],z=months[2];quick(isoDate(y,a,1),isoDate(y,z,lastDay(z,y)))},color));s2.appendChild(row)}ys.addEventListener('change',()=>updates.forEach(f=>f()));
    const rs=button('▶ Chạy khoảng ngày đã chọn',runSingle,'#15803d');rs.id='vada-run-single';s2.appendChild(rs);p.appendChild(s2);

    const s3=document.createElement('div');s3.style.cssText='border-top:1px solid #ddd;margin-top:8px;padding-top:9px';s3.innerHTML='<b>3. Độ trễ</b>';const addDelay=(label,key,vals)=>{const r=document.createElement('div');r.style.cssText='display:flex;justify-content:space-between;align-items:center;margin-top:6px';r.append(label);const sel=delaySelect(state.delays[key],vals);sel.onchange=()=>{state.delays[key]=+sel.value;save()};r.appendChild(sel);s3.appendChild(r)};addDelay('Sau khi điền ngày:','afterDates',[0,200,500,1000,2000]);addDelay('Tìm kiếm → Tải:','afterSearch',[500,1000,1500,2000,3000,5000,8000,10000]);addDelay('Tải → tháng tiếp:','afterDownload',[500,1000,1500,2000,3000,5000]);p.appendChild(s3);

    const s4=document.createElement('div');s4.style.cssText='border-top:1px solid #ddd;margin-top:8px;padding-top:9px';s4.innerHTML='<b>4. Tải lần lượt tất cả tháng</b>';const yrow=document.createElement('div');yrow.style.cssText='display:flex;align-items:center;gap:7px;margin-top:7px';yrow.append('Năm: ');const yi=document.createElement('input');yi.type='number';yi.id='vada-batch-year';yi.min='2000';yi.max='2100';yi.value=state.batchYear;yi.style.cssText='width:85px;padding:6px;border:1px solid #bbb;border-radius:5px';yrow.appendChild(yi);s4.appendChild(yrow);const ra=button('⬇ Tải đủ 12 tháng',runAll,'#0369a1');ra.id='vada-run-all';const st=button('⏹ Dừng',stop,'#dc2626');st.id='vada-stop';s4.append(ra,st);p.appendChild(s4);

    const stat=document.createElement('div');stat.id='vada-status';stat.textContent=`Sẵn sàng • v${SCRIPT_VERSION}`;stat.style.cssText='border-top:1px solid #ddd;margin-top:9px;padding-top:8px;font-size:12px;font-weight:600';p.appendChild(stat);const help=document.createElement('div');help.textContent='↻ LOAD = tải code mới nhất từ GitHub và chạy lại ngay trên tab này, không F5. Bấm 🎯 để chọn thành phần; ESC để hủy.';help.style.cssText='margin-top:4px;color:#777;font-size:11px';p.appendChild(help);
    document.body.appendChild(p);restorePos(p);draggable(p,h);refreshTargets();refreshRun();if(state.hidden){p.style.display='none';showLauncher()}
  }

  function onGlobalKey(e){if(e.altKey&&e.key.toLowerCase()==='v'){e.preventDefault();const p=document.querySelector('#'+PANEL_ID);if(p&&p.style.display!=='none')hidePanel();else{document.querySelector('#'+LAUNCHER_ID)?.remove();p?p.style.display='block':createPanel();state.hidden=false;save()}}}
  document.addEventListener('keydown',onGlobalKey);

  function destroy(){
    stopRequested=true;
    running=false;
    captureCleanup?.();
    if(initTimer)clearTimeout(initTimer);
    document.removeEventListener('keydown',onGlobalKey);
    document.querySelector('#'+PANEL_ID)?.remove();
    document.querySelector('#'+LAUNCHER_ID)?.remove();
  }
  window[INSTANCE_KEY]={version:SCRIPT_VERSION,destroy,hotReload};
  initTimer=setTimeout(createPanel,250);
})();