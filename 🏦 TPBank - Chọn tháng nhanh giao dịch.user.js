// ==UserScript==
// @name         🏦 TPBank - Chọn tháng nhanh giao dịch
// @namespace    https://github.com/datphuho88-dev/tampermonkey-scripts
// @version      1.0.0
// @description  Thêm nút chọn nhanh tháng trên màn hình chọn khoảng thời gian TPBank.
// @author       datphuho88-dev
// @match        https://ebank.tpb.vn/retail/vX/main/inquiry/account/transaction*
// @updateURL    https://raw.githubusercontent.com/datphuho88-dev/tampermonkey-scripts/main/%F0%9F%8F%A6%20TPBank%20-%20Ch%E1%BB%8Dn%20th%C3%A1ng%20nhanh%20giao%20d%E1%BB%8Bch.user.js
// @downloadURL  https://raw.githubusercontent.com/datphuho88-dev/tampermonkey-scripts/main/%F0%9F%8F%A6%20TPBank%20-%20Ch%E1%BB%8Dn%20th%C3%A1ng%20nhanh%20giao%20d%E1%BB%8Bch.user.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(() => {
    'use strict';

    const BOX_ID = 'tpb-quick-month-box';

    const pad2 = (n) => String(n).padStart(2, '0');
    const formatDate = (d) => `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;

    function setInputValue(input, value) {
        const proto = Object.getPrototypeOf(input);
        const descriptor = Object.getOwnPropertyDescriptor(proto, 'value')
            || Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');

        if (descriptor?.set) descriptor.set.call(input, value);
        else input.value = value;

        ['input', 'change', 'blur'].forEach(type => {
            input.dispatchEvent(new Event(type, { bubbles: true }));
        });
    }

    function findDateDialog() {
        const inputs = [...document.querySelectorAll('input')]
            .filter(el => {
                const ph = (el.getAttribute('placeholder') || '').toUpperCase();
                return ph.includes('DD/MM/YYYY');
            });

        for (let i = 0; i < inputs.length - 1; i++) {
            const a = inputs[i];
            const b = inputs[i + 1];
            const rootA = a.closest('[role="dialog"], .modal, .ant-modal, .mat-dialog-container, form, section, div');
            if (!rootA) continue;

            let node = rootA;
            for (let level = 0; level < 8 && node; level++, node = node.parentElement) {
                const text = (node.innerText || '').toUpperCase();
                if (
                    text.includes('CHỌN KHOẢNG THỜI GIAN') &&
                    node.contains(a) &&
                    node.contains(b)
                ) {
                    return { root: node, startInput: a, endInput: b };
                }
            }
        }

        return null;
    }

    function chooseMonth(monthIndex, startInput, endInput) {
        const today = new Date();
        const year = today.getFullYear();

        if (monthIndex > today.getMonth()) return;

        const start = new Date(year, monthIndex, 1);
        const end = monthIndex === today.getMonth()
            ? new Date(year, today.getMonth(), today.getDate())
            : new Date(year, monthIndex + 1, 0);

        setInputValue(startInput, formatDate(start));
        setInputValue(endInput, formatDate(end));

        startInput.focus();
        startInput.blur();
        endInput.focus();
        endInput.blur();
    }

    function injectMonthBox() {
        if (document.getElementById(BOX_ID)) return;

        const dialog = findDateDialog();
        if (!dialog) return;

        const { root, startInput, endInput } = dialog;
        const today = new Date();
        const currentMonth = today.getMonth();

        const box = document.createElement('div');
        box.id = BOX_ID;
        box.innerHTML = `
            <div class="tpb-qm-title">CHỌN NHANH THÁNG ${today.getFullYear()}</div>
            <div class="tpb-qm-grid"></div>
        `;

        Object.assign(box.style, {
            background: '#000',
            border: '1px solid #2b2b2b',
            borderRadius: '8px',
            padding: '9px',
            margin: '8px 0 10px',
            boxSizing: 'border-box'
        });

        const title = box.querySelector('.tpb-qm-title');
        Object.assign(title.style, {
            color: '#fff',
            fontSize: '11px',
            fontWeight: '700',
            marginBottom: '7px'
        });

        const grid = box.querySelector('.tpb-qm-grid');
        Object.assign(grid.style, {
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gap: '6px'
        });

        for (let m = 0; m < 12; m++) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = `T${m + 1}`;

            const future = m > currentMonth;
            Object.assign(btn.style, {
                height: '30px',
                border: m === currentMonth ? '1px solid #ff8a00' : '1px solid #3a3a3a',
                borderRadius: '6px',
                background: m === currentMonth ? '#3a2400' : '#111',
                color: future ? '#555' : '#fff',
                fontSize: '12px',
                fontWeight: '700',
                cursor: future ? 'not-allowed' : 'pointer',
                opacity: future ? '0.6' : '1'
            });

            btn.disabled = future;
            btn.addEventListener('click', () => chooseMonth(m, startInput, endInput));
            grid.appendChild(btn);
        }

        const confirmButton = [...root.querySelectorAll('button')]
            .find(btn => /xác\s*nhận/i.test((btn.innerText || '').trim()));

        if (confirmButton?.parentElement) {
            confirmButton.parentElement.insertBefore(box, confirmButton);
        } else {
            endInput.parentElement?.insertAdjacentElement('afterend', box);
        }
    }

    const observer = new MutationObserver(() => {
        const existing = document.getElementById(BOX_ID);
        if (existing && !document.body.contains(existing)) existing.remove();
        injectMonthBox();
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

    injectMonthBox();
})();
