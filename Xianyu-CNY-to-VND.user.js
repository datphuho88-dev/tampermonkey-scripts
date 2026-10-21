// ==UserScript==
// @name         🛒 Xianyu - Tự đổi giá CNY sang VNĐ
// @namespace    https://github.com/datphuho88-dev/tampermonkey-scripts
// @version      1.0.0
// @description  Hiển thị giá VND cạnh giá Nhân dân tệ trên Xianyu/Goofish; tự cập nhật tỷ giá và sản phẩm.
// @author       datphuho88-dev
// @match        https://www.goofish.com/*
// @match        https://goofish.com/*
// @match        https://www.xianyu.com/*
// @match        https://xianyu.com/*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @connect      open.er-api.com
// @updateURL    https://raw.githubusercontent.com/datphuho88-dev/tampermonkey-scripts/main/Xianyu-CNY-to-VND.user.js
// @downloadURL  https://raw.githubusercontent.com/datphuho88-dev/tampermonkey-scripts/main/Xianyu-CNY-to-VND.user.js
// ==/UserScript==

(function () {
    'use strict';

    const APP = '__xianyuCnyToVnd';
    if (window[APP] && typeof window[APP].destroy === 'function') {
        window[APP].destroy();
    }

    const VERSION = '1.0.0';
    const CACHE_KEY = 'xianyu_vnd_rate_v1';
    const REFRESH_MS = 12 * 60 * 60 * 1000;
    const MAX_OLD_RATE_MS = 7 * 24 * 60 * 60 * 1000;
    const priceNodes = new Map();
    const formatter = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
    let destroyed = false;
    let timer = null;
    let request = null;
    let observer = null;
    let panel = null;
    let rate = 0;
    let updatedAt = 0;
    let rateMessage = '';
    let loading = false;

    try {
        const saved = GM_getValue(CACHE_KEY, null);
        if (saved && Number.isFinite(saved.rate) && saved.rate > 0 &&
            Number.isFinite(saved.timestamp) && Date.now() - saved.timestamp < MAX_OLD_RATE_MS) {
            rate = saved.rate;
            updatedAt = saved.timestamp;
        }
    } catch (e) {
        console.warn('[Xianyu VND] Không đọc được tỷ giá lưu:', e);
    }

    GM_addStyle([
        '#xvnd-panel{position:fixed;right:14px;bottom:16px;z-index:2147483646;',
        'box-sizing:border-box;max-width:280px;padding:10px 12px;border:1px solid #303030;',
        'border-radius:11px;background:#000!important;color:#fff!important;',
        'box-shadow:0 4px 20px #0007;font:12px/1.45 Arial,sans-serif!important;}',
        '#xvnd-panel *{box-sizing:border-box;}',
        '#xvnd-panel .xvnd-head{display:flex;gap:9px;align-items:center;}',
        '#xvnd-panel strong{font-size:13px;color:#fff;}',
        '#xvnd-panel button{background:#171717;color:#fff;border:1px solid #444;',
        'border-radius:6px;padding:3px 8px;font-size:14px;cursor:pointer;}',
        '#xvnd-panel button:hover{background:#333;}',
        '#xvnd-panel .xvnd-rate{margin-top:4px;color:#d1d5db;font-size:11px;}',
        '#xvnd-panel a{font-size:10px;color:#777;text-decoration:none;}',
        '.xvnd-converted{display:inline-block;white-space:nowrap;vertical-align:baseline;',
        'margin:1px 5px 1px 4px;padding:1px 4px;border-radius:3px;',
        'background:#000!important;color:#fff!important;',
        'font:600 12px/1.4 Arial,sans-serif!important;letter-spacing:0!important;}'
    ].join(''));

    function showPanel() {
        if (!document.body || destroyed) return;
        panel = document.createElement('section');
        panel.id = 'xvnd-panel';
        panel.innerHTML = [
            '<div class="xvnd-head">',
            '<strong>¥ → VNĐ</strong>',
            '<span style="flex:1"></span>',
            '<button type="button" id="xvnd-refresh" title="Lấy tỷ giá mới">↻</button>',
            '<span style="font-size:10px;color:#888">v', VERSION, '</span>',
            '</div>',
            '<div class="xvnd-rate" id="xvnd-rate"></div>',
            '<a href="https://www.exchangerate-api.com" target="_blank" rel="noopener noreferrer">',
            'Tỷ giá: ExchangeRate-API</a>'
        ].join('');
        document.body.appendChild(panel);
        panel.querySelector('#xvnd-refresh').addEventListener('click', function () {
            fetchRate(true);
        });
        updatePanel();
    }

    function updatePanel() {
        if (!panel || !panel.isConnected) return;
        const rateLine = panel.querySelector('#xvnd-rate');
        const btn = panel.querySelector('#xvnd-refresh');
        btn.disabled = loading;
        rateLine.textContent = rate > 0
            ? '¥1 ≈ ' + formatter.format(rate) + ' ₫' +
                (Date.now() - updatedAt >= REFRESH_MS ? ' (tỷ giá đã lưu)' : '') +
                (loading ? ' · đang cập nhật…' : '') +
                (rateMessage ? ' · ' + rateMessage : '')
            : (loading ? 'Đang lấy tỷ giá CNY/VND…' :
                rateMessage || 'Chưa có tỷ giá. Bấm ↻ để thử lại.');
    }

    function renderConverted(node, rec) {
        if (!rate || destroyed) return;
        rec.badge.textContent = formatter.format(Math.round(rec.amount * rate)) + ' ₫';
        rec.badge.title = 'Quy đổi từ ¥' + rec.amount + ' với tỷ giá 1 CNY = ' +
            formatter.format(rate) + ' VND; giá tham khảo, chưa gồm phí.';
        if (!rec.badge.isConnected) node.insertAdjacentElement('afterend', rec.badge);
    }

    function candidate(textNode) {
        let el = textNode.parentElement;
        for (let depth = 0; el && depth < 5; depth++, el = el.parentElement) {
            if (el === document.body || el.id === 'xvnd-panel') break;
            const fullText = (el.textContent || '').trim();
            if (fullText.length > 75) break;
            const match = fullText.match(/^[¥￥]\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/);
            if (match) {
                const amount = Number(match[1].replace(/,/g, ''));
                if (Number.isFinite(amount) && amount > 0 && amount < 1000000000) {
                    return { node: el, amount: amount };
                }
            }
        }
        return null;
    }

    function scan() {
        if (destroyed || !rate || !document.body) return;
        const seen = new Set();
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
            acceptNode: function (n) {
                if (!/[¥￥]/.test(n.nodeValue || '')) return NodeFilter.FILTER_REJECT;
                const parent = n.parentElement;
                if (!parent || parent.closest('#xvnd-panel, .xvnd-converted, script, style, textarea, select, option, [contenteditable="true"]')) {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        });
        let textNode;
        while ((textNode = walker.nextNode())) {
            const found = candidate(textNode);
            if (!found) continue;
            const node = found.node;
            if (seen.has(node)) continue;
            seen.add(node);
            let rec = priceNodes.get(node);
            if (!rec) {
                const badge = document.createElement('span');
                badge.className = 'xvnd-converted';
                badge.setAttribute('data-xvnd-badge', '');
                rec = { badge: badge, amount: found.amount };
                priceNodes.set(node, rec);
            } else {
                rec.amount = found.amount;
            }
            renderConverted(node, rec);
        }
        for (const [node, rec] of priceNodes) {
            if (!node.isConnected || !seen.has(node)) {
                rec.badge.remove();
                priceNodes.delete(node);
            }
        }
    }

    function scheduleScan() {
        if (destroyed || timer !== null) return;
        timer = setTimeout(function () {
            timer = null;
            scan();
        }, 160);
    }

    function fetchRate(force) {
        if (destroyed || loading) return;
        if (!force && rate && Date.now() - updatedAt < REFRESH_MS) {
            scan();
            return;
        }
        loading = true;
        rateMessage = '';
        updatePanel();
        const url = 'https://open.er-api.com/v6/latest/CNY?_=' + Date.now();
        request = GM_xmlhttpRequest({
            method: 'GET',
            url: url,
            timeout: 12000,
            headers: { 'Cache-Control': 'no-cache' },
            onload: function (response) {
                if (destroyed) return;
                try {
                    const data = JSON.parse(response.responseText);
                    const freshRate = Number(data && data.rates && data.rates.VND);
                    if (response.status !== 200 || data.result !== 'success' ||
                        !Number.isFinite(freshRate) || freshRate <= 0) {
                        throw new Error('Dữ liệu tỷ giá không hợp lệ');
                    }
                    rate = freshRate;
                    updatedAt = Date.now();
                    try {
                        GM_setValue(CACHE_KEY, { rate: rate, timestamp: updatedAt });
                    } catch (e) {
                        console.warn('[Xianyu VND] Không lưu được tỷ giá:', e);
                    }
                    rateMessage = '';
                    loading = false;
                    request = null;
                    updatePanel();
                    scan();
                } catch (err) {
                    failure(err);
                }
            },
            onerror: function () { failure(new Error('Lỗi mạng')); },
            ontimeout: function () { failure(new Error('Hết thời gian tải')); }
        });
    }

    function failure(err) {
        if (destroyed) return;
        loading = false;
        request = null;
        rateMessage = rate ? 'Không lấy được tỷ giá mới' : 'Không lấy được tỷ giá. Bấm ↻';
        console.warn('[Xianyu VND]', err);
        updatePanel();
        if (rate) scan();
    }

    function onVisibility() {
        if (document.visibilityState === 'visible') fetchRate(false);
    }

    function start() {
        if (destroyed || !document.body) return;
        showPanel();
        observer = new MutationObserver(function (mutations) {
            const hasSiteChanges = mutations.some(function (m) {
                const el = m.target.nodeType === 1 ? m.target : m.target.parentElement;
                if (el && el.closest('#xvnd-panel, .xvnd-converted')) return false;
                if (m.type === 'childList') {
                    const changes = Array.from(m.addedNodes).concat(Array.from(m.removedNodes));
                    if (changes.length && changes.every(function (n) {
                        return n.nodeType === 1 && n.matches && n.matches('#xvnd-panel, .xvnd-converted');
                    })) return false;
                }
                return true;
            });
            if (hasSiteChanges) scheduleScan();
        });
        observer.observe(document.documentElement, {
            childList: true, subtree: true, characterData: true
        });
        document.addEventListener('visibilitychange', onVisibility);
        scan();
        fetchRate(false);
    }

    window[APP] = {
        destroy: function () {
            destroyed = true;
            if (observer) observer.disconnect();
            if (timer !== null) clearTimeout(timer);
            if (request && typeof request.abort === 'function') request.abort();
            document.removeEventListener('visibilitychange', onVisibility);
            for (const rec of priceNodes.values()) rec.badge.remove();
            priceNodes.clear();
            if (panel) panel.remove();
            if (window[APP] === this) delete window[APP];
        }
    };

    if (document.body) start();
    else document.addEventListener('DOMContentLoaded', start, { once: true });
})();
