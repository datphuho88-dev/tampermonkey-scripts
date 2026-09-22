// ==UserScript==
// @name         🟦 Facebook - Group Manager - Danh sách group • Thu gọn bài dài
// @namespace    https://github.com/datphuho88-dev/tampermonkey-scripts
// @version      1.5.1
// @description  Quản lý danh sách group Facebook, thu gọn bài dài, ẩn ảnh/video duyệt bài, kéo panel và hot reload chống CSP.
// @author       VADA
// @match        https://www.facebook.com/*
// @match        https://facebook.com/*
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

  const VERSION = '1.5.1';
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
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];

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
      return Array.isArray(data) ? data : [];
    } catch (_) { return []; }
  }

  function saveGroups(data) {
    localStorage.setItem(GROUP_KEY, JSON.stringify(data));
  }


  function normalizeGistId(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^(ghp_|github_pat_)/i.test(raw)) throw new Error('Bạn đang dán token vào ô Gist ID');
    const m = raw.match(/gist\.github\.com\/(?:[^/]+\/)?([a-f0-9]{20,64})(?:[/?#]|$)/i);
    if (m) return m[1];
    if (/^[a-f0-9]{20,64}$/i.test(raw)) return raw;
    throw new Error('Gist ID không hợp lệ. Hãy dán ID hoặc URL Gist đầy đủ.');
  }

  function reviewRecords() {
    try {
      const data = GM_getValue(SAVED_KEY, []);
      return Array.isArray(data) ? data : [];
    } catch (_) { return []; }
  }

  function saveReviewRecords(data) {
    try { GM_setValue(SAVED_KEY, Array.isArray(data) ? data : []); } catch (_) {}
  }

  function normalizePostUrl(url) {
    try {
      const u = new URL(url, location.origin);
      u.hash = '';
      for (const k of [...u.searchParams.keys()]) {
        if (/^(fbclid|__cft__|__tn__|mibextid|ref|refid)$/i.test(k)) u.searchParams.delete(k);
      }
      return u.href;
    } catch (_) { return String(url || '').trim(); }
  }

  function reviewId(url) {
    const s = normalizePostUrl(url);
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(36);
  }

  function visibleReviewRecords() {
    return reviewRecords()
      .filter(x => x && !x.deleted && x.url)
      .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
  }

  function renderReviewList() {
    const box = $('#vada-fb-review-list');
    if (!box) return;
    const rows = visibleReviewRecords();
    const count = $('#vada-fb-review-count');
    if (count) count.textContent = rows.length ? String(rows.length) : '';
    if (!rows.length) {
      box.innerHTML = '<div class="vada-fb-empty">Chưa lưu bài nào.</div>';
      return;
    }
    box.innerHTML = rows.map((item, i) => {
      let host = '';
      try { host = new URL(item.url).pathname.split('/').filter(Boolean).slice(-2).join('/'); } catch (_) {}
      const label = item.title || item.groupName || host || ('Bài ' + (i + 1));
      return `
        <div class="vada-fb-review-row">
          <button class="vada-fb-review-open" data-id="${esc(item.id)}" data-url="${esc(item.url)}" title="${esc(item.url)}">
            <span class="vada-fb-review-index">${i + 1}</span>
            <span class="vada-fb-review-name">${esc(label)}</span>
          </button>
          <button class="vada-fb-review-delete" data-id="${esc(item.id)}" title="Xóa">×</button>
        </div>`;
    }).join('');
  }

  function mergeReviewRecords(local, remote) {
    const map = new Map();
    for (const item of [...(Array.isArray(local) ? local : []), ...(Array.isArray(remote) ? remote : [])]) {
      if (!item?.id) continue;
      const old = map.get(item.id);
      if (!old || Number(item.updatedAt || 0) >= Number(old.updatedAt || 0)) map.set(item.id, item);
    }
    return [...map.values()];
  }

  function githubGistRequest(method, url, body) {
    return new Promise((resolve, reject) => {
      const token = String(GM_getValue(GIST_TOKEN_KEY, '') || '').trim();
      if (!token) return reject(new Error('Chưa cấu hình GitHub token'));
      GM_xmlhttpRequest({
        method,
        url,
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': 'Bearer ' + token,
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json'
        },
        data: body ? JSON.stringify(body) : undefined,
        timeout: 15000,
        onload(res) {
          let data = null;
          try { data = res.responseText ? JSON.parse(res.responseText) : null; } catch (_) {}
          if (res.status >= 200 && res.status < 300) resolve(data);
          else reject(new Error('GitHub HTTP ' + res.status + (data?.message ? ': ' + data.message : '')));
        },
        onerror() { reject(new Error('Không kết nối được GitHub')); },
        ontimeout() { reject(new Error('GitHub timeout')); }
      });
    });
  }

  function setSyncStatus(text) {
    const el = $('#vada-fb-sync-status');
    if (el) el.textContent = text;
  }

  async function ensureGist() {
    let gistId = '';
    try { gistId = normalizeGistId(GM_getValue(GIST_ID_KEY, '') || ''); }
    catch (_) { GM_setValue(GIST_ID_KEY, ''); gistId = ''; }
    if (gistId) return gistId;
    const created = await githubGistRequest('POST', 'https://api.github.com/gists', {
      description: 'VADA Facebook review queue sync',
      public: false,
      files: { [GIST_FILE]: { content: JSON.stringify({ version: 1, items: reviewRecords() }, null, 2) } }
    });
    gistId = String(created?.id || '');
    if (!gistId) throw new Error('Không tạo được Gist');
    GM_setValue(GIST_ID_KEY, gistId);
    return gistId;
  }

  async function syncReviews(showToast = false) {
    const token = String(GM_getValue(GIST_TOKEN_KEY, '') || '').trim();
    if (!token) {
      setSyncStatus('☁ Chưa cấu hình đồng bộ');
      return;
    }
    setSyncStatus('☁ Đang đồng bộ...');
    try {
      const gistId = await ensureGist();
      let gist;
      try {
        gist = await githubGistRequest('GET', 'https://api.github.com/gists/' + encodeURIComponent(gistId));
      } catch (err) {
        if (/GitHub HTTP 404/.test(String(err?.message || ''))) {
          setSyncStatus('☁ Gist không tồn tại hoặc không có quyền truy cập');
          if (showToast) alert('Gist ID sai, Gist đã bị xóa, hoặc token không có quyền truy cập Gist này.\n\nMáy đầu tiên: vào Cấu hình đồng bộ và để trống Gist ID để tạo Gist mới.\nMáy khác: dán đúng URL/ID của Gist đã tạo.');
          return;
        }
        throw err;
      }
      let remoteItems = [];
      const raw = gist?.files?.[GIST_FILE]?.content || '';
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          remoteItems = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.items) ? parsed.items : []);
        } catch (_) {}
      }
      const merged = mergeReviewRecords(reviewRecords(), remoteItems);
      saveReviewRecords(merged);
      await githubGistRequest('PATCH', 'https://api.github.com/gists/' + encodeURIComponent(gistId), {
        files: { [GIST_FILE]: { content: JSON.stringify({ version: 1, updatedAt: Date.now(), items: merged }, null, 2) } }
      });
      renderReviewList();
      setSyncStatus('☁ Đã đồng bộ • ' + new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }));
      if (showToast) toast('Đã đồng bộ danh sách để duyệt.');
    } catch (err) {
      console.error('[VADA FB] sync lỗi:', err);
      setSyncStatus('☁ Lỗi: ' + err.message);
      if (showToast) toast('Đồng bộ lỗi: ' + err.message);
    }
  }

  function scheduleReviewSync() {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => syncReviews(false), 700);
  }

  function saveReviewPost(url, title = '') {
    url = normalizePostUrl(url);
    if (!/^https?:\/\/(?:www\.)?facebook\.com\//i.test(url)) return false;
    const now = Date.now();
    const id = reviewId(url);
    const data = reviewRecords();
    const i = data.findIndex(x => x.id === id);
    const g = currentGroup();
    const old = i >= 0 ? data[i] : null;
    const item = {
      id,
      url,
      title: String(title || old?.title || '').trim(),
      groupId: g?.id || old?.groupId || '',
      groupName: g?.name || old?.groupName || '',
      createdAt: old?.createdAt || now,
      updatedAt: now,
      deleted: false
    };
    if (i >= 0) data[i] = item;
    else data.unshift(item);
    saveReviewRecords(data);
    renderReviewList();
    scheduleReviewSync();
    toast(i >= 0 ? 'Đã cập nhật bài trong ĐỂ DUYỆT.' : 'Đã lưu bài vào ĐỂ DUYỆT.');
    return true;
  }

  function deleteReviewPost(id) {
    const data = reviewRecords();
    const i = data.findIndex(x => x.id === id);
    if (i < 0) return;
    data[i] = { ...data[i], deleted: true, updatedAt: Date.now() };
    saveReviewRecords(data);
    renderReviewList();
    scheduleReviewSync();
    toast('Đã xóa khỏi danh sách để duyệt.');
  }

  function findArticlePermalink(article) {
    if (!(article instanceof HTMLElement)) return '';
    const links = [...article.querySelectorAll('a[href]')].map(a => a.href).filter(Boolean);
    return links.find(h => /\/groups\/[^/]+\/posts\/|\/permalink\/|story_fbid=|\/posts\//i.test(h)) || '';
  }

  async function saveClipboardPost() {
    let url = '';
    try { url = await navigator.clipboard.readText(); } catch (_) {}
    if (!url) url = findArticlePermalink(lastArticle);
    if (!saveReviewPost(url)) toast('Không đọc được link bài. Hãy cho phép đọc clipboard hoặc mở menu bài rồi thử lại.');
  }

  function setupQuickSaveCapture() {
    quickSaveHandler = e => {
      const article = e.target?.closest?.('[role="article"]');
      if (article) lastArticle = article;

      const action = e.target?.closest?.('[role="menuitem"],[role="button"],button');
      const t = (action?.innerText || e.target?.innerText || '').replace(/\s+/g, ' ').trim().toLowerCase();
      if (!t.includes('sao chép liên kết để chia sẻ với quản trị viên')) return;
      setTimeout(() => saveClipboardPost(), 180);
    };
    document.addEventListener('click', quickSaveHandler, true);
  }

  async function configureReviewSync() {
    const oldId = String(GM_getValue(GIST_ID_KEY, '') || '');
    const gistInput = prompt('GitHub Gist dùng chung giữa các máy.\nCó thể dán Gist ID hoặc URL Gist đầy đủ.\nĐể trống nếu muốn tạo Gist mới:', oldId);
    if (gistInput === null) return;

    let gistId = '';
    try { gistId = normalizeGistId(gistInput); }
    catch (err) { alert(err.message); return; }

    const oldToken = String(GM_getValue(GIST_TOKEN_KEY, '') || '');
    const token = prompt('GitHub token có quyền Gist.\nToken chỉ lưu trong Tampermonkey trên máy này, không ghi vào userscript/GitHub repo:', oldToken ? '••••••••' : '');
    if (token === null) return;

    const cleanToken = token === '••••••••' ? oldToken : token.trim();
    if (/^https?:\/\//i.test(cleanToken) || /^[a-f0-9]{20,64}$/i.test(cleanToken)) {
      alert('Ô token không đúng định dạng. Hãy dán GitHub Personal Access Token.');
      return;
    }

    GM_setValue(GIST_ID_KEY, gistId);
    if (token !== '••••••••') GM_setValue(GIST_TOKEN_KEY, cleanToken);
    await syncReviews(true);
  }

  function currentGroup() {
    const m = location.pathname.match(/^\/groups\/([^/?#]+)/i);
    if (!m) return null;

    const id = m[1];
    const rootPath = `/groups/${id}`;
    const ignored = new Set([
      'đoạn chat','trang chủ của cộng đồng','tổng quan','hỗ trợ quản trị',
      'yêu cầu hủy hiệu','bài viết đang chờ','có thể là spam','bài viết đã lên lịch',
      'nhật ký hoạt động','quy tắc nhóm','nội dung bị thành viên báo cáo',
      'thông báo kiểm duyệt','trạng thái nhóm','vai trò trong cộng đồng',
      'cài đặt nhóm','thêm thành viên','mức độ tăng trưởng','lượt tương tác',
      'quản trị viên và người kiểm duyệt','người tham gia'
    ]);

    const clean = s => String(s || '').replace(/\s+/g, ' ').trim();
    const valid = s => {
      const t = clean(s);
      if (!t || t.length < 2 || t.length > 140) return false;
      return !ignored.has(t.toLowerCase()) && !/^facebook$/i.test(t);
    };

    const candidates = [];
    for (const a of document.querySelectorAll('a[href]')) {
      let u;
      try { u = new URL(a.href, location.origin); } catch (_) { continue; }
      if (u.origin !== location.origin) continue;

      const p = u.pathname.replace(/\/+$/, '');
      if (p !== rootPath && !p.startsWith(rootPath + '/')) continue;

      const label = clean(a.innerText || a.getAttribute('aria-label'));
      if (!valid(label)) continue;

      const r = a.getBoundingClientRect();
      let score = 0;
      if (p === rootPath) score += 500;
      if (r.top >= 0 && r.top < 135) score += 900;
      if (r.left >= 0 && r.left < 420) score += 350;
      if (a.closest('h1,h2,h3')) score += 500;
      if (label.length >= 6 && label.length <= 80) score += 100;
      candidates.push({ name: label, score });
    }

    candidates.sort((a, b) => b.score - a.score || a.name.length - b.name.length);
    let name = candidates[0]?.name || '';

    if (!valid(name)) {
      const og = clean(document.querySelector('meta[property="og:title"]')?.content);
      if (valid(og)) name = og;
    }

    if (!valid(name)) {
      const title = clean(document.title.replace(/\s*\|\s*Facebook\s*$/i, ''));
      if (valid(title) && !ignored.has(title.toLowerCase())) name = title;
    }

    if (!valid(name)) name = `Group ${id}`;
    return { id, name, url: `${location.origin}/groups/${id}/pending_posts` };
  }

  function esc(v) {
    return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function renderGroups() {
    const box = $('#vada-fb-group-list');
    if (!box) return;
    const data = groups();
    if (!data.length) {
      box.innerHTML = '<div class="vada-fb-empty">Chưa lưu group nào.</div>';
      return;
    }
    box.innerHTML = data.map((g, i) => `
      <div class="vada-fb-group-row">
        <button class="vada-fb-group-open" data-url="${esc(g.url)}"><span class="vada-fb-group-index">${i + 1}</span><span class="vada-fb-group-name">${esc(g.alias || g.name || g.url)}</span></button>
        <button class="vada-fb-group-alias" data-url="${esc(g.url)}" title="Đặt biệt danh">✎</button>
        <button class="vada-fb-group-delete" data-url="${esc(g.url)}" title="Xóa">×</button>
      </div>`).join('');
  }

  function addCurrentGroup() {
    const g = currentGroup();
    if (!g) return toast('Hãy mở một group Facebook trước.');
    const data = groups();
    const i = data.findIndex(x => x.id === g.id || x.url === g.url);
    if (i >= 0) data[i] = { ...data[i], ...g };
    else data.unshift(g);
    saveGroups(data);
    renderGroups();
    toast(i >= 0 ? 'Đã cập nhật group.' : 'Đã lưu group.');
  }

  function loadPosition(panel) {
    try {
      const p = JSON.parse(localStorage.getItem(POS_KEY) || 'null');
      if (!p || !Number.isFinite(p.left) || !Number.isFinite(p.top)) return;
      panel.style.left = `${Math.max(0, Math.min(p.left, innerWidth - 80))}px`;
      panel.style.top = `${Math.max(0, Math.min(p.top, innerHeight - 40))}px`;
      panel.style.right = 'auto';
    } catch (_) {}
  }

  function enableDrag(panel) {
    const head = $('.vada-fb-header', panel);
    if (!head) return;

    head.addEventListener('pointerdown', e => {
      if (e.button !== 0 || e.target.closest('button')) return;
      e.preventDefault();

      const r = panel.getBoundingClientRect();
      const startX = e.clientX;
      const startY = e.clientY;
      const baseLeft = r.left;
      const baseTop = r.top;
      const panelW = r.width;
      const panelH = r.height;
      let dx = 0;
      let dy = 0;

      dragging = true;
      clearTimeout(scanTimer);
      observer?.disconnect();

      panel.style.right = 'auto';
      panel.style.left = baseLeft + 'px';
      panel.style.top = baseTop + 'px';
      panel.style.willChange = 'transform';
      panel.style.transform = 'translate3d(0,0,0)';
      panel.style.transition = 'none';

      const render = () => {
        dragFrame = 0;
        panel.style.transform = `translate3d(${dx}px,${dy}px,0)`;
      };

      dragMove = ev => {
        dx = Math.max(-baseLeft, Math.min(ev.clientX - startX, innerWidth - panelW - baseLeft));
        dy = Math.max(-baseTop, Math.min(ev.clientY - startY, innerHeight - 34 - baseTop));
        if (!dragFrame) dragFrame = requestAnimationFrame(render);
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

        localStorage.setItem(POS_KEY, JSON.stringify({ left, top }));

        window.removeEventListener('pointermove', dragMove, true);
        window.removeEventListener('pointerup', dragUp, true);
        window.removeEventListener('pointercancel', dragUp, true);
        dragMove = dragUp = null;
        dragging = false;

        if (observer && document.body) observer.observe(document.body, { childList: true, subtree: true });
        scheduleScan();
      };

      window.addEventListener('pointermove', dragMove, { capture: true, passive: true });
      window.addEventListener('pointerup', dragUp, true);
      window.addEventListener('pointercancel', dragUp, true);
    });
  }

  function latestCode() {
    return new Promise((resolve, reject) => {
      if (typeof GM_xmlhttpRequest !== 'function') {
        reject(new Error('Thiếu quyền GM_xmlhttpRequest. Hãy cài lại v1.4.2 một lần.'));
        return;
      }
      GM_xmlhttpRequest({
        method: 'GET',
        url: RAW_URL + '?_=' + Date.now(),
        headers: {
          'Cache-Control': 'no-cache, no-store, max-age=0',
          'Pragma': 'no-cache'
        },
        timeout: 15000,
        onload(res) {
          if (res.status < 200 || res.status >= 300) {
            reject(new Error('GitHub Raw HTTP ' + res.status));
            return;
          }
          const source = String(res.responseText || '');
          if (!source.includes('// ==UserScript==') || source.length < 500) {
            reject(new Error('Code tải về không hợp lệ'));
            return;
          }
          resolve(source);
        },
        onerror() { reject(new Error('Không kết nối được GitHub Raw')); },
        ontimeout() { reject(new Error('GitHub Raw phản hồi quá lâu')); }
      });
    });
  }

  async function hotReload() {
    const btn = $('#vada-fb-load');
    if (btn) { btn.disabled = true; btn.textContent = '↻ ĐANG LOAD...'; }
    toast('Đang lấy code mới nhất từ GitHub Raw...');
    try {
      const source = await latestCode();
      const match = source.match(/\/\/\s*@version\s+([^\s]+)/);
      const code = source.replace(/\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==\s*/, '');
      toast(`Đã lấy v${match?.[1] || '?'} • đang chạy...`);
      setTimeout(() => {
        try { new Function('GM_xmlhttpRequest', code)(GM_xmlhttpRequest); }
        catch (err) {
          console.error('[VADA FB] LOAD lỗi:', err);
          alert('FB LOAD lỗi: ' + err.message);
        }
      }, 30);
    } catch (err) {
      console.error('[VADA FB] LOAD thất bại:', err);
      if (btn?.isConnected) { btn.disabled = false; btn.textContent = '↻ LOAD'; }
      toast('LOAD thất bại: ' + err.message);
    }
  }

  function addStyles() {
    document.getElementById(STYLE_ID)?.remove();
    const st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent = `
      #${PANEL_ID}{position:fixed;top:88px;right:14px;z-index:2147483646;width:260px;max-height:calc(100vh - 40px);overflow:hidden;background:#000;color:#f5f5f5;border:1px solid #262626;border-radius:10px;box-shadow:0 4px 18px rgba(0,0,0,.65);font:13px/1.35 Arial,sans-serif}
      #${PANEL_ID} *{box-sizing:border-box} #${PANEL_ID} button{font-family:inherit}
      #${PANEL_ID} .vada-fb-header{height:34px;padding:0 8px 0 10px;display:flex;align-items:center;justify-content:space-between;background:#000;color:#fff;border-bottom:1px solid #222;font-weight:700;cursor:move;user-select:none;touch-action:none}
      #${PANEL_ID} .vada-fb-header-actions{display:flex;align-items:center;gap:6px} #${PANEL_ID} .vada-fb-version{font-size:10px;opacity:.85}
      #${PANEL_ID} #vada-fb-toggle{width:25px;height:25px;border:1px solid #2a2a2a;border-radius:6px;cursor:pointer;background:#111;color:#fff;font-size:18px}
      #${PANEL_ID} #vada-fb-panel-body{padding:8px;max-height:calc(100vh - 80px);overflow:auto}
      #${PANEL_ID} .vada-fb-primary,#${PANEL_ID} .vada-fb-secondary,#${PANEL_ID} .vada-fb-load{width:100%;border:0;border-radius:7px;padding:7px 8px;cursor:pointer;font-weight:700}
      #${PANEL_ID} .vada-fb-primary{background:#0a0a0a;color:#fff;border:1px solid #2a2a2a} #${PANEL_ID} .vada-fb-secondary{margin-top:6px;background:#0a0a0a;color:#e5e5e5;border:1px solid #2a2a2a} #${PANEL_ID} .vada-fb-load{margin-top:6px;background:#111;color:#fff;border:1px solid #333}
      #${PANEL_ID} .vada-fb-section-title{margin:10px 2px 5px;font-size:11px;font-weight:700;color:#bdbdbd}
      #${PANEL_ID} .vada-fb-group-row{display:flex;gap:4px;margin-bottom:4px} #${PANEL_ID} .vada-fb-group-open{min-width:0;flex:1;display:flex;align-items:center;gap:7px;border:1px solid #2a2a2a;background:#080808;border-radius:7px;padding:6px 7px;cursor:pointer;text-align:left;color:#f5f5f5}
      #${PANEL_ID} .vada-fb-group-index{width:18px;height:18px;flex:0 0 18px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#1a1a1a;color:#fff;font-size:10px;font-weight:700} #${PANEL_ID} .vada-fb-group-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:600}
      #${PANEL_ID} .vada-fb-group-alias,#${PANEL_ID} .vada-fb-group-delete{width:28px;border:0;border-radius:7px;cursor:pointer;font-size:16px}
      #${PANEL_ID} .vada-fb-group-alias{background:#111;color:#d7d7d7;border:1px solid #2a2a2a}
      #${PANEL_ID} .vada-fb-group-delete{background:#160000;color:#ff6b6b;border:1px solid #3a1111;font-size:18px}
      #${PANEL_ID} .vada-fb-tabs{display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:7px 8px 0;background:#000}
      #${PANEL_ID} .vada-fb-tab{border:1px solid #242424!important;background:#090909!important;color:#aaa!important;border-radius:7px!important;padding:6px!important;cursor:pointer!important;font-size:11px!important;font-weight:700!important}
      #${PANEL_ID} .vada-fb-tab.active{background:#171717!important;color:#fff!important;border-color:#444!important}
      #${PANEL_ID} .vada-fb-tab-pane{display:none} #${PANEL_ID} .vada-fb-tab-pane.active{display:block}
      #${PANEL_ID} .vada-fb-review-row{display:flex;gap:4px;margin-bottom:4px}
      #${PANEL_ID} .vada-fb-review-open{min-width:0;flex:1;display:flex;align-items:center;gap:7px;border:1px solid #2a2a2a;background:#080808;border-radius:7px;padding:6px 7px;cursor:pointer;text-align:left;color:#f5f5f5}
      #${PANEL_ID} .vada-fb-review-index{width:18px;height:18px;flex:0 0 18px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#1a1a1a;font-size:10px;font-weight:700}
      #${PANEL_ID} .vada-fb-review-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px}
      #${PANEL_ID} .vada-fb-review-delete{width:28px;border:1px solid #3a1111;border-radius:7px;cursor:pointer;background:#160000;color:#ff6b6b;font-size:18px}
      #${PANEL_ID} .vada-fb-sync-status{margin-top:6px;padding:6px;border:1px solid #222;border-radius:7px;background:#080808;color:#999;font-size:10px} #${PANEL_ID} .vada-fb-empty,#${PANEL_ID} .vada-fb-status{padding:7px;border-radius:7px;background:#080808;color:#a8a8a8;border:1px solid #222;font-size:11px}
      [${TARGET_ATTR}="collapsed"]{display:-webkit-box!important;-webkit-box-orient:vertical!important;-webkit-line-clamp:${MAX_LINES}!important;overflow:hidden!important;max-height:none!important}
      [${TARGET_ATTR}="expanded"]{display:block!important;-webkit-line-clamp:unset!important;overflow:visible!important;max-height:none!important}
      [${IMAGE_ATTR}="1"],[${VIDEO_ATTR}="1"],[${BOX_ATTR}="1"]{display:none!important;visibility:hidden!important;opacity:0!important;width:0!important;height:0!important;min-width:0!important;min-height:0!important;max-width:0!important;max-height:0!important;margin:0!important;padding:0!important;overflow:hidden!important;pointer-events:none!important}
      .vada-fb-expand-wrap{margin:3px 0!important}.vada-fb-expand-btn{border:0!important;background:transparent!important;padding:2px 0!important;color:#0866ff!important;cursor:pointer!important;font:700 12px Arial,sans-serif!important}
      #vada-fb-toast{position:fixed;right:20px;bottom:20px;z-index:2147483647;background:#000;color:#fff;border:1px solid #2a2a2a;border-radius:8px;padding:9px 12px;font:12px Arial,sans-serif}
    `;
    document.head.appendChild(st);
  }

  function createPanel() {
    document.getElementById(PANEL_ID)?.remove();
    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <div class="vada-fb-header"><span>🟦 FB GROUP</span><div class="vada-fb-header-actions"><span class="vada-fb-version">v${VERSION}</span><button id="vada-fb-toggle">−</button></div></div>
      <div class="vada-fb-tabs">
        <button class="vada-fb-tab active" data-tab="groups">GROUP</button>
        <button class="vada-fb-tab" data-tab="review">ĐỂ DUYỆT <span id="vada-fb-review-count"></span></button>
      </div>
      <div id="vada-fb-panel-body">
        <div class="vada-fb-tab-pane active" data-pane="groups">
          <button id="vada-fb-add-current" class="vada-fb-primary">＋ Lưu group hiện tại</button>
          <div class="vada-fb-section-title">📌 DANH SÁCH GROUP</div><div id="vada-fb-group-list"></div>
          <div class="vada-fb-section-title">📑 ĐỌC NHANH BÀI DÀI</div><div class="vada-fb-status">Bài dài tự thu gọn còn ${MAX_LINES} dòng.</div>
          <button id="vada-fb-rescan" class="vada-fb-secondary">↻ Quét lại bài viết</button>
          <button id="vada-fb-hide-images" class="vada-fb-secondary"></button>
        </div>
        <div class="vada-fb-tab-pane" data-pane="review">
          <button id="vada-fb-save-clipboard" class="vada-fb-primary">＋ Lưu link đang copy</button>
          <div class="vada-fb-section-title">🕒 BÀI ĐỂ DUYỆT SAU</div>
          <div id="vada-fb-review-list"></div>
          <div id="vada-fb-sync-status" class="vada-fb-sync-status">☁ Chưa cấu hình đồng bộ</div>
          <button id="vada-fb-sync-now" class="vada-fb-secondary">☁ Đồng bộ ngay</button>
          <button id="vada-fb-sync-config" class="vada-fb-secondary">⚙ Cấu hình đồng bộ</button>
        </div>
        <button id="vada-fb-load" class="vada-fb-load">↻ LOAD</button>
      </div>`;
    document.body.appendChild(panel);
    loadPosition(panel);
    enableDrag(panel);
    renderGroups();
    renderReviewList();
    updateImageButton();
    if (String(GM_getValue(GIST_TOKEN_KEY, '') || '').trim()) syncReviews(false);

    panel.addEventListener('click', e => {
      const tab = e.target.closest('.vada-fb-tab');
      if (tab) {
        panel.querySelectorAll('.vada-fb-tab').forEach(x => x.classList.toggle('active', x === tab));
        panel.querySelectorAll('.vada-fb-tab-pane').forEach(x => x.classList.toggle('active', x.dataset.pane === tab.dataset.tab));
        return;
      }
      const reviewOpen = e.target.closest('.vada-fb-review-open');
      if (reviewOpen) return void window.open(reviewOpen.dataset.url, '_blank', 'noopener');
      const reviewDelete = e.target.closest('.vada-fb-review-delete');
      if (reviewDelete) return deleteReviewPost(reviewDelete.dataset.id);
      if (e.target.closest('#vada-fb-save-clipboard')) return void saveClipboardPost();
      if (e.target.closest('#vada-fb-sync-now')) return void syncReviews(true);
      if (e.target.closest('#vada-fb-sync-config')) return void configureReviewSync();
      const open = e.target.closest('.vada-fb-group-open');
      if (open) return void (location.href = open.dataset.url);
      const alias = e.target.closest('.vada-fb-group-alias');
      if (alias) {
        const data = groups();
        const item = data.find(g => g.url === alias.dataset.url);
        if (!item) return;
        const value = prompt('Nhập biệt danh cho group:', item.alias || item.name || '');
        if (value === null) return;
        item.alias = value.trim();
        saveGroups(data);
        renderGroups();
        return toast(item.alias ? 'Đã lưu biệt danh.' : 'Đã xóa biệt danh.');
      }
      const del = e.target.closest('.vada-fb-group-delete');
      if (del) {
        saveGroups(groups().filter(g => g.url !== del.dataset.url));
        return renderGroups();
      }
      if (e.target.closest('#vada-fb-add-current')) return addCurrentGroup();
      if (e.target.closest('#vada-fb-rescan')) { resetCollapsed(); scanPosts(); applyImageHiding(true); return toast(`Đã quét lại • ẩn ${hiddenCount} ảnh/video.`); }
      if (e.target.closest('#vada-fb-hide-images')) return setHideImages(!hideImages);
      if (e.target.closest('#vada-fb-load')) return hotReload();
      if (e.target.closest('#vada-fb-toggle')) {
        const body = $('#vada-fb-panel-body', panel);
        const hidden = body.style.display === 'none';
        body.style.display = hidden ? '' : 'none';
        $('#vada-fb-toggle', panel).textContent = hidden ? '−' : '+';
      }
    });
  }

  function text(el) { return (el?.innerText || '').replace(/\s+/g, ' ').trim(); }

  function candidate(el) {
    if (!(el instanceof HTMLElement) || el.closest(`#${PANEL_ID}`) || el.hasAttribute(TARGET_ATTR)) return false;
    const t = text(el);
    if (t.length < MIN_TEXT) return false;
    if (el.querySelectorAll('img,video').length) return false;
    if (el.querySelectorAll('button,[role="button"]').length > 3) return false;
    const r = el.getBoundingClientRect();
    return r.width > 180 && r.height > 35;
  }

  function collapse(el) {
    if (!candidate(el)) return false;
    el.setAttribute(TARGET_ATTR, 'collapsed');
    const wrap = document.createElement('div');
    wrap.className = 'vada-fb-expand-wrap';
    const btn = document.createElement('button');
    btn.className = 'vada-fb-expand-btn';
    btn.type = 'button';
    btn.textContent = 'Mở rộng';
    wrap.appendChild(btn);
    el.insertAdjacentElement('afterend', wrap);
    btn.addEventListener('click', ev => {
      ev.preventDefault(); ev.stopPropagation();
      const collapsed = el.getAttribute(TARGET_ATTR) === 'collapsed';
      el.setAttribute(TARGET_ATTR, collapsed ? 'expanded' : 'collapsed');
      btn.textContent = collapsed ? 'Thu gọn' : 'Mở rộng';
    }, true);
    return true;
  }

  function scanPosts(root = document) {
    const preferred = $$('[data-ad-rendering-role="story_message"],[data-ad-preview="message"],[data-ad-comet-preview="message"]', root);
    preferred.forEach(collapse);
    const articles = $$('[role="article"]', root);
    for (const article of articles) {
      if (article.querySelector(`[${TARGET_ATTR}]`)) continue;
      let best = null;
      for (const el of $$('div[dir="auto"],span[dir="auto"]', article)) {
        if (!candidate(el)) continue;
        if (!best || text(el).length > text(best).length) best = el;
      }
      if (best) collapse(best);
    }
  }

  function saveStyle(map, el, props) {
    if (map.has(el)) return;
    const state = {};
    for (const p of props) state[p] = [el.style.getPropertyValue(p), el.style.getPropertyPriority(p)];
    map.set(el, state);
  }

  function restoreStyle(map, attr) {
    for (const [el, state] of map) {
      if (!el?.isConnected) continue;
      for (const [p, [v, pri]] of Object.entries(state)) v ? el.style.setProperty(p, v, pri) : el.style.removeProperty(p);
      el.removeAttribute(attr);
    }
    map.clear();
  }

  function isPostImage(img) {
    if (!(img instanceof HTMLImageElement) || img.closest(`#${PANEL_ID}`)) return false;
    if (img.matches('img[data-imgperflogname="feedImage"],img[data-visualcompletion="media-vc-image"]')) return true;
    const src = img.currentSrc || img.src || '';
    if (!src.includes('scontent') || !img.closest('main,[role="main"]')) return false;
    const r = img.getBoundingClientRect();
    return Math.max(r.width, img.width || 0, img.naturalWidth || 0) >= 180 && Math.max(r.height, img.height || 0, img.naturalHeight || 0) >= 120;
  }

  function isPostVideo(video) {
    if (!(video instanceof HTMLVideoElement) || video.closest(`#${PANEL_ID}`)) return false;
    if (!video.closest('main,[role="main"],[role="article"]')) return false;
    const r = video.getBoundingClientRect();
    const w = Math.max(r.width, video.clientWidth || 0, video.videoWidth || 0);
    const h = Math.max(r.height, video.clientHeight || 0, video.videoHeight || 0);
    return w >= 120 && h >= 80;
  }

  function mediaBox(media) {
    const article = media.closest('[role="article"]');
    let node = media.parentElement, best = null;
    for (let i = 0; i < 7 && node && node !== article; i++, node = node.parentElement) {
      if (node.closest(`#${PANEL_ID}`)) break;
      if (node.querySelectorAll('button,input,textarea,[role="button"]').length) break;
      if (text(node).length > 40) break;
      const r = node.getBoundingClientRect();
      if (node.querySelectorAll('img,video').length <= 20 && r.width >= 140 && r.height >= 80) best = node;
    }
    return best;
  }

  function hideImage(img) {
    if (!isPostImage(img)) return false;
    saveStyle(imageStyles, img, ['display','visibility','opacity','width','height','min-width','min-height','max-width','max-height','margin','padding','pointer-events']);
    img.setAttribute(IMAGE_ATTR, '1');
    for (const [p, v] of Object.entries({display:'none',visibility:'hidden',opacity:'0',width:'0px',height:'0px','min-width':'0px','min-height':'0px','max-width':'0px','max-height':'0px',margin:'0px',padding:'0px','pointer-events':'none'})) img.style.setProperty(p, v, 'important');
    const box = mediaBox(img);
    if (box) {
      saveStyle(boxStyles, box, ['display','visibility','height','min-height','max-height','margin','padding','overflow']);
      box.setAttribute(BOX_ATTR, '1');
      for (const [p, v] of Object.entries({display:'none',visibility:'hidden',height:'0px','min-height':'0px','max-height':'0px',margin:'0px',padding:'0px',overflow:'hidden'})) box.style.setProperty(p, v, 'important');
    }
    return true;
  }

  function hideVideo(video) {
    if (!isPostVideo(video)) return false;
    try { video.pause(); } catch (_) {}
    saveStyle(videoStyles, video, ['display','visibility','opacity','width','height','min-width','min-height','max-width','max-height','margin','padding','pointer-events']);
    video.setAttribute(VIDEO_ATTR, '1');
    for (const [p, v] of Object.entries({display:'none',visibility:'hidden',opacity:'0',width:'0px',height:'0px','min-width':'0px','min-height':'0px','max-width':'0px','max-height':'0px',margin:'0px',padding:'0px','pointer-events':'none'})) video.style.setProperty(p, v, 'important');
    const box = mediaBox(video);
    if (box) {
      saveStyle(boxStyles, box, ['display','visibility','height','min-height','max-height','margin','padding','overflow']);
      box.setAttribute(BOX_ATTR, '1');
      for (const [p, v] of Object.entries({display:'none',visibility:'hidden',height:'0px','min-height':'0px','max-height':'0px',margin:'0px',padding:'0px',overflow:'hidden'})) box.style.setProperty(p, v, 'important');
    }
    return true;
  }

  function applyImageHiding(recount = false, root = document) {
    if (!hideImages) return;
    if (root instanceof HTMLImageElement && !root.hasAttribute(IMAGE_ATTR)) hideImage(root);
    if (root instanceof HTMLVideoElement && !root.hasAttribute(VIDEO_ATTR)) hideVideo(root);
    root.querySelectorAll?.('img').forEach(img => { if (!img.hasAttribute(IMAGE_ATTR)) hideImage(img); });
    root.querySelectorAll?.('video').forEach(video => { if (!video.hasAttribute(VIDEO_ATTR)) hideVideo(video); });
    hiddenCount = document.querySelectorAll(`img[${IMAGE_ATTR}],video[${VIDEO_ATTR}]`).length;
    updateImageButton();
  }

  function restoreImages() {
    restoreStyle(imageStyles, IMAGE_ATTR);
    restoreStyle(videoStyles, VIDEO_ATTR);
    restoreStyle(boxStyles, BOX_ATTR);
    $$(`[${IMAGE_ATTR}]`).forEach(el => el.removeAttribute(IMAGE_ATTR));
    $$(`[${VIDEO_ATTR}]`).forEach(el => el.removeAttribute(VIDEO_ATTR));
    $$(`[${BOX_ATTR}]`).forEach(el => el.removeAttribute(BOX_ATTR));
    hiddenCount = 0;
  }

  function updateImageButton() {
    const btn = $('#vada-fb-hide-images');
    if (btn) btn.textContent = hideImages ? `🎞 Hiện ảnh/video (${hiddenCount} đã ẩn)` : '🎞 Ẩn toàn bộ ảnh + video';
  }

  function setHideImages(v) {
    hideImages = !!v;
    localStorage.setItem(IMAGE_KEY, hideImages ? '1' : '0');
    if (hideImages) { applyImageHiding(true); toast(`Đã ẩn ${hiddenCount} ảnh/video.`); }
    else { restoreImages(); updateImageButton(); toast('Đã hiện lại ảnh/video.'); }
  }

  function scheduleScan() {
    if (dragging) return;
    clearTimeout(scanTimer);
    scanTimer = setTimeout(() => {
      if (dragging) return;
      scanPosts();
      applyImageHiding(true);
    }, 220);
  }

  function startObserver() {
    observer?.disconnect();
    observer = new MutationObserver(() => scheduleScan());
    observer.observe(document.body, { childList: true, subtree: true });
    imageTimer = setInterval(() => { if (hideImages && !dragging) applyImageHiding(true); }, 1200);
    setupQuickSaveCapture();
    syncTimer = setInterval(() => {
      if (String(GM_getValue(GIST_TOKEN_KEY, '') || '').trim()) syncReviews(false);
    }, 30000);
  }

  function resetCollapsed() {
    $$('.vada-fb-expand-wrap').forEach(el => el.remove());
    $$(`[${TARGET_ATTR}]`).forEach(el => el.removeAttribute(TARGET_ATTR));
  }

  function cleanup() {
    observer?.disconnect(); observer = null;
    clearTimeout(scanTimer); clearTimeout(toastTimer); clearInterval(imageTimer); clearTimeout(syncTimer); clearInterval(syncTimer);
    if (dragFrame) cancelAnimationFrame(dragFrame);
    dragFrame = 0;
    dragging = false;
    if (dragMove) window.removeEventListener('pointermove', dragMove, true);
    if (dragUp) {
      window.removeEventListener('pointerup', dragUp, true);
      window.removeEventListener('pointercancel', dragUp, true);
    }
    dragMove = dragUp = null;
    if (quickSaveHandler) document.removeEventListener('click', quickSaveHandler, true);
    quickSaveHandler = null;
    resetCollapsed();
    restoreImages();
    document.getElementById(PANEL_ID)?.remove();
    document.getElementById(STYLE_ID)?.remove();
    document.getElementById('vada-fb-toast')?.remove();
  }

  window[INSTANCE_KEY] = { version: VERSION, cleanup };

  addStyles();
  createPanel();
  scanPosts();
  applyImageHiding(true);
  startObserver();
})();