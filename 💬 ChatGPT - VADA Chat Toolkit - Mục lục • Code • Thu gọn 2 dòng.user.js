// ==UserScript==
// @name         💬 ChatGPT - VADA Chat Toolkit - Mục lục • Code • Thu gọn 2 dòng
// @namespace    https://chatgpt.com/
// @version      4.2.3
// @description  ChatGPT Toolkit Manual - cực nhẹ, Navigator, Code, thu gọn 2 dòng, LOAD GitHub
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @updateURL    https://raw.githubusercontent.com/datphuho88-dev/tampermonkey-scripts/main/%F0%9F%92%AC%20ChatGPT%20-%20VADA%20Chat%20Toolkit%20-%20M%E1%BB%A5c%20l%E1%BB%A5c%20%E2%80%A2%20Code%20%E2%80%A2%20Thu%20g%E1%BB%8Dn%202%20d%C3%B2ng.user.js
// @downloadURL  https://raw.githubusercontent.com/datphuho88-dev/tampermonkey-scripts/main/%F0%9F%92%AC%20ChatGPT%20-%20VADA%20Chat%20Toolkit%20-%20M%E1%BB%A5c%20l%E1%BB%A5c%20%E2%80%A2%20Code%20%E2%80%A2%20Thu%20g%E1%BB%8Dn%202%20d%C3%B2ng.user.js
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @connect      raw.githubusercontent.com
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const VERSION = '4.2.3';
    const RAW_URL = 'https://raw.githubusercontent.com/datphuho88-dev/tampermonkey-scripts/main/%F0%9F%92%AC%20ChatGPT%20-%20VADA%20Chat%20Toolkit%20-%20M%E1%BB%A5c%20l%E1%BB%A5c%20%E2%80%A2%20Code%20%E2%80%A2%20Thu%20g%E1%BB%8Dn%202%20d%C3%B2ng.user.js';
    const GLOBAL_KEY = '__VADA_CHAT_TOOLKIT__';

    try { window[GLOBAL_KEY]?.destroy?.(); } catch (_) {}

    const APP = {
        cleanups: [],
        destroy() {
            for (const fn of this.cleanups.splice(0)) {
                try { fn(); } catch (_) {}
            }
            document.getElementById('vada-manual-panel')?.remove();
            document.getElementById('vada-manual-toggle')?.remove();
            document.getElementById('vada-manual-css')?.remove();
            document.getElementById('vada-manual-toast')?.remove();
            document.querySelectorAll('.vada-message-compact,.vada-message-expanded,.vada-manual-code-collapsed,.vada-manual-code-wrap,.vada-highlight').forEach(el => {
                el.classList.remove('vada-message-compact','vada-message-expanded','vada-manual-code-collapsed','vada-manual-code-wrap','vada-highlight');
            });
            if (window[GLOBAL_KEY] === this) delete window[GLOBAL_KEY];
        }
    };
    window[GLOBAL_KEY] = APP;

    function on(el, type, fn, options) {
        if (!el) return;
        el.addEventListener(type, fn, options);
        APP.cleanups.push(() => el.removeEventListener(type, fn, options));
    }

    const CONFIG = {
        panelWidth: 360,
        titleLength: 90,
        quickPrompts: [
            { name: '💻 Full code', text: `Viết lại toàn bộ code hoàn chỉnh để tôi copy-paste.\nGiữ nguyên tất cả chức năng đang có.\nKhông xóa các module cũ nếu không thật sự cần thiết.\nKhông trả về các đoạn code rời.\nTrả về một block code hoàn chỉnh.` },
            { name: '🔧 Sửa lỗi', text: `Kiểm tra lỗi trong code hiện tại.\nChỉ sửa những phần cần thiết.\nGiữ nguyên tất cả chức năng đang hoạt động.\nSau đó viết lại toàn bộ code hoàn chỉnh để tôi copy-paste.` },
            { name: '➕ Thêm chức năng', text: `Thêm chức năng tôi yêu cầu vào code hiện tại.\nGiữ nguyên toàn bộ chức năng cũ.\nKhông bỏ bớt module hiện tại.\nSau khi sửa, viết lại toàn bộ code hoàn chỉnh để tôi copy-paste.` },
            { name: '⚡ Tối ưu', text: `Tối ưu code hiện tại để chạy nhẹ và ổn định hơn.\nKhông làm mất chức năng đang có.\nSau đó viết lại toàn bộ code hoàn chỉnh.` },
            { name: '📋 Chỉ code', text: `Trả lời ngắn gọn.\nKhông cần giải thích dài.\nĐưa toàn bộ code hoàn chỉnh để tôi copy-paste.` },
            { name: '🔍 Giải thích', text: `Giải thích ngắn gọn phần này đang hoạt động như thế nào, lỗi nằm ở đâu và cách xử lý thực tế.` }
        ]
    };

    const IDS = { panel:'vada-manual-panel', toggle:'vada-manual-toggle', css:'vada-manual-css', toast:'vada-manual-toast' };
    let currentView='questions', questionCache=[], codeCache=[], compactChat=false, toastTimer=null;

    function injectCSS() {
        const style=document.createElement('style');
        style.id=IDS.css;
        style.textContent=`
#${IDS.toggle}{position:fixed;right:14px;top:75px;width:44px;height:44px;border:1px solid #333;border-radius:50%;background:#000;color:#fff;font-weight:700;font-size:15px;z-index:2147483646;cursor:pointer;box-shadow:0 5px 18px rgba(0,0,0,.45)}
#${IDS.toggle}:hover{transform:scale(1.05)}
#${IDS.panel}{position:fixed;top:70px;right:14px;width:${CONFIG.panelWidth}px;max-height:calc(100vh - 90px);display:none;flex-direction:column;background:#000;color:#fff;border:1px solid #333;border-radius:14px;box-shadow:0 15px 45px rgba(0,0,0,.65);z-index:2147483647;font-family:Arial,sans-serif;font-size:13px;overflow:hidden}
#${IDS.panel} *{box-sizing:border-box}.vada-header{display:flex;align-items:center;justify-content:space-between;padding:9px 11px;background:#000;border-bottom:1px solid #333;cursor:move;user-select:none}.vada-title{font-weight:700}.vada-version{color:#777;font-size:10px;margin-left:5px}.vada-close{border:none;background:transparent;color:#aaa;cursor:pointer;font-size:18px}.vada-body{padding:9px;display:flex;flex-direction:column;gap:7px;overflow-y:auto;overscroll-behavior:contain;background:#000}.vada-search{width:100%;padding:8px 9px;border-radius:8px;border:1px solid #333;background:#000;color:#fff;outline:none}.vada-grid-1{display:grid;grid-template-columns:1fr;gap:5px}.vada-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:5px}.vada-grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}.vada-grid-4{display:grid;grid-template-columns:repeat(4,1fr);gap:5px}.vada-btn{padding:6px;border-radius:7px;border:1px solid #3a3a3a;background:#111;color:#eee;font-size:11px;cursor:pointer}.vada-btn:hover{background:#222}.vada-btn.active{background:#eee;color:#111;font-weight:bold}.vada-btn-red{background:#971f1f;color:#fff;border:1px solid #d24444;font-weight:700;min-height:34px}.vada-btn-red:hover{background:#bd2929}.vada-btn-red.active{background:#d32f2f;color:#fff;border-color:#ff6666}.vada-btn-open{background:#111;color:#fff;border:1px solid #555;font-weight:700;min-height:34px}.vada-btn-open:hover{background:#222}.vada-btn-open.active{background:#eaeaea;color:#111;border-color:#fff}.vada-btn-load{background:#073d1f;border-color:#137a43;color:#8cffb4;font-weight:700}.vada-btn-load:hover{background:#0a5c2d}.vada-section{color:#999;font-size:10px;font-weight:bold;margin-top:3px}.vada-stats{display:flex;justify-content:space-between;color:#888;font-size:11px;padding:0 2px}.vada-list{max-height:36vh;overflow-y:auto;display:flex;flex-direction:column;gap:4px;overscroll-behavior:contain;background:#000}.vada-item{display:grid;grid-template-columns:38px 1fr 30px;gap:5px;align-items:start;padding:7px;border-radius:8px;background:#0b0b0b;border:1px solid #181818;cursor:pointer}.vada-item:hover{background:#161616}.vada-number{color:#ff7373;font-size:11px;font-weight:bold}.vada-text{color:#ddd;line-height:1.35;word-break:break-word}.vada-copy-small{border:none;background:transparent;color:#ccc;cursor:pointer}.vada-empty{padding:20px;color:#888;text-align:center}.vada-prompts{display:grid;grid-template-columns:1fr 1fr;gap:5px}
.vada-message-compact{position:relative!important;max-height:3.25em!important;overflow:hidden!important;cursor:pointer!important}.vada-message-compact:not(.vada-message-expanded)::after{content:'  Bấm để mở';position:absolute;right:0;bottom:0;padding:2px 7px;border-radius:5px 0 0 0;background:#a01919;color:#fff;font-family:Arial,sans-serif;font-size:10px;line-height:18px;pointer-events:none}.vada-message-compact.vada-message-expanded{max-height:none!important;overflow:visible!important;cursor:default!important}.vada-message-compact.vada-message-expanded::after{display:none!important}
.vada-manual-code-collapsed{max-height:260px!important;overflow:hidden!important}.vada-manual-code-wrap,.vada-manual-code-wrap code{white-space:pre-wrap!important;overflow-wrap:anywhere!important;word-break:break-word!important}.vada-highlight{outline:3px solid rgba(255,70,70,.85)!important;outline-offset:3px;border-radius:8px}
#${IDS.toast}{position:fixed;left:50%;bottom:40px;transform:translateX(-50%);padding:8px 13px;border-radius:8px;background:#000;border:1px solid #333;color:#fff;z-index:2147483647;font-family:Arial;font-size:12px}
@media(max-width:700px){#${IDS.panel}{width:min(94vw,360px);right:5px;top:60px}.vada-grid-4{grid-template-columns:1fr 1fr}}
`;
        document.head.appendChild(style);
    }

    function createUI(){
        const toggle=document.createElement('button'); toggle.id=IDS.toggle; toggle.textContent='V'; toggle.title='VADA Chat Toolkit'; on(toggle,'click',openPanel); document.body.appendChild(toggle);
        const panel=document.createElement('div'); panel.id=IDS.panel; panel.innerHTML=`
<div class="vada-header"><div><span class="vada-title">⚡ VADA Chat Tools</span><span class="vada-version">v${VERSION}</span></div><button class="vada-close">✕</button></div>
<div class="vada-body">
<input id="vada-search" class="vada-search" placeholder="🔎 Tìm...">
<div class="vada-grid-2"><button class="vada-btn active" data-view="questions">💬 Câu hỏi</button><button class="vada-btn" data-view="code">💻 Code</button></div>
<div class="vada-stats"><span id="vada-stat-q">Chưa quét</span><span id="vada-stat-code">Chưa quét</span></div>
<div id="vada-list" class="vada-list"><div class="vada-empty">Bấm \"Quét\" để tạo danh sách</div></div>
<div class="vada-grid-2"><button id="vada-scan" class="vada-btn">🔎 Quét</button><button id="vada-clear-cache" class="vada-btn">🧹 Xóa danh sách</button></div>
<div class="vada-section">CODE</div>
<div class="vada-grid-2"><button id="vada-copy-last-code" class="vada-btn">📋 Copy code cuối</button><button id="vada-go-last-code" class="vada-btn">↓ Đến code cuối</button><button id="vada-collapse-code" class="vada-btn">▰ Thu gọn code</button><button id="vada-expand-code" class="vada-btn">▤ Mở code</button><button id="vada-wrap-code" class="vada-btn">↩ Xuống dòng</button><button id="vada-unwrap-code" class="vada-btn">↔ Dòng gốc</button></div>
<div class="vada-section">CHAT</div>
<div class="vada-grid-2"><button id="vada-compact-chat" class="vada-btn vada-btn-red">🔴 Thu gọn 2 dòng</button><button id="vada-open-chat" class="vada-btn vada-btn-open active">▤ Mở toàn bộ</button></div>
<div class="vada-grid-2"><button id="vada-copy-last-answer" class="vada-btn">📋 GPT mới nhất</button><button id="vada-copy-all-questions" class="vada-btn">📋 Tất cả câu hỏi</button></div>
<div class="vada-section">PROMPT NHANH</div>
<div id="vada-prompts" class="vada-prompts"></div>
<div class="vada-grid-4"><button id="vada-top" class="vada-btn">↑ Đầu</button><button id="vada-bottom" class="vada-btn">↓ Cuối</button><button id="vada-load" class="vada-btn vada-btn-load">↻ LOAD</button><button id="vada-close-bottom" class="vada-btn">✕ Ẩn</button></div>
</div>`; document.body.appendChild(panel); bindPanelEvents(); renderPrompts(); makeDraggable(panel); restorePosition(panel);
    }

    function openPanel(){const p=document.getElementById(IDS.panel),t=document.getElementById(IDS.toggle);if(p)p.style.display='flex';if(t)t.style.display='none';}
    function closePanel(){const p=document.getElementById(IDS.panel),t=document.getElementById(IDS.toggle);if(p)p.style.display='none';if(t)t.style.display='block';}
    function togglePanel(){const p=document.getElementById(IDS.panel);if(!p)return;(p.style.display==='none'||getComputedStyle(p).display==='none')?openPanel():closePanel();}

    function getMessages(){const nodes=document.querySelectorAll('[data-message-author-role]'),out=[],seen=new Set();nodes.forEach(node=>{const role=node.getAttribute('data-message-author-role');if(role!=='user'&&role!=='assistant')return;const container=node.closest('[data-testid^="conversation-turn-"]')||node.closest('article')||node;if(seen.has(container))return;seen.add(container);out.push({role,el:node,container});});return out;}
    function getText(el){return el?(el.innerText||el.textContent||'').replace(/^You said:\s*/i,'').replace(/^Bạn đã nói:\s*/i,'').trim():'';}
    function shortText(text){text=String(text||'').replace(/\s+/g,' ').trim();return text.length<=CONFIG.titleLength?text:text.slice(0,CONFIG.titleLength)+'…';}

    function compactAllChat(){compactChat=true;applyCompactChat();updateCompactButtons();}
    function openAllChat(){compactChat=false;removeCompactChat();updateCompactButtons();}
    function applyCompactChat(){const messages=getMessages();messages.forEach(m=>{m.el.classList.add('vada-message-compact');m.el.classList.remove('vada-message-expanded');});toast(`Đã thu gọn ${messages.length} tin nhắn`);}
    function removeCompactChat(){document.querySelectorAll('.vada-message-compact').forEach(el=>el.classList.remove('vada-message-compact','vada-message-expanded'));toast('Đã mở toàn bộ hội thoại');}
    function updateCompactButtons(){document.getElementById('vada-compact-chat')?.classList.toggle('active',compactChat);document.getElementById('vada-open-chat')?.classList.toggle('active',!compactChat);}
    function compactClickHandler(event){if(!compactChat)return;const message=event.target.closest('.vada-message-compact');if(!message||event.target.closest('a,button,input,textarea,select')||window.getSelection()?.toString())return;message.classList.toggle('vada-message-expanded');}
    function expandContainingMessage(element){if(!compactChat||!element)return;element.closest('[data-message-author-role]')?.classList.add('vada-message-expanded');}

    function scanQuestions(){questionCache=[];let number=0;getMessages().forEach(m=>{if(m.role!=='user')return;number++;questionCache.push({number,text:getText(m.el),element:m.container,messageElement:m.el});});updateStats();if(currentView==='questions')renderQuestions();if(compactChat)applyCompactChat();toast(`Đã quét ${questionCache.length} câu hỏi`);}
    function scanCode(){codeCache=[];getCodeBlocksNow().forEach((pre,index)=>{const code=getCodeText(pre);codeCache.push({number:index+1,code,language:detectLanguage(pre),lines:Math.max(1,code.split('\n').length),element:pre});});updateStats();if(currentView==='code')renderCode();toast(`Đã quét ${codeCache.length} code`);}
    function scanCurrentView(){currentView==='questions'?scanQuestions():scanCode();}

    function renderQuestions(){const list=document.getElementById('vada-list'),query=(document.getElementById('vada-search')?.value||'').trim().toLowerCase();list.innerHTML='';let shown=0;questionCache.forEach(item=>{if(query&&!item.text.toLowerCase().includes(query))return;shown++;const row=document.createElement('div');row.className='vada-item';row.innerHTML=`<span class="vada-number">Q${item.number}</span><span class="vada-text">${escapeHTML(shortText(item.text))}</span><button class="vada-copy-small" title="Copy">📋</button>`;on(row,'click',e=>{if(e.target.closest('.vada-copy-small'))return;item.messageElement?.classList.add('vada-message-expanded');scrollToElement(item.element);});on(row.querySelector('.vada-copy-small'),'click',e=>{e.stopPropagation();copyText(item.text);toast(`Đã copy Q${item.number}`);});list.appendChild(row);});if(!shown)list.innerHTML=`<div class="vada-empty">${questionCache.length?'Không tìm thấy':'Bấm "Quét" để tạo mục lục câu hỏi'}</div>`;}
    function renderCode(){const list=document.getElementById('vada-list'),query=(document.getElementById('vada-search')?.value||'').trim().toLowerCase();list.innerHTML='';let shown=0;codeCache.forEach(item=>{if(query&&!item.code.toLowerCase().includes(query)&&!item.language.toLowerCase().includes(query))return;shown++;const row=document.createElement('div');row.className='vada-item';row.innerHTML=`<span class="vada-number">C${item.number}</span><span class="vada-text"><b>${escapeHTML(item.language)} • ${item.lines} dòng</b><br>${escapeHTML(shortText(item.code))}</span><button class="vada-copy-small">📋</button>`;on(row,'click',e=>{if(e.target.closest('.vada-copy-small'))return;expandContainingMessage(item.element);scrollToElement(item.element);});on(row.querySelector('.vada-copy-small'),'click',e=>{e.stopPropagation();copyText(item.code);toast(`Đã copy C${item.number}`);});list.appendChild(row);});if(!shown)list.innerHTML=`<div class="vada-empty">${codeCache.length?'Không tìm thấy':'Bấm "Quét" để tạo danh sách code'}</div>`;}
    function renderCurrentView(){currentView==='questions'?renderQuestions():renderCode();}

    function getCodeBlocksNow(){return[...document.querySelectorAll('[data-message-author-role="assistant"] pre')];}
    function getCodeText(pre){const code=pre?.querySelector('code');return(code?.innerText||pre?.innerText||'').trim();}
    function detectLanguage(pre){const match=(pre?.querySelector('code')?.className||'').match(/language-([a-zA-Z0-9_+#-]+)/);return match?match[1]:'code';}
    async function copyLatestCode(){const blocks=getCodeBlocksNow();if(!blocks.length)return toast('Không tìm thấy code');await copyText(getCodeText(blocks.at(-1)));toast('Đã copy code cuối');}
    function goToLatestCode(){const blocks=getCodeBlocksNow();if(!blocks.length)return toast('Không tìm thấy code');expandContainingMessage(blocks.at(-1));scrollToElement(blocks.at(-1));}
    function collapseAllCode(){const blocks=getCodeBlocksNow();blocks.forEach(pre=>pre.classList.add('vada-manual-code-collapsed'));toast(`Đã thu gọn ${blocks.length} code`);}
    function expandAllCode(){const blocks=getCodeBlocksNow();blocks.forEach(pre=>pre.classList.remove('vada-manual-code-collapsed'));toast(`Đã mở ${blocks.length} code`);}
    function wrapAllCode(){getCodeBlocksNow().forEach(pre=>pre.classList.add('vada-manual-code-wrap'));toast('Đã bật xuống dòng');}
    function unwrapAllCode(){getCodeBlocksNow().forEach(pre=>pre.classList.remove('vada-manual-code-wrap'));toast('Đã về dòng gốc');}

    async function copyLatestAnswer(){const messages=getMessages().filter(x=>x.role==='assistant');if(!messages.length)return toast('Không tìm thấy câu trả lời');await copyText(getText(messages.at(-1).el));toast('Đã copy GPT mới nhất');}
    async function copyAllQuestions(){const messages=getMessages().filter(x=>x.role==='user');if(!messages.length)return toast('Không tìm thấy câu hỏi');await copyText(messages.map((x,i)=>`Q${i+1}. ${getText(x.el)}`).join('\n\n'));toast(`Đã copy ${messages.length} câu hỏi`);}
    function updateStats(){const q=document.getElementById('vada-stat-q'),c=document.getElementById('vada-stat-code');if(q)q.textContent=questionCache.length?`${questionCache.length} câu hỏi`:'Chưa quét câu hỏi';if(c)c.textContent=codeCache.length?`${codeCache.length} code`:'Chưa quét code';}
    function clearCache(){questionCache=[];codeCache=[];updateStats();document.getElementById('vada-list').innerHTML='<div class="vada-empty">Danh sách đã xóa</div>';toast('Đã xóa danh sách');}

    function renderPrompts(){const holder=document.getElementById('vada-prompts');CONFIG.quickPrompts.forEach(prompt=>{const button=document.createElement('button');button.className='vada-btn';button.textContent=prompt.name;button.title=prompt.text;on(button,'click',()=>insertPrompt(prompt.text));holder.appendChild(button);});}
    function findComposer(){return document.querySelector('#prompt-textarea')||document.querySelector('textarea[data-id]')||document.querySelector('textarea[placeholder]')||document.querySelector('main [contenteditable="true"]');}
    function insertPrompt(text){const composer=findComposer();if(!composer)return toast('Không tìm thấy ô nhập');composer.focus();const old=(composer.tagName==='TEXTAREA'?composer.value:composer.innerText||'').trim(),finalText=old?`${old}\n\n${text}`:text;if(composer.tagName==='TEXTAREA'){const descriptor=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value');if(descriptor?.set)descriptor.set.call(composer,finalText);else composer.value=finalText;composer.dispatchEvent(new Event('input',{bubbles:true}));}else{composer.textContent=finalText;composer.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:text}));}composer.focus();toast('Đã chèn prompt');}

    function findScrollContainer(target){let el=target?.parentElement;while(el&&el!==document.body&&el!==document.documentElement){const css=getComputedStyle(el),oy=css.overflowY;if((oy==='auto'||oy==='scroll')&&el.scrollHeight>el.clientHeight+40)return el;el=el.parentElement;}el=document.querySelector('main');while(el&&el!==document.body&&el!==document.documentElement){const css=getComputedStyle(el),oy=css.overflowY;if((oy==='auto'||oy==='scroll')&&el.scrollHeight>el.clientHeight+40)return el;el=el.parentElement;}return document.scrollingElement||document.documentElement;}
    function scrollChat(direction){const turns=[...document.querySelectorAll('[data-testid^="conversation-turn-"]')],messages=getMessages(),target=direction==='top'?(turns[0]||messages[0]?.container||document.querySelector('main')):(turns.at(-1)||messages.at(-1)?.container||findComposer()||document.querySelector('main')),scroller=findScrollContainer(target);if(scroller){const top=direction==='top'?0:scroller.scrollHeight;try{scroller.scrollTo({top,behavior:'smooth'});}catch(_){scroller.scrollTop=top;}}if(target)setTimeout(()=>{try{target.scrollIntoView({behavior:'smooth',block:direction==='top'?'start':'end'});}catch(_){}},60);}

    function hotLoad(){
        const button=document.getElementById('vada-load');
        const oldText=button?.textContent||'↻ LOAD';
        const panelWasOpen=document.getElementById(IDS.panel)?.style.display!=='none';
        if(button){button.disabled=true;button.textContent='… LOAD';}
        toast('Đang tải bản mới từ GitHub...');
        const url=`${RAW_URL}?_=${Date.now()}`;
        GM_xmlhttpRequest({
            method:'GET',
            url,
            headers:{'Cache-Control':'no-cache','Pragma':'no-cache'},
            timeout:15000,
            onload(response){
                try{
                    if(response.status<200||response.status>=300)throw new Error(`HTTP ${response.status}`);
                    const code=response.responseText||'';
                    if(!code.includes('// ==UserScript==')||!code.includes('VADA ChatGPT Toolkit'))throw new Error('Nội dung tải về không hợp lệ');
                    // Dùng direct eval để code mới vẫn chạy trong sandbox Tampermonkey và dùng được GM_*.
                    // Không destroy trước: nếu code tải về lỗi cú pháp, panel hiện tại vẫn còn nguyên.
                    eval(code);
                    const newPanel=document.getElementById(IDS.panel);
                    const newToggle=document.getElementById(IDS.toggle);
                    if(!newPanel&&!newToggle)throw new Error('Bản mới không khởi tạo được giao diện');
                    if(panelWasOpen&&newPanel){newPanel.style.display='flex';if(newToggle)newToggle.style.display='none';}
                }catch(error){
                    console.error('[VADA LOAD]',error);
                    // Nếu bản mới đã dọn instance cũ rồi nhưng khởi tạo thất bại, dựng lại bản đang chạy.
                    try{window[GLOBAL_KEY]?.destroy?.();}catch(_){}
                    try{
                        APP.cleanups.length=0;
                        window[GLOBAL_KEY]=APP;
                        init();
                        if(panelWasOpen)openPanel();
                    }catch(restoreError){
                        console.error('[VADA LOAD RESTORE]',restoreError);
                    }
                    const restoredButton=document.getElementById('vada-load');
                    if(restoredButton){restoredButton.disabled=false;restoredButton.textContent=oldText;}
                    toast(`LOAD lỗi: ${error.message}`);
                }
            },
            onerror(){
                if(button?.isConnected){button.disabled=false;button.textContent=oldText;}
                toast('LOAD lỗi: không kết nối được GitHub Raw');
            },
            ontimeout(){
                if(button?.isConnected){button.disabled=false;button.textContent=oldText;}
                toast('LOAD lỗi: quá thời gian kết nối');
            }
        });
    }

    function bindPanelEvents(){const panel=document.getElementById(IDS.panel);on(panel.querySelector('.vada-close'),'click',closePanel);on(panel.querySelector('#vada-close-bottom'),'click',closePanel);panel.querySelectorAll('[data-view]').forEach(button=>on(button,'click',()=>{currentView=button.dataset.view;panel.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b===button));renderCurrentView();}));on(panel.querySelector('#vada-search'),'input',renderCurrentView);on(panel.querySelector('#vada-scan'),'click',scanCurrentView);on(panel.querySelector('#vada-clear-cache'),'click',clearCache);on(panel.querySelector('#vada-copy-last-code'),'click',copyLatestCode);on(panel.querySelector('#vada-go-last-code'),'click',goToLatestCode);on(panel.querySelector('#vada-collapse-code'),'click',collapseAllCode);on(panel.querySelector('#vada-expand-code'),'click',expandAllCode);on(panel.querySelector('#vada-wrap-code'),'click',wrapAllCode);on(panel.querySelector('#vada-unwrap-code'),'click',unwrapAllCode);on(panel.querySelector('#vada-compact-chat'),'click',compactAllChat);on(panel.querySelector('#vada-open-chat'),'click',openAllChat);on(panel.querySelector('#vada-copy-last-answer'),'click',copyLatestAnswer);on(panel.querySelector('#vada-copy-all-questions'),'click',copyAllQuestions);on(panel.querySelector('#vada-top'),'click',()=>scrollChat('top'));on(panel.querySelector('#vada-bottom'),'click',()=>scrollChat('bottom'));on(panel.querySelector('#vada-load'),'click',hotLoad);}
    function bindKeyboard(){const handler=event=>{if(!event.altKey||!event.shiftKey)return;const key=event.key.toLowerCase();if(key==='q'){event.preventDefault();togglePanel();}if(key==='c'){event.preventDefault();copyLatestCode();}if(key==='f'){event.preventDefault();openPanel();const search=document.getElementById('vada-search');search?.focus();search?.select();}};on(document,'keydown',handler);}
    function scrollToElement(el){if(!el)return;expandContainingMessage(el);try{el.scrollIntoView({behavior:'smooth',block:'center'});}catch(_){}el.classList.add('vada-highlight');const timer=setTimeout(()=>el.classList.remove('vada-highlight'),1200);APP.cleanups.push(()=>clearTimeout(timer));}

    function makeDraggable(panel){const header=panel.querySelector('.vada-header');let dragging=false,startX=0,startY=0,startLeft=0,startTop=0;const down=event=>{if(event.target.closest('button'))return;dragging=true;const rect=panel.getBoundingClientRect();startX=event.clientX;startY=event.clientY;startLeft=rect.left;startTop=rect.top;panel.style.right='auto';event.preventDefault();},move=event=>{if(!dragging)return;let left=startLeft+event.clientX-startX,top=startTop+event.clientY-startY;left=Math.max(0,Math.min(window.innerWidth-60,left));top=Math.max(0,Math.min(window.innerHeight-50,top));panel.style.left=`${left}px`;panel.style.top=`${top}px`;},up=()=>{if(!dragging)return;dragging=false;const rect=panel.getBoundingClientRect();GM_setValue('vada_manual_position',{left:rect.left,top:rect.top});};on(header,'mousedown',down);on(document,'mousemove',move);on(document,'mouseup',up);}
    function restorePosition(panel){const position=GM_getValue('vada_manual_position',null);if(position&&position.left>=0&&position.left<window.innerWidth-50&&position.top>=0&&position.top<window.innerHeight-50){panel.style.left=`${position.left}px`;panel.style.top=`${position.top}px`;panel.style.right='auto';}}
    async function copyText(text){if(!text)return;try{await navigator.clipboard.writeText(text);}catch(_){const textarea=document.createElement('textarea');textarea.value=text;textarea.style.position='fixed';textarea.style.opacity='0';document.body.appendChild(textarea);textarea.select();document.execCommand('copy');textarea.remove();}}
    function toast(text){let box=document.getElementById(IDS.toast);if(!box){box=document.createElement('div');box.id=IDS.toast;document.body.appendChild(box);}box.textContent=text;clearTimeout(toastTimer);toastTimer=setTimeout(()=>box?.remove(),1300);}
    function escapeHTML(text){return String(text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#039;');}

    function init(){injectCSS();createUI();bindKeyboard();on(document,'click',compactClickHandler,true);updateCompactButtons();console.log(`[VADA Chat Toolkit v${VERSION}] Running`);}
    if(document.readyState==='loading')on(document,'DOMContentLoaded',init,{once:true});else init();
})();