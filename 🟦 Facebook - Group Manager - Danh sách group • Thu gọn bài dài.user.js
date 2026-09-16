// ==UserScript==
// @name         🟦 Facebook - Group Manager - Danh sách group • Thu gọn bài dài
// @namespace    https://github.com/datphuho88-dev/tampermonkey-scripts
// @version      1.0.0
// @description  Quản lý danh sách group Facebook và thu gọn bài viết dài để đọc nhanh.
// @author       VADA
// @match        https://www.facebook.com/*
// @match        https://facebook.com/*
// @updateURL    https://raw.githubusercontent.com/datphuho88-dev/tampermonkey-scripts/main/%F0%9F%9F%A6%20Facebook%20-%20Group%20Manager%20-%20Danh%20s%C3%A1ch%20group%20%E2%80%A2%20Thu%20g%E1%BB%8Dn%20b%C3%A0i%20d%C3%A0i.user.js
// @downloadURL  https://raw.githubusercontent.com/datphuho88-dev/tampermonkey-scripts/main/%F0%9F%9F%A6%20Facebook%20-%20Group%20Manager%20-%20Danh%20s%C3%A1ch%20group%20%E2%80%A2%20Thu%20g%E1%BB%8Dn%20b%C3%A0i%20d%C3%A0i.user.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(() => {
  'use strict';

  const VERSION = '1.0.0';
  const STORAGE_KEY = 'vada_fb_group_manager_groups_v1';
  const PANEL_ID = 'vada-fb-group-manager';
  const STYLE_ID = 'vada-fb-group-manager-style';
  const COLLAPSE_CLASS = 'vada-fb-post-collapsed';
  const PROCESSED_ATTR = 'data-vada-fb-collapse-ready';
  const MAX_LINES = 3;
  const MIN_TEXT_LENGTH = 220;

  let scanTimer = 0;
  let observer = null;

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
    let name = '';

    const heading = document.querySelector('h1');
    if (heading?.textContent?.trim()) name = heading.textContent.trim();

    if (!name) {
      const title = document.title.replace(/\s*\|\s*Facebook\s*$/i, '').trim();
      if (title && title.toLowerCase() !== 'facebook') name = title;
    }

    return {
      name: name || `Group ${match[1]}`,
      url,
      id: match[1]
    };
  }

  function addCurrentGroup() {
    const group = getCurrentGroup();
    if (!group) {
      showToast('Hãy mở một group Facebook trước.');
      return;
    }

    const groups = loadGroups();
    const existingIndex = groups.findIndex(item => normalizeUrl(item.url) === group.url);

    if (existingIndex >= 0) {
      groups[existingIndex] = { ...groups[existingIndex], ...group };
      showToast('Đã cập nhật group trong danh sách.');
    } else {
      groups.unshift(group);
      showToast('Đã thêm group vào danh sách.');
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
      <div class="vada-fb-group-row" data-index="${index}">
        <button class="vada-fb-group-open" title="Mở group" data-url="${escapeHtml(group.url)}">
          <span class="vada-fb-group-index">${index + 1}</span>
          <span class="vada-fb-group-name">${escapeHtml(group.name || group.url)}</span>
        </button>
        <button class="vada-fb-group-delete" title="Xóa khỏi danh sách" data-url="${escapeHtml(group.url)}">×</button>
      </div>
    `).join('');
  }

  function createPanel() {
    document.getElementById(PANEL_ID)?.remove();

    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <div class="vada-fb-header">
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
        <div class="vada-fb-section-title vada-fb-reading-title">📑 ĐỌC NHANH BÀI DÀI</div>
        <div class="vada-fb-status">Bài dài tự thu gọn còn ${MAX_LINES} dòng. Bấm <b>Mở rộng</b> ngay dưới bài để xem đầy đủ.</div>
      </div>
    `;

    document.body.appendChild(panel);
    renderGroupList();

    panel.addEventListener('click', event => {
      const openButton = event.target.closest('.vada-fb-group-open');
      if (openButton) {
        location.href = openButton.dataset.url;
        return;
      }

      const deleteButton = event.target.closest('.vada-fb-group-delete');
      if (deleteButton) {
        removeGroup(deleteButton.dataset.url);
        return;
      }

      if (event.target.closest('#vada-fb-add-current')) {
        addCurrentGroup();
        return;
      }

      if (event.target.closest('#vada-fb-toggle')) {
        const body = panel.querySelector('#vada-fb-panel-body');
        const button = panel.querySelector('#vada-fb-toggle');
        const hidden = body.style.display === 'none';
        body.style.display = hidden ? '' : 'none';
        button.textContent = hidden ? '−' : '+';
      }
    });
  }

  function addStyles() {
    document.getElementById(STYLE_ID)?.remove();
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${PANEL_ID} {
        position: fixed;
        top: 88px;
        right: 14px;
        z-index: 2147483646;
        width: 260px;
        max-height: calc(100vh - 110px);
        overflow: hidden;
        background: rgba(255,255,255,.98);
        color: #1c1e21;
        border: 1px solid #ccd0d5;
        border-radius: 10px;
        box-shadow: 0 4px 18px rgba(0,0,0,.14);
        font: 13px/1.35 Arial, sans-serif;
      }
      #${PANEL_ID} * { box-sizing: border-box; }
      #${PANEL_ID} .vada-fb-header {
        height: 34px;
        padding: 0 8px 0 10px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: #0866ff;
        color: #fff;
        font-weight: 700;
      }
      #${PANEL_ID} .vada-fb-header-actions { display:flex; align-items:center; gap:6px; }
      #${PANEL_ID} .vada-fb-version { font-size: 10px; opacity:.82; }
      #${PANEL_ID} #vada-fb-toggle {
        width: 25px; height:25px; border:0; border-radius:6px; cursor:pointer;
        background:rgba(255,255,255,.16); color:#fff; font-size:18px; line-height:1;
      }
      #${PANEL_ID} #vada-fb-panel-body {
        padding: 8px;
        max-height: calc(100vh - 145px);
        overflow-y: auto;
      }
      #${PANEL_ID} button { font-family: inherit; }
      #${PANEL_ID} .vada-fb-primary {
        width:100%; border:0; border-radius:7px; padding:7px 8px; cursor:pointer;
        background:#e7f3ff; color:#0866ff; font-weight:700;
      }
      #${PANEL_ID} .vada-fb-section-title {
        margin:10px 2px 5px; font-size:11px; font-weight:700; color:#65676b;
      }
      #${PANEL_ID} .vada-fb-reading-title { margin-top:12px; }
      #${PANEL_ID} .vada-fb-group-row {
        display:flex; align-items:stretch; gap:4px; margin-bottom:4px;
      }
      #${PANEL_ID} .vada-fb-group-open {
        min-width:0; flex:1; display:flex; align-items:center; gap:7px;
        border:1px solid #dddfe2; background:#f7f8fa; border-radius:7px;
        padding:6px 7px; cursor:pointer; text-align:left; color:#1c1e21;
      }
      #${PANEL_ID} .vada-fb-group-open:hover { background:#eef1f5; }
      #${PANEL_ID} .vada-fb-group-index {
        width:18px; height:18px; flex:0 0 18px; border-radius:50%;
        display:flex; align-items:center; justify-content:center;
        background:#e4e6eb; font-size:10px; font-weight:700;
      }
      #${PANEL_ID} .vada-fb-group-name {
        display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
        font-size:12px; font-weight:600;
      }
      #${PANEL_ID} .vada-fb-group-delete {
        width:28px; border:0; border-radius:7px; cursor:pointer;
        background:#fce8e8; color:#c62828; font-size:18px;
      }
      #${PANEL_ID} .vada-fb-empty,
      #${PANEL_ID} .vada-fb-status {
        padding:7px; border-radius:7px; background:#f0f2f5; color:#65676b; font-size:11px;
      }
      .${COLLAPSE_CLASS} {
        display: -webkit-box !important;
        -webkit-box-orient: vertical !important;
        -webkit-line-clamp: ${MAX_LINES} !important;
        overflow: hidden !important;
      }
      .vada-fb-expand-wrap {
        margin-top: 3px !important;
        text-align: left !important;
      }
      .vada-fb-expand-btn {
        appearance:none !important;
        border:0 !important;
        background:transparent !important;
        padding:2px 0 !important;
        color:#0866ff !important;
        cursor:pointer !important;
        font:600 12px/1.3 Arial,sans-serif !important;
      }
      #vada-fb-toast {
        position:fixed; right:20px; bottom:20px; z-index:2147483647;
        background:#1c1e21; color:#fff; border-radius:8px; padding:9px 12px;
        font:12px Arial,sans-serif; box-shadow:0 3px 12px rgba(0,0,0,.2);
      }
    `;
    document.head.appendChild(style);
  }

  function showToast(message) {
    document.getElementById('vada-fb-toast')?.remove();
    const toast = document.createElement('div');
    toast.id = 'vada-fb-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 1800);
  }

  function isLikelyPostMessage(el) {
    if (!(el instanceof HTMLElement)) return false;
    if (el.closest(`#${PANEL_ID}`)) return false;
    if (el.getAttribute(PROCESSED_ATTR)) return false;

    const text = (el.innerText || '').trim();
    if (text.length < MIN_TEXT_LENGTH) return false;

    const role = el.getAttribute('data-ad-preview');
    if (role === 'message') return true;

    // Selector dự phòng cho feed/group khi Facebook thay cấu trúc DOM.
    const article = el.closest('[role="article"]');
    if (!article) return false;

    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;

    // Tránh thu gọn các container lớn chứa cả nút/comment của bài.
    if (el.querySelectorAll('a, button, [role="button"]').length > 8) return false;
    if (el.children.length > 12) return false;

    return true;
  }

  function collapseElement(el) {
    if (!isLikelyPostMessage(el)) return;
    el.setAttribute(PROCESSED_ATTR, '1');

    const originalHeight = el.getBoundingClientRect().height;
    el.classList.add(COLLAPSE_CLASS);

    requestAnimationFrame(() => {
      const collapsedHeight = el.getBoundingClientRect().height;
      if (originalHeight <= collapsedHeight + 8) {
        el.classList.remove(COLLAPSE_CLASS);
        return;
      }

      const wrap = document.createElement('div');
      wrap.className = 'vada-fb-expand-wrap';
      const button = document.createElement('button');
      button.className = 'vada-fb-expand-btn';
      button.type = 'button';
      button.textContent = 'Mở rộng';
      wrap.appendChild(button);
      el.insertAdjacentElement('afterend', wrap);

      button.addEventListener('click', () => {
        const collapsed = el.classList.toggle(COLLAPSE_CLASS);
        button.textContent = collapsed ? 'Mở rộng' : 'Thu gọn';
      });
    });
  }

  function scanPosts(root = document) {
    const directMessages = root.querySelectorAll?.('[data-ad-preview="message"]') || [];
    directMessages.forEach(collapseElement);

    // Dự phòng: chỉ xét các div/span có text tương đối dài bên trong article.
    const articles = root.querySelectorAll?.('[role="article"]') || [];
    articles.forEach(article => {
      const candidates = article.querySelectorAll('div[dir="auto"], span[dir="auto"]');
      candidates.forEach(collapseElement);
    });
  }

  function scheduleScan() {
    clearTimeout(scanTimer);
    scanTimer = window.setTimeout(() => scanPosts(document), 180);
  }

  function startObserver() {
    observer?.disconnect();
    observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        if (mutation.addedNodes.length) {
          scheduleScan();
          break;
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function cleanup() {
    observer?.disconnect();
    clearTimeout(scanTimer);
    document.getElementById(PANEL_ID)?.remove();
    document.getElementById(STYLE_ID)?.remove();
    document.getElementById('vada-fb-toast')?.remove();
    document.querySelectorAll('.vada-fb-expand-wrap').forEach(el => el.remove());
    document.querySelectorAll(`[${PROCESSED_ATTR}]`).forEach(el => {
      el.removeAttribute(PROCESSED_ATTR);
      el.classList.remove(COLLAPSE_CLASS);
    });
  }

  // Cho phép bản script mới dọn instance cũ nếu Tampermonkey chạy lại trên SPA.
  if (window.__VADA_FB_GROUP_MANAGER__?.cleanup) {
    try { window.__VADA_FB_GROUP_MANAGER__.cleanup(); } catch (_) {}
  }
  window.__VADA_FB_GROUP_MANAGER__ = { version: VERSION, cleanup };

  addStyles();
  createPanel();
  scanPosts(document);
  startObserver();
})();
