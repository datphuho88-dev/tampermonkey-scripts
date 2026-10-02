// ==UserScript==
// @name         🟦 Facebook - Group Manager - Danh sách group • Thu gọn bài dài
// @namespace    https://github.com/datphuho88-dev/tampermonkey-scripts
// @version      1.5.5
// @description  Quản lý danh sách group Facebook, thu gọn bài dài, ẩn ảnh/video duyệt bài, kéo panel và hot reload chống CSP.
// @author       VADA
// @match        https://facebook.com/*
// @match        https://*.facebook.com/*
// @updateURL    https://raw.githubusercontent.com/datphuho88-dev/tampermonkey-scripts/main/%F0%9F%9F%A6%20Facebook%20-%20Group%20Manager%20-%20Danh%20s%C3%A1ch%20group%20%E2%80%A2%20Thu%20g%E1%BB%8Dn%20b%C3%A0i%20d%C3%A0i.user.js
// @downloadURL  https://raw.githubusercontent.com/datphuho88-dev/tampermonkey-scripts/main/%F0%9F%9F%A6%20Facebook%20-%20Group%20Manager%20-%20Danh%20s%C3%A1ch%20group%20%E2%80%A2%20Thu%20g%E1%BB%8Dn%20b%C3%A0i%20d%C3%A0i.user.js
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      raw.githubusercontent.com
// @connect      api.github.com
// @run-at       document-start
// ==/UserScript==

(() => {
  'use strict';

  const VERSION = '1.5.5';
  const RAW_URL = 'https://raw.githubusercontent.com/datphuho88-dev/tampermonkey-scripts/main/%F0%9F%9F%A6%20Facebook%20-%20Group%20Manager%20-%20Danh%20s%C3%A1ch%20group%20%E2%80%A2%20Thu%20g%E1%BB%8Dn%20b%C3%A0i%20d%C3%A0i.user.js';
  const INSTANCE_KEY = '__VADA_FB_GROUP_MANAGER__';
  const PANEL_ID = 'vada-fb-group-manager';
  const STYLE_ID = 'vada-fb-group-manager-style';
  const GROUP_KEY = 'vada_fb_group_manager_groups_v1';
  const POS_KEY = 'vada_fb_group_manager_position_v1';
  const IMAGE_KEY = 'vada_fb_hide_review_images_v1';
  const SAVED_KEY = 'vada_fb_review_saved_posts_v1';
  const GIST_ID_KEY = 'vada_fb_review_gist_id_v1';
  const GIST_TOKEN_KEY = 'vada_fb_review_gist_token_v1';
  const GIST_FILE = 'fb-review-posts.json';
  const TARGET_ATTR = 'data-vada-fb-collapse-target';
  const IMAGE_ATTR = 'data-vada-fb-image-hidden';
  const VIDEO_ATTR = 'data-vada-fb-video-hidden';
  const BOX_ATTR = 'data-vada-fb-media-box-hidden';
  const MAX_LINES = 3;
  const MIN_TEXT = 120;

  let observer = null;
  let scanTimer = 0;
  let imageTimer = 0;
  let toastTimer = 0;
  let dragMove = null;
  let dragUp = null;
  let dragFrame = 0;
  let dragging = false;
  let hideImages = localStorage.getItem(IMAGE_KEY) !== '0';
  let hiddenCount = 0;
  let syncTimer = 0;
  let lastArticle = null;
  let quickSaveHandler = null;

  const imageStyles = new Map();
  const videoStyles = new Map();
  const boxStyles = new Map();

  const gmGet = (key, fallback) => {
    try {
      if (typeof GM_getValue === 'function') return GM_getValue(key, fallback);
    } catch (_) {}
    try {
      const raw = localStorage.getItem('__VADA_GM__' + key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (_) { return fallback; }
  };

  const gmSet = (key, value) => {
    try {
      if (typeof GM_setValue === 'function') {
        GM_setValue(key, value);
        return;
      }
    } catch (_) {}
    try { localStorage.setItem('__VADA_GM__' + key, JSON.stringify(value)); } catch (_) {}
  };

  const $ = (s, root = document) => root?.querySelector?.(s) || null;
  const $ = (s, root = document) => root?.querySelectorAll ? [...root.querySelectorAll(s)] : [];

  try { window[INSTANCE_KEY]?.cleanup?.(); } catch (_) {}

  function toast(text) {
    clearTimeout(toastTimer);
    document.getElementById('vada-fb-toast')?.remove();
    const el = document.createElement('div');
    el.id = 'vada-fb-toast';
    el.textContent = text;
    document.body.appendChild(el);
    toastTimer = setTimeout(() => el.remove(), 2200);
  }

  function groups() {
    try {
      const data = JSON.parse(localStorage.getItem(GROUP_KEY) || '[]');
      if (!Array.isArray(data)) return [];
      let changed = false;
      const now = Date.now();
      const normalized = data.map((g, index) => {
        if (!g || typeof g !== 'object') return g;
        const next = { ...g };
        if (!next.id) {
          const m = String(next.url || '').match(/\/groups\/([^/?#]+)/i);
          if (m) { next.id = m[1]; changed = true; }
        }
        if (typeof next.deleted !== 'boolean') { next.deleted = false; changed = true; }
        if (!Number(next.updatedAt)) { next.updatedAt = now - index; changed = true; }
        return next;
      }).filter(Boolean);
      if (changed) localStorage.setItem(GROUP_KEY, JSON.stringify(normalized));
      return normalized;
    } catch (_) { return []; }
  }

  function visibleGroups() {
    return groups().filter(g => g && !g.deleted && g.id && g.url);
  }

  function saveGroups(data) {