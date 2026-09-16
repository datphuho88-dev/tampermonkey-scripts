// ==UserScript==
// @name         Shopee → vff Google Sheets
// @namespace    shopee-vff
// @version      5.0
// @description  Lấy tên SP + SL + giá từng SP rồi gửi thẳng vào Google Sheets
// @match        https://shopee.vn/user/purchase*
// @match        https://shopee.vn/user/purchase/*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @connect      script.google.com
// @connect      script.googleusercontent.com
// ==/UserScript==

(function () {
    'use strict';

    // ==========================================================
    // CHỈ CẦN SỬA DÒNG NÀY
    // Dán URL Web App lấy từ Apps Script vào đây
    // ==========================================================

    const WEB_APP_URL =
        'https://script.google.com/macros/s/AKfycbxSeVVDq7fw8sh2dp0EePex-5ZWtFpZ6fBEk3Zmo8oq_CaVuq0HX0P0q0A_-aBqtKLM/exec';


    // Phải giống SECRET_TOKEN bên Apps Script
    const SECRET_TOKEN =
        'SHOPEE_VFF_2026_ABC987';


    // Link Google Sheet vff
    const SHEET_URL =
        'https://docs.google.com/spreadsheets/d/1lvL8RkoqkVEM_DD1zWABW9ZCYAH1poKLA7GmnbIwB-w/edit';


    // ==========================================================
    // BIẾN CHẠY
    // ==========================================================

    let running = false;
    let stopRequested = false;

    const collected = [];

    // Tránh đọc cùng một node nhiều lần
    const processedQtyNodes = new WeakSet();

    // Tránh trùng khi Shopee render lại DOM
    const positionKeys = new Set();


    const sleep = ms =>
        new Promise(resolve => setTimeout(resolve, ms));


    function clean(text) {
        return (text || '')
            .replace(/\u00a0/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }


    function isVisible(el) {
        if (!el) return false;

        const style = getComputedStyle(el);

        return (
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            el.getClientRects().length > 0
        );
    }


    // ==========================================================
    // KIỂM TRA GIÁ GẠCH NGANG
    // VD: 52.000đ phải bỏ
    // ==========================================================

    function isStrikethrough(el, stopAt) {

        let node = el;

        for (let i = 0; i < 5 && node; i++) {

            const style = getComputedStyle(node);

            const decoration =
                (
                    style.textDecorationLine +
                    ' ' +
                    style.textDecoration
                ).toLowerCase();

            if (decoration.includes('line-through')) {
                return true;
            }

            const tag =
                (node.tagName || '').toLowerCase();

            if (
                tag === 'del' ||
                tag === 's' ||
                tag === 'strike'
            ) {
                return true;
            }

            if (node === stopAt) break;

            node = node.parentElement;
        }

        return false;
    }


    // ==========================================================
    // KIỂM TRA ELEMENT CÓ PHẢI GIÁ KHÔNG
    // ==========================================================

    function parsePriceElement(el, itemBox) {

        if (!isVisible(el)) return null;

        const text = clean(el.innerText);

        /*
         * Các dạng:
         * 38.000₫
         * ₫38.000
         * 38,000₫
         */

        let match =
            text.match(/^([\d.,]+)\s*₫$/);

        if (!match) {
            match =
                text.match(/^₫\s*([\d.,]+)$/);
        }

        if (!match) return null;


        const number =
            parseInt(
                match[1].replace(/[^\d]/g, ''),
                10
            );


        if (!number) return null;


        return {
            el: el,

            text:
                number.toLocaleString('vi-VN') +
                '₫',

            value: number,

            struck:
                isStrikethrough(
                    el,
                    itemBox
                )
        };
    }


    // ==========================================================
    // TÌM KHỐI CỦA 1 SẢN PHẨM
    // ==========================================================

    function findItemBox(qtyEl) {

        let node =
            qtyEl.parentElement;

        for (
            let level = 0;
            level < 10 && node;
            level++
        ) {

            const text =
                clean(node.innerText);


            // Không được leo lên vùng "Thành tiền"
            if (
                text.includes('Thành tiền')
            ) {
                return null;
            }


            const priceEls =
                [...node.querySelectorAll('*')]
                    .filter(el => {

                        if (
                            el.children.length > 0
                        ) {
                            return false;
                        }

                        return (
                            parsePriceElement(
                                el,
                                node
                            ) !== null
                        );
                    });


            const hasPrice =
                priceEls.length > 0;


            /*
             * Một itemBox hợp lệ phải có:
             *
             * x1/x2...
             * giá
             * một lượng text đủ để chứa tên SP
             */

            if (
                hasPrice &&
                text.length >= 15 &&
                text.length <= 1500
            ) {
                return node;
            }


            node =
                node.parentElement;
        }


        return null;
    }


    // ==========================================================
    // TÌM GIÁ THỰC TẾ CỦA TỪNG SẢN PHẨM
    // ==========================================================

    function getUnitPrice(
        itemBox,
        qtyEl
    ) {

        let prices =
            [...itemBox.querySelectorAll('*')]
                .filter(el =>
                    el.children.length === 0
                )
                .map(el =>
                    parsePriceElement(
                        el,
                        itemBox
                    )
                )
                .filter(Boolean);


        // BỎ GIÁ GẠCH NGANG
        prices =
            prices.filter(
                p => !p.struck
            );


        if (!prices.length) {
            return null;
        }


        const qtyRect =
            qtyEl.getBoundingClientRect();


        const qtyCenterY =
            qtyRect.top +
            qtyRect.height / 2;


        /*
         * Giá sản phẩm thường nằm gần cùng vùng
         * với quantity x1/x2.
         *
         * Nếu ngang nhau thì ưu tiên giá bên phải.
         */

        prices.sort(
            (a, b) => {

                const ar =
                    a.el.getBoundingClientRect();

                const br =
                    b.el.getBoundingClientRect();


                const aCenterY =
                    ar.top +
                    ar.height / 2;

                const bCenterY =
                    br.top +
                    br.height / 2;


                const ay =
                    Math.abs(
                        aCenterY -
                        qtyCenterY
                    );

                const by =
                    Math.abs(
                        bCenterY -
                        qtyCenterY
                    );


                if (
                    Math.abs(ay - by) > 5
                ) {
                    return ay - by;
                }


                // Nếu cùng dòng,
                // lấy giá bên phải hơn
                return br.left - ar.left;
            }
        );


        return prices[0];
    }


    // ==========================================================
    // TÌM TÊN SẢN PHẨM
    // ==========================================================

    function getProductName(
        itemBox,
        qtyText
    ) {

        const badExact = [
            'Chat',
            'Xem Shop',
            'HOÀN THÀNH',
            'Mua Lại',
            'Đánh Giá',
            'Thêm'
        ];


        const candidates =
            [...itemBox.querySelectorAll('*')]
                .filter(isVisible)
                .map(el =>
                    clean(el.innerText)
                )
                .filter(text => {

                    if (!text) return false;

                    if (
                        text.length < 5 ||
                        text.length > 400
                    ) {
                        return false;
                    }


                    if (
                        text === qtyText
                    ) {
                        return false;
                    }


                    if (
                        badExact.includes(text)
                    ) {
                        return false;
                    }


                    if (
                        text.startsWith(
                            'Phân loại hàng'
                        )
                    ) {
                        return false;
                    }


                    if (
                        text.includes(
                            'Giao hàng thành công'
                        )
                    ) {
                        return false;
                    }


                    if (
                        text.includes(
                            'Thành tiền'
                        )
                    ) {
                        return false;
                    }


                    // Loại các dòng có giá
                    if (
                        text.includes('₫')
                    ) {
                        return false;
                    }


                    // Loại ancestor chứa quantity
                    if (
                        new RegExp(
                            '(^|\\s)' +
                            qtyText.replace(
                                /[.*+?^${}()|[\]\\]/g,
                                '\\$&'
                            ) +
                            '(\\s|$)',
                            'i'
                        ).test(text)
                    ) {
                        return false;
                    }


                    return true;
                });


        if (!candidates.length) {
            return '';
        }


        /*
         * Tên sản phẩm thường là chuỗi dài nhất
         * trong itemBox sau khi loại variant/UI.
         */

        candidates.sort(
            (a, b) =>
                b.length - a.length
        );


        return candidates[0];
    }


    // ==========================================================
    // ĐỌC CÁC SẢN PHẨM HIỆN CÓ TRONG DOM
    // ==========================================================

  function collectProducts() {

    // Tìm chữ "Thành tiền"
    const totalLabels =
        [...document.querySelectorAll('body *')]
            .filter(el => {

                if (!isVisible(el)) return false;

                const text =
                    clean(el.innerText);

                return (
                    text === 'Thành tiền' ||
                    text === 'Thành tiền:'
                );
            });


    totalLabels.forEach(label => {

        // ===========================
        // TÌM TOÀN BỘ KHỐI ĐƠN HÀNG
        // ===========================

        let orderBox = label;

        for (
            let i = 0;
            i < 15 && orderBox.parentElement;
            i++
        ) {

            orderBox =
                orderBox.parentElement;

            const text =
                clean(orderBox.innerText);


            const hasTotal =
                /Thành tiền\s*:?\s*[\d.,]+\s*₫/i
                    .test(text);


            const hasQty =
                /x\d+/i.test(text);


            const hasStatus =
                text.includes('HOÀN THÀNH') ||
                text.includes('Giao hàng thành công');


            if (
                hasTotal &&
                hasQty &&
                hasStatus
            ) {
                break;
            }
        }


        if (!orderBox) return;


        const orderText =
            clean(orderBox.innerText);


        // ===========================
        // LẤY "THÀNH TIỀN"
        // ===========================

        const totalMatch =
            orderText.match(
                /Thành tiền\s*:?\s*([\d.,]+)\s*₫/i
            );


        if (!totalMatch) return;


        const totalMoney =
            parseInt(
                totalMatch[1]
                    .replace(/[^\d]/g, ''),
                10
            );


        if (!totalMoney) return;


        // ===========================
        // LẤY CÁC SẢN PHẨM TRONG ĐƠN
        // ===========================

        const qtyElements =
            [...orderBox.querySelectorAll('*')]
                .filter(el => {

                    if (
                        el.children.length > 0
                    ) {
                        return false;
                    }

                    if (!isVisible(el)) {
                        return false;
                    }

                    return /^x\d+$/i.test(
                        clean(el.innerText)
                    );
                });


        const products = [];


        qtyElements.forEach(qtyEl => {

            const qty =
                clean(qtyEl.innerText);


            // Dùng lại hàm có sẵn
            const itemBox =
                findItemBox(qtyEl);


            if (!itemBox) return;


            const name =
                getProductName(
                    itemBox,
                    qty
                );


            if (!name) return;


            products.push(
                `${name} ${qty}`
            );
        });


        // Bỏ trùng
        const uniqueProducts =
            [...new Set(products)];


        if (!uniqueProducts.length) {
            return;
        }


        // ===========================
        // TẠO DỮ LIỆU
        // ===========================

        const formattedTotal =
            totalMoney.toLocaleString('vi-VN') +
            '₫';


        /*
         * Nếu 1 đơn có nhiều sản phẩm:
         *
         * SP 1 x2 | SP 2 x1 70.000₫
         *
         * Nhưng cột B chỉ có 70000 một lần.
         */

        const output =
            uniqueProducts.join(' | ') +
            ' ' +
            formattedTotal;


        // ===========================
        // CHỐNG TRÙNG ĐƠN
        // ===========================

        const rect =
            orderBox.getBoundingClientRect();


        const absoluteY =
            rect.top +
            window.scrollY;


        const key =
            [
                uniqueProducts.join('|'),
                totalMoney,
                Math.round(
                    absoluteY / 80
                )
            ].join('||');


        if (
            positionKeys.has(key)
        ) {
            return;
        }


        positionKeys.add(key);


        collected.push({

            output: output,

            // QUAN TRỌNG:
            // Cột B lấy Thành tiền
            money: totalMoney
        });

    });


    updateStatus();
}

 function updateStatus(extra = '') {

    status.innerHTML =
        `Đã lấy <b>${collected.length}</b> đơn` +
        (
            extra
                ? `<br>${extra}`
                : ''
        );
}


    // ==========================================================
    // BẮT ĐẦU CUỘN
    // ==========================================================

    async function startScrolling() {

        if (running) return;


        if (
            WEB_APP_URL.includes(
                'DAN_LINK'
            )
        ) {
            alert(
                'Bạn chưa dán WEB_APP_URL của Apps Script vào code Tampermonkey.'
            );

            return;
        }


        running = true;
        stopRequested = false;


        startBtn.disabled = true;
        stopBtn.disabled = false;


        collectProducts();


        let lastHeight =
            document.documentElement.scrollHeight;


        let unchangedCount = 0;


        while (
            running &&
            !stopRequested
        ) {

            collectProducts();


            /*
             * Cuộn 75% màn hình/lần.
             * Không nhảy thẳng xuống đáy.
             */

            window.scrollBy({
                top:
                    Math.floor(
                        window.innerHeight *
                        0.75
                    ),

                behavior:
                    'smooth'
            });


            await sleep(850);


            collectProducts();


            const newHeight =
                document.documentElement
                    .scrollHeight;


            if (
                newHeight === lastHeight
            ) {
                unchangedCount++;
            } else {
                unchangedCount = 0;
            }


            lastHeight =
                newHeight;


            /*
             * Không tự gửi.
             * Nếu tới cuối chỉ dừng cuộn.
             */

            if (
                unchangedCount >= 12
            ) {

                running = false;

                startBtn.disabled = false;

                updateStatus(
                    'Đã tới cuối danh sách'
                );

                break;
            }
        }
    }


    // ==========================================================
    // GỬI GOOGLE SHEETS
    // ==========================================================

    function sendToGoogleSheets() {

        collectProducts();


        if (!collected.length) {

            alert(
                'Chưa tìm thấy sản phẩm nào.'
            );

            return;
        }


        sendBtn.disabled = true;
        startBtn.disabled = true;


        updateStatus(
            'Đang gửi sang Google Sheets...'
        );


        const rows =
            collected.map(item => [
                item.output,
                item.money
            ]);


        GM_xmlhttpRequest({

            method: 'POST',

            url: WEB_APP_URL,

            headers: {
                'Content-Type':
                    'text/plain;charset=UTF-8'
            },

            data: JSON.stringify({
                token: SECRET_TOKEN,
                rows: rows
            }),


            onload: function (response) {

                let result;

                try {

                    result =
                        JSON.parse(
                            response.responseText
                        );

                } catch (e) {

                    alert(
                        'Apps Script trả về dữ liệu không hợp lệ.\n\n' +
                        response.responseText
                    );

                    sendBtn.disabled = false;
                    startBtn.disabled = false;

                    return;
                }


                if (!result.ok) {

                    alert(
                        'Không ghi được Google Sheets:\n' +
                        result.error
                    );

                    sendBtn.disabled = false;
                    startBtn.disabled = false;

                    return;
                }


                updateStatus(
                    `✅ Đã ghi ${result.count} sản phẩm vào A1`
                );


                sendBtn.disabled = false;
                startBtn.disabled = false;


                /*
                 * Ghi thành công -> mở file vff
                 */

                window.open(
                    SHEET_URL,
                    '_blank'
                );
            },


            onerror: function (err) {

                alert(
                    'Không kết nối được Apps Script.'
                );

                console.error(err);

                sendBtn.disabled = false;
                startBtn.disabled = false;
            }
        });
    }


    // ==========================================================
    // DỪNG CUỘN + GỬI
    // ==========================================================

    async function stopAndSend() {

        stopRequested = true;
        running = false;


        stopBtn.disabled = true;


        collectProducts();


        await sleep(250);


        sendToGoogleSheets();
    }


    // ==========================================================
    // XÓA DANH SÁCH ĐÃ THU
    // ==========================================================

    function resetData() {

        if (running) {

            alert(
                'Hãy dừng trước khi xóa dữ liệu.'
            );

            return;
        }


        collected.length = 0;
        positionKeys.clear();


        updateStatus(
            'Đã xóa danh sách tạm'
        );
    }


    // ==========================================================
    // GIAO DIỆN
    // ==========================================================

    const panel =
        document.createElement('div');


    Object.assign(
        panel.style,
        {
            position: 'fixed',
            right: '20px',
            bottom: '25px',

            zIndex: '2147483647',

            width: '235px',

            padding: '12px',

            background:
                'rgba(255,255,255,.96)',

            border:
                '1px solid #ccc',

            borderRadius:
                '12px',

            boxShadow:
                '0 4px 18px rgba(0,0,0,.28)',

            fontFamily:
                'Arial, sans-serif',

            fontSize:
                '14px'
        }
    );


    const startBtn =
        document.createElement('button');


    startBtn.innerText =
        '▶ Bắt đầu';


    const stopBtn =
        document.createElement('button');


    stopBtn.innerText =
        '■ Dừng & Gửi';


    stopBtn.disabled = true;


    const sendBtn =
        document.createElement('button');


    sendBtn.innerText =
        '☁ Gửi ngay';


    const resetBtn =
        document.createElement('button');


    resetBtn.innerText =
        '↺ Xóa dữ liệu tạm';


    const status =
        document.createElement('div');


    status.innerHTML =
        'Đã lấy <b>0</b> sản phẩm';


    const buttons = [
        startBtn,
        stopBtn,
        sendBtn,
        resetBtn
    ];


    buttons.forEach(btn => {

        Object.assign(
            btn.style,
            {
                display: 'block',

                width: '100%',

                padding: '10px',

                marginBottom: '7px',

                border: 'none',

                borderRadius: '7px',

                cursor: 'pointer',

                fontWeight: 'bold'
            }
        );
    });


    Object.assign(
        startBtn.style,
        {
            background: '#ee4d2d',
            color: '#fff'
        }
    );


    Object.assign(
        stopBtn.style,
        {
            background: '#222',
            color: '#fff'
        }
    );


    Object.assign(
        sendBtn.style,
        {
            background: '#0f9d58',
            color: '#fff'
        }
    );


    Object.assign(
        resetBtn.style,
        {
            background: '#e9e9e9',
            color: '#333'
        }
    );


    Object.assign(
        status.style,
        {
            textAlign: 'center',
            lineHeight: '20px',
            marginTop: '4px'
        }
    );


    startBtn.onclick =
        startScrolling;


    stopBtn.onclick =
        stopAndSend;


    sendBtn.onclick =
        sendToGoogleSheets;


    resetBtn.onclick =
        resetData;


    panel.appendChild(
        startBtn
    );

    panel.appendChild(
        stopBtn
    );

    panel.appendChild(
        sendBtn
    );

    panel.appendChild(
        resetBtn
    );

    panel.appendChild(
        status
    );


    document.body.appendChild(
        panel
    );


    // Đọc luôn các sản phẩm đang hiển thị
    setTimeout(
        collectProducts,
        1500
    );

})();