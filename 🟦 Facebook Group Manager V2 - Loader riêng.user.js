// ==UserScript==
// @name         🟦 Facebook Group Manager V2 - Loader riêng
// @namespace    https://github.com/datphuho88-dev/tampermonkey-scripts/v2
// @version      2.0.0
// @description  Loader riêng cho Facebook Group Manager, tránh trùng tên userscript cũ.
// @author       VADA
// @match        https://facebook.com/*
// @match        https://*.facebook.com/*
// @updateURL    https://raw.githubusercontent.com/datphuho88-dev/tampermonkey-scripts/main/%F0%9F%9F%A6%20Facebook%20Group%20Manager%20V2%20-%20Loader%20ri%C3%AAng.user.js
// @downloadURL  https://raw.githubusercontent.com/datphuho88-dev/tampermonkey-scripts/main/%F0%9F%9F%A6%20Facebook%20Group%20Manager%20V2%20-%20Loader%20ri%C3%AAng.user.js
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      raw.githubusercontent.com
// @connect      api.github.com
// @run-at       document-start
// ==/UserScript==

(() => {
  'use strict';

  const SOURCE = 'https://raw.githubusercontent.com/datphuho88-dev/tampermonkey-scripts/main/%F0%9F%9F%A6%20Facebook%20-%20Group%20Manager%20-%20Danh%20s%C3%A1ch%20group%20%E2%80%A2%20Thu%20g%E1%BB%8Dn%20b%C3%A0i%20d%C3%A0i.user.js';

  function boot() {
    GM_xmlhttpRequest({
      method: 'GET',
      url: SOURCE + '?_=' + Date.now(),
      headers: {
        'Cache-Control': 'no-cache, no-store, max-age=0',
        'Pragma': 'no-cache'
      },
      timeout: 15000,
      onload(res) {
        try {
          if (res.status < 200 || res.status >= 300) throw new Error('HTTP ' + res.status);
          let code = String(res.responseText || '');
          if (!code.includes('// ==UserScript==')) throw new Error('Source không hợp lệ');
          code = code.replace(/\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==\s*/, '');
          new Function(code)();
        } catch (err) {
          console.error('[VADA FB V2] lỗi chạy source:', err);
        }
      },
      onerror() {
        console.error('[VADA FB V2] không tải được source GitHub');
      },
      ontimeout() {
        console.error('[VADA FB V2] GitHub timeout');
      }
    });
  }

  boot();
})();