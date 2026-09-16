// ==UserScript==
// @name         🟦 Facebook - Group Manager - Danh sách group • Thu gọn bài dài
// @namespace    https://github.com/datphuho88-dev/tampermonkey-scripts
// @version      1.1.0
// @description  Quản lý danh sách group Facebook, thu gọn bài viết dài, kéo panel và hot reload từ GitHub.
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

  const VERSION = '1.1.0';
  const RAW_URL = 'https://raw.githubusercontent.com/datphuho88-dev/tampermonkey-scripts/main/%F0%9F%9F%A6%20Facebook%20-%20Group%20Manager%20-%20Danh%20s%C3%A1ch%20group%20%E2%80%A2%20Thu%20g%E1%BB%8Dn%20b%C3%A0i%20d%C3%A0i.user.js';
  const STORAGE_KEY = 'vada_fb_group_manager_groups_v1';
  const POS_KEY = 'vada_fb_group_manager_position_v1';
  const PANEL_ID = 'vada-fb-group-manager';
  const STYLE_ID = 'vada-fb-group-manager-style';
  const PROCESSED_ATTR = 'data-vada-fb-collapse-ready';
  const MAX_LINES = 3;
  const MIN_TEXT_LENGTH = 160;

  let observer = null;
  let scanTimer = 0;
  let toastTimer = 0;
  let dragMoveHandler = null;
  let dragUpHandler = null;
  const originalStyles = new Map();

  function loadGroups() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(data) ? data : [];
    } catch (_) {
      return [];
    }
  }

  function saveGroups(groups) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
  }

  function normalizeUrl(url) {
    try {
      const u = new URL(url, location.origin);
      u.search = '';
      u.hash = '';
      return u.href.replace(/\/$/, '');
    } catch (_) {
      return url;
    }
  }

  function getCurrentGroup() {
    const match = location.pathname.match(/^\/groups\/([^/?#]+)/i);
    if (!match) return null;

    const url = normalizeUrl(`${location.origin}/groups/${match[1]}`);
    let name = document.querySelector('h1')?.textContent?.trim() || '';

    if (!name) {
      const title = document.title.replace(/\s*\|\s*Facebook\s*$/i, '').trim();
      if (title && title.toLowerCase() !== 'facebook') name = title;
    }

    return { name: name || `Group ${match[1]}`, url, id: match[1] };
  }

  function addCurrentGroup() {
    const group = getCurrentGroup();
    if (!group) return showToast('Hãy mở một group Facebook trước.');

    const groups = loadGroups();
    const index = groups.findIndex(item => normalizeUrl(item.url) === group.url);
    if (index >= 0) {
      groups[index] = { ...groups[index], ...group };
      showToast('Đã cập nhật group.');
    } else {
      groups.unshift(group);
      showToast('Đã lưu group.');
    }
    saveGroups(groups);
    renderGroupList();
  }

  function removeGroup(url) {
    const target = normalizeUrl(url);
    saveGroups(loadGroups().filter(item => normalizeUrl(item.url) !== target));
    renderGroupList();
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function renderGroupList() {
    const box = document.querySelector('#vada-fb-group-list');
    if (!box) return;
    const groups = loadGroups();

    if (!groups.length) {
      box.innerHTML = '<div class="vada-fb-empty">Chưa lưu group nào.</div>';
      return;
    }

    box.innerHTML = groups.map((group, index) => `
      <div class="vada-fb-group-row">
        <button class="vada-fb-group-open" title="Mở group" data-url="${escapeHtml(group.url)}">
          <span class="vada-fb-group-index">${index + 1}</span>
          <span class="vada-fb-group-name">${escapeHtml(group.name || group.url)}</span>
        </button>
        <button class="vada-fb-group-delete" title="Xóa" data-url="${escapeHtml(group.url)}">×</button>
      </div>
    `).join('');
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
    const rect = panel.getBoundingClientRect();
    localStorage.setItem(POS_KEY, JSON.stringify({ left: Math.round(rect.left), top: Math.round(rect.top) }));
  }

  function enableDrag(panel) {
    const header = panel.querySelector('.vada-fb-header');
    if (!header) return;

    header.addEventListener('pointerdown', event => {
      if (event.button !== 0 || event.target.closest('button')) return;
      event.preventDefault();

      const rect = panel.getBoundingClientRect();
      const dx = event.clientX - rect.left;
      const dy = event.clientY - rect.top;
      panel.style.right = 'auto';
      header.setPointerCapture?.(event.pointerId);

      dragMoveHandler = moveEvent => {
        const left = Math.max(0, Math.min(moveEvent.clientX - dx, innerWidth - panel.offsetWidth));
        const top = Math.max(0, Math.min(moveEvent.clientY - dy, innerHeight - 34));
        panel.style.left = `${left}px`;
        panel.style.top = `${top}px`;
      };

      dragUpHandler = () => {
        savePosition(panel);
        window.removeEventListener('pointermove', dragMoveHandler, true);
        window.removeEventListener('pointerup', dragUpHandler, true);
        dragMoveHandler = null;
        dragUpHandler = null;
      };

      window.addEventListener('pointermove', dragMoveHandler, true);
      window.addEventListener('pointerup', dragUpHandler, true);
    });
  }

  function loadLatest() {
    const button = document.querySelector('#vada-fb-load');
    if (button) {
      button.disabled = true;
      button.textContent = '↻ ...';
    }

    GM_xmlhttpRequest({
      method: 'GET',
      url: `${RAW_URL}?_=${Date.now()}`,
      headers: { 'Cache-Control': 'no-cache' },
      onload(response) {
        try {
          if (response.status < 200 || response.status >= 300 || !response.responseText) {
            throw new Error(`HTTP ${response.status}`);
          }
          const runner = new Function('GM_xmlhttpRequest', response.responseText);
          cleanup();
          runner(GM_xmlhttpRequest);
        } catch (error) {
          console.error('[VADA FB] LOAD lỗi:', error);
          if (button?.isConnected) {
            button.disabled = false;
            button.textContent = '↻ LOAD';
          }
          showToast(`LOAD lỗi: ${error.message}`);
        }
      },
      onerror() {
        if (button?.isConnected) {
          button.disabled = false;
          button.textContent = '↻ LOAD';
        }
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
        <div class="vada-fb-header-actions">
          <span class="vada-fb-version">v${VERSION}</span>
          <button id="vada-fb-toggle" title="Thu gọn bảng">−</button>
        </div>
      </div>
      <div id="vada-fb-panel-body">
        <button id="vada-fb-add-current" class="vada-fb-primary">＋ Lưu group hiện tại</button>
        <div class="vada-fb-section-title">📌 DANH SÁCH GROUP</div>
        <div id="vada-fb-group-list"></div>
        <div class="vada-fb-section-title">📑 ĐỌC NHANH BÀI DÀI</div>
        <div class="vada-fb-status">Bài dài tự thu gọn còn ${MAX_LINES} dòng.</div>
        <button id="vada-fb-rescan" class="vada-fb-secondary">↻ Quét lại bài viết</button>
        <button id="vada-fb-load" class="vada-fb-load">↻ LOAD</button>
      </div>
    `;

    document.body.appendChild(panel);
    loadPosition(panel);
    enableDrag(panel);
    renderGroupList();

    panel.addEventListener('click', event => {
      const openButton = event.target.closest('.vada-fb-group-open');
      if (openButton) return void (location.href = openButton.dataset.url);

      const deleteButton = event.target.closest('.vada-fb-group-delete');
      if (deleteButton) return removeGroup(deleteButton.dataset.url);

      if (event.target.closest('#vada-fb-add-current')) return addCurrentGroup();
      if (event.target.closest('#vada-fb-rescan')) {
        resetCollapsedPosts();
        scanPosts();
        return showToast('Đã quét lại bài viết.');
      }
      if (event.target.closest('#vada-fb-load')) return loadLatest();

      if (event.target.closest('#vada-fb-toggle')) {
        const body = panel.querySelector('#vada-fb-panel-body');
        const toggle = panel.querySelector('#vada-fb-toggle');
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
      #${PANEL_ID}{position:fixed;top:88px;right:14px;z-index:2147483646;width:260px;max-height:calc(100vh - 40px);overflow:hidden;background:rgba(255,255,255,.98);color:#1c1e21;border:1px solid #ccd0d5;border-radius:10px;box-shadow:0 4px 18px rgba(0,0,0,.14);font:13px/1.35 Arial,sans-serif}
      #${PANEL_ID} *{box-sizing:border-box}
      #${PANEL_ID} .vada-fb-header{height:34px;padding:0 8px 0 10px;display:flex;align-items:center;justify-content:space-between;background:#0866ff;color:#fff;font-weight:700;cursor:move;touch-action:none;user-select:none}
      #${PANEL_ID} .vada-fb-header-actions{display:flex;align-items:center;gap:6px}
      #${PANEL_ID} .vada-fb-version{font-size:10px;opacity:.85}
      #${PANEL_ID} #vada-fb-toggle{width:25px;height:25px;border:0;border-radius:6px;cursor:pointer;background:rgba(255,255,255,.16);color:#fff;font-size:18px;line-height:1}
      #${PANEL_ID} #vada-fb-panel-body{padding:8px;max-height:calc(100vh - 80px);overflow-y:auto}
      #${PANEL_ID} button{font-family:inherit}
      #${PANEL_ID} .vada-fb-primary,#${PANEL_ID} .vada-fb-secondary,#${PANEL_ID} .vada-fb-load{width:100%;border:0;border-radius:7px;padding:7px 8px;cursor:pointer;font-weight:700}
      #${PANEL_ID} .vada-fb-primary{background:#e7f3ff;color:#0866ff}
      #${PANEL_ID} .vada-fb-secondary{margin-top:6px;background:#f0f2f5;color:#444}
      #${PANEL_ID} .vada-fb-load{margin-top:6px;background:#0866ff;color:#fff}
      #${PANEL_ID} .vada-fb-load:disabled{opacity:.65;cursor:wait}
      #${PANEL_ID} .vada-fb-section-title{margin:10px 2px 5px;font-size:11px;font-weight:700;color:#65676b}
      #${PANEL_ID} .vada-fb-group-row{display:flex;align-items:stretch;gap:4px;margin-bottom:4px}
      #${PANEL_ID} .vada-fb-group-open{min-width:0;flex:1;display:flex;align-items:center;gap:7px;border:1px solid #dddfe2;background:#f7f8fa;border-radius:7px;padding:6px 7px;cursor:pointer;text-align:left;color:#1c1e21}
      #${PANEL_ID} .vada-fb-group-index{width:18px;height:18px;flex:0 0 18px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#e4e6eb;font-size:10px;font-weight:700}
      #${PANEL_ID} .vada-fb-group-name{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:600}
      #${PANEL_ID} .vada-fb-group-delete{width:28px;border:0;border-radius:7px;cursor:pointer;background:#fce8e8;color:#c62828;font-size:18px}
      #${PANEL_ID} .vada-fb-empty,#${PANEL_ID} .vada-fb-status{padding:7px;border-radius:7px;background:#f0f2f5;color:#65676b;font-size:11px}
      .vada-fb-expand-wrap{margin:3px 0 2px!important;text-align:left!important;position:relative!important;z-index:2!important}
      .vada-fb-expand-btn{appearance:none!important;border:0!important;background:transparent!important;padding:2px 0!important;color:#0866ff!important;cursor:pointer!important;font:700 12px/1.3 Arial,sans-serif!important}
      #vada-fb-toast{position:fixed;right:20px;bottom:20px;z-index:2147483647;background:#1c1e21;color:#fff;border-radius:8px;padding:9px 12px;font:12px Arial,sans-serif;box-shadow:0 3px 12px rgba(0,0,0,.2)}
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
    toastTimer = window.setTimeout(() => toast.remove(), 1800);
  }

  function isVisible(el) {
    if (!(el instanceof HTMLElement)) return false;
    const style = getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && el.getClientRects().length > 0;
  }

  function getCandidateFromArticle(article) {
    const direct = article.querySelector('[data-ad-preview="message"], [data-ad-rendering-role="story_message"]');
    if (direct && isVisible(direct) && (direct.innerText || '').trim().length >= MIN_TEXT_LENGTH) return direct;

    const candidates = [...article.querySelectorAll('div[dir="auto"], span[dir="auto"]')];
    for (const el of candidates) {
      if (!isVisible(el) || el.closest(`#${PANEL_ID}`)) continue;
      if (el.getAttribute(PROCESSED_ATTR)) continue;
      const text = (el.innerText || '').trim();
      if (text.length < MIN_TEXT_LENGTH) continue;
      if (el.querySelectorAll('button,[role="button"]').length > 3) continue;
      if (el.querySelector('[role="article"]')) continue;
      return el;
    }
    return null;
  }

  function collapseElement(el) {
    if (!(el instanceof HTMLElement) || el.getAttribute(PROCESSED_ATTR)) return;
    el.setAttribute(PROCESSED_ATTR, '1');

    const cs = getComputedStyle(el);
    const fontSize = parseFloat(cs.fontSize) || 15;
    let lineHeight = parseFloat(cs.lineHeight);
    if (!Number.isFinite(lineHeight)) lineHeight = fontSize * 1.35;
    const maxHeight = Math.ceil(lineHeight * MAX_LINES + 2);

    originalStyles.set(el, {
      maxHeight: el.style.maxHeight,
      overflow: el.style.overflow,
      position: el.style.position
    });

    const fullHeight = Math.max(el.scrollHeight, el.getBoundingClientRect().height);
    if (fullHeight <= maxHeight + 6) {
      el.removeAttribute(PROCESSED_ATTR);
      originalStyles.delete(el);
      return;
    }

    el.style.maxHeight = `${maxHeight}px`;
    el.style.overflow = 'hidden';

    const wrap = document.createElement('div');
    wrap.className = 'vada-fb-expand-wrap';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'vada-fb-expand-btn';
    button.textContent = 'Mở rộng';
    wrap.appendChild(button);
    el.insertAdjacentElement('afterend', wrap);

    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      const collapsed = el.style.maxHeight !== 'none';
      if (collapsed) {
        el.style.maxHeight = 'none';
        el.style.overflow = 'visible';
        button.textContent = 'Thu gọn';
      } else {
        el.style.maxHeight = `${maxHeight}px`;
        el.style.overflow = 'hidden';
        button.textContent = 'Mở rộng';
        el.scrollIntoView({ block: 'nearest' });
      }
    }, true);
  }

  function scanPosts(root = document) {
    const articles = [...(root.querySelectorAll?.('[role="article"]') || [])];
    for (const article of articles) {
      const candidate = getCandidateFromArticle(article);
      if (candidate) collapseElement(candidate);
    }
  }

  function scheduleScan() {
    clearTimeout(scanTimer);
    scanTimer = window.setTimeout(() => scanPosts(document), 250);
  }

  function startObserver() {
    observer?.disconnect();
    observer = new MutationObserver(mutations => {
      if (mutations.some(m => m.addedNodes?.length)) scheduleScan();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function resetCollapsedPosts() {
    document.querySelectorAll('.vada-fb-expand-wrap').forEach(el => el.remove());
    for (const [el, old] of originalStyles.entries()) {
      if (!el?.isConnected) continue;
      el.style.maxHeight = old.maxHeight;
      el.style.overflow = old.overflow;
      el.style.position = old.position;
      el.removeAttribute(PROCESSED_ATTR);
    }
    document.querySelectorAll(`[${PROCESSED_ATTR}]`).forEach(el => el.removeAttribute(PROCESSED_ATTR));
    originalStyles.clear();
  }

  function cleanup() {
    observer?.disconnect();
    observer = null;
    clearTimeout(scanTimer);
    clearTimeout(toastTimer);
    if (dragMoveHandler) window.removeEventListener('pointermove', dragMoveHandler, true);
    if (dragUpHandler) window.removeEventListener('pointerup', dragUpHandler, true);
    dragMoveHandler = null;
    dragUpHandler = null;
    resetCollapsedPosts();
    document.getElementById(PANEL_ID)?.remove();
    document.getElementById(STYLE_ID)?.remove();
    document.getElementById('vada-fb-toast')?.remove();
  }

  if (window.__VADA_FB_GROUP_MANAGER__?.cleanup) {
    try { window.__VADA_FB_GROUP_MANAGER__.cleanup(); } catch (_) {}
  }
  window.__VADA_FB_GROUP_MANAGER__ = { version: VERSION, cleanup };

  addStyles();
  createPanel();
  scanPosts(document);
  startObserver();
})();