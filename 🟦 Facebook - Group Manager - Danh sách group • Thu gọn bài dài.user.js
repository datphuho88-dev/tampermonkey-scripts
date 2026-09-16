// ==UserScript==
// @name         🟦 Facebook - Group Manager - Danh sách group • Thu gọn bài dài
// @namespace    https://github.com/datphuho88-dev/tampermonkey-scripts
// @version      1.4.1
// @description  Quản lý danh sách group Facebook, thu gọn bài dài, ẩn ảnh/video duyệt bài, kéo panel và hot reload kiểu ACB.
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

  const VERSION = '1.4.1';
  const API = 'https://api.github.com/repos/datphuho88-dev/tampermonkey-scripts/contents/%F0%9F%9F%A6%20Facebook%20-%20Group%20Manager%20-%20Danh%20s%C3%A1ch%20group%20%E2%80%A2%20Thu%20g%E1%BB%8Dn%20b%C3%A0i%20d%C3%A0i.user.js';
  const INSTANCE_KEY = '__VADA_FB_GROUP_MANAGER__';
  const PANEL_ID = 'vada-fb-group-manager';
  const STYLE_ID = 'vada-fb-group-manager-style';
  const GROUP_KEY = 'vada_fb_group_manager_groups_v1';
  const POS_KEY = 'vada_fb_group_manager_position_v1';
  const IMAGE_KEY = 'vada_fb_hide_review_images_v1';
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
  let hideImages = localStorage.getItem(IMAGE_KEY) !== '0';
  let hiddenCount = 0;

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

  function currentGroup() {
    const m = location.pathname.match(/^\/groups\/([^/?#]+)/i);
    if (!m) return null;
    const name = $('h1')?.textContent?.trim() || document.title.replace(/\s*\|\s*Facebook\s*$/i, '').trim() || `Group ${m[1]}`;
    return { id: m[1], name, url: `${location.origin}/groups/${m[1]}` };
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
        <button class="vada-fb-group-open" data-url="${esc(g.url)}"><span class="vada-fb-group-index">${i + 1}</span><span class="vada-fb-group-name">${esc(g.name || g.url)}</span></button>
        <button class="vada-fb-group-delete" data-url="${esc(g.url)}" title="Xóa">×</button>
      </div>`).join('');
  }

  function addCurrentGroup() {
    const g = currentGroup();
    if (!g) return toast('Hãy mở một group Facebook trước.');
    const data = groups();
    const i = data.findIndex(x => x.id === g.id || x.url === g.url);
    if (i >= 0) data[i] = g;
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
    head.addEventListener('pointerdown', e => {
      if (e.button !== 0 || e.target.closest('button')) return;
      e.preventDefault();
      const r = panel.getBoundingClientRect();
      const dx = e.clientX - r.left;
      const dy = e.clientY - r.top;
      panel.style.right = 'auto';
      dragMove = ev => {
        panel.style.left = `${Math.max(0, Math.min(ev.clientX - dx, innerWidth - panel.offsetWidth))}px`;
        panel.style.top = `${Math.max(0, Math.min(ev.clientY - dy, innerHeight - 34))}px`;
      };
      dragUp = () => {
        const rr = panel.getBoundingClientRect();
        localStorage.setItem(POS_KEY, JSON.stringify({ left: Math.round(rr.left), top: Math.round(rr.top) }));
        window.removeEventListener('pointermove', dragMove, true);
        window.removeEventListener('pointerup', dragUp, true);
        dragMove = dragUp = null;
      };
      window.addEventListener('pointermove', dragMove, true);
      window.addEventListener('pointerup', dragUp, true);
    });
  }

  async function latestCode() {
    const res = await fetch(API + '?ref=main&_=' + Date.now(), {
      cache: 'no-store',
      credentials: 'omit',
      headers: { Accept: 'application/vnd.github+json' }
    });
    if (!res.ok) throw new Error('GitHub API HTTP ' + res.status);
    const data = await res.json();
    const b64 = String(data.content || '').replace(/\s/g, '');
    if (!b64) throw new Error('Không đọc được code GitHub');
    return new TextDecoder().decode(Uint8Array.from(atob(b64), c => c.charCodeAt(0)));
  }

  async function hotReload() {
    const btn = $('#vada-fb-load');
    if (btn) { btn.disabled = true; btn.textContent = '↻ ĐANG LOAD...'; }
    toast('Đang lấy code mới nhất từ GitHub...');
    try {
      const source = await latestCode();
      const match = source.match(/\/\/\s*@version\s+([^\s]+)/);
      const code = source.replace(/\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==\s*/, '');
      toast(`Đã lấy v${match?.[1] || '?'} • đang chạy...`);
      setTimeout(() => {
        try { new Function(code)(); }
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
      #${PANEL_ID}{position:fixed;top:88px;right:14px;z-index:2147483646;width:260px;max-height:calc(100vh - 40px);overflow:hidden;background:#fff;color:#1c1e21;border:1px solid #ccd0d5;border-radius:10px;box-shadow:0 4px 18px rgba(0,0,0,.18);font:13px/1.35 Arial,sans-serif}
      #${PANEL_ID} *{box-sizing:border-box} #${PANEL_ID} button{font-family:inherit}
      #${PANEL_ID} .vada-fb-header{height:34px;padding:0 8px 0 10px;display:flex;align-items:center;justify-content:space-between;background:#0866ff;color:#fff;font-weight:700;cursor:move;user-select:none;touch-action:none}
      #${PANEL_ID} .vada-fb-header-actions{display:flex;align-items:center;gap:6px} #${PANEL_ID} .vada-fb-version{font-size:10px;opacity:.85}
      #${PANEL_ID} #vada-fb-toggle{width:25px;height:25px;border:0;border-radius:6px;cursor:pointer;background:rgba(255,255,255,.16);color:#fff;font-size:18px}
      #${PANEL_ID} #vada-fb-panel-body{padding:8px;max-height:calc(100vh - 80px);overflow:auto}
      #${PANEL_ID} .vada-fb-primary,#${PANEL_ID} .vada-fb-secondary,#${PANEL_ID} .vada-fb-load{width:100%;border:0;border-radius:7px;padding:7px 8px;cursor:pointer;font-weight:700}
      #${PANEL_ID} .vada-fb-primary{background:#e7f3ff;color:#0866ff} #${PANEL_ID} .vada-fb-secondary{margin-top:6px;background:#f0f2f5;color:#444} #${PANEL_ID} .vada-fb-load{margin-top:6px;background:#0866ff;color:#fff}
      #${PANEL_ID} .vada-fb-section-title{margin:10px 2px 5px;font-size:11px;font-weight:700;color:#65676b}
      #${PANEL_ID} .vada-fb-group-row{display:flex;gap:4px;margin-bottom:4px} #${PANEL_ID} .vada-fb-group-open{min-width:0;flex:1;display:flex;align-items:center;gap:7px;border:1px solid #dddfe2;background:#f7f8fa;border-radius:7px;padding:6px 7px;cursor:pointer;text-align:left;color:#1c1e21}
      #${PANEL_ID} .vada-fb-group-index{width:18px;height:18px;flex:0 0 18px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#e4e6eb;font-size:10px;font-weight:700} #${PANEL_ID} .vada-fb-group-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:600}
      #${PANEL_ID} .vada-fb-group-delete{width:28px;border:0;border-radius:7px;cursor:pointer;background:#fce8e8;color:#c62828;font-size:18px} #${PANEL_ID} .vada-fb-empty,#${PANEL_ID} .vada-fb-status{padding:7px;border-radius:7px;background:#f0f2f5;color:#65676b;font-size:11px}
      [${TARGET_ATTR}="collapsed"]{display:-webkit-box!important;-webkit-box-orient:vertical!important;-webkit-line-clamp:${MAX_LINES}!important;overflow:hidden!important;max-height:none!important}
      [${TARGET_ATTR}="expanded"]{display:block!important;-webkit-line-clamp:unset!important;overflow:visible!important;max-height:none!important}
      [${IMAGE_ATTR}="1"],[${VIDEO_ATTR}="1"],[${BOX_ATTR}="1"]{display:none!important;visibility:hidden!important;opacity:0!important;width:0!important;height:0!important;min-width:0!important;min-height:0!important;max-width:0!important;max-height:0!important;margin:0!important;padding:0!important;overflow:hidden!important;pointer-events:none!important}
      .vada-fb-expand-wrap{margin:3px 0!important}.vada-fb-expand-btn{border:0!important;background:transparent!important;padding:2px 0!important;color:#0866ff!important;cursor:pointer!important;font:700 12px Arial,sans-serif!important}
      #vada-fb-toast{position:fixed;right:20px;bottom:20px;z-index:2147483647;background:#1c1e21;color:#fff;border-radius:8px;padding:9px 12px;font:12px Arial,sans-serif}
    `;
    document.head.appendChild(st);
  }

  function createPanel() {
    document.getElementById(PANEL_ID)?.remove();
    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <div class="vada-fb-header"><span>🟦 FB GROUP</span><div class="vada-fb-header-actions"><span class="vada-fb-version">v${VERSION}</span><button id="vada-fb-toggle">−</button></div></div>
      <div id="vada-fb-panel-body">
        <button id="vada-fb-add-current" class="vada-fb-primary">＋ Lưu group hiện tại</button>
        <div class="vada-fb-section-title">📌 DANH SÁCH GROUP</div><div id="vada-fb-group-list"></div>
        <div class="vada-fb-section-title">📑 ĐỌC NHANH BÀI DÀI</div><div class="vada-fb-status">Bài dài tự thu gọn còn ${MAX_LINES} dòng.</div>
        <button id="vada-fb-rescan" class="vada-fb-secondary">↻ Quét lại bài viết</button>
        <button id="vada-fb-hide-images" class="vada-fb-secondary"></button>
        <button id="vada-fb-load" class="vada-fb-load">↻ LOAD</button>
      </div>`;
    document.body.appendChild(panel);
    loadPosition(panel);
    enableDrag(panel);
    renderGroups();
    updateImageButton();

    panel.addEventListener('click', e => {
      const open = e.target.closest('.vada-fb-group-open');
      if (open) return void (location.href = open.dataset.url);
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
    clearTimeout(scanTimer);
    scanTimer = setTimeout(() => { scanPosts(); applyImageHiding(true); }, 180);
  }

  function startObserver() {
    observer?.disconnect();
    observer = new MutationObserver(() => scheduleScan());
    observer.observe(document.body, { childList: true, subtree: true });
    imageTimer = setInterval(() => { if (hideImages) applyImageHiding(true); }, 900);
  }

  function resetCollapsed() {
    $$('.vada-fb-expand-wrap').forEach(el => el.remove());
    $$(`[${TARGET_ATTR}]`).forEach(el => el.removeAttribute(TARGET_ATTR));
  }

  function cleanup() {
    observer?.disconnect(); observer = null;
    clearTimeout(scanTimer); clearTimeout(toastTimer); clearInterval(imageTimer);
    if (dragMove) window.removeEventListener('pointermove', dragMove, true);
    if (dragUp) window.removeEventListener('pointerup', dragUp, true);
    dragMove = dragUp = null;
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