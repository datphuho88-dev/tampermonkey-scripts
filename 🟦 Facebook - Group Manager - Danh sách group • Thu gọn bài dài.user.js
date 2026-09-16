// ==UserScript==
// @name         🟦 Facebook - Group Manager - Danh sách group • Thu gọn bài dài
// @namespace    https://github.com/datphuho88-dev/tampermonkey-scripts
// @version      1.3.1
// @description  Quản lý danh sách group Facebook, thu gọn bài dài, ẩn ảnh duyệt bài, kéo panel và hot reload từ GitHub.
// @author       VADA
// @match        https://www.facebook.com/*
// @match        https://facebook.com/*
// @updateURL    https://raw.githubusercontent.com/datphuho88-dev/tampermonkey-scripts/main/%F0%9F%9F%A6%20Facebook%20-%20Group%20Manager%20-%20Danh%20s%C3%A1ch%20group%20%E2%80%A2%20Thu%20g%E1%BB%8Dn%20b%C3%A0i%20d%C3%A0i.user.js
// @downloadURL  https://raw.githubusercontent.com/datphuho88-dev/tampermonkey-scripts/main/%F0%9F%9F%A6%20Facebook%20-%20Group%20Manager%20-%20Danh%20s%C3%A1ch%20group%20%E2%80%A2%20Thu%20g%E1%BB%8Dn%20b%C3%A0i%20d%C3%A0i.user.js
// @grant        GM_xmlhttpRequest
// @connect      raw.githubusercontent.com
// @run-at       document-idle
// ==/UserScript==

