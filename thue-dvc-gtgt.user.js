// ==UserScript==
// @name         Thuế DVC - Tra cứu 01/GTGT nhanh v4
// @namespace    tampermonkey-tax
// @version      4.0
// @description  Chọn năm, quý và điền đúng 2 ô Từ ngày / Đến ngày
// @match        https://dichvucong.gdt.gov.vn/*
// @match       // https://*.gdt.gov.vn/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const sleep = ms => new Promise(r => setTimeout(r, ms));

    function fire(el) {
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('blur', { bubbles: true }));
    }

    function setNativeValue(input, value) {
        if (!input) return;

        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;
        if (setter) setter.call(input, value); else input.value = value;
        fire(input);
    }

    function isVisible(el) { return !!(el && el.offsetParent !== null && el.type !== 'hidden'); }

    function getDateInputs() {
        const inputs = [...document.querySelectorAll('input')].filter(isVisible);
        const dateCandidates = inputs.filter(input => {
            const text = [input.placeholder || '',input.value || '',input.getAttribute('aria-label') || '',input.getAttribute('name') || '',input.getAttribute('id') || ''].join(' ').toLowerCase();
            return text.includes('ngày') || text.includes('date') || /\d{2}\/\d{2}\/\d{4}/.test(input.value || '');
        });
        console.log('[TAX] Date candidates:', dateCandidates);
        if (dateCandidates.length >= 2) return {from:dateCandidates[0],to:dateCandidates[1]};
        return {from:null,to:null};
    }

    async function selectGTGT() {
        for (const select of document.querySelectorAll('select')) {
            const option = [...select.options].find(o => /01\/GTGT/i.test(o.textContent));
            if (option) { select.value=option.value; select.dispatchEvent(new Event('change',{bubbles:true})); return true; }
        }
        const elements=[...document.querySelectorAll('[role="combobox"], .ant-select-selector')];
        for(const el of elements){const txt=el.parentElement?.parentElement?.innerText||'';if(!/tờ khai/i.test(txt))continue;el.click();await sleep(300);const options=[...document.querySelectorAll('[role="option"], .ant-select-item-option')];const gtgt=options.find(o=>/01\/GTGT/i.test(o.textContent));if(gtgt){gtgt.click();return true;}}
        return false;
    }

    async function fillRange(fromDate,toDate){await selectGTGT();await sleep(300);let {from,to}=getDateInputs();if(!from||!to){alert('Không tìm thấy đủ 2 ô ngày. Mở F12 > Console và gửi tôi dòng [TAX] Date candidates.');return;}if(from===to){alert('Script đang bắt trùng cùng một ô ngày.');return;}console.log('[TAX] FROM input:',from);console.log('[TAX] TO input:',to);setNativeValue(from,fromDate);await sleep(150);setNativeValue(to,toDate);from.focus();from.blur();to.focus();to.blur();console.log(`[TAX] Đã điền: ${fromDate} → ${toDate}`);}

    function pad(n){return String(n).padStart(2,'0');}
    function dateStr(day,month,year){return `${pad(day)}/${pad(month)}/${year}`;}
    function lastDay(month,year){return new Date(year,month,0).getDate();}
    function makeQuarterRanges(q,year){const m1=(q-1)*3+1,m2=m1+1,m3=m1+2,d1=lastDay(m1,year),d2=lastDay(m2,year),d3=lastDay(m3,year);return [{label:`(1-${d1})/${m1}`,from:dateStr(1,m1,year),to:dateStr(d1,m1,year)},{label:`(1-${Math.min(30,d2)})/${m2}`,from:dateStr(1,m2,year),to:dateStr(Math.min(30,d2),m2,year)},{label:d2===31?`(31/${m2}-${d3}/${m3})`:`(1-${d3})/${m3}`,from:d2===31?dateStr(31,m2,year):dateStr(1,m3,year),to:dateStr(d3,m3,year)}];}
    function btn(text,handler,bg){const b=document.createElement('button');b.type='button';b.textContent=text;Object.assign(b.style,{padding:'7px 9px',margin:'3px',border:'0',borderRadius:'6px',background:bg,color:'#fff',cursor:'pointer',fontWeight:'600'});b.addEventListener('click',handler);return b;}

    function createPanel(){if(document.getElementById('tax-fast-panel'))return;const panel=document.createElement('div');panel.id='tax-fast-panel';Object.assign(panel.style,{position:'fixed',right:'15px',bottom:'15px',zIndex:'999999',width:'430px',background:'#fff',border:'1px solid #aaa',borderRadius:'10px',padding:'12px',boxShadow:'0 3px 15px rgba(0,0,0,.25)',fontFamily:'Arial'});panel.innerHTML='<div style="font-weight:bold;margin-bottom:8px">Tra 01/GTGT nhanh</div>';const yearRow=document.createElement('div');yearRow.style.marginBottom='8px';const label=document.createElement('span');label.textContent='Năm: ';label.style.fontWeight='700';const select=document.createElement('select');select.id='tax-year';Object.assign(select.style,{padding:'5px 8px',borderRadius:'5px'});const currentYear=new Date().getFullYear();for(let y=currentYear;y>=2020;y--){const opt=document.createElement('option');opt.value=y;opt.textContent=y;if(y===2026)opt.selected=true;select.appendChild(opt);}yearRow.appendChild(label);yearRow.appendChild(select);panel.appendChild(yearRow);const quarters=document.createElement('div');panel.appendChild(quarters);function render(){quarters.innerHTML='';const year=Number(select.value);[1,2,3,4].forEach(q=>{const row=document.createElement('div');row.style.marginBottom='5px';const qLabel=document.createElement('b');qLabel.textContent=`Q${q}: `;row.appendChild(qLabel);const ranges=makeQuarterRanges(q,year);ranges.forEach(r=>{const button=btn(r.label,()=>fillRange(r.from,r.to),q%2?'#1976d2':'#388e3c');button.title=`${r.from} → ${r.to}`;row.appendChild(button);});quarters.appendChild(row);});}select.addEventListener('change',render);render();const note=document.createElement('div');note.innerHTML='Chọn khoảng ngày → nhập CAPTCHA → bấm Tìm kiếm.';note.style.cssText='font-size:11px;color:#555;margin-top:8px';panel.appendChild(note);document.body.appendChild(panel);}
    setInterval(createPanel,1000);
})();