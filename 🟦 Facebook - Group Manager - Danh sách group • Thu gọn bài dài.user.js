// ==UserScript==
// @name         🟦 Facebook - Group Manager - Danh sách group • Thu gọn bài dài
// @namespace    https://github.com/datphuho88-dev/tampermonkey-scripts
// @version      1.6.4
// @description  Facebook Group Manager tối ưu: group, bài để duyệt, thu gọn bài, ẩn media, đồng bộ Gist và hot reload.
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
// @run-at       document-idle
// ==/UserScript==

(() => {
  'use strict';

  const VERSION = '1.6.4';
  const RAW_URL = 'https://raw.githubusercontent.com/datphuho88-dev/tampermonkey-scripts/main/%F0%9F%9F%A6%20Facebook%20-%20Group%20Manager%20-%20Danh%20s%C3%A1ch%20group%20%E2%80%A2%20Thu%20g%E1%BB%8Dn%20b%C3%A0i%20d%C3%A0i.user.js';
  const INSTANCE_KEY = '__VADA_FB_GROUP_MANAGER__';
  const PANEL_ID = 'vada-fb-group-manager';
  const STYLE_ID = 'vada-fb-group-manager-style';

  const GROUP_KEY = 'vada_fb_group_manager_groups_v1';
  const POS_KEY = 'vada_fb_group_manager_position_v1';
  const MEDIA_KEY = 'vada_fb_hide_review_images_v1';
  const REVIEW_KEY = 'vada_fb_review_saved_posts_v1';
  const GIST_ID_KEY = 'vada_fb_review_gist_id_v1';
  const GIST_TOKEN_KEY = 'vada_fb_review_gist_token_v1';
  const GIST_FILE = 'fb-review-posts.json';

  const TARGET_ATTR = 'data-vada-fb-collapse-target';
  const IMAGE_ATTR = 'data-vada-fb-image-hidden';
  const VIDEO_ATTR = 'data-vada-fb-video-hidden';
  const BOX_ATTR = 'data-vada-fb-media-box-hidden';
  const ORIG_STYLE_ATTR = 'data-vada-fb-original-style';
  const HAD_STYLE_ATTR = 'data-vada-fb-had-style';

  const MAX_LINES = 3;
  const MIN_TEXT = 110;
  const MEDIA_SELECTOR = 'img[data-imgperflogname="feedImage"],img[data-visualcompletion="media-vc-image"],img[src*="scontent"],video';

  let observer = null;
  let pendingRoots = new Set();
  let workHandle = 0;
  let workUsesIdle = false;

  let toastTimer = 0;
  let syncDebounce = 0;
  let syncInterval = 0;
  let syncBusy = false;
  let syncQueued = false;
  let visibilityHandler = null;

  let dragMove = null;
  let dragUp = null;
  let dragFrame = 0;
  let dragging = false;

  let quickSaveHandler = null;
  let mediaLoadHandler = null;
  let lastArticle = null;

  let hideMedia = localStorage.getItem(MEDIA_KEY) !== '0';
  let hiddenCount = 0;
  let lastPathname = location.pathname;
  let groupCache = [];
  let reviewCache = [];
  let lastGroupHtml = '';
  let lastReviewHtml = '';
  let draggingGroupId = '';

  const $ = (selector, root = document) => root && root.querySelector ? root.querySelector(selector) : null;
  const $$ = (selector, root = document) => root && root.querySelectorAll ? Array.from(root.querySelectorAll(selector)) : [];

  const gmGet = (key, fallback) => {
    try {
      if (typeof GM_getValue === 'function') return GM_getValue(key, fallback);
    } catch (_) {}
    try {
      const raw = localStorage.getItem('__VADA_GM__' + key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (_) {
      return fallback;
    }
  };

  const gmSet = (key, value) => {
    try {
      if (typeof GM_setValue === 'function') {
        GM_setValue(key, value);
        return;
      }
    } catch (_) {}
    try {
      localStorage.setItem('__VADA_GM__' + key, JSON.stringify(value));
    } catch (_) {}
  };

  try {
    if (window[INSTANCE_KEY] && typeof window[INSTANCE_KEY].cleanup === 'function') {
      window[INSTANCE_KEY].cleanup();
    }
  } catch (_) {}

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function now() {
    return Date.now();
  }

  function toast(message) {
    clearTimeout(toastTimer);
    const old = document.getElementById('vada-fb-toast');
    if (old) old.remove();
    const el = document.createElement('div');
    el.id = 'vada-fb-toast';
    el.textContent = message;
    document.body.appendChild(el);
    toastTimer = setTimeout(() => el.remove(), 2200);
  }

  function normalizeGroup(record, index, total) {
    if (!record || typeof record !== 'object') return null;
    const g = Object.assign({}, record);
    if (!g.id) {
      const m = String(g.url || '').match(/\/groups\/([^/?#]+)/i);
      if (m) g.id = m[1];
    }
    if (!g.id) return null;
    g.id = String(g.id);
    g.url = 'https://www.facebook.com/groups/' + g.id + '/pending_posts';
    g.deleted = !!g.deleted;
    g.updatedAt = Number(g.updatedAt) || now() - index;
    g.createdAt = Number(g.createdAt) || now() - index * 1000;
    g.name = String(g.name || ('Group ' + g.id));
    g.alias = String(g.alias || '');
    g.icon = String(g.icon || '');
    g.order = Number.isFinite(Number(g.order)) ? Number(g.order) : index;
    return g;
  }

  function loadGroups() {
    try {
      const raw = JSON.parse(localStorage.getItem(GROUP_KEY) || '[]');
      const list = Array.isArray(raw) ? raw : [];
      groupCache = list.map((g, i) => normalizeGroup(g, i, list.length)).filter(Boolean);
      saveGroups(false);
    } catch (_) {
      groupCache = [];
    }
  }

  function saveGroups(render = true) {
    try {
      localStorage.setItem(GROUP_KEY, JSON.stringify(groupCache));
    } catch (_) {}
    if (render) renderGroups();
  }

  function visibleGroups() {
    return groupCache
      .filter(g => g && !g.deleted && g.id)
      .slice()
      .sort((a, b) => {
        const ao = Number.isFinite(Number(a.order)) ? Number(a.order) : 999999;
        const bo = Number.isFinite(Number(b.order)) ? Number(b.order) : 999999;
        if (ao !== bo) return ao - bo;
        return Number(b.createdAt || 0) - Number(a.createdAt || 0);
      });
  }

  function loadReviews() {
    const raw = gmGet(REVIEW_KEY, []);
    reviewCache = Array.isArray(raw) ? raw.filter(Boolean) : [];
  }

  function saveReviews(render = true) {
    gmSet(REVIEW_KEY, reviewCache);
    if (render) renderReviews();
  }

  function visibleReviews() {
    return reviewCache
      .filter(x => x && !x.deleted && x.url)
      .slice()
      .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
  }

  function mergeRecords(local, remote, keyName) {
    const map = new Map();
    const all = []
      .concat(Array.isArray(local) ? local : [])
      .concat(Array.isArray(remote) ? remote : []);
    for (const item of all) {
      const key = item && item[keyName] != null ? String(item[keyName]) : '';
      if (!key) continue;
      const old = map.get(key);
      if (!old || Number(item.updatedAt || 0) >= Number(old.updatedAt || 0)) {
        map.set(key, Object.assign({}, item));
      }
    }
    return Array.from(map.values());
  }

  function normalizeGistId(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^(ghp_|github_pat_)/i.test(raw)) throw new Error('Bạn đang dán token vào ô Gist ID');
    const m = raw.match(/gist\.github\.com\/(?:[^/]+\/)?([a-f0-9]{20,64})(?:[/?#]|$)/i);
    if (m) return m[1];
    if (/^[a-f0-9]{20,64}$/i.test(raw)) return raw;
    throw new Error('Gist ID không hợp lệ');
  }

  function gistRequest(method, url, body) {
    return new Promise((resolve, reject) => {
      const token = String(gmGet(GIST_TOKEN_KEY, '') || '').trim();
      if (!token) {
        reject(new Error('Chưa cấu hình GitHub token'));
        return;
      }
      GM_xmlhttpRequest({
        method: method,
        url: url,
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: 'Bearer ' + token,
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json'
        },
        data: body ? JSON.stringify(body) : undefined,
        timeout: 15000,
        onload: res => {
          let data = null;
          try {
            data = res.responseText ? JSON.parse(res.responseText) : null;
          } catch (_) {}
          if (res.status >= 200 && res.status < 300) {
            resolve(data);
          } else {
            reject(new Error('GitHub HTTP ' + res.status + (data && data.message ? ': ' + data.message : '')));
          }
        },
        onerror: () => reject(new Error('Không kết nối được GitHub')),
        ontimeout: () => reject(new Error('GitHub timeout'))
      });
    });
  }

  function setSyncStatus(message) {
    const el = $('#vada-fb-sync-status');
    if (el && el.textContent !== message) el.textContent = message;
  }

  async function ensureGist() {
    let gistId = '';
    try {
      gistId = normalizeGistId(gmGet(GIST_ID_KEY, '') || '');
    } catch (_) {
      gmSet(GIST_ID_KEY, '');
    }
    if (gistId) return gistId;

    const created = await gistRequest('POST', 'https://api.github.com/gists', {
      description: 'VADA Facebook Group Manager Sync',
      public: false,
      files: {
        [GIST_FILE]: {
          content: JSON.stringify({
            version: 3,
            updatedAt: now(),
            items: reviewCache,
            groups: groupCache
          }, null, 2)
        }
      }
    });

    gistId = String(created && created.id ? created.id : '');
    if (!gistId) throw new Error('Không tạo được Gist');
    gmSet(GIST_ID_KEY, gistId);
    return gistId;
  }

  async function syncData(showToast) {
    const token = String(gmGet(GIST_TOKEN_KEY, '') || '').trim();
    if (!token) {
      setSyncStatus('☁ Chưa cấu hình đồng bộ');
      return;
    }

    if (syncBusy) {
      syncQueued = true;
      return;
    }

    syncBusy = true;
    setSyncStatus('☁ Đang đồng bộ...');

    try {
      const gistId = await ensureGist();
      let gist;
      try {
        gist = await gistRequest('GET', 'https://api.github.com/gists/' + encodeURIComponent(gistId));
      } catch (err) {
        if (/GitHub HTTP 404/.test(String(err && err.message || ''))) {
          throw new Error('Gist không tồn tại hoặc token không có quyền');
        }
        throw err;
      }

      let remoteItems = [];
      let remoteGroups = [];
      const raw = gist && gist.files && gist.files[GIST_FILE] ? gist.files[GIST_FILE].content : '';
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            remoteItems = parsed;
          } else {
            remoteItems = Array.isArray(parsed.items) ? parsed.items : [];
            remoteGroups = Array.isArray(parsed.groups) ? parsed.groups : [];
          }
        } catch (_) {}
      }

      reviewCache = mergeRecords(reviewCache, remoteItems, 'id');
      groupCache = mergeRecords(groupCache, remoteGroups, 'id')
        .map((g, i) => normalizeGroup(g, i, remoteGroups.length))
        .filter(Boolean);

      saveReviews(false);
      saveGroups(false);

      await gistRequest('PATCH', 'https://api.github.com/gists/' + encodeURIComponent(gistId), {
        files: {
          [GIST_FILE]: {
            content: JSON.stringify({
              version: 3,
              updatedAt: now(),
              items: reviewCache,
              groups: groupCache
            }, null, 2)
          }
        }
      });

      renderReviews();
      renderGroups();
      setSyncStatus('☁ Đã đồng bộ • ' + new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }));
      if (showToast) toast('Đã đồng bộ bài để duyệt + group.');
    } catch (err) {
      console.error('[VADA FB] sync:', err);
      setSyncStatus('☁ Lỗi: ' + err.message);
      if (showToast) toast('Đồng bộ lỗi: ' + err.message);
    } finally {
      syncBusy = false;
      if (syncQueued) {
        syncQueued = false;
        setTimeout(() => syncData(false), 500);
      }
    }
  }

  function queueSync(delay) {
    clearTimeout(syncDebounce);
    if (!String(gmGet(GIST_TOKEN_KEY, '') || '').trim()) return;
    syncDebounce = setTimeout(() => syncData(false), Number(delay) || 1000);
  }

  async function configureSync() {
    const oldId = String(gmGet(GIST_ID_KEY, '') || '');
    const gistInput = prompt(
      'GitHub Gist dùng chung giữa các máy.\n' +
      'Dán Gist ID hoặc URL Gist đầy đủ.\n' +
      'Để trống trên máy đầu tiên để tự tạo Gist:',
      oldId
    );
    if (gistInput === null) return;

    let gistId = '';
    try {
      gistId = normalizeGistId(gistInput);
    } catch (err) {
      alert(err.message);
      return;
    }

    const oldToken = String(gmGet(GIST_TOKEN_KEY, '') || '');
    const tokenInput = prompt(
      'GitHub token có quyền Gist.\n' +
      'Token chỉ lưu trong Tampermonkey trên máy này:',
      oldToken ? '••••••••' : ''
    );
    if (tokenInput === null) return;

    const token = tokenInput === '••••••••' ? oldToken : tokenInput.trim();
    if (!token) {
      alert('Chưa nhập GitHub token.');
      return;
    }

    gmSet(GIST_ID_KEY, gistId);
    gmSet(GIST_TOKEN_KEY, token);
    await syncData(true);
  }

  function currentGroup() {
    const match = location.pathname.match(/^\/groups\/([^/?#]+)/i);
    if (!match) return null;

    const id = match[1];
    const rootPath = '/groups/' + id;
    const ignored = new Set([
      'đoạn chat', 'trang chủ của cộng đồng', 'tổng quan', 'hỗ trợ quản trị',
      'yêu cầu hủy hiệu', 'bài viết đang chờ', 'có thể là spam', 'bài viết đã lên lịch',
      'nhật ký hoạt động', 'quy tắc nhóm', 'nội dung bị thành viên báo cáo',
      'thông báo kiểm duyệt', 'trạng thái nhóm', 'vai trò trong cộng đồng',
      'cài đặt nhóm', 'thêm thành viên', 'mức độ tăng trưởng', 'lượt tương tác',
      'quản trị viên và người kiểm duyệt', 'người tham gia'
    ]);

    const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
    const valid = value => {
      const text = clean(value);
      return text.length >= 2 && text.length <= 140 &&
        !ignored.has(text.toLowerCase()) && !/^facebook$/i.test(text);
    };

    let bestName = '';
    let bestScore = -1;

    for (const a of $$('a[href]')) {
      let u;
      try {
        u = new URL(a.href, location.origin);
      } catch (_) {
        continue;
      }
      if (u.origin !== location.origin) continue;
      const p = u.pathname.replace(/\/+$/, '');
      if (p !== rootPath && !p.startsWith(rootPath + '/')) continue;

      const label = clean(a.innerText || a.getAttribute('aria-label'));
      if (!valid(label)) continue;

      const r = a.getBoundingClientRect();
      let score = 0;
      if (p === rootPath) score += 500;
      if (r.top >= 0 && r.top < 150) score += 800;
      if (r.left >= 0 && r.left < 430) score += 250;
      if (a.closest('h1,h2,h3')) score += 500;
      if (label.length >= 5 && label.length <= 90) score += 100;

      if (score > bestScore) {
        bestScore = score;
        bestName = label;
      }
    }

    if (!valid(bestName)) {
      const og = clean($('meta[property="og:title"]') && $('meta[property="og:title"]').content);
      if (valid(og)) bestName = og;
    }

    if (!valid(bestName)) {
      const title = clean(document.title.replace(/\s*\|\s*Facebook\s*$/i, ''));
      if (valid(title)) bestName = title;
    }

    if (!valid(bestName)) bestName = 'Group ' + id;

    let icon = '';
    const ogImage = $('meta[property="og:image"]');
    if (ogImage && ogImage.content) icon = String(ogImage.content);

    if (!icon) {
      const imgs = $('img[src]');
      let bestImage = null;
      let bestImageScore = -1;
      for (const img of imgs) {
        if (!(img instanceof HTMLImageElement)) continue;
        if (img.closest('#' + PANEL_ID)) continue;
        const src = img.currentSrc || img.src || '';
        if (!src || !/scontent|fbcdn/i.test(src)) continue;
        const rect = img.getBoundingClientRect();
        if (rect.width < 40 || rect.height < 40) continue;
        let score = 0;
        if (rect.top >= 0 && rect.top < 320) score += 500;
        if (rect.left >= 0 && rect.left < 520) score += 250;
        score += Math.min(rect.width * rect.height / 1000, 300);
        if (score > bestImageScore) {
          bestImageScore = score;
          bestImage = src;
        }
      }
      if (bestImage) icon = bestImage;
    }

    return {
      id: String(id),
      name: bestName,
      icon: icon,
      url: 'https://www.facebook.com/groups/' + id + '/pending_posts'
    };
  }

  function addCurrentGroup() {
    const g = currentGroup();
    if (!g) {
      toast('Hãy mở một group Facebook trước.');
      return;
    }

    const time = now();
    const index = groupCache.findIndex(x => String(x.id) === g.id);
    if (index >= 0) {
      groupCache[index] = Object.assign({}, groupCache[index], g, {
        icon: g.icon || groupCache[index].icon || '',
        deleted: false,
        updatedAt: time
      });
    } else {
      const maxOrder = visibleGroups().reduce((m, x) => Math.max(m, Number(x.order) || 0), -1);
      groupCache.push(Object.assign({}, g, {
        alias: '',
        icon: g.icon || '',
        order: maxOrder + 1,
        deleted: false,
        createdAt: time,
        updatedAt: time
      }));
    }

    saveGroups();
    queueSync();
    toast(index >= 0 ? 'Đã cập nhật group.' : 'Đã lưu group.');
  }

  function editGroupAlias(url) {
    const item = groupCache.find(g => g.url === url);
    if (!item) return;
    const value = prompt('Nhập biệt danh cho group:', item.alias || item.name || '');
    if (value === null) return;
    item.alias = value.trim();
    item.deleted = false;
    item.updatedAt = now();
    saveGroups();
    queueSync();
    toast(item.alias ? 'Đã lưu biệt danh.' : 'Đã xóa biệt danh.');
  }

  function deleteGroup(url) {
    const item = groupCache.find(g => g.url === url);
    if (!item) return;
    item.deleted = true;
    item.updatedAt = now();
    saveGroups();
    queueSync();
    toast('Đã xóa group.');
  }

  function reorderGroup(sourceId, targetId, after) {
    sourceId = String(sourceId || '');
    targetId = String(targetId || '');
    if (!sourceId || !targetId || sourceId === targetId) return;

    const rows = visibleGroups();
    const from = rows.findIndex(g => String(g.id) === sourceId);
    let to = rows.findIndex(g => String(g.id) === targetId);
    if (from < 0 || to < 0) return;

    const moved = rows.splice(from, 1)[0];
    if (from < to) to--;
    if (after) to++;
    to = Math.max(0, Math.min(to, rows.length));
    rows.splice(to, 0, moved);

    const time = now();
    rows.forEach((g, index) => {
      const real = groupCache.find(x => String(x.id) === String(g.id));
      if (!real) return;
      real.order = index;
      real.updatedAt = time;
    });

    saveGroups();
    queueSync(500);
    toast('Đã lưu thứ tự group.');
  }

  function renderGroups() {
    const box = $('#vada-fb-group-list');
    if (!box) return;

    const rows = visibleGroups();
    const html = rows.length ? rows.map((g, index) => {
      const homeUrl = 'https://www.facebook.com/groups/' + encodeURIComponent(g.id);
      const reviewUrl = homeUrl + '/pending_posts';
      const iconHtml = g.icon ?
        '<img class="vada-fb-group-icon" src="' + escapeHtml(g.icon) + '" alt="">' :
        '<span class="vada-fb-group-icon vada-fb-group-icon-placeholder">■</span>';

      return (
        '<div class="vada-fb-group-row" draggable="true" data-group-id="' + escapeHtml(g.id) + '">' +
          '<div class="vada-fb-group-label" title="Kéo để sắp xếp • ' + escapeHtml(g.name) + '">' +
            '<span class="vada-fb-drag-handle" title="Kéo để sắp xếp">⋮⋮</span>' +
            iconHtml +
            '<span class="vada-fb-index">' + (index + 1) + '</span>' +
            '<span class="vada-fb-name">' + escapeHtml(g.alias || g.name || g.url) + '</span>' +
          '</div>' +
          '<button class="vada-fb-group-home" data-url="' + escapeHtml(homeUrl) + '" title="Trang chủ nhóm">🏠</button>' +
          '<button class="vada-fb-group-review" data-url="' + escapeHtml(reviewUrl) + '" title="Bài viết đang chờ">✓</button>' +
          '<button class="vada-fb-group-alias" data-url="' + escapeHtml(g.url) + '" title="Đặt biệt danh">✎</button>' +
          '<button class="vada-fb-group-delete" data-url="' + escapeHtml(g.url) + '" title="Xóa">×</button>' +
        '</div>'
      );
    }).join('') : '<div class="vada-fb-empty">Chưa lưu group nào.</div>';

    if (html !== lastGroupHtml) {
      lastGroupHtml = html;
      box.innerHTML = html;
    }
  }

  function normalizePostUrl(url) {
    try {
      const u = new URL(url, location.origin);
      u.hash = '';
      ['fbclid', '__cft__', '__tn__', 'mibextid', 'ref', 'refid'].forEach(k => u.searchParams.delete(k));
      return u.href;
    } catch (_) {
      return String(url || '').trim();
    }
  }

  function reviewId(url) {
    const value = normalizePostUrl(url);
    let hash = 2166136261;
    for (let i = 0; i < value.length; i++) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function saveReviewPost(url, title) {
    url = normalizePostUrl(url);
    if (!/^https?:\/\/(?:www\.)?facebook\.com\//i.test(url)) return false;

    const id = reviewId(url);
    const time = now();
    const group = currentGroup();
    const index = reviewCache.findIndex(x => String(x.id) === id);
    const old = index >= 0 ? reviewCache[index] : null;

    const item = {
      id: id,
      url: url,
      title: String(title || (old && old.title) || '').trim(),
      groupId: group ? group.id : (old && old.groupId) || '',
      groupName: group ? group.name : (old && old.groupName) || '',
      createdAt: old && old.createdAt ? old.createdAt : time,
      updatedAt: time,
      deleted: false
    };

    if (index >= 0) reviewCache[index] = item;
    else reviewCache.unshift(item);

    saveReviews();
    queueSync();
    toast(index >= 0 ? 'Đã cập nhật bài trong ĐỂ DUYỆT.' : 'Đã lưu bài vào ĐỂ DUYỆT.');
    return true;
  }

  function deleteReview(id) {
    const item = reviewCache.find(x => String(x.id) === String(id));
    if (!item) return;
    item.deleted = true;
    item.updatedAt = now();
    saveReviews();
    queueSync();
    toast('Đã xóa khỏi ĐỂ DUYỆT.');
  }

  function renderReviews() {
    const box = $('#vada-fb-review-list');
    if (!box) return;

    const rows = visibleReviews();
    const count = $('#vada-fb-review-count');
    if (count) count.textContent = rows.length ? String(rows.length) : '';

    const html = rows.length ? rows.map((item, index) => {
      let fallback = '';
      try {
        fallback = new URL(item.url).pathname.split('/').filter(Boolean).slice(-2).join('/');
      } catch (_) {}
      const label = item.title || item.groupName || fallback || ('Bài ' + (index + 1));
      return '<div class="vada-fb-review-row">' +
        '<button class="vada-fb-review-open" data-url="' + escapeHtml(item.url) + '">' +
          '<span class="vada-fb-index">' + (index + 1) + '</span>' +
          '<span class="vada-fb-name">' + escapeHtml(label) + '</span>' +
        '</button>' +
        '<button class="vada-fb-review-delete" data-id="' + escapeHtml(item.id) + '" title="Xóa">×</button>' +
      '</div>';
    }).join('') : '<div class="vada-fb-empty">Chưa lưu bài nào.</div>';

    if (html !== lastReviewHtml) {
      lastReviewHtml = html;
      box.innerHTML = html;
    }
  }

  function findArticlePermalink(article) {
    if (!(article instanceof HTMLElement)) return '';
    const links = $$('a[href]', article).map(a => a.href).filter(Boolean);
    return links.find(h => /\/groups\/[^/]+\/(?:posts|permalink)\/|story_fbid=|\/posts\/\d+/i.test(h)) || '';
  }

  async function saveClipboardPost() {
    let url = '';
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        url = await navigator.clipboard.readText();
      }
    } catch (_) {}

    if (!url) url = findArticlePermalink(lastArticle);
    if (!saveReviewPost(url, '')) {
      toast('Không đọc được link bài. Hãy bấm menu bài rồi thử lại.');
    }
  }

  function setupQuickSaveCapture() {
    quickSaveHandler = event => {
      const article = event.target && event.target.closest ? event.target.closest('[role="article"]') : null;
      if (article) lastArticle = article;

      const menuItem = event.target && event.target.closest ? event.target.closest('[role="menuitem"]') : null;
      if (!menuItem) return;

      const label = String(menuItem.innerText || '').replace(/\s+/g, ' ').trim().toLowerCase();
      if (!label.includes('sao chép liên kết để chia sẻ với quản trị viên')) return;

      setTimeout(saveClipboardPost, 180);
    };

    document.addEventListener('click', quickSaveHandler, true);
  }

  function cleanText(el) {
    return String(el && (el.innerText || el.textContent) || '').replace(/\s+/g, ' ').trim();
  }

  function candidateText(el) {
    if (!(el instanceof HTMLElement)) return false;
    if (el.closest('#' + PANEL_ID)) return false;
    if (el.hasAttribute(TARGET_ATTR)) return false;

    const text = cleanText(el);
    if (text.length < MIN_TEXT) return false;
    if (el.querySelector('img,video')) return false;
    if (el.querySelectorAll('button,[role="button"]').length > 4) return false;

    const rect = el.getBoundingClientRect();
    return rect.width > 150 && rect.height > 30;
  }

  function collapseTarget(el) {
    if (!candidateText(el)) return false;

    el.setAttribute(TARGET_ATTR, 'collapsed');

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
      const collapsed = el.getAttribute(TARGET_ATTR) === 'collapsed';
      el.setAttribute(TARGET_ATTR, collapsed ? 'expanded' : 'collapsed');
      button.textContent = collapsed ? 'Thu gọn' : 'Mở rộng';
    }, true);

    return true;
  }

  function processArticle(article) {
    if (!(article instanceof HTMLElement)) return;
    if (article.closest('#' + PANEL_ID)) return;
    if (article.querySelector('[' + TARGET_ATTR + ']')) return;

    const preferred = $(
      '[data-ad-rendering-role="story_message"],[data-ad-preview="message"],[data-ad-comet-preview="message"]',
      article
    );
    if (preferred && collapseTarget(preferred)) return;

    let best = null;
    let bestLength = 0;

    for (const el of $$('div[dir="auto"],span[dir="auto"]', article)) {
      if (!candidateText(el)) continue;
      const length = cleanText(el).length;
      if (length > bestLength) {
        best = el;
        bestLength = length;
      }
    }

    if (best) collapseTarget(best);
  }

  function scanPosts(root) {
    if (!root) return;

    if (root instanceof HTMLElement && root.matches('[role="article"]')) {
      processArticle(root);
      return;
    }

    for (const article of $$('[role="article"]', root)) {
      processArticle(article);
    }
  }

  function saveOriginalStyle(el) {
    if (!(el instanceof HTMLElement)) return;
    if (el.hasAttribute(ORIG_STYLE_ATTR)) return;
    el.setAttribute(HAD_STYLE_ATTR, el.hasAttribute('style') ? '1' : '0');
    el.setAttribute(ORIG_STYLE_ATTR, el.getAttribute('style') || '');
  }

  function restoreOriginalStyle(el) {
    if (!(el instanceof HTMLElement)) return;
    const had = el.getAttribute(HAD_STYLE_ATTR) === '1';
    const value = el.getAttribute(ORIG_STYLE_ATTR) || '';
    if (had) el.setAttribute('style', value);
    else el.removeAttribute('style');
    el.removeAttribute(ORIG_STYLE_ATTR);
    el.removeAttribute(HAD_STYLE_ATTR);
  }

  function isPostMedia(media) {
    if (!(media instanceof HTMLElement)) return false;
    if (media.closest('#' + PANEL_ID)) return false;

    if (media instanceof HTMLImageElement) {
      if (media.matches('img[data-imgperflogname="feedImage"]')) return true;
      if (!media.closest('[role="article"],main,[role="main"]')) return false;

      const rect = media.getBoundingClientRect();
      const width = Math.max(rect.width, media.width || 0, media.naturalWidth || 0);
      const height = Math.max(rect.height, media.height || 0, media.naturalHeight || 0);
      if (media.matches('img[data-visualcompletion="media-vc-image"]')) {
        return width >= 120 && height >= 80;
      }
      const src = media.currentSrc || media.src || '';
      return src.includes('scontent') && width >= 180 && height >= 120;
    }

    if (media instanceof HTMLVideoElement) {
      if (!media.closest('[role="article"],main,[role="main"]')) return false;
      const rect = media.getBoundingClientRect();
      const width = Math.max(rect.width, media.clientWidth || 0, media.videoWidth || 0);
      const height = Math.max(rect.height, media.clientHeight || 0, media.videoHeight || 0);
      return width >= 120 && height >= 80;
    }

    return false;
  }

  function isPendingPostsPage() {
    return /\/groups\/[^/]+\/pending_posts\/?$/i.test(location.pathname);
  }

  function isReviewActionContainer(node) {
    if (!(node instanceof HTMLElement)) return false;
    const text = cleanText(node);
    if (/\b(phê duyệt|từ chối|approve|decline)\b/i.test(text)) return true;
    return node.querySelectorAll('button,[role="button"]').length >= 3 && text.length > 20;
  }

  function findMediaBox(media) {
    const article = media.closest('[role="article"]');
    let node = media.parentElement;
    let best = null;

    for (let depth = 0; depth < 12 && node && node !== article; depth++, node = node.parentElement) {
      if (node.closest('#' + PANEL_ID)) break;
      if (isReviewActionContainer(node)) break;

      const text = cleanText(node);
      const controls = node.querySelectorAll('button,input,textarea,[role="button"]').length;
      const mediaCount = node.querySelectorAll('img,video').length;

      if (text.length > 45 || controls > 2 || mediaCount > 30) break;
      if (mediaCount >= 1) best = node;
    }

    return best;
  }

  function collapseMediaBox(box) {
    if (!(box instanceof HTMLElement) || box.hasAttribute(BOX_ATTR)) return;
    saveOriginalStyle(box);
    box.setAttribute(BOX_ATTR, '1');

    box.style.setProperty('display', 'none', 'important');
    box.style.setProperty('visibility', 'hidden', 'important');
    box.style.setProperty('height', '0px', 'important');
    box.style.setProperty('min-height', '0px', 'important');
    box.style.setProperty('max-height', '0px', 'important');
    box.style.setProperty('width', '0px', 'important');
    box.style.setProperty('min-width', '0px', 'important');
    box.style.setProperty('max-width', '0px', 'important');
    box.style.setProperty('margin', '0px', 'important');
    box.style.setProperty('padding', '0px', 'important');
    box.style.setProperty('padding-bottom', '0px', 'important');
    box.style.setProperty('aspect-ratio', 'auto', 'important');
    box.style.setProperty('overflow', 'hidden', 'important');
  }

  function collapseEmptyMediaParents(box, article) {
    if (!isPendingPostsPage() || !(box instanceof HTMLElement)) return;

    let node = box.parentElement;
    for (let depth = 0; depth < 5 && node && node !== article; depth++, node = node.parentElement) {
      if (node.closest('#' + PANEL_ID)) break;
      if (isReviewActionContainer(node)) break;

      const text = cleanText(node);
      const controls = node.querySelectorAll('button,input,textarea,[role="button"]').length;
      const mediaCount = node.querySelectorAll('img,video').length;

      if (text.length > 24 || controls > 1 || mediaCount < 1) break;
      collapseMediaBox(node);
    }
  }

  function hideOneMedia(media) {
    if (!hideMedia || !isPendingPostsPage() || !isPostMedia(media)) return false;

    const attr = media instanceof HTMLVideoElement ? VIDEO_ATTR : IMAGE_ATTR;
    if (media.hasAttribute(attr)) return false;

    if (media instanceof HTMLVideoElement) {
      try { media.pause(); } catch (_) {}
    }

    saveOriginalStyle(media);
    media.setAttribute(attr, '1');
    media.style.setProperty('display', 'none', 'important');
    media.style.setProperty('visibility', 'hidden', 'important');
    media.style.setProperty('width', '0px', 'important');
    media.style.setProperty('height', '0px', 'important');
    media.style.setProperty('min-width', '0px', 'important');
    media.style.setProperty('min-height', '0px', 'important');
    media.style.setProperty('max-width', '0px', 'important');
    media.style.setProperty('max-height', '0px', 'important');
    media.style.setProperty('margin', '0px', 'important');
    media.style.setProperty('padding', '0px', 'important');

    const box = findMediaBox(media);
    if (box) {
      const article = media.closest('[role="article"]');
      collapseMediaBox(box);
      collapseEmptyMediaParents(box, article);
    }

    hiddenCount++;
    return true;
  }

  function hideMediaIn(root) {
    if (!hideMedia || !isPendingPostsPage() || !root) return;

    let changed = false;
    if (root instanceof HTMLElement && root.matches(MEDIA_SELECTOR)) {
      changed = hideOneMedia(root) || changed;
    }

    for (const media of $$(MEDIA_SELECTOR, root)) {
      changed = hideOneMedia(media) || changed;
    }

    if (changed) updateMediaButton();
  }

  function restoreMedia() {
    const marked = $$(
      '[' + IMAGE_ATTR + '],[' + VIDEO_ATTR + '],[' + BOX_ATTR + ']'
    );

    for (const el of marked) {
      restoreOriginalStyle(el);
      el.removeAttribute(IMAGE_ATTR);
      el.removeAttribute(VIDEO_ATTR);
      el.removeAttribute(BOX_ATTR);
    }

    hiddenCount = 0;
  }

  function updateMediaButton() {
    const button = $('#vada-fb-hide-media');
    if (!button) return;

    const pending = isPendingPostsPage();
    button.disabled = !pending;
    button.style.opacity = pending ? '1' : '.55';
    button.style.cursor = pending ? 'pointer' : 'not-allowed';

    if (!pending) {
      button.textContent = '🎞 Chỉ ẩn ảnh/video ở Duyệt bài';
      return;
    }

    button.textContent = hideMedia ?
      '🎞 Hiện ảnh/video (' + hiddenCount + ' đã ẩn)' :
      '🎞 Ẩn toàn bộ ảnh + video';
  }

  function setHideMedia(value) {
    hideMedia = !!value;
    localStorage.setItem(MEDIA_KEY, hideMedia ? '1' : '0');

    if (!isPendingPostsPage()) {
      restoreMedia();
      updateMediaButton();
      toast('Ảnh/video chỉ được ẩn trong trang Duyệt bài.');
      return;
    }

    if (hideMedia) {
      hiddenCount = 0;
      hideMediaIn(document);
      toast('Đã bật ẩn ảnh/video trong Duyệt bài.');
    } else {
      restoreMedia();
      updateMediaButton();
      toast('Đã hiện lại ảnh/video.');
    }
  }

  function handleRouteChange(force) {
    const current = location.pathname;
    if (!force && current === lastPathname) return;
    lastPathname = current;

    if (!isPendingPostsPage()) {
      if (hiddenCount || document.querySelector('[' + IMAGE_ATTR + '],[' + VIDEO_ATTR + '],[' + BOX_ATTR + ']')) {
        restoreMedia();
      }
      updateMediaButton();
      return;
    }

    updateMediaButton();
    if (hideMedia) {
      hiddenCount = 0;
      hideMediaIn(document);
    }
  }

  function cancelWork() {
    if (!workHandle) return;
    if (workUsesIdle && typeof cancelIdleCallback === 'function') {
      cancelIdleCallback(workHandle);
    } else {
      clearTimeout(workHandle);
    }
    workHandle = 0;
  }

  function runPendingWork() {
    workHandle = 0;
    workUsesIdle = false;
    if (dragging) return;

    const roots = Array.from(pendingRoots);
    pendingRoots.clear();

    for (const root of roots) {
      if (!root || !root.isConnected) continue;
      if (root instanceof HTMLElement && root.closest('#' + PANEL_ID)) continue;
      scanPosts(root);
      hideMediaIn(root);
    }
  }

  function queueRoot(node) {
    if (!(node instanceof HTMLElement)) return;
    if (node.id === PANEL_ID || node.closest('#' + PANEL_ID)) return;

    const article = node.closest('[role="article"]');
    pendingRoots.add(article || node);

    if (workHandle || dragging) return;

    if (typeof requestIdleCallback === 'function') {
      workUsesIdle = true;
      workHandle = requestIdleCallback(runPendingWork, { timeout: 220 });
    } else {
      workUsesIdle = false;
      workHandle = setTimeout(runPendingWork, 80);
    }
  }

  function observeDom() {
    if (!observer || !document.body) return;
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  function startObserver() {
    if (observer) observer.disconnect();

    observer = new MutationObserver(mutations => {
      handleRouteChange(false);
      if (dragging) return;
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLElement) queueRoot(node);
        }
      }
    });

    observeDom();

    mediaLoadHandler = event => {
      const target = event.target;
      if (!hideMedia || !isPendingPostsPage()) return;
      if (target instanceof HTMLImageElement || target instanceof HTMLVideoElement) {
        if (hideOneMedia(target)) updateMediaButton();
      }
    };

    document.addEventListener('load', mediaLoadHandler, true);
    document.addEventListener('loadedmetadata', mediaLoadHandler, true);
  }

  function resetCollapsed() {
    $$('.vada-fb-expand-wrap').forEach(el => el.remove());
    $$('[' + TARGET_ATTR + ']').forEach(el => el.removeAttribute(TARGET_ATTR));
  }

  function loadPosition(panel) {
    try {
      const pos = JSON.parse(localStorage.getItem(POS_KEY) || 'null');
      if (!pos || !Number.isFinite(pos.left) || !Number.isFinite(pos.top)) return;
      panel.style.left = Math.max(0, Math.min(pos.left, innerWidth - 80)) + 'px';
      panel.style.top = Math.max(0, Math.min(pos.top, innerHeight - 40)) + 'px';
      panel.style.right = 'auto';
    } catch (_) {}
  }

  function enableDrag(panel) {
    const header = $('.vada-fb-header', panel);
    if (!header) return;

    header.addEventListener('pointerdown', event => {
      if (event.button !== 0 || event.target.closest('button')) return;
      event.preventDefault();

      const rect = panel.getBoundingClientRect();
      const startX = event.clientX;
      const startY = event.clientY;
      const baseLeft = rect.left;
      const baseTop = rect.top;
      const panelWidth = rect.width;
      let dx = 0;
      let dy = 0;

      dragging = true;
      cancelWork();
      if (observer) observer.disconnect();

      panel.style.right = 'auto';
      panel.style.left = baseLeft + 'px';
      panel.style.top = baseTop + 'px';
      panel.style.willChange = 'transform';
      panel.style.transition = 'none';

      const paint = () => {
        dragFrame = 0;
        panel.style.transform = 'translate3d(' + dx + 'px,' + dy + 'px,0)';
      };

      dragMove = moveEvent => {
        dx = Math.max(
          -baseLeft,
          Math.min(moveEvent.clientX - startX, innerWidth - panelWidth - baseLeft)
        );
        dy = Math.max(
          -baseTop,
          Math.min(moveEvent.clientY - startY, innerHeight - 34 - baseTop)
        );
        if (!dragFrame) dragFrame = requestAnimationFrame(paint);
      };

      dragUp = () => {
        if (dragFrame) {
          cancelAnimationFrame(dragFrame);
          dragFrame = 0;
        }

        const left = Math.round(baseLeft + dx);
        const top = Math.round(baseTop + dy);

        panel.style.transform = '';
        panel.style.willChange = '';
        panel.style.transition = '';
        panel.style.left = left + 'px';
        panel.style.top = top + 'px';

        localStorage.setItem(POS_KEY, JSON.stringify({ left: left, top: top }));

        window.removeEventListener('pointermove', dragMove, true);
        window.removeEventListener('pointerup', dragUp, true);
        window.removeEventListener('pointercancel', dragUp, true);

        dragMove = null;
        dragUp = null;
        dragging = false;
        observeDom();

        if (pendingRoots.size) {
          const root = pendingRoots.values().next().value;
          if (root) queueRoot(root);
        }
      };

      window.addEventListener('pointermove', dragMove, { capture: true, passive: true });
      window.addEventListener('pointerup', dragUp, true);
      window.addEventListener('pointercancel', dragUp, true);
    });
  }

  function latestCode() {
    return new Promise((resolve, reject) => {
      if (typeof GM_xmlhttpRequest !== 'function') {
        reject(new Error('Thiếu quyền GM_xmlhttpRequest'));
        return;
      }

      GM_xmlhttpRequest({
        method: 'GET',
        url: RAW_URL + '?_=' + now(),
        headers: {
          'Cache-Control': 'no-cache, no-store, max-age=0',
          Pragma: 'no-cache'
        },
        timeout: 15000,
        onload: res => {
          if (res.status < 200 || res.status >= 300) {
            reject(new Error('GitHub Raw HTTP ' + res.status));
            return;
          }
          const source = String(res.responseText || '');
          if (!source.includes('// ==UserScript==') || source.length < 1000) {
            reject(new Error('Code tải về không hợp lệ'));
            return;
          }
          resolve(source);
        },
        onerror: () => reject(new Error('Không tải được GitHub Raw')),
        ontimeout: () => reject(new Error('GitHub Raw timeout'))
      });
    });
  }

  async function hotReload() {
    const button = $('#vada-fb-load');
    if (button) {
      button.disabled = true;
      button.textContent = '↻ ĐANG LOAD...';
    }

    toast('Đang lấy code mới nhất...');

    try {
      const source = await latestCode();
      const match = source.match(/\/\/\s*@version\s+([^\s]+)/);
      const code = source.replace(/\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==\s*/, '');
      const runner = new Function('GM_xmlhttpRequest', 'GM_getValue', 'GM_setValue', code);

      toast('Đã lấy v' + (match ? match[1] : '?') + ' • đang chạy...');
      cleanup();

      setTimeout(() => {
        try {
          runner(GM_xmlhttpRequest, GM_getValue, GM_setValue);
        } catch (err) {
          console.error('[VADA FB] LOAD:', err);
          alert('FB LOAD lỗi: ' + err.message);
        }
      }, 30);
    } catch (err) {
      console.error('[VADA FB] LOAD:', err);
      if (button && button.isConnected) {
        button.disabled = false;
        button.textContent = '↻ LOAD';
      }
      toast('LOAD thất bại: ' + err.message);
    }
  }

  function addStyles() {
    const old = document.getElementById(STYLE_ID);
    if (old) old.remove();

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '#' + PANEL_ID + '{position:fixed;top:88px;right:14px;z-index:2147483646;width:360px;max-height:calc(100vh - 34px);overflow:hidden;background:#000;color:#f5f5f5;border:1px solid #262626;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.72);font:12px/1.35 Arial,sans-serif;contain:layout style paint}',
      '#' + PANEL_ID + ' *{box-sizing:border-box}',
      '#' + PANEL_ID + ' button{font-family:inherit}',
      '#' + PANEL_ID + ' .vada-fb-header{height:34px;padding:0 7px 0 10px;display:flex;align-items:center;justify-content:space-between;background:#000;color:#fff;border-bottom:1px solid #222;font-weight:700;cursor:move;user-select:none;touch-action:none}',
      '#' + PANEL_ID + ' .vada-fb-header-actions{display:flex;align-items:center;gap:6px}',
      '#' + PANEL_ID + ' .vada-fb-version{font-size:10px;color:#bbb}',
      '#' + PANEL_ID + ' #vada-fb-toggle{width:25px;height:25px;border:1px solid #2a2a2a;border-radius:6px;cursor:pointer;background:#111;color:#fff;font-size:17px}',
      '#' + PANEL_ID + ' .vada-fb-tabs{display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:7px 8px 0}',
      '#' + PANEL_ID + ' .vada-fb-tab{border:1px solid #242424;background:#090909;color:#999;border-radius:7px;padding:6px;cursor:pointer;font-size:11px;font-weight:700}',
      '#' + PANEL_ID + ' .vada-fb-tab.active{background:#171717;color:#fff;border-color:#444}',
      '#' + PANEL_ID + ' #vada-fb-panel-body{padding:8px;max-height:calc(100vh - 86px);overflow:auto;overscroll-behavior:contain}',
      '#' + PANEL_ID + ' .vada-fb-tab-pane{display:none}',
      '#' + PANEL_ID + ' .vada-fb-tab-pane.active{display:block}',
      '#' + PANEL_ID + ' .vada-fb-primary,#' + PANEL_ID + ' .vada-fb-secondary,#' + PANEL_ID + ' .vada-fb-load{width:100%;border-radius:7px;padding:7px 8px;cursor:pointer;font-weight:700}',
      '#' + PANEL_ID + ' .vada-fb-primary{background:#0a0a0a;color:#fff;border:1px solid #2a2a2a}',
      '#' + PANEL_ID + ' .vada-fb-secondary{margin-top:6px;background:#0a0a0a;color:#ddd;border:1px solid #2a2a2a}',
      '#' + PANEL_ID + ' .vada-fb-load{margin-top:7px;background:#111;color:#fff;border:1px solid #333}',
      '#' + PANEL_ID + ' .vada-fb-section-title{margin:10px 2px 5px;font-size:11px;font-weight:700;color:#bdbdbd}',
      '#' + PANEL_ID + ' .vada-fb-group-row,#' + PANEL_ID + ' .vada-fb-review-row{display:flex;gap:4px;margin-bottom:4px}',
      '#' + PANEL_ID + ' .vada-fb-group-row[draggable="true"]{transition:opacity .12s ease,transform .12s ease}',
      '#' + PANEL_ID + ' .vada-fb-group-row.vada-fb-dragging{opacity:.45}',
      '#' + PANEL_ID + ' .vada-fb-group-row.vada-fb-drop-before{box-shadow:inset 0 2px 0 #4ade80}',
      '#' + PANEL_ID + ' .vada-fb-group-row.vada-fb-drop-after{box-shadow:inset 0 -2px 0 #4ade80}',
      '#' + PANEL_ID + ' .vada-fb-group-label,#' + PANEL_ID + ' .vada-fb-review-open{min-width:0;flex:1;display:flex;align-items:center;gap:6px;border:1px solid #2a2a2a;background:#080808;border-radius:7px;padding:5px 6px;text-align:left;color:#f5f5f5}',
      '#' + PANEL_ID + ' .vada-fb-group-label{cursor:grab;user-select:none}',
      '#' + PANEL_ID + ' .vada-fb-group-row.vada-fb-dragging .vada-fb-group-label{cursor:grabbing}',
      '#' + PANEL_ID + ' .vada-fb-drag-handle{color:#777;font-size:12px;letter-spacing:-2px;flex:0 0 13px}',
      '#' + PANEL_ID + ' .vada-fb-group-icon{width:24px;height:24px;flex:0 0 24px;border-radius:5px;object-fit:cover;background:#141414;border:1px solid #2a2a2a}',
      '#' + PANEL_ID + ' .vada-fb-group-icon-placeholder{display:flex;align-items:center;justify-content:center;color:#555;font-size:8px}',
      '#' + PANEL_ID + ' .vada-fb-review-open{cursor:pointer}',
      '#' + PANEL_ID + ' .vada-fb-index{width:18px;height:18px;flex:0 0 18px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#1a1a1a;color:#fff;font-size:10px;font-weight:700}',
      '#' + PANEL_ID + ' .vada-fb-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px}',
      '#' + PANEL_ID + ' .vada-fb-group-home,#' + PANEL_ID + ' .vada-fb-group-review,#' + PANEL_ID + ' .vada-fb-group-alias,#' + PANEL_ID + ' .vada-fb-group-delete,#' + PANEL_ID + ' .vada-fb-review-delete{width:28px;flex:0 0 28px;border-radius:7px;cursor:pointer;padding:0}',
      '#' + PANEL_ID + ' .vada-fb-group-home{background:#101820;color:#dbeafe;border:1px solid #203044}',
      '#' + PANEL_ID + ' .vada-fb-group-review{background:#0b1a0f;color:#86efac;border:1px solid #173820}',
      '#' + PANEL_ID + ' .vada-fb-group-alias{background:#111;color:#ddd;border:1px solid #2a2a2a}',
      '#' + PANEL_ID + ' .vada-fb-group-delete,#' + PANEL_ID + ' .vada-fb-review-delete{background:#160000;color:#ff6b6b;border:1px solid #3a1111;font-size:18px}',
      '#' + PANEL_ID + ' .vada-fb-empty,#' + PANEL_ID + ' .vada-fb-status,#' + PANEL_ID + ' .vada-fb-sync-status{padding:7px;border-radius:7px;background:#080808;color:#999;border:1px solid #222;font-size:10px}',
      '[' + TARGET_ATTR + '="collapsed"]{display:-webkit-box!important;-webkit-box-orient:vertical!important;-webkit-line-clamp:' + MAX_LINES + '!important;overflow:hidden!important}',
      '[' + TARGET_ATTR + '="expanded"]{display:block!important;-webkit-line-clamp:unset!important;overflow:visible!important}',
      '[' + IMAGE_ATTR + '="1"],[' + VIDEO_ATTR + '="1"],[' + BOX_ATTR + '="1"]{display:none!important;visibility:hidden!important;height:0!important;min-height:0!important;max-height:0!important;margin:0!important;padding:0!important;overflow:hidden!important}',
      '.vada-fb-expand-wrap{margin:3px 0!important}',
      'body:has([role="article"]) [role="article"]{scroll-margin-top:70px}',
      'body:has([href*="/pending_posts"]) [' + BOX_ATTR + '="1"]{aspect-ratio:auto!important;padding-bottom:0!important}',
      '.vada-fb-expand-btn{border:0!important;background:transparent!important;padding:2px 0!important;color:#5b9cff!important;cursor:pointer!important;font:700 12px Arial,sans-serif!important}',
      '#vada-fb-toast{position:fixed;right:20px;bottom:20px;z-index:2147483647;background:#000;color:#fff;border:1px solid #2a2a2a;border-radius:8px;padding:9px 12px;font:12px Arial,sans-serif}'
    ].join('\n');

    document.head.appendChild(style);
  }

  function createPanel() {
    const old = document.getElementById(PANEL_ID);
    if (old) old.remove();

    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.innerHTML =
      '<div class="vada-fb-header">' +
        '<span>■ FB GROUP</span>' +
        '<div class="vada-fb-header-actions">' +
          '<span class="vada-fb-version">v' + VERSION + '</span>' +
          '<button id="vada-fb-toggle">−</button>' +
        '</div>' +
      '</div>' +
      '<div class="vada-fb-tabs">' +
        '<button class="vada-fb-tab active" data-tab="groups">GROUP</button>' +
        '<button class="vada-fb-tab" data-tab="review">ĐỂ DUYỆT <span id="vada-fb-review-count"></span></button>' +
      '</div>' +
      '<div id="vada-fb-panel-body">' +
        '<div class="vada-fb-tab-pane active" data-pane="groups">' +
          '<button id="vada-fb-add-current" class="vada-fb-primary">＋ Lưu group hiện tại</button>' +
          '<div class="vada-fb-section-title">📌 DANH SÁCH GROUP</div>' +
          '<div id="vada-fb-group-list"></div>' +
          '<div class="vada-fb-section-title">📑 ĐỌC NHANH BÀI DÀI</div>' +
          '<div class="vada-fb-status">Bài dài tự thu gọn còn ' + MAX_LINES + ' dòng.</div>' +
          '<button id="vada-fb-rescan" class="vada-fb-secondary">↻ Quét lại bài viết</button>' +
          '<button id="vada-fb-hide-media" class="vada-fb-secondary"></button>' +
        '</div>' +
        '<div class="vada-fb-tab-pane" data-pane="review">' +
          '<button id="vada-fb-save-clipboard" class="vada-fb-primary">＋ Lưu link đang copy</button>' +
          '<div class="vada-fb-section-title">🕒 BÀI ĐỂ DUYỆT SAU</div>' +
          '<div id="vada-fb-review-list"></div>' +
          '<div id="vada-fb-sync-status" class="vada-fb-sync-status">☁ Chưa cấu hình đồng bộ</div>' +
          '<button id="vada-fb-sync-now" class="vada-fb-secondary">☁ Đồng bộ ngay</button>' +
          '<button id="vada-fb-sync-config" class="vada-fb-secondary">⚙ Cấu hình đồng bộ</button>' +
        '</div>' +
        '<button id="vada-fb-load" class="vada-fb-load">↻ LOAD</button>' +
      '</div>';

    document.body.appendChild(panel);
    loadPosition(panel);
    enableDrag(panel);
    renderGroups();
    renderReviews();
    handleRouteChange(true);

    if (String(gmGet(GIST_TOKEN_KEY, '') || '').trim()) {
      setSyncStatus('☁ Sẵn sàng đồng bộ');
      queueSync(250);
    }

    const clearDropMarks = () => {
      $('.vada-fb-group-row', panel).forEach(row => {
        row.classList.remove('vada-fb-drop-before', 'vada-fb-drop-after');
      });
    };

    panel.addEventListener('dragstart', event => {
      const row = event.target.closest('.vada-fb-group-row[data-group-id]');
      if (!row) return;
      draggingGroupId = row.getAttribute('data-group-id') || '';
      row.classList.add('vada-fb-dragging');
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', draggingGroupId);
      }
    });

    panel.addEventListener('dragover', event => {
      const row = event.target.closest('.vada-fb-group-row[data-group-id]');
      if (!row || !draggingGroupId || row.getAttribute('data-group-id') === draggingGroupId) return;
      event.preventDefault();
      clearDropMarks();
      const rect = row.getBoundingClientRect();
      const after = event.clientY > rect.top + rect.height / 2;
      row.classList.add(after ? 'vada-fb-drop-after' : 'vada-fb-drop-before');
      row.dataset.dropAfter = after ? '1' : '0';
    });

    panel.addEventListener('drop', event => {
      const row = event.target.closest('.vada-fb-group-row[data-group-id]');
      if (!row || !draggingGroupId) return;
      event.preventDefault();
      const targetId = row.getAttribute('data-group-id') || '';
      const after = row.dataset.dropAfter === '1';
      reorderGroup(draggingGroupId, targetId, after);
      draggingGroupId = '';
      clearDropMarks();
    });

    panel.addEventListener('dragend', event => {
      const row = event.target.closest('.vada-fb-group-row[data-group-id]');
      if (row) row.classList.remove('vada-fb-dragging');
      draggingGroupId = '';
      clearDropMarks();
    });

    panel.addEventListener('click', event => {
      const tab = event.target.closest('.vada-fb-tab');
      if (tab) {
        $$('.vada-fb-tab', panel).forEach(el => el.classList.toggle('active', el === tab));
        $$('.vada-fb-tab-pane', panel).forEach(el => {
          el.classList.toggle('active', el.getAttribute('data-pane') === tab.getAttribute('data-tab'));
        });
        return;
      }

      const reviewOpen = event.target.closest('.vada-fb-review-open');
      if (reviewOpen) {
        window.open(reviewOpen.getAttribute('data-url'), '_blank', 'noopener');
        return;
      }

      const reviewDelete = event.target.closest('.vada-fb-review-delete');
      if (reviewDelete) {
        deleteReview(reviewDelete.getAttribute('data-id'));
        return;
      }

      const groupHome = event.target.closest('.vada-fb-group-home');
      if (groupHome) {
        location.href = groupHome.getAttribute('data-url');
        return;
      }

      const groupReview = event.target.closest('.vada-fb-group-review');
      if (groupReview) {
        location.href = groupReview.getAttribute('data-url');
        return;
      }

      const aliasButton = event.target.closest('.vada-fb-group-alias');
      if (aliasButton) {
        editGroupAlias(aliasButton.getAttribute('data-url'));
        return;
      }

      const deleteButton = event.target.closest('.vada-fb-group-delete');
      if (deleteButton) {
        deleteGroup(deleteButton.getAttribute('data-url'));
        return;
      }

      if (event.target.closest('#vada-fb-add-current')) {
        addCurrentGroup();
        return;
      }

      if (event.target.closest('#vada-fb-save-clipboard')) {
        saveClipboardPost();
        return;
      }

      if (event.target.closest('#vada-fb-sync-now')) {
        syncData(true);
        return;
      }

      if (event.target.closest('#vada-fb-sync-config')) {
        configureSync();
        return;
      }

      if (event.target.closest('#vada-fb-rescan')) {
        resetCollapsed();
        scanPosts(document);
        if (hideMedia) {
          hiddenCount = 0;
          restoreMedia();
          hideMediaIn(document);
        }
        toast('Đã quét lại bài viết.');
        return;
      }

      if (event.target.closest('#vada-fb-hide-media')) {
        setHideMedia(!hideMedia);
        return;
      }

      if (event.target.closest('#vada-fb-load')) {
        hotReload();
        return;
      }

      if (event.target.closest('#vada-fb-toggle')) {
        const body = $('#vada-fb-panel-body', panel);
        const tabs = $('.vada-fb-tabs', panel);
        const hidden = body.style.display === 'none';
        body.style.display = hidden ? '' : 'none';
        tabs.style.display = hidden ? '' : 'none';
        $('#vada-fb-toggle', panel).textContent = hidden ? '−' : '+';
      }
    });
  }

  function startSyncLoop() {
    clearInterval(syncInterval);
    syncInterval = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (!String(gmGet(GIST_TOKEN_KEY, '') || '').trim()) return;
      syncData(false);
    }, 60000);

    visibilityHandler = () => {
      if (document.visibilityState === 'visible' && String(gmGet(GIST_TOKEN_KEY, '') || '').trim()) {
        queueSync(800);
      }
    };

    document.addEventListener('visibilitychange', visibilityHandler);
  }

  function cleanup() {
    if (observer) observer.disconnect();
    observer = null;

    cancelWork();
    pendingRoots.clear();

    clearTimeout(toastTimer);
    clearTimeout(syncDebounce);
    clearInterval(syncInterval);

    if (dragFrame) cancelAnimationFrame(dragFrame);
    dragFrame = 0;

    if (dragMove) window.removeEventListener('pointermove', dragMove, true);
    if (dragUp) {
      window.removeEventListener('pointerup', dragUp, true);
      window.removeEventListener('pointercancel', dragUp, true);
    }

    dragMove = null;
    dragUp = null;
    dragging = false;

    if (quickSaveHandler) document.removeEventListener('click', quickSaveHandler, true);
    if (mediaLoadHandler) {
      document.removeEventListener('load', mediaLoadHandler, true);
      document.removeEventListener('loadedmetadata', mediaLoadHandler, true);
    }
    if (visibilityHandler) document.removeEventListener('visibilitychange', visibilityHandler);

    quickSaveHandler = null;
    mediaLoadHandler = null;
    visibilityHandler = null;

    resetCollapsed();
    restoreMedia();

    const panel = document.getElementById(PANEL_ID);
    if (panel) panel.remove();

    const style = document.getElementById(STYLE_ID);
    if (style) style.remove();

    const toastEl = document.getElementById('vada-fb-toast');
    if (toastEl) toastEl.remove();
  }

  function init() {
    if (!document.body || !document.head) {
      setTimeout(init, 50);
      return;
    }

    loadGroups();
    loadReviews();
    addStyles();
    createPanel();

    scanPosts(document);
    handleRouteChange(true);

    setupQuickSaveCapture();
    startObserver();
    startSyncLoop();

    window[INSTANCE_KEY] = {
      version: VERSION,
      cleanup: cleanup
    };
  }

  init();
})();