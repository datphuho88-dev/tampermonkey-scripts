// ==UserScript==
// @name         ACB - Tải Excel 12 tháng tự động
// @namespace    acb-auto-export
// @version      1.0
// @description  Tự động chọn từng tháng và tải Excel trên ACB ONE BIZ
// @match        https://*.acb.com.vn/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // =========================
    // CÀI ĐẶT
    // =========================
    const DELAY_AFTER_SELECT = 1200;    // Đợi sau khi chọn tháng
    const DELAY_AFTER_DOWNLOAD = 3500;  // Đợi sau mỗi lần bấm Xuất Excel

    let running = false;

    // =========================
    // HÀM TIỆN ÍCH
    // =========================

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function normalizeText(str) {
        return (str || '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    }

    // Tìm select gần chữ Tháng / Năm
    function findSelectByLabel(labelText) {
        const wanted = normalizeText(labelText);

        const allElements = [...document.querySelectorAll('td, div, span, label, p')];

        for (const el of allElements) {
            const text = normalizeText(el.innerText);

            if (
                text === wanted ||
                text.startsWith(wanted + ' ') ||
                text.startsWith(wanted + ':')
            ) {
                // 1. tìm trong chính phần tử
                let select = el.querySelector('select');
                if (select) return select;

                // 2. tìm ở phần tử cha
                let parent = el.parentElement;

                for (let i = 0; parent && i < 4; i++) {
                    select = parent.querySelector('select');
                    if (select) return select;

                    // tìm hàng kế bên / ô kế bên
                    const selects = parent.parentElement
                        ? parent.parentElement.querySelectorAll('select')
                        : [];

                    if (selects.length) {
                        for (const s of selects) {
                            if (s !== select) {
                                return s;
                            }
                        }
                    }

                    parent = parent.parentElement;
                }
            }
        }

        return null;
    }

    function findMonthSelect() {
        // Ưu tiên nhận biết theo option 01 -> 12
        const selects = [...document.querySelectorAll('select')];

        for (const s of selects) {
            const opts = [...s.options].map(o => o.text.trim());

            const monthCount = [
                '01', '02', '03', '04',
                '05', '06', '07', '08',
                '09', '10', '11', '12'
            ].filter(x => opts.includes(x)).length;

            if (monthCount >= 10) {
                return s;
            }
        }

        return findSelectByLabel('Tháng');
    }

    function findYearSelect() {
        const selects = [...document.querySelectorAll('select')];

        for (const s of selects) {
            const opts = [...s.options].map(o => o.text.trim());

            // Có ít nhất vài giá trị dạng 2023, 2024, 2025...
            const years = opts.filter(x => /^20\d{2}$/.test(x));

            if (years.length >= 2) {
                return s;
            }
        }

        return findSelectByLabel('Năm');
    }

   function findExportButton() {
    const elements = [
        ...document.querySelectorAll(
            'input[type="button"], input[type="submit"], button, a'
        )
    ].filter(el => {
        const text = normalizeText(
            el.innerText ||
            el.value ||
            el.title
        );

        return (
            text === 'xuất excel' ||
            text.includes('xuất excel') ||
            text.includes('xuat excel')
        );
    });

    console.log('[ACB AUTO] Số nút Xuất Excel tìm thấy:', elements.length);

    // Có 2 nút giống nhau:
    // [0] = bên trái
    // [1] = bên phải (chọn theo tháng/năm)
    return elements[1] || elements[elements.length - 1] || null;
}

    function setSelectValue(select, wantedValue) {
        if (!select) return false;

        const wanted = String(wantedValue);

        let option = [...select.options].find(o =>
            o.value === wanted ||
            o.text.trim() === wanted
        );

        // riêng tháng: 1 có thể là 01
        if (!option && /^\d+$/.test(wanted)) {
            const padded = wanted.padStart(2, '0');

            option = [...select.options].find(o =>
                o.value === padded ||
                o.text.trim() === padded
            );
        }

        if (!option) return false;

        select.value = option.value;

        select.dispatchEvent(
            new Event('change', {
                bubbles: true
            })
        );

        select.dispatchEvent(
            new Event('input', {
                bubbles: true
            })
        );

        return true;
    }

    // =========================
    // CHẠY TẢI
    // =========================

    async function startExport() {

        if (running) {
            alert('Đang chạy rồi.');
            return;
        }

        const monthSelect = findMonthSelect();
        const yearSelect = findYearSelect();
        const exportButton = findExportButton();

        if (!monthSelect) {
            alert('Không tìm thấy ô chọn THÁNG.');
            return;
        }

        if (!yearSelect) {
            alert('Không tìm thấy ô chọn NĂM.');
            return;
        }

        if (!exportButton) {
            alert('Không tìm thấy nút XUẤT EXCEL.');
            return;
        }

        // Hỏi năm cần tải
        const currentYear =
            [...yearSelect.options].find(
                o => o.value === yearSelect.value
            )?.text.trim() ||
            new Date().getFullYear();

        const year = prompt(
            'Nhập năm cần tải đủ 12 tháng:',
            currentYear
        );

        if (!year) return;

        const yearExists = [...yearSelect.options].some(o =>
            o.text.trim() === String(year) ||
            o.value === String(year)
        );

        if (!yearExists) {
            alert('Không tìm thấy năm ' + year + ' trong danh sách.');
            return;
        }

        if (!confirm(
            `Sẽ tải Excel từ tháng 01 đến tháng 12 năm ${year}.\n\nTiếp tục?`
        )) {
            return;
        }

        running = true;
        startBtn.innerText = '⏳ Đang tải...';
        startBtn.style.opacity = '0.7';

        try {

            // Chọn năm
            setSelectValue(yearSelect, year);

            await sleep(1000);

            for (let month = 1; month <= 12; month++) {

                if (!running) break;

                const mm = String(month).padStart(2, '0');

                startBtn.innerText =
                    `⏳ ${mm}/${year}`;

                console.log(
                    '[ACB AUTO] Chọn tháng:',
                    mm,
                    'năm:',
                    year
                );

                // Chọn tháng
                const monthOK =
                    setSelectValue(monthSelect, mm) ||
                    setSelectValue(monthSelect, month);

                if (!monthOK) {
                    console.warn(
                        '[ACB AUTO] Không chọn được tháng',
                        mm
                    );

                    continue;
                }

                // Đợi website nhận tháng
                await sleep(DELAY_AFTER_SELECT);

                // tìm lại nút vì website có thể render lại HTML
                const btn =
                    findExportButton();

                if (!btn) {
                    throw new Error(
                        'Mất nút Xuất Excel tại tháng ' + mm
                    );
                }

                console.log(
                    '[ACB AUTO] Xuất Excel tháng',
                    mm
                );

                btn.click();

                // Đợi file tải
                await sleep(DELAY_AFTER_DOWNLOAD);
            }

            alert(
                `Đã gửi lệnh tải 12 tháng năm ${year}.`
            );

        } catch (err) {

            console.error(err);

            alert(
                'Có lỗi:\n' +
                err.message
            );

        } finally {

            running = false;

            startBtn.innerText =
                '⬇ Tải Excel 12 tháng';

            startBtn.style.opacity = '1';
        }
    }

    // =========================
    // NÚT NỔI
    // =========================

    const startBtn = document.createElement('button');

    startBtn.innerText =
        '⬇ Tải Excel 12 tháng';

    Object.assign(startBtn.style, {
        position: 'fixed',
        right: '20px',
        bottom: '20px',
        zIndex: '999999',
        padding: '12px 18px',
        fontSize: '14px',
        fontWeight: 'bold',
        cursor: 'pointer',
        border: '1px solid #174c91',
        borderRadius: '6px',
        background: '#2868b2',
        color: '#fff',
        boxShadow: '0 2px 8px rgba(0,0,0,.3)'
    });

    startBtn.addEventListener(
        'click',
        startExport
    );

    document.body.appendChild(startBtn);

})();