// ==UserScript==
// @name         💬 ChatGPT - VADA Chat Toolkit - Mục lục • Code • Thu gọn 2 dòng
// @namespace    https://chatgpt.com/
// @version      4.1.1
// @description  ChatGPT Toolkit Manual - cực nhẹ, Navigator, Code, thu gọn hội thoại User/GPT còn 2 dòng và mở riêng từng tin nhắn
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @updateURL    https://raw.githubusercontent.com/datphuho88-dev/tampermonkey-scripts/main/%F0%9F%92%AC%20ChatGPT%20-%20VADA%20Chat%20Toolkit%20-%20M%E1%BB%A5c%20l%E1%BB%A5c%20%E2%80%A2%20Code%20%E2%80%A2%20Thu%20g%E1%BB%8Dn%202%20d%C3%B2ng.user.js
// @downloadURL  https://raw.githubusercontent.com/datphuho88-dev/tampermonkey-scripts/main/%F0%9F%92%AC%20ChatGPT%20-%20VADA%20Chat%20Toolkit%20-%20M%E1%BB%A5c%20l%E1%BB%A5c%20%E2%80%A2%20Code%20%E2%80%A2%20Thu%20g%E1%BB%8Dn%202%20d%C3%B2ng.user.js
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const CONFIG = {
        panelWidth: 360,
        titleLength: 90,
        quickPrompts: [
            {
                name: '💻 Full code',
                text:
`Viết lại toàn bộ code hoàn chỉnh để tôi copy-paste.
Giữ nguyên tất cả chức năng đang có.
Không xóa các module cũ nếu không thật sự cần thiết.
Không trả về các đoạn code rời.
Trả về một block code hoàn chỉnh.`
            },
            {
                name: '🔧 Sửa lỗi',
                text:
`Kiểm tra lỗi trong code hiện tại.
Chỉ sửa những phần cần thiết.
Giữ nguyên tất cả chức năng đang hoạt động.
Sau đó viết lại toàn bộ code hoàn chỉnh để tôi copy-paste.`
            },
            {
                name: '➕ Thêm chức năng',
                text:
`Thêm chức năng tôi yêu cầu vào code hiện tại.
Giữ nguyên toàn bộ chức năng cũ.
Không bỏ bớt module hiện tại.
Sau khi sửa, viết lại toàn bộ code hoàn chỉnh để tôi copy-paste.`
            },
            {
                name: '⚡ Tối ưu',
                text:
`Tối ưu code hiện tại để chạy nhẹ và ổn định hơn.
Không làm mất chức năng đang có.
Sau đó viết lại toàn bộ code hoàn chỉnh.`
            },
            {
                name: '📋 Chỉ code',
                text:
`Trả lời ngắn gọn.
Không cần giải thích dài.
Đưa toàn bộ code hoàn chỉnh để tôi copy-paste.`
            },
            {
                name: '🔍 Giải thích',
                text:
`Giải thích ngắn gọn phần này đang hoạt động như thế nào, lỗi nằm ở đâu và cách xử lý thực tế.`
            }
        ]
    };

    const IDS = {
        panel: 'vada-manual-panel',
        toggle: 'vada-manual-toggle',
        css: 'vada-manual-css',
        toast: 'vada-manual-toast'
    };

    let currentView = 'questions';
    let questionCache = [];
    let codeCache = [];
    let compactChat = false;

    function injectCSS() {
        if (document.getElementById(IDS.css)) return;

        const style = document.createElement('style');
        style.id = IDS.css;
        style.textContent = `
#${IDS.toggle}{position:fixed;right:14px;top:75px;width:44px;height:44px;border:none;border-radius:50%;background:#b92323;color:#fff;font-weight:700;font-size:15px;z-index:2147483646;cursor:pointer;box-shadow:0 5px 18px rgba(0,0,0,.3)}
#${IDS.toggle}:hover{transform:scale(1.05)}
#${IDS.panel}{position:fixed;top:70px;right:14px;width:${CONFIG.panelWidth}px;max-height:calc(100vh - 90px);display:none;flex-direction:column;background:rgba(22,22,24,.98);color:#fff;border:1px solid rgba(255,255,255,.13);border-radius:14px;box-shadow:0 15px 45px rgba(0,0,0,.4);z-index:2147483647;font-family:Arial,sans-serif;font-size:13px;overflow:hidden}
#${IDS.panel} *{box-sizing:border-box}.vada-header{display:flex;align-items:center;justify-content:space-between;padding:9px 11px;background:#111;border-bottom:1px solid rgba(255,255,255,.1);cursor:move;user-select:none}.vada-title{font-weight:700}.vada-version{color:#777;font-size:10px;margin-left:5px}.vada-close{border:none;background:transparent;color:#aaa;cursor:pointer;font-size:18px}.vada-body{padding:9px;display:flex;flex-direction:column;gap:7px;overflow-y:auto;overscroll-behavior:contain}.vada-search{width:100%;padding:8px 9px;border-radius:8px;border:1px solid rgba(255,255,255,.14);background:#262629;color:#fff;outline:none}.vada-grid-1{display:grid;grid-template-columns:1fr;gap:5px}.vada-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:5px}.vada-grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}.vada-btn{padding:6px;border-radius:7px;border:1px solid rgba(255,255,255,.12);background:#2b2b2f;color:#eee;font-size:11px;cursor:pointer}.vada-btn:hover{background:#44444a}.vada-btn.active{background:#eee;color:#111;font-weight:bold}.vada-btn-red{background:#971f1f;color:#fff;border:1px solid #d24444;font-weight:700;min-height:34px}.vada-btn-red:hover{background:#bd2929}.vada-btn-red.active{background:#d32f2f;color:#fff;border-color:#ff6666}.vada-section{color:#999;font-size:10px;font-weight:bold;margin-top:3px}.vada-stats{display:flex;justify-content:space-between;color:#888;font-size:11px;padding:0 2px}.vada-list{max-height:36vh;overflow-y:auto;display:flex;flex-direction:column;gap:4px;overscroll-behavior:contain}.vada-item{display:grid;grid-template-columns:38px 1fr 30px;gap:5px;align-items:start;padding:7px;border-radius:8px;background:rgba(255,255,255,.04);cursor:pointer}.vada-item:hover{background:rgba(255,255,255,.1)}.vada-number{color:#ff7373;font-size:11px;font-weight:bold}.vada-text{color:#ddd;line-height:1.35;word-break:break-word}.vada-copy-small{border:none;background:transparent;color:#ccc;cursor:pointer}.vada-empty{padding:20px;color:#888;text-align:center}.vada-prompts{display:grid;grid-template-columns:1fr 1fr;gap:5px}
.vada-message-compact{position:relative!important;max-height:3.25em!important;overflow:hidden!important;cursor:pointer!important}.vada-message-compact:not(.vada-message-expanded)::after{content:'  Bấm để mở';position:absolute;right:0;bottom:0;padding:2px 7px;border-radius:5px 0 0 0;background:rgba(160,25,25,.94);color:#fff;font-family:Arial,sans-serif;font-size:10px;line-height:18px;pointer-events:none}.vada-message-compact.vada-message-expanded{max-height:none!important;overflow:visible!important;cursor:default!important}.vada-message-compact.vada-message-expanded::after{display:none!important}
.vada-manual-code-collapsed{max-height:260px!important;overflow:hidden!important}.vada-manual-code-wrap,.vada-manual-code-wrap code{white-space:pre-wrap!important;overflow-wrap:anywhere!important;word-break:break-word!important}.vada-highlight{outline:3px solid rgba(255,70,70,.85)!important;outline-offset:3px;border-radius:8px}
#${IDS.toast}{position:fixed;left:50%;bottom:40px;transform:translateX(-50%);padding:8px 13px;border-radius:8px;background:rgba(20,20,20,.95);color:#fff;z-index:2147483647;font-family:Arial;font-size:12px}
@media(max-width:700px){#${IDS.panel}{width:min(94vw,360px);right:5px;top:60px}}
`;
        document.head.appendChild(style);
    }

    function createUI() {
        createToggle();
        createPanel();
    }

    function createToggle() {
        if (document.getElementById(IDS.toggle)) return;
        const button = document.createElement('button');
        button.id = IDS.toggle;
        button.textContent = 'V';
        button.title = 'VADA Chat Toolkit';
        button.addEventListener('click', openPanel);
        document.body.appendChild(button);
    }

    function createPanel() {
        if (document.getElementById(IDS.panel)) return;
        const panel = document.createElement('div');
        panel.id = IDS.panel;
        panel.innerHTML = `
<div class="vada-header"><div><span class="vada-title">⚡ VADA Chat Tools</span><span class="vada-version">Manual v4.1.1</span></div><button class="vada-close">✕</button></div>
<div class="vada-body">
<input id="vada-search" class="vada-search" placeholder="🔎 Tìm...">
<div class="vada-grid-2"><button class="vada-btn active" data-view="questions">💬 Câu hỏi</button><button class="vada-btn" data-view="code">💻 Code</button></div>
<div class="vada-stats"><span id="vada-stat-q">Chưa quét</span><span id="vada-stat-code">Chưa quét</span></div>
<div id="vada-list" class="vada-list"><div class="vada-empty">Bấm "Quét" để tạo danh sách</div></div>
<div class="vada-grid-2"><button id="vada-scan" class="vada-btn">🔎 Quét</button><button id="vada-clear-cache" class="vada-btn">🧹 Xóa danh sách</button></div>
<div class="vada-section">CODE</div>
<div class="vada-grid-2"><button id="vada-copy-last-code" class="vada-btn">📋 Copy code cuối</button><button id="vada-go-last-code" class="vada-btn">↓ Đến code cuối</button><button id="vada-collapse-code" class="vada-btn">▰ Thu gọn code</button><button id="vada-expand-code" class="vada-btn">▤ Mở code</button><button id="vada-wrap-code" class="vada-btn">↩ Xuống dòng</button><button id="vada-unwrap-code" class="vada-btn">↔ Dòng gốc</button></div>
<div class="vada-section">CHAT</div>
<div class="vada-grid-1"><button id="vada-compact-chat" class="vada-btn vada-btn-red">🔴 Thu gọn hội thoại còn 2 dòng</button></div>
<div class="vada-grid-2"><button id="vada-copy-last-answer" class="vada-btn">📋 GPT mới nhất</button><button id="vada-copy-all-questions" class="vada-btn">📋 Tất cả câu hỏi</button></div>
<div class="vada-section">PROMPT NHANH</div>
<div id="vada-prompts" class="vada-prompts"></div>
<div class="vada-grid-3"><button id="vada-top" class="vada-btn">↑ Đầu</button><button id="vada-bottom" class="vada-btn">↓ Cuối</button><button id="vada-close-bottom" class="vada-btn">✕ Ẩn</button></div>
</div>`;
        document.body.appendChild(panel);
        bindPanelEvents();
        renderPrompts();
        makeDraggable(panel);
        restorePosition(panel);
    }

    function openPanel() {
        const panel = document.getElementById(IDS.panel);
        const toggle = document.getElementById(IDS.toggle);
        if (panel) panel.style.display = 'flex';
        if (toggle) toggle.style.display = 'none';
    }

    function closePanel() {
        const panel = document.getElementById(IDS.panel);
        const toggle = document.getElementById(IDS.toggle);
        if (panel) panel.style.display = 'none';
        if (toggle) toggle.style.display = 'block';
    }

    function togglePanel() {
        const panel = document.getElementById(IDS.panel);
        if (!panel) return;
        if (panel.style.display === 'none' || getComputedStyle(panel).display === 'none') openPanel();
        else closePanel();
    }

    function getMessages() {
        const nodes = document.querySelectorAll('[data-message-author-role]');
        const output = [];
        const seen = new Set();
        nodes.forEach(node => {
            const role = node.getAttribute('data-message-author-role');
            if (role !== 'user' && role !== 'assistant') return;
            const container = node.closest('[data-testid^="conversation-turn-"]') || node.closest('article') || node;
            if (seen.has(container)) return;
            seen.add(container);
            output.push({ role, el: node, container });
        });
        return output;
    }

    function getText(el) {
        if (!el) return '';
        return (el.innerText || el.textContent || '').replace(/^You said:\s*/i, '').replace(/^Bạn đã nói:\s*/i, '').trim();
    }

    function shortText(text) {
        text = text.replace(/\s+/g, ' ').trim();
        return text.length <= CONFIG.titleLength ? text : text.slice(0, CONFIG.titleLength) + '…';
    }

    function toggleCompactChat() {
        compactChat = !compactChat;
        if (compactChat) applyCompactChat();
        else removeCompactChat();
        updateCompactButton();
    }

    function applyCompactChat() {
        const messages = getMessages();
        messages.forEach(message => {
            message.el.classList.add('vada-message-compact');
            message.el.classList.remove('vada-message-expanded');
        });
        toast(`Đã thu gọn ${messages.length} tin nhắn`);
    }

    function removeCompactChat() {
        document.querySelectorAll('.vada-message-compact').forEach(element => {
            element.classList.remove('vada-message-compact');
            element.classList.remove('vada-message-expanded');
        });
        toast('Đã mở toàn bộ hội thoại');
    }

    function updateCompactButton() {
        const button = document.getElementById('vada-compact-chat');
        if (!button) return;
        button.classList.toggle('active', compactChat);
        button.textContent = compactChat ? '🔴 Mở toàn bộ hội thoại' : '🔴 Thu gọn hội thoại còn 2 dòng';
    }

    function bindCompactMessageClick() {
        document.addEventListener('click', event => {
            if (!compactChat) return;
            const message = event.target.closest('.vada-message-compact');
            if (!message) return;
            if (event.target.closest('a, button, input, textarea, select')) return;
            const selection = window.getSelection();
            if (selection && selection.toString()) return;
            message.classList.toggle('vada-message-expanded');
        }, true);
    }

    function expandContainingMessage(element) {
        if (!compactChat || !element) return;
        const message = element.closest('[data-message-author-role]');
        if (message && message.classList.contains('vada-message-compact')) message.classList.add('vada-message-expanded');
    }

    function scanQuestions() {
        questionCache = [];
        const messages = getMessages();
        let number = 0;
        messages.forEach(message => {
            if (message.role !== 'user') return;
            number++;
            questionCache.push({ number, text: getText(message.el), element: message.container, messageElement: message.el });
        });
        updateStats();
        if (currentView === 'questions') renderQuestions();
        if (compactChat) applyCompactChat();
        toast(`Đã quét ${questionCache.length} câu hỏi`);
    }

    function scanCode() {
        codeCache = [];
        const blocks = document.querySelectorAll('[data-message-author-role="assistant"] pre');
        blocks.forEach((pre, index) => {
            const code = getCodeText(pre);
            const language = detectLanguage(pre);
            codeCache.push({ number: index + 1, code, language, lines: Math.max(1, code.split('\n').length), element: pre });
        });
        updateStats();
        if (currentView === 'code') renderCode();
        toast(`Đã quét ${codeCache.length} code`);
    }

    function scanCurrentView() {
        if (currentView === 'questions') scanQuestions();
        else scanCode();
    }

    function renderQuestions() {
        const list = document.getElementById('vada-list');
        const query = (document.getElementById('vada-search').value || '').trim().toLowerCase();
        list.innerHTML = '';
        let shown = 0;
        questionCache.forEach(item => {
            if (query && !item.text.toLowerCase().includes(query)) return;
            shown++;
            const row = document.createElement('div');
            row.className = 'vada-item';
            row.innerHTML = `<span class="vada-number">Q${item.number}</span><span class="vada-text">${escapeHTML(shortText(item.text))}</span><button class="vada-copy-small" title="Copy">📋</button>`;
            row.addEventListener('click', event => {
                if (event.target.closest('.vada-copy-small')) return;
                if (item.messageElement) item.messageElement.classList.add('vada-message-expanded');
                scrollToElement(item.element);
            });
            row.querySelector('.vada-copy-small').addEventListener('click', event => {
                event.stopPropagation();
                copyText(item.text);
                toast(`Đã copy Q${item.number}`);
            });
            list.appendChild(row);
        });
        if (!shown) list.innerHTML = `<div class="vada-empty">${questionCache.length ? 'Không tìm thấy' : 'Bấm "Quét" để tạo mục lục câu hỏi'}</div>`;
    }

    function renderCode() {
        const list = document.getElementById('vada-list');
        const query = (document.getElementById('vada-search').value || '').trim().toLowerCase();
        list.innerHTML = '';
        let shown = 0;
        codeCache.forEach(item => {
            if (query && !item.code.toLowerCase().includes(query) && !item.language.toLowerCase().includes(query)) return;
            shown++;
            const row = document.createElement('div');
            row.className = 'vada-item';
            row.innerHTML = `<span class="vada-number">C${item.number}</span><span class="vada-text"><b>${escapeHTML(item.language)} • ${item.lines} dòng</b><br>${escapeHTML(shortText(item.code))}</span><button class="vada-copy-small">📋</button>`;
            row.addEventListener('click', event => {
                if (event.target.closest('.vada-copy-small')) return;
                expandContainingMessage(item.element);
                scrollToElement(item.element);
            });
            row.querySelector('.vada-copy-small').addEventListener('click', event => {
                event.stopPropagation();
                copyText(item.code);
                toast(`Đã copy C${item.number}`);
            });
            list.appendChild(row);
        });
        if (!shown) list.innerHTML = `<div class="vada-empty">${codeCache.length ? 'Không tìm thấy' : 'Bấm "Quét" để tạo danh sách code'}</div>`;
    }

    function renderCurrentView() {
        if (currentView === 'questions') renderQuestions();
        else renderCode();
    }

    function getCodeBlocksNow() {
        return [...document.querySelectorAll('[data-message-author-role="assistant"] pre')];
    }

    function getCodeText(pre) {
        const code = pre.querySelector('code');
        return (code?.innerText || pre.innerText || '').trim();
    }

    function detectLanguage(pre) {
        const code = pre.querySelector('code');
        if (code) {
            const match = (code.className || '').match(/language-([a-zA-Z0-9_+#-]+)/);
            if (match) return match[1];
        }
        return 'code';
    }

    async function copyLatestCode() {
        const blocks = getCodeBlocksNow();
        if (!blocks.length) return toast('Không tìm thấy code');
        await copyText(getCodeText(blocks[blocks.length - 1]));
        toast('Đã copy code cuối');
    }

    function goToLatestCode() {
        const blocks = getCodeBlocksNow();
        if (!blocks.length) return toast('Không tìm thấy code');
        const latest = blocks[blocks.length - 1];
        expandContainingMessage(latest);
        scrollToElement(latest);
    }

    function collapseAllCode() {
        const blocks = getCodeBlocksNow();
        blocks.forEach(pre => pre.classList.add('vada-manual-code-collapsed'));
        toast(`Đã thu gọn ${blocks.length} code`);
    }

    function expandAllCode() {
        const blocks = getCodeBlocksNow();
        blocks.forEach(pre => pre.classList.remove('vada-manual-code-collapsed'));
        toast(`Đã mở ${blocks.length} code`);
    }

    function wrapAllCode() {
        const blocks = getCodeBlocksNow();
        blocks.forEach(pre => pre.classList.add('vada-manual-code-wrap'));
        toast('Đã bật xuống dòng');
    }

    function unwrapAllCode() {
        const blocks = getCodeBlocksNow();
        blocks.forEach(pre => pre.classList.remove('vada-manual-code-wrap'));
        toast('Đã về dòng gốc');
    }

    async function copyLatestAnswer() {
        const messages = getMessages().filter(item => item.role === 'assistant');
        if (!messages.length) return toast('Không tìm thấy câu trả lời');
        await copyText(getText(messages[messages.length - 1].el));
        toast('Đã copy GPT mới nhất');
    }

    async function copyAllQuestions() {
        const messages = getMessages().filter(item => item.role === 'user');
        if (!messages.length) return toast('Không tìm thấy câu hỏi');
        const output = messages.map((item, index) => `Q${index + 1}. ${getText(item.el)}`).join('\n\n');
        await copyText(output);
        toast(`Đã copy ${messages.length} câu hỏi`);
    }

    function updateStats() {
        const q = document.getElementById('vada-stat-q');
        const c = document.getElementById('vada-stat-code');
        if (q) q.textContent = questionCache.length ? `${questionCache.length} câu hỏi` : 'Chưa quét câu hỏi';
        if (c) c.textContent = codeCache.length ? `${codeCache.length} code` : 'Chưa quét code';
    }

    function clearCache() {
        questionCache = [];
        codeCache = [];
        updateStats();
        document.getElementById('vada-list').innerHTML = '<div class="vada-empty">Danh sách đã xóa</div>';
        toast('Đã xóa danh sách');
    }

    function renderPrompts() {
        const holder = document.getElementById('vada-prompts');
        CONFIG.quickPrompts.forEach(prompt => {
            const button = document.createElement('button');
            button.className = 'vada-btn';
            button.textContent = prompt.name;
            button.addEventListener('click', () => insertPrompt(prompt.text));
            holder.appendChild(button);
        });
    }

    function findComposer() {
        return document.querySelector('#prompt-textarea') || document.querySelector('textarea[data-id]') || document.querySelector('textarea[placeholder]') || document.querySelector('main [contenteditable="true"]');
    }

    function insertPrompt(text) {
        const composer = findComposer();
        if (!composer) return toast('Không tìm thấy ô nhập');
        composer.focus();
        if (composer.tagName === 'TEXTAREA') {
            const old = composer.value.trim();
            const finalText = old ? old + '\n\n' + text : text;
            const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
            if (descriptor?.set) descriptor.set.call(composer, finalText);
            else composer.value = finalText;
            composer.dispatchEvent(new Event('input', { bubbles: true }));
            return;
        }
        const old = (composer.innerText || '').trim();
        const finalText = old ? old + '\n\n' + text : text;
        composer.textContent = finalText;
        composer.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
        composer.focus();
        toast('Đã chèn prompt');
    }

    function bindPanelEvents() {
        const panel = document.getElementById(IDS.panel);
        panel.querySelector('.vada-close').addEventListener('click', closePanel);
        panel.querySelector('#vada-close-bottom').addEventListener('click', closePanel);
        panel.querySelectorAll('[data-view]').forEach(button => {
            button.addEventListener('click', () => {
                currentView = button.dataset.view;
                panel.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('active', b === button));
                renderCurrentView();
            });
        });
        panel.querySelector('#vada-search').addEventListener('input', renderCurrentView);
        panel.querySelector('#vada-scan').addEventListener('click', scanCurrentView);
        panel.querySelector('#vada-clear-cache').addEventListener('click', clearCache);
        panel.querySelector('#vada-copy-last-code').addEventListener('click', copyLatestCode);
        panel.querySelector('#vada-go-last-code').addEventListener('click', goToLatestCode);
        panel.querySelector('#vada-collapse-code').addEventListener('click', collapseAllCode);
        panel.querySelector('#vada-expand-code').addEventListener('click', expandAllCode);
        panel.querySelector('#vada-wrap-code').addEventListener('click', wrapAllCode);
        panel.querySelector('#vada-unwrap-code').addEventListener('click', unwrapAllCode);
        panel.querySelector('#vada-compact-chat').addEventListener('click', toggleCompactChat);
        panel.querySelector('#vada-copy-last-answer').addEventListener('click', copyLatestAnswer);
        panel.querySelector('#vada-copy-all-questions').addEventListener('click', copyAllQuestions);
        panel.querySelector('#vada-top').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
        panel.querySelector('#vada-bottom').addEventListener('click', () => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' }));
    }

    function bindKeyboard() {
        document.addEventListener('keydown', event => {
            if (!event.altKey || !event.shiftKey) return;
            const key = event.key.toLowerCase();
            if (key === 'q') { event.preventDefault(); togglePanel(); }
            if (key === 'c') { event.preventDefault(); copyLatestCode(); }
            if (key === 'f') {
                event.preventDefault();
                openPanel();
                const search = document.getElementById('vada-search');
                search.focus();
                search.select();
            }
        });
    }

    function scrollToElement(el) {
        if (!el) return;
        expandContainingMessage(el);
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('vada-highlight');
        setTimeout(() => el.classList.remove('vada-highlight'), 1200);
    }

    function makeDraggable(panel) {
        const header = panel.querySelector('.vada-header');
        let dragging = false, startX = 0, startY = 0, startLeft = 0, startTop = 0;
        header.addEventListener('mousedown', event => {
            if (event.target.closest('button')) return;
            dragging = true;
            const rect = panel.getBoundingClientRect();
            startX = event.clientX;
            startY = event.clientY;
            startLeft = rect.left;
            startTop = rect.top;
            panel.style.right = 'auto';
            event.preventDefault();
        });
        document.addEventListener('mousemove', event => {
            if (!dragging) return;
            let left = startLeft + event.clientX - startX;
            let top = startTop + event.clientY - startY;
            left = Math.max(0, Math.min(window.innerWidth - 60, left));
            top = Math.max(0, Math.min(window.innerHeight - 50, top));
            panel.style.left = left + 'px';
            panel.style.top = top + 'px';
        });
        document.addEventListener('mouseup', () => {
            if (!dragging) return;
            dragging = false;
            const rect = panel.getBoundingClientRect();
            GM_setValue('vada_manual_position', { left: rect.left, top: rect.top });
        });
    }

    function restorePosition(panel) {
        const position = GM_getValue('vada_manual_position', null);
        if (!position) return;
        if (position.left >= 0 && position.left < window.innerWidth - 50 && position.top >= 0 && position.top < window.innerHeight - 50) {
            panel.style.left = position.left + 'px';
            panel.style.top = position.top + 'px';
            panel.style.right = 'auto';
        }
    }

    async function copyText(text) {
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
        } catch (error) {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            textarea.remove();
        }
    }

    let toastTimer = null;
    function toast(text) {
        let box = document.getElementById(IDS.toast);
        if (!box) {
            box = document.createElement('div');
            box.id = IDS.toast;
            document.body.appendChild(box);
        }
        box.textContent = text;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => box.remove(), 1300);
    }

    function escapeHTML(text) {
        return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    function init() {
        injectCSS();
        createUI();
        bindKeyboard();
        bindCompactMessageClick();
        console.log('%c[VADA Chat Toolkit Manual v4.1.1] Running', 'color:#ff5555;font-weight:bold');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