(() => {
  'use strict';

  const VERSION = '1.3.1';
  const RAW_URL = 'https://raw.githubusercontent.com/datphuho88-dev/tampermonkey-scripts/main/%F0%9F%9F%A6%20Facebook%20-%20Group%20Manager%20-%20Danh%20s%C3%A1ch%20group%20%E2%80%A2%20Thu%20g%E1%BB%8Dn%20b%C3%A0i%20d%C3%A0i.user.js';
  const STORAGE_KEY = 'vada_fb_group_manager_groups_v1';
  const POS_KEY = 'vada_fb_group_manager_position_v1';
  const IMAGE_HIDE_KEY = 'vada_fb_hide_review_images_v1';
  const PANEL_ID = 'vada-fb-group-manager';
  const STYLE_ID = 'vada-fb-group-manager-style';
  const IMAGE_STYLE_ID = 'vada-fb-image-hide-style';
  const ARTICLE_ATTR = 'data-vada-fb-article-ready';
  const TARGET_ATTR = 'data-vada-fb-collapse-target';
  const MEDIA_BOX_ATTR = 'data-vada-fb-media-box-hidden';
  const MAX_LINES = 3;
  const MIN_TEXT_LENGTH = 120;

  let observer = null;
  let scanTimer = 0;
  let toastTimer = 0;
  let dragMoveHandler = null;
  let dragUpHandler = null;
  let hideImages = loadImageHideState();

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];

  function loadGroups() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(data) ? data : [];
    } catch (_) { return []; }
  }

  function saveGroups(groups) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
  }

  function loadImageHideState() {
    const saved = localStorage.getItem(IMAGE_HIDE_KEY);
    if (saved === '1') return true;
    if (saved === '0') return false;
    return /\/groups\/[^/]+\/(pending_posts|manage|admin_activities|reported|quality)/i.test(location.pathname);
  }

  function normalizeUrl(url) {
    try {
      const u = new URL(url, location.origin);
      u.search = '';
      u.hash = '';
      return u.href.replace(/\/$/, '');
    } catch (_) { return url; }
  }

  function getCurrentGroup() {
    const match = location.pathname.match(/^\/groups\/([^/?#]+)/i);
    if (!match) return null;
    const url = normalizeUrl(`${location.origin}/groups/${match[1]}`);
    let name = $('h1')?.textContent?.trim() || '';
    if (!name) name = document.title.replace(/\s*\|\s*Facebook\s*$/i, '').trim();
    return { name: name || `Group ${match[1]}`, url, id: match[1] };
  }

  function addCurrentGroup() {
    const group = getCurrentGroup();
    if (!group) return showToast('Hãy mở một group Facebook trước.');
    const groups = loadGroups();
    const index = groups.findIndex(item => normalizeUrl(item.url) === group.url);
    if (index >= 0) groups[index] = { ...groups[index], ...group };
    else groups.unshift(group);
    saveGroups(groups);
    renderGroupList();
    showToast(index >= 0 ? 'Đã cập nhật group.' : 'Đã lưu group.');
  }

  function removeGroup(url) {
    const target = normalizeUrl(url);
    saveGroups(loadGroups().filter(item => normalizeUrl(item.url) !== target));
    renderGroupList();
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function renderGroupList() {
    const box = $('#vada-fb-group-list');
    if (!box) return;
    const groups = loadGroups();
    if (!groups.length) {
      box.innerHTML = '<div class="vada-fb-empty">Chưa lưu group nào.</div>';
      return;
    }
    box.innerHTML = groups.map((group, index) => `
      <div class="vada-fb-group-row">
        <button class="vada-fb-group-open" data-url="${escapeHtml(group.url)}" title="Mở group">
          <span class="vada-fb-group-index">${index + 1}</span>
          <span class="vada-fb-group-name">${escapeHtml(group.name || group.url)}</span>
        </button>
        <button class="vada-fb-group-delete" data-url="${escapeHtml(group.url)}" title="Xóa">×</button>
      </div>`).join('');
  }

  function loadPosition(panel) {
    try {
      const pos = JSON.parse(localStorage.getItem(POS_KEY) || 'null');
      if (!pos || !Number.isFinite(pos.left) || !Number.isFinite(pos.top)) return;
      panel.style.left = `${Math.max(0, Math.min(pos.left, innerWidth - 80))}px`;
      panel.style.top = `${Math.max(0, Math.min(pos.top, innerHeight - 40))}px`;
      panel.style.right = 'auto';
    } catch (_) {}
  }

  function savePosition(panel) {
    const r = panel.getBoundingClientRect();
    localStorage.setItem(POS_KEY, JSON.stringify({ left: Math.round(r.left), top: Math.round(r.top) }));
  }

  function enableDrag(panel) {
    const header = $('.vada-fb-header', panel);
    if (!header) return;
    header.addEventListener('pointerdown', event => {
      if (event.button !== 0 || event.target.closest('button')) return;
      event.preventDefault();
      const r = panel.getBoundingClientRect();
      const dx = event.clientX - r.left;
      const dy = event.clientY - r.top;
      panel.style.right = 'auto';
      dragMoveHandler = e => {
        const left = Math.max(0, Math.min(e.clientX - dx, innerWidth - panel.offsetWidth));
        const top = Math.max(0, Math.min(e.clientY - dy, innerHeight - 34));
        panel.style.left = `${left}px`;
        panel.style.top = `${top}px`;
      };
      dragUpHandler = () => {
        savePosition(panel);
        window.removeEventListener('pointermove', dragMoveHandler, true);
        window.removeEventListener('pointerup', dragUpHandler, true);
        dragMoveHandler = dragUpHandler = null;
      };
      window.addEventListener('pointermove', dragMoveHandler, true);
      window.addEventListener('pointerup', dragUpHandler, true);
    });
  }

  function loadLatest() {
    const btn = $('#vada-fb-load');
    if (btn) { btn.disabled = true; btn.textContent = '↻ ...'; }
    GM_xmlhttpRequest({
      method: 'GET',
      url: `${RAW_URL}?_=${Date.now()}`,
      headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
      onload(res) {
        try {
          if (res.status < 200 || res.status >= 300 || !res.responseText) throw new Error(`HTTP ${res.status}`);
          const runner = new Function('GM_xmlhttpRequest', res.responseText);
          cleanup();
          runner(GM_xmlhttpRequest);
        } catch (err) {
          console.error('[VADA FB] LOAD lỗi:', err);
          if (btn?.isConnected) { btn.disabled = false; btn.textContent = '↻ LOAD'; }
          showToast(`LOAD lỗi: ${err.message}`);
        }
      },
      onerror() {
        if (btn?.isConnected) { btn.disabled = false; btn.textContent = '↻ LOAD'; }
        showToast('Không tải được code từ GitHub.');
      }
    });
  }

  function createPanel() {
    document.getElementById(PANEL_ID)?.remove();
    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <div class="vada-fb-header" title="Giữ và kéo để di chuyển">
        <span>🟦 FB GROUP</span>
        <div class="vada-fb-header-actions"><span class="vada-fb-version">v${VERSION}</span><button id="vada-fb-toggle">−</button></div>
      </div>
      <div id="vada-fb-panel-body">
        <button id="vada-fb-add-current" class="vada-fb-primary">＋ Lưu group hiện tại</button>
        <div class="vada-fb-section-title">📌 DANH SÁCH GROUP</div>
        <div id="vada-fb-group-list"></div>
        <div class="vada-fb-section-title">📑 ĐỌC NHANH BÀI DÀI</div>
        <div class="vada-fb-status">Bài dài tự thu gọn còn ${MAX_LINES} dòng.</div>
        <button id="vada-fb-rescan" class="vada-fb-secondary">↻ Quét lại bài viết</button>
        <button id="vada-fb-hide-images" class="vada-fb-secondary"></button>
        <button id="vada-fb-load" class="vada-fb-load">↻ LOAD</button>
      </div>`;
    document.body.appendChild(panel);
    loadPosition(panel);
    enableDrag(panel);
    renderGroupList();
    updateImageButton();

    panel.addEventListener('click', event => {
      const open = event.target.closest('.vada-fb-group-open');
      if (open) return void (location.href = open.dataset.url);
      const del = event.target.closest('.vada-fb-group-delete');
      if (del) return removeGroup(del.dataset.url);
      if (event.target.closest('#vada-fb-add-current')) return addCurrentGroup();
      if (event.target.closest('#vada-fb-rescan')) {
        resetCollapsedPosts();
        scanPosts();
        applyImageHiding();
        return showToast('Đã quét lại bài viết.');
      }
      if (event.target.closest('#vada-fb-hide-images')) {
        setHideImages(!hideImages);
        return;
      }
      if (event.target.closest('#vada-fb-load')) return loadLatest();
      if (event.target.closest('#vada-fb-toggle')) {
        const body = $('#vada-fb-panel-body', panel);
        const toggle = $('#vada-fb-toggle', panel);
        const hidden = body.style.display === 'none';
        body.style.display = hidden ? '' : 'none';
        toggle.textContent = hidden ? '−' : '+';
      }
    });
  }

  function addStyles() {
    document.getElementById(STYLE_ID)?.remove();
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${PANEL_ID}{position:fixed;top:88px;right:14px;z-index:2147483646;width:260px;max-height:calc(100vh - 40px);overflow:hidden;background:#fff;color:#1c1e21;border:1px solid #ccd0d5;border-radius:10px;box-shadow:0 4px 18px rgba(0,0,0,.14);font:13px/1.35 Arial,sans-serif}
      #${PANEL_ID} *{box-sizing:border-box}
      #${PANEL_ID} .vada-fb-header{height:34px;padding:0 8px 0 10px;display:flex;align-items:center;justify-content:space-between;background:#0866ff;color:#fff;font-weight:700;cursor:move;touch-action:none;user-select:none}
      #${PANEL_ID} .vada-fb-header-actions{display:flex;align-items:center;gap:6px}
      #${PANEL_ID} .vada-fb-version{font-size:10px;opacity:.85}
      #${PANEL_ID} #vada-fb-toggle{width:25px;height:25px;border:0;border-radius:6px;cursor:pointer;background:rgba(255,255,255,.16);color:#fff;font-size:18px}
      #${PANEL_ID} #vada-fb-panel-body{padding:8px;max-height:calc(100vh - 80px);overflow-y:auto}
      #${PANEL_ID} button{font-family:inherit}
      #${PANEL_ID} .vada-fb-primary,#${PANEL_ID} .vada-fb-secondary,#${PANEL_ID} .vada-fb-load{width:100%;border:0;border-radius:7px;padding:7px 8px;cursor:pointer;font-weight:700}
      #${PANEL_ID} .vada-fb-primary{background:#e7f3ff;color:#0866ff}
      #${PANEL_ID} .vada-fb-secondary{margin-top:6px;background:#f0f2f5;color:#444}
      #${PANEL_ID} .vada-fb-load{margin-top:6px;background:#0866ff;color:#fff}
      #${PANEL_ID} .vada-fb-section-title{margin:10px 2px 5px;font-size:11px;font-weight:700;color:#65676b}
      #${PANEL_ID} .vada-fb-group-row{display:flex;gap:4px;margin-bottom:4px}
      #${PANEL_ID} .vada-fb-group-open{min-width:0;flex:1;display:flex;align-items:center;gap:7px;border:1px solid #dddfe2;background:#f7f8fa;border-radius:7px;padding:6px 7px;cursor:pointer;text-align:left;color:#1c1e21}
      #${PANEL_ID} .vada-fb-group-index{width:18px;height:18px;flex:0 0 18px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#e4e6eb;font-size:10px;font-weight:700}
      #${PANEL_ID} .vada-fb-group-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:600}
      #${PANEL_ID} .vada-fb-group-delete{width:28px;border:0;border-radius:7px;cursor:pointer;background:#fce8e8;color:#c62828;font-size:18px}
      #${PANEL_ID} .vada-fb-empty,#${PANEL_ID} .vada-fb-status{padding:7px;border-radius:7px;background:#f0f2f5;color:#65676b;font-size:11px}
      [${TARGET_ATTR}="collapsed"]{display:-webkit-box!important;-webkit-box-orient:vertical!important;-webkit-line-clamp:${MAX_LINES}!important;overflow:hidden!important;max-height:none!important}
      [${TARGET_ATTR}="expanded"]{display:block!important;-webkit-line-clamp:unset!important;overflow:visible!important;max-height:none!important}
      .vada-fb-expand-wrap{margin:4px 0 2px!important;text-align:left!important;position:relative!important;z-index:5!important}
      .vada-fb-expand-btn{appearance:none!important;border:0!important;background:transparent!important;padding:2px 0!important;color:#0866ff!important;cursor:pointer!important;font:700 12px/1.3 Arial,sans-serif!important}
      #vada-fb-toast{position:fixed;right:20px;bottom:20px;z-index:2147483647;background:#1c1e21;color:#fff;border-radius:8px;padding:9px 12px;font:12px Arial,sans-serif}
    `;
    document.head.appendChild(style);
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    document.getElementById('vada-fb-toast')?.remove();
    const toast = document.createElement('div');
    toast.id = 'vada-fb-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    toastTimer = setTimeout(() => toast.remove(), 1800);
  }

  function cleanText(el) {
    return (el?.innerText || '').replace(/\s+/g, ' ').trim();
  }

  function isVisible(el) {
    if (!(el instanceof HTMLElement)) return false;
    const s = getComputedStyle(el);
    return s.display !== 'none' && s.visibility !== 'hidden' && el.getClientRects().length > 0;
  }

  function scoreCandidate(el) {
    if (!(el instanceof HTMLElement) || !isVisible(el)) return -1;
    if (el.closest(`#${PANEL_ID}`)) return -1;
    const text = cleanText(el);
    if (text.length < MIN_TEXT_LENGTH) return -1;
    if (el.querySelector('[role="article"]')) return -1;
    if (el.querySelectorAll('img,video').length > 0) return -1;
    if (el.querySelectorAll('button,[role="button"]').length > 4) return -1;
    let score = text.length;
    if (el.matches('[data-ad-preview="message"]')) score += 2500;
    if (el.matches('[data-ad-rendering-role="story_message"]')) score += 3000;
    if (el.getAttribute('dir') === 'auto') score += 250;
    return score;
  }

  function findPostText(article) {
    const preferred = [
      '[data-ad-rendering-role="story_message"]',
      '[data-ad-preview="message"]',
      '[data-ad-comet-preview="message"]'
    ];
    for (const selector of preferred) {
      const el = $(selector, article);
      if (scoreCandidate(el) >= 0) return el;
    }
    let best = null;
    let bestScore = -1;
    for (const el of $$('div[dir="auto"],span[dir="auto"]', article)) {
      const score = scoreCandidate(el);
      if (score > bestScore) { best = el; bestScore = score; }
    }
    return best;
  }

  function collapseTarget(el, article) {
    if (!el || el.hasAttribute(TARGET_ATTR)) return false;
    if (cleanText(el).length < MIN_TEXT_LENGTH) return false;
    el.setAttribute(TARGET_ATTR, 'collapsed');

    const wrap = document.createElement('div');
    wrap.className = 'vada-fb-expand-wrap';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'vada-fb-expand-btn';
    btn.textContent = 'Mở rộng';
    wrap.appendChild(btn);
    el.insertAdjacentElement('afterend', wrap);

    btn.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      const collapsed = el.getAttribute(TARGET_ATTR) === 'collapsed';
      el.setAttribute(TARGET_ATTR, collapsed ? 'expanded' : 'collapsed');
      btn.textContent = collapsed ? 'Thu gọn' : 'Mở rộng';
    }, true);

    article?.setAttribute(ARTICLE_ATTR, '1');
    return true;
  }

  function processArticle(article) {
    if (!(article instanceof HTMLElement) || article.closest(`#${PANEL_ID}`)) return;
    if (article.hasAttribute(ARTICLE_ATTR) && article.querySelector(`[${TARGET_ATTR}]`)) return;
    const target = findPostText(article);
    if (target) collapseTarget(target, article);
  }

  function scanPosts(root = document) {
    const articles = root.matches?.('[role="article"]') ? [root] : $$('[role="article"]', root);
    for (const article of articles) processArticle(article);
  }

  function ensureImageHideStyle() {
    if (!hideImages) {
      document.getElementById(IMAGE_STYLE_ID)?.remove();
      $$(`[${MEDIA_BOX_ATTR}]`).forEach(el => el.removeAttribute(MEDIA_BOX_ATTR));
      return;
    }
    let style = document.getElementById(IMAGE_STYLE_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = IMAGE_STYLE_ID;
      document.head.appendChild(style);
    }
    style.textContent = `
      img[data-imgperflogname="feedImage"],
      img[data-visualcompletion="media-vc-image"]{
        display:none!important;
        visibility:hidden!important;
        width:0!important;
        height:0!important;
        min-width:0!important;
        min-height:0!important;
        max-width:0!important;
        max-height:0!important;
        margin:0!important;
        padding:0!important;
      }
      [${MEDIA_BOX_ATTR}="1"]{display:none!important;height:0!important;min-height:0!important;max-height:0!important;margin:0!important;padding:0!important;overflow:hidden!important}
    `;
  }

  function findMediaBox(img) {
    let node = img;
    let best = img;
    for (let i = 0; i < 5; i++) {
      const parent = node.parentElement;
      if (!parent || parent.closest(`#${PANEL_ID}`)) break;
      const text = cleanText(parent);
      const controls = parent.querySelectorAll('button,input,textarea,[role="button"]').length;
      const media = parent.querySelectorAll('img,video').length;
      if (text.length > 10 || controls > 0 || media < 1 || media > 12) break;
      best = parent;
      node = parent;
    }
    return best;
  }

  function applyImageHiding(root = document) {
    ensureImageHideStyle();
    if (!hideImages) return;
    const images = [];
    if (root instanceof HTMLImageElement && root.matches('img[data-imgperflogname="feedImage"],img[data-visualcompletion="media-vc-image"]')) images.push(root);
    root.querySelectorAll?.('img[data-imgperflogname="feedImage"],img[data-visualcompletion="media-vc-image"]').forEach(img => images.push(img));
    for (const img of images) {
      const box = findMediaBox(img);
      if (box !== img) box.setAttribute(MEDIA_BOX_ATTR, '1');
    }
  }

  function updateImageButton() {
    const btn = $('#vada-fb-hide-images');
    if (!btn) return;
    btn.textContent = hideImages ? '🖼 Hiện ảnh bài viết' : '🖼 Ẩn toàn bộ ảnh';
  }

  function setHideImages(value) {
    hideImages = !!value;
    localStorage.setItem(IMAGE_HIDE_KEY, hideImages ? '1' : '0');
    ensureImageHideStyle();
    if (hideImages) applyImageHiding(document);
    updateImageButton();
    showToast(hideImages ? 'Đã ẩn ảnh bài viết.' : 'Đã hiện lại ảnh bài viết.');
  }

  function scheduleScan() {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(() => {
      scanPosts(document);
      applyImageHiding(document);
    }, 160);
  }

  function startObserver() {
    observer?.disconnect();
    observer = new MutationObserver(mutations => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          if (node.matches?.('[role="article"]')) processArticle(node);
          node.querySelectorAll?.('[role="article"]').forEach(processArticle);
          if (hideImages) applyImageHiding(node);
        }
      }
      scheduleScan();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function resetCollapsedPosts() {
    $$('.vada-fb-expand-wrap').forEach(el => el.remove());
    $$(`[${TARGET_ATTR}]`).forEach(el => el.removeAttribute(TARGET_ATTR));
    $$(`[${ARTICLE_ATTR}]`).forEach(el => el.removeAttribute(ARTICLE_ATTR));
  }

  function cleanup() {
    observer?.disconnect();
    observer = null;
    clearTimeout(scanTimer);
    clearTimeout(toastTimer);
    if (dragMoveHandler) window.removeEventListener('pointermove', dragMoveHandler, true);
    if (dragUpHandler) window.removeEventListener('pointerup', dragUpHandler, true);
    dragMoveHandler = dragUpHandler = null;
    resetCollapsedPosts();
    $$(`[${MEDIA_BOX_ATTR}]`).forEach(el => el.removeAttribute(MEDIA_BOX_ATTR));
    document.getElementById(PANEL_ID)?.remove();
    document.getElementById(STYLE_ID)?.remove();
    document.getElementById(IMAGE_STYLE_ID)?.remove();
    document.getElementById('vada-fb-toast')?.remove();
  }

  if (window.__VADA_FB_GROUP_MANAGER__?.cleanup) {
    try { window.__VADA_FB_GROUP_MANAGER__.cleanup(); } catch (_) {}
  }
  window.__VADA_FB_GROUP_MANAGER__ = { version: VERSION, cleanup };

  addStyles();
  createPanel();
  scanPosts(document);
  applyImageHiding(document);
  startObserver();
})();