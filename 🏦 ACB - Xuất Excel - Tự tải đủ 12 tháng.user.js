// ==UserScript==
// @name         🏦 ACB | Xuất Excel | Tự tải đủ 12 tháng
// @namespace    acb-auto-export
// @version      1.3.0
// @description  Tự động chọn từng tháng và tải Excel trên ACB ONE BIZ; có chọn ô đăng nhập/mật khẩu, kiểm tra nút tải, dừng và hot-load chống cache
// @match        https://*.acb.com.vn/*
// @grant        none
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/datphuho88-dev/tampermonkey-scripts/main/%F0%9F%8F%A6%20ACB%20-%20Xu%E1%BA%A5t%20Excel%20-%20T%E1%BB%B1%20t%E1%BA%A3i%20%C4%91%E1%BB%A7%2012%20th%C3%A1ng.user.js
// @downloadURL  https://raw.githubusercontent.com/datphuho88-dev/tampermonkey-scripts/main/%F0%9F%8F%A6%20ACB%20-%20Xu%E1%BA%A5t%20Excel%20-%20T%E1%BB%B1%20t%E1%BA%A3i%20%C4%91%E1%BB%A7%2012%20th%C3%A1ng.user.js
// ==/UserScript==

(function () {
    'use strict';

    const SCRIPT_VERSION = '1.3.0';
    const RAW_URL = 'https://raw.githubusercontent.com/datphuho88-dev/tampermonkey-scripts/main/%F0%9F%8F%A6%20ACB%20-%20Xu%E1%BA%A5t%20Excel%20-%20T%E1%BB%B1%20t%E1%BA%A3i%20%C4%91%E1%BB%A7%2012%20th%C3%A1ng.user.js';
    const API_URL = 'https://api.github.com/repos/datphuho88-dev/tampermonkey-scripts/contents/%F0%9F%8F%A6%20ACB%20-%20Xu%E1%BA%A5t%20Excel%20-%20T%E1%BB%B1%20t%E1%BA%A3i%20%C4%91%E1%BB%A7%2012%20th%C3%A1ng.user.js';
    const INSTANCE_KEY = '__ACB_AUTO_EXPORT_INSTANCE__';
    const PANEL_ID = 'acb-auto-export-panel';
    const POS_KEY = 'ACB_AUTO_EXPORT_PANEL_POS';
    const LOGIN_USER_KEY = 'ACB_AUTO_LOGIN_USER_SELECTOR';
    const LOGIN_PASS_KEY = 'ACB_AUTO_LOGIN_PASS_SELECTOR';

    const DELAY_AFTER_SELECT = 900;
    const DELAY_AFTER_DOWNLOAD = 3000;

    let running = false;
    let stopRequested = false;
    let initTimer = null;
    let captureCleanup = null;

    try { window[INSTANCE_KEY]?.destroy?.(); } catch {}

    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    const normalizeText = str => (str || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const visible = el => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden';
    };

    function isUsable(el) {
        if (!el || !visible(el)) return false;
        const s = getComputedStyle(el);
        return !el.disabled &&
            el.getAttribute('aria-disabled') !== 'true' &&
            s.pointerEvents !== 'none' &&
            s.display !== 'none' &&
            s.visibility !== 'hidden';
    }

    function setStatus(message, type = 'info') {
        const el = document.querySelector('#acb-auto-status');
        if (!el) return;
        el.textContent = message;
        el.style.color = ({ info:'#374151', success:'#15803d', warning:'#b45309', error:'#dc2626' })[type] || '#374151';
    }

    async function fetchLatestSource() {
        const url = API_URL + '?ref=main&_=' + Date.now();
        const res = await fetch(url, {
            cache: 'no-store',
            credentials: 'omit',
            headers: { 'Accept': 'application/vnd.github+json' }
        });
        if (!res.ok) throw new Error(`GitHub API HTTP ${res.status}`);
        const data = await res.json();
        if (!data?.content) throw new Error('GitHub API không trả về nội dung file');
        const base64 = String(data.content).replace(/\s/g, '');
        const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
        return new TextDecoder('utf-8').decode(bytes);
    }

    async function hotReload() {
        if (running) {
            setStatus('Hãy dừng tiến trình trước khi LOAD', 'warning');
            return;
        }
        setStatus('Đang lấy code mới nhất từ GitHub API...');
        try {
            const source = await fetchLatestSource();
            const m = source.match(/\/\/\s*@version\s+([^\s]+)/);
            const remoteVersion = m?.[1] || '?';
            const runtime = source.replace(/\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==\s*/, '');
            if (!runtime.trim()) throw new Error('Không đọc được code chạy');
            setStatus(`Đã lấy v${remoteVersion} • đang chạy...`, 'success');
            setTimeout(() => {
                try { new Function(runtime)(); }
                catch (err) { console.error(err); alert('ACB LOAD lỗi: ' + err.message); }
            }, 30);
        } catch (err) {
            console.error(err);
            setStatus('LOAD thất bại: ' + err.message, 'error');
        }
    }

    function cssEscape(value) {
        if (window.CSS?.escape) return CSS.escape(String(value));
        return String(value).replace(/([ !"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1');
    }

    function buildSelector(el) {
        if (!(el instanceof Element)) return null;
        if (el.id) return '#' + cssEscape(el.id);

        const tag = el.tagName.toLowerCase();
        const name = el.getAttribute('name');
        if (name) {
            const sel = `${tag}[name="${String(name).replace(/"/g, '\\"')}"]`;
            if (document.querySelectorAll(sel).length === 1) return sel;
        }

        const type = el.getAttribute('type');
        if (tag === 'input' && type) {
            const inputs = [...document.querySelectorAll(`input[type="${cssEscape(type)}"]`)].filter(visible);
            if (inputs.length === 1) return `input[type="${cssEscape(type)}"]`;
        }

        const parts = [];
        let cur = el;
        for (let depth = 0; cur && cur !== document.body && depth < 5; depth++, cur = cur.parentElement) {
            let part = cur.tagName.toLowerCase();
            if (cur.id) {
                part = '#' + cssEscape(cur.id);
                parts.unshift(part);
                break;
            }
            const siblings = cur.parentElement ? [...cur.parentElement.children].filter(x => x.tagName === cur.tagName) : [];
            if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(cur) + 1})`;
            parts.unshift(part);
        }
        return parts.join(' > ');
    }

    function getSavedTarget(key) {
        const selector = localStorage.getItem(key);
        if (!selector) return null;
        try { return document.querySelector(selector); } catch { return null; }
    }

    function captureLoginField(kind) {
        if (captureCleanup) captureCleanup();

        const isUser = kind === 'user';
        const key = isUser ? LOGIN_USER_KEY : LOGIN_PASS_KEY;
        const label = isUser ? 'TÊN ĐĂNG NHẬP' : 'MẬT KHẨU';

        setStatus(`Bấm trực tiếp vào ô ${label} trên trang...`, 'warning');

        let hoverEl = null;
        let oldOutline = '';
        let oldOffset = '';

        const clearHover = () => {
            if (!hoverEl) return;
            hoverEl.style.outline = oldOutline;
            hoverEl.style.outlineOffset = oldOffset;
            hoverEl = null;
        };

        const onMove = e => {
            const target = e.target.closest?.('input,textarea,[contenteditable="true"]');
            if (!target || target.closest('#' + PANEL_ID)) return;
            if (target === hoverEl) return;
            clearHover();
            hoverEl = target;
            oldOutline = target.style.outline;
            oldOffset = target.style.outlineOffset;
            target.style.outline = '4px solid #f59e0b';
            target.style.outlineOffset = '2px';
        };

        const onClick = e => {
            const target = e.target.closest?.('input,textarea,[contenteditable="true"]');
            if (!target || target.closest('#' + PANEL_ID)) return;

            e.preventDefault();
            e.stopPropagation();

            const selector = buildSelector(target);
            if (!selector) {
                setStatus(`Không tạo được selector cho ô ${label}`, 'error');
                cleanup();
                return;
            }

            if (!isUser && target instanceof HTMLInputElement && target.type !== 'password') {
                setStatus('Ô đã chọn không phải input type=password; vẫn đã lưu selector', 'warning');
            } else {
                setStatus(`Đã lưu ô ${label}`, 'success');
            }

            localStorage.setItem(key, selector);
            flashElement(target, isUser ? '#2563eb' : '#7c3aed', label);
            cleanup();
        };

        const onKey = e => {
            if (e.key === 'Escape') {
                setStatus('Đã hủy chọn thành phần', 'warning');
                cleanup();
            }
        };

        function cleanup() {
            clearHover();
            document.removeEventListener('mousemove', onMove, true);
            document.removeEventListener('click', onClick, true);
            document.removeEventListener('keydown', onKey, true);
            if (captureCleanup === cleanup) captureCleanup = null;
        }

        captureCleanup = cleanup;
        setTimeout(() => {
            document.addEventListener('mousemove', onMove, true);
            document.addEventListener('click', onClick, true);
            document.addEventListener('keydown', onKey, true);
        }, 120);
    }

    function testSavedLoginFields() {
        const user = getSavedTarget(LOGIN_USER_KEY);
        const pass = getSavedTarget(LOGIN_PASS_KEY);
        let found = 0;
        if (flashElement(user, '#2563eb', 'TÊN ĐĂNG NHẬP')) found++;
        if (flashElement(pass, '#7c3aed', 'MẬT KHẨU')) found++;
        setStatus(`Kiểm tra đăng nhập: tìm thấy ${found}/2`, found === 2 ? 'success' : 'warning');
    }

    function findSelectByLabel(labelText) {
        const wanted = normalizeText(labelText);
        const allElements = document.querySelectorAll('td, div, span, label, p');
        for (const el of allElements) {
            const t = normalizeText(el.innerText);
            if (t !== wanted && !t.startsWith(wanted + ' ') && !t.startsWith(wanted + ':')) continue;
            const own = el.querySelector('select');
            if (own && visible(own)) return own;
            let parent = el.parentElement;
            for (let i = 0; parent && i < 4; i++, parent = parent.parentElement) {
                const select = [...parent.querySelectorAll('select')].find(visible);
                if (select) return select;
            }
        }
        return null;
    }

    function findMonthSelect() {
        for (const s of document.querySelectorAll('select')) {
            if (!visible(s)) continue;
            const opts = [...s.options].map(o => o.text.trim());
            let count = 0;
            for (let m = 1; m <= 12; m++) if (opts.includes(String(m).padStart(2, '0'))) count++;
            if (count >= 10) return s;
        }
        return findSelectByLabel('Tháng');
    }

    function findYearSelect() {
        for (const s of document.querySelectorAll('select')) {
            if (!visible(s)) continue;
            const years = [...s.options].filter(o => /^20\d{2}$/.test(o.text.trim()));
            if (years.length >= 2) return s;
        }
        return findSelectByLabel('Năm');
    }

    function findExportButton() {
        const candidates = [...document.querySelectorAll('input[type="button"],input[type="submit"],button,a')]
            .filter(el => {
                if (!isUsable(el)) return false;
                const t = normalizeText(el.innerText || el.value || el.title);
                return t.includes('xuất excel') || t.includes('xuat excel');
            });
        if (!candidates.length) return null;
        if (candidates.length === 1) return candidates[0];
        return candidates.sort((a, b) => b.getBoundingClientRect().left - a.getBoundingClientRect().left)[0];
    }

    function flashElement(el, color, label) {
        if (!el) return false;
        const oldOutline = el.style.outline;
        const oldOutlineOffset = el.style.outlineOffset;
        el.style.outline = `4px solid ${color}`;
        el.style.outlineOffset = '2px';
        try { el.scrollIntoView({ block:'center', inline:'nearest', behavior:'smooth' }); } catch {}
        setTimeout(() => {
            el.style.outline = oldOutline;
            el.style.outlineOffset = oldOutlineOffset;
        }, 3000);
        console.log('[ACB AUTO] ' + label, el);
        return true;
    }

    function verifyExportButton(showAlert = false) {
        const btn = findExportButton();
        if (!btn) {
            setStatus('Nút XUẤT EXCEL chưa sẵn sàng hoặc đang bị khóa', 'error');
            if (showAlert) alert('Không tìm thấy nút XUẤT EXCEL đang sẵn sàng để bấm.');
            return false;
        }
        flashElement(btn, '#16a34a', 'XUẤT EXCEL SẴN SÀNG');
        setStatus('Nút XUẤT EXCEL sẵn sàng', 'success');
        return true;
    }

    function testElements() {
        const month = findMonthSelect();
        const year = findYearSelect();
        const excel = findExportButton();
        let found = 0;
        if (flashElement(month, '#2563eb', 'THÁNG')) found++;
        if (flashElement(year, '#16a34a', 'NĂM')) found++;
        if (flashElement(excel, '#dc2626', 'XUẤT EXCEL')) found++;
        setStatus(`Kiểm tra thành phần: tìm thấy ${found}/3`, found === 3 ? 'success' : 'warning');
    }

    function setSelectValue(select, wantedValue) {
        if (!select) return false;
        const wanted = String(wantedValue);
        const padded = /^\d+$/.test(wanted) ? wanted.padStart(2, '0') : wanted;
        const option = [...select.options].find(o =>
            o.value === wanted || o.text.trim() === wanted || o.value === padded || o.text.trim() === padded
        );
        if (!option) return false;
        select.value = option.value;
        select.dispatchEvent(new Event('input', { bubbles:true }));
        select.dispatchEvent(new Event('change', { bubbles:true }));
        return true;
    }

    async function waitForExportButton(timeout = 8000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            const btn = findExportButton();
            if (btn && isUsable(btn)) return btn;
            await sleep(150);
        }
        return null;
    }

    function updateButtons() {
        const start = document.querySelector('#acb-auto-start');
        const stop = document.querySelector('#acb-auto-stop');
        if (start) { start.disabled = running; start.style.opacity = running ? '.55' : '1'; }
        if (stop) { stop.disabled = !running; stop.style.opacity = running ? '1' : '.45'; }
    }

    function stopExport() {
        if (!running) return;
        stopRequested = true;
        setStatus('Đang dừng sau bước hiện tại...', 'warning');
    }

    async function startExport() {
        if (running) return;
        const monthSelect = findMonthSelect();
        const yearSelect = findYearSelect();
        const exportButton = findExportButton();
        if (!monthSelect) return alert('Không tìm thấy ô chọn THÁNG.');
        if (!yearSelect) return alert('Không tìm thấy ô chọn NĂM.');
        if (!exportButton) return alert('Không tìm thấy nút XUẤT EXCEL đang sẵn sàng.');

        const currentYear = [...yearSelect.options].find(o => o.value === yearSelect.value)?.text.trim() || new Date().getFullYear();
        const year = prompt('Nhập năm cần tải đủ 12 tháng:', currentYear);
        if (!year) return;
        const yearExists = [...yearSelect.options].some(o => o.text.trim() === String(year) || o.value === String(year));
        if (!yearExists) return alert('Không tìm thấy năm ' + year + ' trong danh sách.');
        if (!confirm(`Sẽ tải Excel từ tháng 01 đến tháng 12 năm ${year}.\n\nTiếp tục?`)) return;

        running = true;
        stopRequested = false;
        updateButtons();
        try {
            setStatus(`Đang chọn năm ${year}...`);
            setSelectValue(yearSelect, year);
            await sleep(700);
            let completed = 0;
            for (let month = 1; month <= 12 && !stopRequested; month++) {
                const mm = String(month).padStart(2, '0');
                setStatus(`Đang tải ${mm}/${year} • ${month}/12`);
                const monthOK = setSelectValue(monthSelect, mm) || setSelectValue(monthSelect, month);
                if (!monthOK) { console.warn('[ACB AUTO] Không chọn được tháng', mm); continue; }
                await sleep(DELAY_AFTER_SELECT);
                if (stopRequested) break;

                const btn = await waitForExportButton();
                if (!btn) throw new Error('Nút Xuất Excel chưa sẵn sàng tại tháng ' + mm);

                if (!isUsable(btn)) throw new Error('Nút Xuất Excel bị khóa tại tháng ' + mm);
                btn.click();

                completed++;
                await sleep(DELAY_AFTER_DOWNLOAD);
            }
            if (stopRequested) setStatus('Đã dừng', 'warning');
            else setStatus(`Hoàn tất ${completed}/12 tháng năm ${year}`, 'success');
        } catch (err) {
            console.error(err);
            setStatus('Lỗi: ' + err.message, 'error');
            alert('Có lỗi:\n' + err.message);
        } finally {
            running = false;
            stopRequested = false;
            updateButtons();
        }
    }

    function makeButton(text, id, bg, onClick) {
        const b = document.createElement('button');
        b.id = id;
        b.type = 'button';
        b.textContent = text;
        b.style.cssText = `border:0;border-radius:7px;padding:7px 10px;cursor:pointer;background:${bg};color:#fff;font-size:12px;font-weight:700;white-space:nowrap`;
        b.addEventListener('click', onClick);
        return b;
    }

    function restorePosition(panel) {
        try {
            const p = JSON.parse(localStorage.getItem(POS_KEY) || 'null');
            if (!p || typeof p.left !== 'number' || typeof p.top !== 'number') return;
            const maxLeft = Math.max(0, innerWidth - panel.offsetWidth);
            const maxTop = Math.max(0, innerHeight - 45);
            panel.style.left = Math.min(Math.max(0, p.left), maxLeft) + 'px';
            panel.style.top = Math.min(Math.max(0, p.top), maxTop) + 'px';
            panel.style.right = 'auto';
            panel.style.bottom = 'auto';
        } catch {}
    }

    function makeDraggable(panel, handle) {
        handle.style.cursor = 'move';
        handle.title = 'Giữ và kéo để di chuyển hộp';
        handle.addEventListener('mousedown', e => {
            if (e.button !== 0 || e.target.closest('button')) return;
            e.preventDefault();
            const r = panel.getBoundingClientRect();
            const sx = e.clientX, sy = e.clientY, sl = r.left, st = r.top;
            panel.style.left = sl + 'px';
            panel.style.top = st + 'px';
            panel.style.right = 'auto';
            panel.style.bottom = 'auto';

            const move = ev => {
                const maxLeft = Math.max(0, innerWidth - panel.offsetWidth);
                const maxTop = Math.max(0, innerHeight - 45);
                panel.style.left = Math.min(Math.max(0, sl + ev.clientX - sx), maxLeft) + 'px';
                panel.style.top = Math.min(Math.max(0, st + ev.clientY - sy), maxTop) + 'px';
            };
            const up = () => {
                document.removeEventListener('mousemove', move);
                document.removeEventListener('mouseup', up);
                const q = panel.getBoundingClientRect();
                localStorage.setItem(POS_KEY, JSON.stringify({ left:Math.round(q.left), top:Math.round(q.top) }));
            };
            document.addEventListener('mousemove', move);
            document.addEventListener('mouseup', up);
        });
    }

    function createPanel() {
        document.querySelector('#' + PANEL_ID)?.remove();

        const panel = document.createElement('div');
        panel.id = PANEL_ID;
        panel.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:2147483647;width:310px;padding:10px;background:#fff;border:1px solid #cbd5e1;border-radius:10px;box-shadow:0 5px 18px rgba(0,0,0,.25);font-family:Arial,sans-serif;color:#111827;user-select:none';

        const head = document.createElement('div');
        head.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px';
        const title = document.createElement('div');
        title.innerHTML = `<b>🏦 ACB Auto Excel</b> <span style="font-size:10px;background:#eef2ff;color:#3730a3;padding:2px 5px;border-radius:8px">v${SCRIPT_VERSION}</span>`;
        const load = makeButton('↻ LOAD', 'acb-auto-load', '#0f766e', hotReload);
        load.title = 'Lấy code mới nhất qua GitHub API và chạy lại ngay';
        head.append(title, load);

        const loginTools = document.createElement('div');
        loginTools.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px';
        const pickUser = makeButton('👤 Chọn tên đăng nhập', 'acb-auto-pick-user', '#2563eb', () => captureLoginField('user'));
        const pickPass = makeButton('🔑 Chọn mật khẩu', 'acb-auto-pick-pass', '#7c3aed', () => captureLoginField('pass'));
        loginTools.append(pickUser, pickPass);

        const loginCheck = document.createElement('div');
        loginCheck.style.cssText = 'display:flex;gap:6px;margin-bottom:6px';
        const checkLogin = makeButton('🔐 Kiểm tra ô đăng nhập', 'acb-auto-check-login', '#475569', testSavedLoginFields);
        checkLogin.style.flex = '1';
        loginCheck.append(checkLogin);

        const actions = document.createElement('div');
        actions.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap';
        const start = makeButton('⬇ Tải đủ 12 tháng', 'acb-auto-start', '#2868b2', startExport);
        const stop = makeButton('⏹ Dừng', 'acb-auto-stop', '#dc2626', stopExport);
        actions.append(start, stop);

        const tools = document.createElement('div');
        tools.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px';
        const test = makeButton('🔍 Kiểm tra thành phần', 'acb-auto-test', '#4b5563', testElements);
        const checkDownload = makeButton('✅ Kiểm tra nút tải', 'acb-auto-check-download', '#15803d', () => verifyExportButton(true));
        tools.append(test, checkDownload);

        const status = document.createElement('div');
        status.id = 'acb-auto-status';
        status.textContent = `Sẵn sàng • v${SCRIPT_VERSION}`;
        status.style.cssText = 'margin-top:8px;padding-top:7px;border-top:1px solid #e5e7eb;font-size:11px;font-weight:600';

        const help = document.createElement('div');
        help.textContent = 'Chọn ô đăng nhập/mật khẩu chỉ lưu vị trí thành phần, không lưu nội dung mật khẩu. Trước mỗi lần tải, script tự kiểm tra lại nút Xuất Excel.';
        help.style.cssText = 'margin-top:5px;font-size:10px;color:#6b7280;line-height:1.35';

        panel.append(head, loginTools, loginCheck, actions, tools, status, help);
        document.body.appendChild(panel);
        restorePosition(panel);
        makeDraggable(panel, head);
        updateButtons();
    }

    function destroy() {
        stopRequested = true;
        running = false;
        if (captureCleanup) captureCleanup();
        if (initTimer) clearTimeout(initTimer);
        document.querySelector('#' + PANEL_ID)?.remove();
    }

    window[INSTANCE_KEY] = {
        version:SCRIPT_VERSION,
        destroy,
        hotReload,
        testElements,
        testSavedLoginFields,
        verifyExportButton
    };

    initTimer = setTimeout(createPanel, 300);
})();