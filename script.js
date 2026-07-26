// --- 0. Mobile Viewport Height Fix ---
// แก้ปัญหา 100vh บนมือถือ (Chrome/LINE browser มี address bar ทำให้ content ตก)
function setMobileVH() {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
    document.documentElement.style.setProperty('--full-height', `${window.innerHeight}px`);
}
setMobileVH();
window.addEventListener('resize', setMobileVH);
window.addEventListener('orientationchange', () => {
    setTimeout(setMobileVH, 300);
});

// --- 0.5 Page Transition Engine ---
// ใช้แทน white-fade-overlay ทุกจุด
// transitionTo(callback, options)
// options: { theme, animIn, animOut, duration, enterClass }
const PageTransition = (() => {
    const DEFAULTS = {
        theme: 'white',
        animIn: 'tx-fadeIn',
        animOut: 'tx-fadeOut',
        duration: 400,   // ms สำหรับ overlay fade in
        hold: 100,       // ms ค้างไว้ก่อน fade out
        enterClass: null // class ที่จะใส่ให้ target element หลังเปลี่ยน
    };

    function run(callback, opts = {}) {
        const o = Object.assign({}, DEFAULTS, opts);
        const overlay = document.getElementById('page-transition-overlay');
        // ลบ theme เก่า
        overlay.className = '';
        overlay.classList.add(`theme-${o.theme}`);
        overlay.style.display = 'block';
        overlay.style.animation = `${o.animIn} ${o.duration}ms cubic-bezier(0.4,0,0.2,1) both`;

        setTimeout(() => {
            // เรียก callback เปลี่ยนหน้า
            if (callback) callback();
            setTimeout(() => {
                overlay.style.animation = `${o.animOut} ${o.duration}ms cubic-bezier(0.4,0,0.2,1) both`;
                setTimeout(() => {
                    overlay.style.display = 'none';
                    overlay.style.animation = '';
                    overlay.className = '';
                }, o.duration);
            }, o.hold);
        }, o.duration);
    }

    // Presets สำหรับแต่ละ transition
    return {
        // ขาวธรรมดา (fallback)
        white:     (cb) => run(cb, { theme: 'white',  animIn: 'tx-fadeIn',     animOut: 'tx-fadeOut',    duration: 350 }),
        // เขียว — ธรรมชาติ สำหรับหน้าต้อนรับ
        nature:    (cb) => run(cb, { theme: 'nature',  animIn: 'tx-scaleIn',    animOut: 'tx-scaleOut',   duration: 400 }),
        // slide ขึ้น
        slideUp:   (cb) => run(cb, { theme: 'white',  animIn: 'tx-slideUpIn',  animOut: 'tx-slideUpOut', duration: 380 }),
        // slide ซ้าย
        slideLeft: (cb) => run(cb, { theme: 'white',  animIn: 'tx-slideLeftIn', animOut: 'tx-slideLeftOut', duration: 360 }),
        // flip แนวนอน
        flip:      (cb) => run(cb, { theme: 'white',  animIn: 'tx-flipIn',     animOut: 'tx-flipOut',    duration: 380 }),
        // zoom ออก
        zoomOut:   (cb) => run(cb, { theme: 'blur',   animIn: 'tx-zoomOutIn',  animOut: 'tx-zoomOutOut', duration: 380 }),
        // ripple วงกลม
        ripple:    (cb) => run(cb, { theme: 'green',  animIn: 'tx-rippleIn',   animOut: 'tx-rippleOut',  duration: 400 }),
        // cinematic ดำ — สำหรับ farewell
        cinematic: (cb) => run(cb, { theme: 'black',  animIn: 'tx-cinematicIn', animOut: 'tx-cinematicOut', duration: 500, hold: 200 }),
        // wipe จากซ้ายไปขวา
        wipe:      (cb) => run(cb, { theme: 'nature', animIn: 'tx-wipeIn',     animOut: 'tx-wipeOut',    duration: 380 }),
    };
})();

// --- 1. ตั้งค่าตัวแปรเริ่มต้น ---
let widthValue = 0;

// โหลด User ID เดิมถ้ามี หรือจะสร้างใหม่ด้วยระบบ Sequential หลังเช็คจำนวนผู้ใช้
let userId = localStorage.getItem('memory_garden_user_id');
console.log("Initial User ID from storage:", userId);

// ตัวแปรสำหรับ LINE Login
let isLineLogin = false;
let lineProfile = null;

let detectedProvince = null; // ย้ายมาประกาศด้านบนเพื่อเลี่ยง ReferenceError
let userLatitude = null;
let userLongitude = null;
let hourAngle = 0;
let minuteAngle = 0;
let clockScore = 0;
let handsScore = 0;

// ตัวแปรสำหรับ Math Test
let mathCurrentValue = 100;
let mathStep = 1;
let mathCorrectCount = 0;
let mathScore = 0;

// ตัวแปรสำหรับ Recall Test
let recallScore = 0;
let recallHintUsed = false;
let recallHintStage = 0; // 0: None, 1: Pattern, 2: Semantic, 3: Audio
let secretWordsData = []; // Store full word objects from Supabase
let secretWords = [];

// ตัวแปรสำหรับ Orientation
let orientationScore = 0;

// --- 2. ระบบ Fake Progress Loading ---
const progressBar = document.getElementById('progress-bar');
const loaderWrapper = document.getElementById('loader-wrapper');

const fakeLoadingInterval = setInterval(() => {
    if (widthValue < 85) {
        widthValue += 1;
        if (progressBar) progressBar.style.width = widthValue + '%';
    }
}, 30);

window.addEventListener('load', async function () {
    // Initial background setup from Supabase
    const bgs = MemoryGardenTools.getBackgrounds();
    document.querySelectorAll('.full-bg-video, #intro-page, #userid-page, #result-page, #welcome-garden-page, #clock-test-page, #memory-test-page, #math-test-page, #naming-test-page, #recall-test-page, #orientation-test-page, #farewell-page').forEach(el => {
        if (el.tagName === 'VIDEO') {
            el.style.display = 'none';
        }
        // Backgrounds are now mostly handled by style.css using public URLs.
        // We can optionally set them here if we want dynamic control.
    });

    let liffInitialized = false;
    try {
        // Initialize LIFF
        const liffId = "2010532474-WfR6f2f3";
        await liff.init({
            liffId: liffId,
            withLoginOnExternalBrowser: false // ป้องกันการ redirect ออก browser ภายนอก
        });
        liffInitialized = true;
        // เช็ค isInClient ก่อน: ถ้าอยู่ใน LINE app
        if (liff.isInClient()) {
            // บังคับเด้งออกไปเปิดใน External Browser (Chrome / Safari) ทันที
            const currentUrl = window.location.href;
            if (currentUrl.indexOf('openExternalBrowser=1') === -1) {
                const connector = currentUrl.indexOf('?') > -1 ? '&' : '?';
                const targetUrl = currentUrl + connector + 'openExternalBrowser=1';
                liff.openWindow({
                    url: targetUrl,
                    external: true
                });
                return;
            }
            isLineLogin = true;
            lineProfile = await liff.getProfile();
            userId = lineProfile.userId;
            localStorage.setItem('memory_garden_user_id', userId);
            console.log("Logged in via LINE in-app browser. User ID:", userId);
        } else if (liff.isLoggedIn()) {
            // เปิดใน external browser แต่ login ไว้แล้ว
            isLineLogin = true;
            lineProfile = await liff.getProfile();
            userId = lineProfile.userId;
            localStorage.setItem('memory_garden_user_id', userId);
            console.log("Logged in via LINE (external browser). User ID:", userId);
        }
    } catch (err) {
        console.error("LIFF Initialization failed", err);
    }

    // Bind LINE UI events
    const lineLoginBtn = document.getElementById('line-login-btn');
    if (lineLoginBtn) {
        lineLoginBtn.onclick = function () {
            if (liffInitialized) {
                // ถ้าอยู่ใน LINE app (isInClient) ให้ login ภายใน ไม่เปิด browser ใหม่
                if (liff.isInClient()) {
                    liff.login(); // ใน LINE in-app จะไม่เด้งออก browser นอก
                } else {
                    // อยู่นอก LINE app ค่อย login ปกติ
                    liff.login();
                }
            } else {
                showCustomPopup("ระบบ LINE LIFF ยังไม่พร้อมทำงาน กรุณารอสักครู่หรือลองใหม่อีกครั้ง");
            }
        };
    }

    const lineContinueBtn = document.getElementById('line-continue-btn');
    if (lineContinueBtn) {
        lineContinueBtn.onclick = function () {
            const linePage = document.getElementById('line-login-page');
            if (linePage) linePage.style.display = 'none';
            showIntroPage();
        };
    }



    const lineLogoutBtn = document.getElementById('line-logout-btn');
    if (lineLogoutBtn) {
        lineLogoutBtn.onclick = function (e) {
            e.preventDefault();
            if (liffInitialized && liff.isLoggedIn()) {
                liff.logout();
            }
            isLineLogin = false;
            lineProfile = null;
            localStorage.removeItem('memory_garden_user_id');
            updateLineLoginUI();
            location.reload();
        };
    }

    clearInterval(fakeLoadingInterval);
    widthValue = 100;
    if (progressBar) progressBar.style.width = '100%';

    setTimeout(() => {
        if (loaderWrapper) loaderWrapper.style.display = 'none';
        updateLineLoginUI();
        goToLogin();
    }, 500);
});

// ฟังก์ชันปรับปรุงการแสดงผล UI LINE
function updateLineLoginUI() {
    const unauthSec = document.getElementById('line-unauth-section');
    const authSec = document.getElementById('line-auth-section');
    const avatar = document.getElementById('line-user-avatar');
    const nameDisp = document.getElementById('line-user-name');

    if (isLineLogin && lineProfile) {
        if (unauthSec) unauthSec.style.display = 'none';
        if (authSec) authSec.style.display = 'block';
        if (avatar) avatar.src = lineProfile.pictureUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150';
        if (nameDisp) nameDisp.textContent = lineProfile.displayName || 'LINE User';
    } else {
        if (unauthSec) unauthSec.style.display = 'block';
        if (authSec) authSec.style.display = 'none';
    }
}

// =====================================================
// ระบบดูประวัติผลการทดสอบ
// =====================================================

// ผูกปุ่ม History
const lineHistoryBtn = document.getElementById('line-history-btn');
if (lineHistoryBtn) {
    lineHistoryBtn.onclick = function () {
        showHistoryPage();
    };
}

// ปุ่มปิดหน้าประวัติ
const closeHistoryBtn = document.getElementById('close-history-btn');
if (closeHistoryBtn) {
    closeHistoryBtn.onclick = function () {
        const hp = document.getElementById('history-page');
        if (hp) {
            hp.style.opacity = '0';
            setTimeout(() => { hp.style.display = 'none'; hp.style.opacity = ''; }, 250);
        }
    };
}

// ปุ่มทำแบบทดสอบใหม่จากหน้าประวัติ
const historyStartBtn = document.getElementById('history-start-btn');
if (historyStartBtn) {
    historyStartBtn.onclick = function () {
        const hp = document.getElementById('history-page');
        if (hp) hp.style.display = 'none';
        // ซ่อนหน้า LINE Login แล้วไปหน้าแนะนำ
        const linePage = document.getElementById('line-login-page');
        if (linePage) linePage.style.display = 'none';
        showIntroPage();
    };
}

// ปิดเมื่อคลิกนอก modal
const historyPage = document.getElementById('history-page');
if (historyPage) {
    historyPage.addEventListener('click', function (e) {
        if (e.target === historyPage) {
            historyPage.style.opacity = '0';
            setTimeout(() => { historyPage.style.display = 'none'; historyPage.style.opacity = ''; }, 250);
        }
    });
}

// ฟังก์ชันแสดงหน้าประวัติ
async function showHistoryPage() {
    const histPage = document.getElementById('history-page');
    const histLoading = document.getElementById('history-loading');
    const histEmpty = document.getElementById('history-empty');
    const histList = document.getElementById('history-list');
    const histUsername = document.getElementById('history-username');
    const histAvatar = document.getElementById('history-avatar');
    const histTotalCount = document.getElementById('history-total-count');
    const histBestScore = document.getElementById('history-best-score');
    const histLastScore = document.getElementById('history-last-score');

    if (!histPage) return;

    // แสดง modal
    histPage.style.display = 'flex';
    histPage.style.opacity = '0';
    setTimeout(() => { histPage.style.opacity = '1'; histPage.style.transition = 'opacity 0.25s ease'; }, 10);

    // ใส่ข้อมูล profile
    if (lineProfile) {
        if (histUsername) histUsername.textContent = lineProfile.displayName || 'LINE User';
        if (histAvatar) histAvatar.src = lineProfile.pictureUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150';
    } else {
        if (histUsername) histUsername.textContent = userId || 'ผู้ใช้งาน';
        if (histAvatar) histAvatar.src = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150';
    }

    // รีเซ็ตสถานะ
    if (histLoading) histLoading.style.display = 'block';
    if (histEmpty) histEmpty.style.display = 'none';
    if (histList) { histList.style.display = 'none'; histList.innerHTML = ''; }
    if (histTotalCount) histTotalCount.textContent = '-';
    if (histBestScore) histBestScore.textContent = '-';
    if (histLastScore) histLastScore.textContent = '-';

    // ดึงข้อมูลจาก Supabase
    const records = await MemoryGardenTools.getUserHistory(userId);
    if (histLoading) histLoading.style.display = 'none';

    if (!records || records.length === 0) {
        if (histEmpty) histEmpty.style.display = 'block';
        return;
    }

    // คำนวณ stats
    const scores = records.map(r => r.total_score || 0);
    const best = Math.max(...scores);
    const last = scores[0];
    if (histTotalCount) histTotalCount.textContent = records.length + ' ครั้ง';
    if (histBestScore) histBestScore.textContent = best + '/15';
    if (histLastScore) histLastScore.textContent = last + '/15';

    // Render รายการ
    if (histList) {
        histList.style.display = 'flex';
        histList.innerHTML = records.map((r, idx) => renderHistoryCard(r, idx)).join('');

        // Animate bars หลัง render
        setTimeout(() => {
            histList.querySelectorAll('.history-score-bar-fill').forEach(bar => {
                bar.style.width = bar.dataset.width;
            });
        }, 100);
    }
}

// ฟังก์ชัน render card แต่ละครั้ง
function renderHistoryCard(record, index) {
    const score = record.total_score || 0;
    const risk = record.risk_level || 'ไม่ระบุ';
    const details = record.details || {};
    const memory = details.memory ?? '-';
    const focus = details.focus ?? '-';
    const awareness = details.awareness ?? '-';
    const pct = Math.round((score / 15) * 100);

    // สีแถบและ badge
    let barColor = '#82954b'; // เขียว
    let badgeClass = 'normal';
    let badgeIcon = '✅';
    if (risk.includes('MCI') || risk.includes('บกพร่อง')) {
        barColor = '#f5a623'; badgeClass = 'mci'; badgeIcon = '⚠️';
    } else if (risk.includes('พิเศษ') || risk.includes('เสี่ยง') || risk.includes('ดูแล')) {
        barColor = '#e06666'; badgeClass = 'high'; badgeIcon = '🆘';
    }

    // แปลงวันที่
    let dateStr = '';
    if (record.created_at) {
        const d = new Date(record.created_at);
        dateStr = d.toLocaleDateString('th-TH', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    }

    const isLatest = index === 0;

    return `
    <div class="history-card" style="${isLatest ? 'border-color: #82954b; background: #f8fbf3;' : ''}">
        <div class="history-card-header">
            <div>
                ${isLatest ? '<span style="font-size:0.7rem;color:#82954b;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">ล่าสุด</span><br>' : ''}
                <span class="history-card-date">📅 ${dateStr}</span>
            </div>
            <span class="history-risk-badge ${badgeClass}">${badgeIcon} ${risk}</span>
        </div>
        <div class="history-score-row">
            <div class="history-total-score">${score}<span>/15</span></div>
            <div class="history-score-bar-wrap">
                <div class="history-score-bar-fill"
                    style="width: 0%; background: linear-gradient(90deg, ${barColor}, ${barColor}88);"
                    data-width="${pct}%"></div>
            </div>
            <div style="margin-left: 10px; font-size: 0.85rem; color: #888; min-width: 36px; text-align: right;">${pct}%</div>
        </div>
        <div class="history-detail-row">
            <div class="history-detail-chip">🧠 ความจำ: <strong>${memory}/3</strong></div>
            <div class="history-detail-chip">🎯 สมาธิ: <strong>${focus}/9</strong></div>
            <div class="history-detail-chip">🗓️ รับรู้: <strong>${awareness}/3</strong></div>
        </div>
    </div>`;
}


// --- 3. ฟังก์ชันพื้นฐาน (Typewriter & Navigation) ---
const scriptURL = 'https://script.google.com/macros/s/AKfycby_G-6fHIB8FgYwSpa__TbTO7EV8HP9F8aSF3589ZDpuj7lx9nQi_jmPic50eTYkm0Z/exec';
const MAX_USERS = 100;

async function goToLogin() {
    const linePage = document.getElementById('line-login-page');
    try {
        // ยังคงเช็คจำนวนผู้ใช้สูงสุดจาก Supabase
        const count = await MemoryGardenTools.getUserCount();

        if (count >= MAX_USERS) {
            if (loaderWrapper) loaderWrapper.style.display = 'none';
            showFullPage();
            return;
        }
    } catch (e) {
        console.warn('เช็คจำนวนสูงสุดไม่ได้:', e);
    }

    // แสดงหน้า LINE Login เป็นหน้าแรก
    if (linePage) {
        linePage.style.display = 'flex';
    }
}

function showIntroPage() {
    const introPage = document.getElementById('intro-page');
    const login = document.getElementById('login-container');

    if (introPage) {
        introPage.style.display = 'flex';
    }

    // ใช้ addEventListener แทน onclick เพื่อไม่ให้ผูกซ้ำ
    const startBtn = document.getElementById('intro-start-btn');
    if (startBtn && !startBtn.dataset.bound) {
        startBtn.dataset.bound = 'true';
        startBtn.addEventListener('click', function () {
            if (introPage) introPage.style.display = 'none';
            if (login) {
                login.style.display = 'flex';
                login.style.opacity = '1';
            }
        });
    }
}

function showFullPage() {
    document.body.innerHTML = `
        <div style="
            min-height:100vh; display:flex; flex-direction:column;
            justify-content:center; align-items:center;
            background: url('https://wqllezztqhfabpygicuv.supabase.co/storage/v1/object/public/Back%20image%201/garden.gif') center/cover no-repeat;
            text-align:center; padding:40px;
        ">
            <div style="background:rgba(255,255,255,0.9);border-radius:24px;padding:40px 32px;max-width:400px;box-shadow:0 8px 32px rgba(0,0,0,0.15);backdrop-filter:blur(10px);">
                <div style="font-size:3rem;margin-bottom:16px;">🌸</div>
                <h2 style="font-family:'Anuphan',sans-serif;color:#4a5d23;margin-bottom:12px;">ขออภัยค่ะ</h2>
                <p style="font-family:'Anuphan',sans-serif;color:#555;line-height:1.8;">
                    ขณะนี้มีผู้เข้าร่วมครบ ${MAX_USERS} คนแล้ว<br>
                    ขอบคุณที่ให้ความสนใจนะครับ 🙏
                </p>
            </div>
        </div>`;
}

function typeWriter(text, elementId, speed, callback) {
    let i = 0;
    const element = document.getElementById(elementId);
    if (!element) return;
    element.innerHTML = "";

    // ใช้ Array.from เพื่อจัดการ Surrogate Pairs และเบื้องต้นสำหรับภาษาไทย
    // แต่สำหรับภาษาไทยที่สมบูรณ์ ควรใช้การเช็คสระ/วรรณยุกต์
    const characters = Array.from(text);

    function typing() {
        if (i < characters.length) {
            let char = characters[i];

            // ตรวจสอบว่าเป็นสระหรือวรรณยุกต์ที่ต้องอยู่บน/ล่างตัวอักษรก่อนหน้าหรือไม่
            // ช่วงรหัสสระ/วรรณยุกต์ไทย: \u0E31, \u0E34-\u0E3A, \u0E47-\u0E4E
            while (i + 1 < characters.length &&
                /[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/.test(characters[i + 1])) {
                char += characters[i + 1];
                i++;
            }

            element.innerHTML += char;
            i++;
            setTimeout(typing, speed);
        } else { if (callback) callback(); }
    }
    typing();
}

// --- Custom Premium Popup Modal Functions ---
function showCustomPopup(message, icon = "⚠️", isConfirm = false) {
    const modal = document.getElementById('custom-alert-modal');
    const msgEl = document.getElementById('custom-alert-message');
    const iconEl = document.getElementById('custom-alert-icon');
    const okBtn = document.getElementById('custom-alert-ok-btn');
    const cancelBtn = document.getElementById('custom-alert-cancel-btn');
    const card = modal.querySelector('div');

    msgEl.innerText = message;
    iconEl.innerText = icon;

    if (isConfirm) {
        cancelBtn.style.display = 'inline-block';
    } else {
        cancelBtn.style.display = 'none';
    }

    modal.style.display = 'flex';
    modal.style.opacity = '0';
    card.style.transform = 'scale(0.85)';

    // force reflow
    modal.offsetHeight;

    modal.style.opacity = '1';
    card.style.transform = 'scale(1)';

    return new Promise((resolve) => {
        okBtn.onclick = () => {
            modal.style.opacity = '0';
            card.style.transform = 'scale(0.85)';
            setTimeout(() => {
                modal.style.display = 'none';
                resolve(true);
            }, 250);
        };
        cancelBtn.onclick = () => {
            modal.style.opacity = '0';
            card.style.transform = 'scale(0.85)';
            setTimeout(() => {
                modal.style.display = 'none';
                resolve(false);
            }, 250);
        };
    });
}

// --- 4. หน้า Login & เริ่มต้นเดินทาง ---
const infoForm = document.getElementById('info-form');
if (infoForm) {
    infoForm.addEventListener('submit', function (e) {
        e.preventDefault();
        document.getElementById('login-container').style.display = 'none';
        if (isLineLogin) {
            const welcomePage = document.getElementById('welcome-garden-page');
            if (welcomePage) { welcomePage.style.display = 'flex'; welcomePage.style.opacity = '1'; }
            typeWriter(`สวัสดีคุณ ${lineProfile ? (lineProfile.displayName || 'ผู้ใช้งาน') : 'ผู้ใช้งาน'} ยินดีต้อนรับเข้าสู่สวนแห่งความทรงจำ...`, "typing-text", 50, () => {
                const btn = document.getElementById('start-journey-btn');
                if (btn) { btn.style.display = 'inline-block'; setTimeout(() => { btn.style.opacity = '1'; }, 100); }
            });
        } else {
            document.getElementById('userid-display').innerText = userId;
            document.getElementById('userid-page').style.display = 'flex';
        }
    });
}

document.getElementById('userid-next-btn').onclick = function () {
    document.getElementById('userid-page').style.display = 'none';
    const welcomePage = document.getElementById('welcome-garden-page');
    welcomePage.style.display = 'flex';
    welcomePage.style.opacity = '1';
    setTimeout(() => {
        typeWriter("ยินดีต้อนรับสู่สวนความจำที่แสนอบอุ่น พวกเราจะนําพาทุกท่านเดินเล่นและทบทวนความทรงจำไปด้วยกัน", "typing-text", 50, () => {
            const btn = document.getElementById('start-journey-btn');
            btn.style.display = 'inline-block';
            setTimeout(() => { btn.style.opacity = '1'; }, 100);
        });
    }, 200);
};

// --- 5. ด่านที่ 1: จดจำ 3 คำ (ดึงจาก Supabase) ---
const startJourneyBtn = document.getElementById('start-journey-btn');
if (startJourneyBtn) {
    startJourneyBtn.addEventListener('click', async function () {
        // ดึงคำจาก Supabase ก่อน แล้วค่อย transition
        let wordsData = await MemoryGardenTools.fetchRecallSet(userId, 3);

        const FALLBACK_POOL = [
            { id: null, word: 'แมว', definition: '', example_sentence: 'เจ้า[.....]ชอบกินปลาและนอนบนโซฟา' },
            { id: null, word: 'บ้าน', definition: '', example_sentence: 'ฉันกำลังเดินทางกลับ[.....]หลังเลิกงาน' },
            { id: null, word: 'ต้นไม้', definition: '', example_sentence: 'ในสวนมี[.....]ใหญ่ที่ให้ร่มเงาดีมาก' },
            { id: null, word: 'นาฬิกา', definition: '', example_sentence: 'คุณช่วยดู[.....]หน่อยสิว่ากี่โมงแล้ว' },
            { id: null, word: 'ดอกไม้', definition: '', example_sentence: 'ฉันชอบกลิ่นหอมของ[.....]ในตอนเช้า' },
        ];

        if (!wordsData) wordsData = [];
        if (wordsData.length < 3) {
            const currentWords = wordsData.map(w => w.word);
            const needed = 3 - wordsData.length;
            const extra = FALLBACK_POOL
                .filter(w => !currentWords.includes(w.word))
                .sort(() => Math.random() - 0.5)
                .slice(0, needed);
            wordsData = [...wordsData, ...extra];
        }

        secretWordsData = wordsData;
        secretWords = wordsData.map(w => w.word);

        document.getElementById('welcome-garden-page').style.display = 'none';
        document.getElementById('memory-test-page').style.display = 'flex';
        document.getElementById('memory-words-display').innerText = secretWords.join('   ');

        typeWriter("ขอให้ทุกท่านลองจำคำต่อไปนี้ดูนะ...", "instruction-text", 50, () => {
            setTimeout(() => {
                const words = document.getElementById('words-container');
                words.style.display = 'block';
                setTimeout(() => { words.style.opacity = "1"; }, 100);

                setTimeout(() => {
                    words.style.opacity = "0";
                    setTimeout(() => {
                        words.style.display = 'none';
                        goToClockPage();
                    }, 300);
                }, 4500);
            }, 1000);
        });
    });
}

// --- 6. ด่านที่ 2: ระบบนาฬิกา ---
const CLOCK_TIME_POOL = [
    { h: 3, m: 0 }, { h: 6, m: 0 }, { h: 9, m: 0 }, { h: 12, m: 0 },
    { h: 1, m: 30 }, { h: 4, m: 30 }, { h: 7, m: 30 }, { h: 10, m: 30 },
    { h: 2, m: 15 }, { h: 5, m: 45 }, { h: 8, m: 15 }, { h: 11, m: 45 },
    { h: 3, m: 10 }, { h: 6, m: 20 }, { h: 9, m: 40 }, { h: 12, m: 50 },
    { h: 2, m: 0 }, { h: 5, m: 0 }, { h: 8, m: 0 }, { h: 11, m: 10 },
];
let targetHour = 0, targetMinute = 0;
let correctHourAngle = 0, correctMinuteAngle = 0;

function goToClockPage() {
    // reset scores ทุกครั้งที่เริ่มใหม่
    clockScore = 0;
    handsScore = 0;

    const pick = CLOCK_TIME_POOL[Math.floor(Math.random() * CLOCK_TIME_POOL.length)];
    targetHour = pick.h;
    targetMinute = pick.m;

    correctMinuteAngle = targetMinute * 6;
    correctHourAngle = ((targetHour % 12) * 30 + targetMinute * 0.5) % 360;
    correctHourAngle = Math.round(correctHourAngle / 30) * 30 % 360;

    hourAngle = 0;
    minuteAngle = 0;

    const timeStr = `${targetHour}:${String(targetMinute).padStart(2, '0')}`;

    document.getElementById('memory-test-page').style.display = 'none';
    document.getElementById('clock-hand-btns').style.display = 'none';
    document.getElementById('clock-test-page').style.display = 'flex';
    typeWriter(`อรุณสวัสดิ์ ตอนนี้คุณพึ่งตื่นนอนแต่นาฬิกาคุณดันกลับมาพังซะได้ คุณช่วยซ่อมนาฬิกาให้หน่อยได้มั้ย ตอนนี้ ${timeStr}`, "clock-instruction", 50, () => {
        setupClockGame();
    });
}

function setupClockGame() {
    const pile = document.getElementById('numbers-pile');
    const face = document.getElementById('clock-face');
    if (!pile || !face) return;

    const hint = document.getElementById('clock-hint');
    if (hint) hint.style.display = 'block';

    pile.innerHTML = "";
    face.querySelectorAll('.drop-zone').forEach(z => z.remove());

    // สร้าง drop-zone ทั้ง 12 ตำแหน่งบนหน้าปัดก่อน (ใช้ % เพื่อให้ Responsive บนหน้าจอทุกขนาด)
    for (let i = 1; i <= 12; i++) {
        const angle = (i * 30 - 90) * (Math.PI / 180);
        const x = 50 + 39 * Math.cos(angle);
        const y = 50 + 39 * Math.sin(angle);

        const zone = document.createElement('div');
        zone.className = 'drop-zone';
        zone.id = `zone-${i}`;
        zone.style.left = x + '%';
        zone.style.top = y + '%';
        face.appendChild(zone);
    }

    // สร้างตัวเลข 1–12 ใส่ใน pile
    const numbers = Array.from({ length: 12 }, (_, k) => k + 1);

    numbers.forEach(i => {
        const num = document.createElement('div');
        num.className = 'draggable-number';
        num.innerText = i;
        num.id = `num-${i}`;
        makeElementDraggable(num);
        pile.appendChild(num);
    });

    // Reset clock hands transform rotation
    const hrHand = document.getElementById('hour-hand');
    const mnHand = document.getElementById('minute-hand');
    if (hrHand) hrHand.style.transform = `translateX(-50%) rotate(0deg)`;
    if (mnHand) mnHand.style.transform = `translateX(-50%) rotate(0deg)`;

    // Setup reset button action
    const resetBtn = document.getElementById('clock-reset-btn');
    if (resetBtn) {
        resetBtn.onclick = function () {
            const currentPile = document.getElementById('numbers-pile');
            const zones = document.querySelectorAll('.drop-zone');

            zones.forEach(zone => {
                zone.querySelectorAll('.draggable-number').forEach(num => {
                    returnToPile(num);
                });
                zone.classList.remove('filled');
            });

            checkClockState();
        };
    }

    checkClockState();
}

function returnToPile(el) {
    const pile = document.getElementById('numbers-pile');
    if (!pile) return;

    const val = parseInt(el.innerText);
    const numbersInPile = Array.from(pile.querySelectorAll('.draggable-number'));

    let inserted = false;
    for (let i = 0; i < numbersInPile.length; i++) {
        const currentVal = parseInt(numbersInPile[i].innerText);
        if (val < currentVal) {
            pile.insertBefore(el, numbersInPile[i]);
            inserted = true;
            break;
        }
    }

    if (!inserted) {
        pile.appendChild(el);
    }

    el.style.position = 'static';
    el.style.transform = 'none';
    el.style.left = '';
    el.style.top = '';
}

function makeElementDraggable(el) {
    let isDragging = false;
    let hasMoved = false;
    let startX = 0, startY = 0;
    let originalLeft = el.style.left;
    let originalTop = el.style.top;
    let originalPosition = el.style.position;
    let originalTransform = el.style.transform;

    const startDrag = (e) => {
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        startX = clientX;
        startY = clientY;
        isDragging = true;
        hasMoved = false;

        originalLeft = el.style.left;
        originalTop = el.style.top;
        originalPosition = el.style.position;
        originalTransform = el.style.transform;

        const moveAt = (ev) => {
            const cx = ev.clientX || (ev.touches && ev.touches[0].clientX);
            const cy = ev.clientY || (ev.touches && ev.touches[0].clientY);
            el.style.left = cx - el.offsetWidth / 2 + 'px';
            el.style.top = cy - el.offsetHeight / 2 + 'px';
        };

        const onMouseMove = (ev) => {
            if (!isDragging) return;
            const cx = ev.clientX || (ev.touches && ev.touches[0].clientX);
            const cy = ev.clientY || (ev.touches && ev.touches[0].clientY);
            const dist = Math.sqrt(Math.pow(cx - startX, 2) + Math.pow(cy - startY, 2));

            if (!hasMoved && dist > 5) {
                hasMoved = true;
                el.style.position = 'fixed';
                el.style.transform = 'none';
            }

            if (hasMoved) {
                moveAt(ev);
            }
        };

        const stopDrag = (ev) => {
            isDragging = false;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', stopDrag);
            document.removeEventListener('touchmove', onMouseMove);
            document.removeEventListener('touchend', stopDrag);

            const endX = ev.clientX || (ev.changedTouches && ev.changedTouches[0].clientX) || startX;
            const endY = ev.clientY || (ev.changedTouches && ev.changedTouches[0].clientY) || startY;
            const distMoved = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));

            if (distMoved < 15 && !hasMoved) {
                const parentZone = el.parentElement;
                if (parentZone && parentZone.classList.contains('drop-zone')) {
                    parentZone.classList.remove('filled');
                    returnToPile(el);
                    checkClockState();
                    return;
                }
            }

            if (hasMoved) {
                checkDrop(el);
            } else {
                el.style.position = originalPosition;
                el.style.left = originalLeft;
                el.style.top = originalTop;
                el.style.transform = originalTransform;
            }
        };
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', stopDrag);
        document.addEventListener('touchmove', onMouseMove, { passive: false });
        document.addEventListener('touchend', stopDrag);
    };
    el.onmousedown = startDrag;
    el.ontouchstart = startDrag;
}

function checkClockState() {
    const placedCount = document.querySelectorAll('.drop-zone .draggable-number').length;
    const clockHands = document.getElementById('clock-hands');
    const handBtns = document.getElementById('clock-hand-btns');
    const submitBtn = document.getElementById('clock-submit-btn');
    const resetBtn = document.getElementById('clock-reset-btn');

    if (resetBtn) {
        resetBtn.style.display = placedCount > 0 ? 'inline-block' : 'none';
    }

    if (placedCount === 12) {
        if (clockHands) {
            clockHands.style.display = 'block';
            clockHands.style.pointerEvents = 'auto';
        }
        if (handBtns) handBtns.style.display = 'flex';
        if (submitBtn) submitBtn.style.display = 'inline-block';
        enableRotation('hour-hand', 'hour');
        enableRotation('minute-hand', 'minute');
    } else {
        if (clockHands) {
            clockHands.style.display = 'none';
            clockHands.style.pointerEvents = 'none';
        }
        if (handBtns) handBtns.style.display = 'none';
        if (submitBtn) submitBtn.style.display = 'none';
    }
}

function checkDrop(el) {
    const zones = document.querySelectorAll('.drop-zone');
    let closestZone = null;
    let minDist = Infinity;
    const r1 = el.getBoundingClientRect();

    zones.forEach(zone => {
        const r2 = zone.getBoundingClientRect();
        const dist = Math.sqrt(Math.pow((r1.left + r1.width / 2) - (r2.left + r2.width / 2), 2) + Math.pow((r1.top + r1.height / 2) - (r2.top + r2.height / 2), 2));
        if (dist < minDist) {
            minDist = dist;
            closestZone = zone;
        }
    });

    const oldParentZone = el.parentElement;
    let dropped = false;

    if (closestZone && minDist < 45) {
        const zone = closestZone;
        // Case 1: The zone is empty
        if (zone.children.length === 0) {
            if (oldParentZone && oldParentZone.classList.contains('drop-zone')) {
                oldParentZone.classList.remove('filled');
            }
            zone.appendChild(el);
            zone.classList.add('filled');
            el.style.position = 'absolute';
            el.style.left = '50%';
            el.style.top = '50%';
            el.style.transform = 'translate(-50%, -50%)';
            dropped = true;
        }
        // Case 2: We dragged it but let go in its own zone
        else if (zone.children.length === 1 && zone.children[0] === el) {
            el.style.position = 'absolute';
            el.style.left = '50%';
            el.style.top = '50%';
            el.style.transform = 'translate(-50%, -50%)';
            dropped = true;
        }
        // Case 3: The zone has a different number — send that number back to pile
        else if (zone.children.length === 1 && zone.children[0] !== el) {
            const displaced = zone.children[0];
            // ถ้าเลขที่ลากมาอยู่ใน zone อื่น ให้ล้าง zone นั้นก่อน
            if (oldParentZone && oldParentZone.classList.contains('drop-zone')) {
                oldParentZone.classList.remove('filled');
            }
            // ส่งเลขเดิมกลับไป pile
            returnToPile(displaced);
            // วางเลขใหม่ลงช่อง
            zone.appendChild(el);
            zone.classList.add('filled');
            el.style.position = 'absolute';
            el.style.left = '50%';
            el.style.top = '50%';
            el.style.transform = 'translate(-50%, -50%)';
            dropped = true;
        }
    }

    if (!dropped) {
        if (oldParentZone && oldParentZone.classList.contains('drop-zone')) {
            oldParentZone.classList.remove('filled');
        }
        returnToPile(el);
    }

    checkClockState();
}

function enableRotation(id, type) {
    const hand = document.getElementById(id);
    const btn = document.getElementById(type === 'hour' ? 'btn-hour' : 'btn-minute');

    const rotate = () => {
        if (type === 'hour') {
            hourAngle = (hourAngle + 30) % 360;
            hand.style.transform = `translateX(-50%) rotate(${hourAngle}deg)`;
        } else {
            minuteAngle = (minuteAngle + 30) % 360;
            hand.style.transform = `translateX(-50%) rotate(${minuteAngle}deg)`;
        }
    };

    hand.onclick = rotate;
    btn.onclick = rotate;
}

document.getElementById('clock-submit-btn').onclick = function () {
    clockScore = (document.querySelectorAll('.drop-zone .draggable-number').length === 12) ? 1 : 0;
    handsScore = (hourAngle === correctHourAngle && minuteAngle === correctMinuteAngle) ? 1 : 0;
    document.getElementById('clock-test-page').style.display = 'none';
    startMathTest();
};

// --- 7. ด่านที่ 3: ระบบคำนวณ (Math Test) ---
let mathStartValue = 100;
let mathSubtractor = 7;

function startMathTest() {
    const mathPage = document.getElementById('math-test-page');
    
    // สุ่มชุดโจทย์สำหรับทำแบบทดสอบ (เพื่อให้เหมาะสมกับสมาธิ)
    const mathPool = [
        { start: 100, step: 7 },
        { start: 100, step: 3 },
        { start: 90, step: 7 },
        { start: 90, step: 3 },
        { start: 95, step: 5 },
        { start: 80, step: 7 },
        { start: 80, step: 5 }
    ];
    
    const chosen = mathPool[Math.floor(Math.random() * mathPool.length)];
    mathStartValue = chosen.start;
    mathSubtractor = chosen.step;
    
    mathCurrentValue = mathStartValue;
    mathStep = 1;
    mathCorrectCount = 0;
    mathScore = 0;
    
    // อัปเดตตัวเลขลบในหน้าจอ HTML
    const subEl = document.getElementById('math-subtractor');
    if (subEl) subEl.innerText = mathSubtractor;
    
    mathPage.style.display = 'flex';
    setTimeout(() => {
        document.getElementById('math-caption').style.opacity = "1";
        setTimeout(() => {
            document.getElementById('math-question-container').style.opacity = "1";
            document.getElementById('math-next-btn').style.opacity = "1";
            updateMathUI();
        }, 1200);
    }, 500);
}

function updateMathUI() {
    document.getElementById('current-num').innerText = mathCurrentValue;
    document.getElementById('math-step').innerText = mathStep;
    const input = document.getElementById('math-answer');
    input.value = "";
    input.focus();
}

document.getElementById('math-next-btn').onclick = async function () {
    const userAnswer = parseInt(document.getElementById('math-answer').value);
    if (isNaN(userAnswer)) { 
        showCustomPopup("กรุณาใส่คำตอบก่อนนะคะ"); 
        return; 
    }
    if (userAnswer === (mathCurrentValue - mathSubtractor)) mathCorrectCount++;
    mathCurrentValue -= mathSubtractor;
    mathStep++;
    if (mathStep <= 5) updateMathUI();
    else {
        if (mathCorrectCount >= 4) mathScore = 3;
        else if (mathCorrectCount >= 2) mathScore = 2;
        else if (mathCorrectCount === 1) mathScore = 1;
        document.getElementById('math-test-page').style.display = 'none';
        await startNamingTest();
    }
};

// --- 8. ด่านที่ 3.5: การบอกชื่อสิ่งของ (Naming Test) — ดึงรูปสัตว์จาก Supabase Storage ---
let namingScore = 0;
let namingSelectedObjects = [];

async function startNamingTest() {
    const page = document.getElementById('naming-test-page');
    const container = document.getElementById('naming-cards-container');
    page.style.display = 'flex';
    container.innerHTML = '<p style="color:#82954b;font-size:1rem;text-align:center;">กำลังโหลดรูปภาพ...</p>';
    namingScore = 0;

    // ดึงรายการสัตว์จาก Supabase (naming_pool) พร้อม fallback อัตโนมัติ
    namingSelectedObjects = await MemoryGardenTools.fetchNamingItems(2);

    container.innerHTML = '';
    namingSelectedObjects.forEach((obj, i) => {
        const card = document.createElement('div');
        card.style.cssText = 'width:100%;background:#fff;border-radius:16px;padding:14px 18px;box-shadow:0 4px 16px rgba(0,0,0,0.08);display:flex;flex-direction:row;align-items:center;gap:16px;box-sizing:border-box;border:1.5px solid #e8ede0;';

        // แสดงรูปจริงจาก Supabase Storage
        const imgWrapper = document.createElement('div');
        imgWrapper.style.cssText = 'width:90px;height:90px;flex-shrink:0;background:#f5f8f0;border-radius:12px;display:flex;align-items:center;justify-content:center;overflow:hidden;';

        const img = document.createElement('img');
        img.src = obj.image_url;
        img.alt = '?';  // ไม่เผย alt เพื่อไม่บอกคำตอบ
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:12px;';
        img.onerror = () => {
            // ถ้าโหลดรูปไม่ได้ แสดง emoji แทน
            imgWrapper.innerHTML = '<span style="font-size:52px;">🐾</span>';
        };

        imgWrapper.appendChild(img);

        const rightDiv = document.createElement('div');
        rightDiv.style.cssText = 'flex:1;display:flex;flex-direction:column;gap:8px;';

        const label = document.createElement('label');
        label.textContent = `ชื่อสัตว์ที่ ${i + 1}`;
        label.style.cssText = 'font-size:0.9rem;color:#82954b;font-weight:bold;';

        const input = document.createElement('input');
        input.type = 'text';
        input.id = `naming-answer-${i}`;
        input.placeholder = 'พิมพ์ชื่อสัตว์ในภาพ';
        input.style.cssText = 'width:100%;padding:10px 14px;border:1.5px solid #ddd;border-radius:10px;font-size:1rem;outline:none;box-sizing:border-box;font-family:\'Anuphan\',sans-serif;';

        rightDiv.appendChild(label);
        rightDiv.appendChild(input);
        card.appendChild(imgWrapper);
        card.appendChild(rightDiv);
        container.appendChild(card);
    });
}

document.getElementById('naming-submit-btn').onclick = function () {
    const answers = namingSelectedObjects.map((_, i) =>
        document.getElementById(`naming-answer-${i}`).value.trim()
    );
    namingScore = 0;
    answers.forEach((ans, i) => {
        if (ans === namingSelectedObjects[i].name) namingScore++;
    });

    document.getElementById('naming-test-page').style.display = 'none';
    startRecallTest();
};


// --- Helper: สร้าง Pattern Hint (Stage 1) ---
// "Sustainable" → "S _ _ _ _ _ _ _ e"
function buildPatternHint(word) {
    if (!word || word.length < 2) return word;
    const chars = [...word]; // Unicode-safe split for Thai/English
    return chars.map((ch, i) => (i === 0 || i === chars.length - 1) ? ch : '_').join(' ');
}

// --- Helper: สร้าง Semantic Hint (Stage 2) ---
// แทนที่คำตอบในประโยคตัวอย่างด้วย [.....]
function buildSemanticHint(wordObj) {
    if (!wordObj || !wordObj.example_sentence) return null;
    const escaped = wordObj.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'gi');
    return wordObj.example_sentence.replace(regex, '[.....]');
}

// --- Helper: อัปเดต Progress Bar ---
async function updateProgressBar() {
    const progress = await MemoryGardenTools.getProgress(userId);
    const reviewed = progress.reviewed_today || 0;
    const due = progress.total_due || 0;
    const total = reviewed + due;
    const pct = total > 0 ? Math.round((reviewed / total) * 100) : 0;
    const fillEl = document.getElementById('recall-progress-fill');
    const textEl = document.getElementById('recall-progress-text');
    if (fillEl) fillEl.style.width = pct + '%';
    if (textEl) textEl.textContent = `${reviewed}/${total} คำ`;
}

// --- 9. ด่านที่ 4: ระบบระลึกถึง (Recall Test) ---
function startRecallTest() {
    const recallPage = document.getElementById('recall-test-page');
    const inputCon = document.getElementById('recall-input-container');
    recallScore = 0;
    recallHintUsed = false;
    recallHintStage = 0;

    const hintBtn = document.getElementById('recall-hint-btn');
    hintBtn.disabled = false;
    hintBtn.style.opacity = '1';
    hintBtn.textContent = '💡 ขอคำใบ้ (จะได้ 0 คะแนน)';

    document.getElementById('recall-hint-box').style.display = 'none';
    document.getElementById('recall-1').value = '';
    document.getElementById('recall-2').value = '';
    document.getElementById('recall-3').value = '';
    inputCon.style.opacity = '0';
    recallPage.style.display = 'flex';

    // แสดงข้อความด้วย typeWriter ให้ตัวหนังสือค่อยๆ พิมพ์
    typeWriter("เมื่อคืนเราฝันอะไรก็ไม่รู้ แต่จำลางๆ ได้ว่ามีของ 3 อย่างอยู่ด้วย คุณช่วยเรานึกออกมาได้มั้ย?", "recall-caption", 50, () => {
        setTimeout(() => {
            inputCon.style.transition = "opacity 0.8s ease";
            inputCon.style.opacity = "1";
            document.getElementById('recall-1').focus();
        }, 300);
    });

    // โหลด progress bar แบบ real-time
    updateProgressBar();
}

// --- Multi-stage Progressive Hint System ---
document.getElementById('recall-hint-btn').onclick = async function () {
    // Stage 0 → 1: แสดงคำเตือนก่อนครั้งแรก
    if (recallHintStage === 0) {
        const confirmed = await showCustomPopup("การขอรับคำใบ้จะส่งผลให้คะแนนในหมวดความจำระยะสั้นเป็น 0 คะแนน\n\nคุณแน่ใจหรือไม่ว่าต้องการดูคำใบ้?", "⚠️", true);
        if (!confirmed) return;
        recallHintUsed = true;
    }

    recallHintStage++;
    const hintBox = document.getElementById('recall-hint-box');
    const hintText = document.getElementById('recall-hint-text');
    hintBox.style.display = 'block';
    hintBox.classList.add('hint-animate');
    setTimeout(() => hintBox.classList.remove('hint-animate'), 600);

    if (recallHintStage === 1) {
        // Stage 1: Pattern Hint — ตัวแรก + ตัวสุดท้าย + _ แทนตัวที่เหลือ
        this.textContent = '💬 ขอคำใบ้เพิ่ม (ระดับ 2 - ประโยคตัวอย่าง)';
        const hints = secretWords.map((w, i) =>
            `<div class="hint-stage"><span class="hint-label">คำที่ ${i + 1}:</span> <span class="hint-pattern">${buildPatternHint(w)}</span></div>`
        ).join('');
        hintText.innerHTML = `<p style="color:#82954b;font-weight:bold;margin:0 0 8px;">🔠 รูปแบบตัวอักษร</p>${hints}`;

    } else if (recallHintStage === 2) {
        // Stage 2: Semantic Hint — ประโยคตัวอย่างพร้อมแทนคำด้วย [.....]
        this.textContent = '🔊 ขอคำใบ้เพิ่ม (ระดับ 3 - ฟังเสียง)';
        const pattern = secretWords.map((w, i) =>
            `<div class="hint-stage"><span class="hint-label">คำที่ ${i + 1}:</span> <span class="hint-pattern">${buildPatternHint(w)}</span></div>`
        ).join('');
        const semantic = secretWordsData.map((obj, i) => {
            const sentence = buildSemanticHint(obj);
            return sentence
                ? `<div class="hint-stage"><span class="hint-label">คำที่ ${i + 1}:</span> <em>"${sentence}"</em></div>`
                : '';
        }).join('');
        hintText.innerHTML = `<p style="color:#82954b;font-weight:bold;margin:0 0 8px;">🔠 รูปแบบ</p>${pattern}<p style="color:#82954b;font-weight:bold;margin:8px 0;">📖 ประโยคตัวอย่าง</p>${semantic}`;

    } else if (recallHintStage === 3) {
        // Stage 3: Audio/Phonetic — TTS หรือ phonetic
        this.disabled = true;
        this.style.opacity = '0.4';
        this.textContent = '✅ ใบ้ครบแล้ว';

        const pattern = secretWords.map((w, i) =>
            `<div class="hint-stage"><span class="hint-label">คำที่ ${i + 1}:</span> <span class="hint-pattern">${buildPatternHint(w)}</span></div>`
        ).join('');
        const semantic = secretWordsData.map((obj, i) => {
            const sentence = buildSemanticHint(obj);
            return sentence
                ? `<div class="hint-stage"><span class="hint-label">คำที่ ${i + 1}:</span> <em>"${sentence}"</em></div>`
                : '';
        }).join('');
        const audio = secretWordsData.map((obj, i) => {
            if (obj.audio_url) {
                return `<div class="hint-stage"><span class="hint-label">คำที่ ${i + 1}:</span>
                    <button onclick="new Audio('${obj.audio_url}').play()" class="hint-audio-btn">🔊 ฟังเสียง</button>
                    ${obj.phonetic ? `<span class="hint-phonetic">${obj.phonetic}</span>` : ''}
                </div>`;
            } else {
                // TTS Fallback
                return `<div class="hint-stage"><span class="hint-label">คำที่ ${i + 1}:</span>
                    <button onclick="speakWord('${obj.word}')" class="hint-audio-btn">🔊 ฟังเสียง (TTS)</button>
                    ${obj.phonetic ? `<span class="hint-phonetic">${obj.phonetic}</span>` : ''}
                </div>`;
            }
        }).join('');
        hintText.innerHTML =
            `<p style="color:#82954b;font-weight:bold;margin:0 0 4px;">🔠 รูปแบบ</p>${pattern}` +
            `<p style="color:#82954b;font-weight:bold;margin:8px 0 4px;">📖 ประโยค</p>${semantic}` +
            `<p style="color:#82954b;font-weight:bold;margin:8px 0 4px;">🔊 เสียง</p>${audio}`;
    }
};

// TTS helper
function speakWord(word) {
    if (!('speechSynthesis' in window)) return;
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = 'th-TH';
    utterance.rate = 0.8;
    window.speechSynthesis.speak(utterance);
}

document.getElementById('recall-next-btn').onclick = async function () {
    const r1 = document.getElementById('recall-1').value.trim();
    const r2 = document.getElementById('recall-2').value.trim();
    const r3 = document.getElementById('recall-3').value.trim();
    const answers = [r1, r2, r3];

    recallScore = 0;
    if (!recallHintUsed) {
        const correctAnswers = new Set();
        answers.forEach(ans => {
            if (secretWords.includes(ans)) {
                correctAnswers.add(ans);
            }
        });
        recallScore = correctAnswers.size;
    }

    // Feedback animation
    const btn = this;
    if (recallScore > 0) {
        btn.classList.add('btn-correct-flash');
        setTimeout(() => btn.classList.remove('btn-correct-flash'), 800);
    }

    // บันทึกผลลัพธ์ไปที่ Supabase ผ่าน MCP Tool
    for (let i = 0; i < secretWordsData.length; i++) {
        const wordObj = secretWordsData[i];
        if (wordObj.id) {
            const isCorrect = answers.includes(wordObj.word);
            await MemoryGardenTools.updateWordStatus(userId, wordObj.id, isCorrect);
        }
    }

    // อัปเดต progress bar อีกครั้งหลังบันทึก
    await updateProgressBar();

    document.getElementById('recall-test-page').style.display = 'none';
    startOrientationTest();
};

// --- 9. ด่านสุดท้าย: การรับรู้ (Orientation Test) ---
const THAI_PROVINCES = [
    'กระบี่', 'กรุงเทพมหานคร', 'กาญจนบุรี', 'กาฬสินธุ์', 'กำแพงเพชร',
    'ขอนแก่น', 'จันทบุรี', 'ฉะเชิงเทรา', 'ชลบุรี', 'ชัยนาท',
    'ชัยภูมิ', 'ชุมพร', 'เชียงราย', 'เชียงใหม่', 'ตรัง',
    'ตราด', 'ตาก', 'นครนายก', 'นครปฐม', 'นครพนม',
    'นครราชสีมา', 'นครศรีธรรมราช', 'นครสวรรค์', 'นนทบุรี', 'นราธิวาส',
    'น่าน', 'บึงกาฬ', 'บุรีรัมย์', 'ปทุมธานี', 'ประจวบคีรีขันธ์',
    'ปราจีนบุรี', 'ปัตตานี', 'พระนครศรีอยุธยา', 'พะเยา', 'พังงา',
    'พัทลุง', 'พิจิตร', 'พิษณุโลก', 'เพชรบุรี', 'เพชรบูรณ์',
    'แพร่', 'ภูเก็ต', 'มหาสารคาม', 'มุกดาหาร', 'แม่ฮ่องสอน',
    'ยโสธร', 'ยะลา', 'ร้อยเอ็ด', 'ระนอง', 'ระยอง',
    'ราชบุรี', 'ลพบุรี', 'ลำปาง', 'ลำพูน', 'เลย',
    'ศรีสะเกษ', 'สกลนคร', 'สงขลา', 'สตูล', 'สมุทรปราการ',
    'สมุทรสงคราม', 'สมุทรสาคร', 'สระแก้ว', 'สระบุรี', 'สิงห์บุรี',
    'สุโขทัย', 'สุพรรณบุรี', 'สุราษฎร์ธานี', 'สุรินทร์', 'หนองคาย',
    'หนองบัวลำภู', 'อ่างทอง', 'อำนาจเจริญ', 'อุดรธานี', 'อุตรดิตถ์',
    'อุทัยธานี', 'อุบลราชธานี'
];

function setupProvinceSearch() {
    const searchInput = document.getElementById('ori-province-search');
    const dropdown = document.getElementById('ori-province-dropdown');
    const hiddenInput = document.getElementById('ori-province-value');

    searchInput.addEventListener('input', function () {
        const q = this.value.trim();
        hiddenInput.value = '';
        if (!q) { dropdown.style.display = 'none'; return; }

        const matches = THAI_PROVINCES.filter(p => p.includes(q));
        if (matches.length === 0) { dropdown.style.display = 'none'; return; }

        dropdown.innerHTML = '';
        matches.forEach(p => {
            const item = document.createElement('div');
            item.textContent = p;
            item.style.cssText = 'padding:12px 15px;cursor:pointer;border-bottom:1px solid #f0f0f0;font-size:1rem;';
            item.addEventListener('mousedown', function (e) {
                e.preventDefault();
                searchInput.value = p;
                hiddenInput.value = p;
                dropdown.style.display = 'none';
            });
            item.addEventListener('mouseover', () => item.style.background = '#f5f5f5');
            item.addEventListener('mouseout', () => item.style.background = 'white');
            dropdown.appendChild(item);
        });
        dropdown.style.display = 'block';
    });

    searchInput.addEventListener('blur', () => {
        setTimeout(() => { dropdown.style.display = 'none'; }, 150);
    });
}

function startOrientationTest() {
    const oriPage = document.getElementById('orientation-test-page');
    const inputCon = document.getElementById('orientation-input-container');
    oriPage.style.display = 'flex';
    orientationScore = 0;
    document.getElementById('ori-date').value = '';
    document.getElementById('ori-month').value = '';
    document.getElementById('ori-year').value = '';
    document.getElementById('ori-day').value = '';
    document.getElementById('ori-province-search').value = '';
    document.getElementById('ori-province-value').value = '';
    document.getElementById('orientation-input-container').style.opacity = '0';
    detectedProvince = null;

    // setup ครั้งเดียว
    if (!oriPage.dataset.searchReady) {
        setupProvinceSearch();
        oriPage.dataset.searchReady = 'true';
    }

    getUserProvince();

    const msg = "ขอบคุณมากครับที่ช่วยเรามาตลอด เหลือคำถามสุดท้ายแล้วครับ เราอยากทราบว่าในโลกของคุณ วันนี้วันที่เท่าไหร่ เดือนอะไร ปีอะไร วันอะไรในสัปดาห์ และคุณอยู่ที่จังหวัดอะไรครับ";
    const captionEl = document.getElementById('orientation-caption');
    if (captionEl) captionEl.textContent = msg;

    setTimeout(() => {
        inputCon.style.transition = "opacity 0.6s ease";
        inputCon.style.opacity = "1";
        document.getElementById('ori-date').focus();
    }, 200);
}

// จังหวัดที่ได้จาก GPS (ประกาศไว้ด้านบนสุดแล้ว)

function getUserProvince() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
        async (pos) => {
            const { latitude, longitude } = pos.coords;
            userLatitude = latitude;
            userLongitude = longitude;
            try {
                const res = await fetch(
                    `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=th`,
                    { headers: { 'Accept-Language': 'th' } }
                );
                const data = await res.json();
                // Nominatim คืน state = จังหวัด (ภาษาไทย)
                const raw = data.address?.state || '';
                // ตัด "จังหวัด" นำหน้าออก ถ้ามี
                detectedProvince = raw.replace(/^จังหวัด/, '').trim();
                console.log('GPS จังหวัด:', detectedProvince);
            } catch (e) {
                console.warn('Reverse geocoding ล้มเหลว:', e);
            }
        },
        (err) => { console.warn('Geolocation error:', err.message); }
    );
}

document.getElementById('ori-next-btn').onclick = function () {
    const d = parseInt(document.getElementById('ori-date').value);
    const m = parseInt(document.getElementById('ori-month').value);
    const y = parseInt(document.getElementById('ori-year').value);
    const dayVal = document.getElementById('ori-day').value;
    const province = document.getElementById('ori-province-value').value;

    if (!d || !m || !y || dayVal === '' || !province) {
        showCustomPopup("กรุณากรอกข้อมูลให้ครบถ้วน");
        return;
    }

    const now = new Date();
    orientationScore = 0;
    if (d === now.getDate()) orientationScore++;
    if (m === (now.getMonth() + 1)) orientationScore++;
    if (y === now.getFullYear() || y === (now.getFullYear() + 543)) orientationScore++;
    if (parseInt(dayVal) === now.getDay()) orientationScore++;
    // เช็คจังหวัดจาก GPS (ถ้าได้พิกัดมา)
    if (detectedProvince) {
        if (province === detectedProvince) orientationScore++;
    } else {
        // GPS ไม่พร้อม/ปฏิเสธ → ให้คะแนนเสมอ
        orientationScore++;
    }

    goToFarewell();
};

function goToFarewell() {
    document.getElementById('orientation-test-page').style.display = 'none';
    const farewellPage = document.getElementById('farewell-page');
    if (farewellPage) farewellPage.style.display = 'flex';

    const msg = "ขอบคุณนะที่ช่วยเหลือเราตลอดและทำให้เรามีรอยยิ้ม แต่ว่ามันคงถึงเวลาที่เราต้องจากกันแล้วละ โชคดีนะ...";
    typeWriter(msg, "farewell-text", 70, () => {
        setTimeout(() => {
            document.getElementById('farewell-page').style.display = 'none';
            calculateAndShowResult();
        }, 2000);
    });
}

function sendDataToSheet(userData) {
    console.log("กำลังส่งข้อมูล...", userData);

    fetch(scriptURL, {
        method: 'POST',
        mode: 'no-cors',
        cache: 'no-cache',
        body: JSON.stringify(userData)
    })
        .then(() => {
            console.log("ส่งข้อมูลสำเร็จ (GAS)");
        })
        .catch(error => {
            console.error("เกิดข้อผิดพลาดในการส่งข้อมูล", error);
        });
}

// ฟังก์ชันสำหรับส่งข้อมูลเข้า Google Form (Background)
function sendToGoogleForm(userData) {
    const formURL = "https://docs.google.com/forms/d/e/1FAIpQLSdlh51nTnmzPeuncxcBSiAUVYde2FDknRlx3Oya2rPnkNCwOA/formResponse";
    const formData = new FormData();

    // แมปข้อมูลเข้ากับ Entry ID จริงที่ตรวจพบ
    formData.append("entry.604375086", userData.userId); // User ID
    formData.append("entry.1212631587", `คะแนน: ${userData.totalScore}/15, ระดับ: ${userData.riskLevel}, รายละเอียด: ${JSON.stringify(userData.details)}`); // ใส่คะแนนและรายละเอียดในช่องข้อเสนอแนะ

    fetch(formURL, {
        method: "POST",
        mode: "no-cors",
        body: formData
    }).catch(err => console.warn("Google Form Background Error:", err));
}

// ฟังก์ชันเปิดฟอร์มประเมินความพึงพอใจแบบกรอกรหัสให้อัตโนมัติ
function openSatisfactionForm() {
    const baseUrl = "https://docs.google.com/forms/d/e/1FAIpQLSdlh51nTnmzPeuncxcBSiAUVYde2FDknRlx3Oya2rPnkNCwOA/viewform";
    const prefilledUrl = `${baseUrl}?entry.604375086=${userId}`;
    window.open(prefilledUrl, '_blank');
}

function calculateAndShowResult() {
    // ถ้ายังไม่มี userId ให้สร้าง anonymous ID
    if (!userId) {
        userId = 'anon_' + Date.now();
        localStorage.setItem('memory_garden_user_id', userId);
    }

    let memoryScoreFinal = recallScore;
    let focusScoreFinal = (clockScore + handsScore + mathScore);
    let orientScoreFinal = orientationScore;

    let totalScore = recallScore + clockScore + handsScore + mathScore + orientationScore + namingScore;

    const eduLevel = document.getElementById('user-education').value;
    if (eduLevel === "ตํ่ากว่ามัธยมศึกษาปีที่ 6") {
        totalScore += 1;
    }

    if (totalScore > 15) totalScore = 15;

    const percentage = Math.round((totalScore / 15) * 100);
    document.getElementById('farewell-page').style.display = 'none';
    document.getElementById('result-page').style.display = 'flex';
    document.body.style.overflowY = "auto";

    updateRiskDisplay(totalScore);

    const userData = {
        timestamp: new Date().toLocaleString('th-TH'),
        userId: userId,
        name: (isLineLogin && lineProfile) ? lineProfile.displayName : (document.getElementById('user-name')?.value || "Anonymous"),
        age: document.getElementById('user-age').value,
        gender: document.getElementById('user-gender').value,
        education: document.getElementById('user-education').value,
        disease: document.getElementById('user-disease').value || "ไม่มี",
        totalScore: totalScore,
        riskLevel: document.getElementById('risk-level-title').innerText,
        latitude: userLatitude,
        longitude: userLongitude,
        details: {
            memory: recallScore,
            focus: (clockScore + handsScore + mathScore),
            awareness: (orientationScore + namingScore)
        }
    };

    sendDataToSheet(userData);   // ส่งไป Apps Script เดิม
    sendToGoogleForm(userData); // ส่งไป Google Form (เงียบๆ)
    MemoryGardenTools.saveTestResult(userData); // ส่งไป Supabase

    const resultUserIdDisplay = document.getElementById('result-userid-display');
    if (resultUserIdDisplay) resultUserIdDisplay.innerText = userId;
}

function updateRiskDisplay(score) {
    const riskCard = document.getElementById('risk-card');
    const riskTitle = document.getElementById('risk-level-title');
    const riskDesc = document.getElementById('risk-description');
    const adviceList = document.getElementById('advice-list');

    if (score >= 13) {
        riskCard.style.backgroundColor = "";
        riskCard.style.borderColor = "#82954b";
        riskCard.style.borderWidth = "2px";
        riskCard.style.borderStyle = "solid";
        riskCard.style.color = "#2d2d2d";
        riskTitle.innerText = "ปกติ (Normal)";
        riskDesc.innerText = "ขณะนี้สุขภาพสมองของท่านอยู่ในเกณฑ์ปกติครับ การทดสอบด้านสมาธิ การจดจำ และการรับรู้วันเวลาทำได้ดีมาก ขอให้ท่านหมั่นดูแลสุขภาพกายและใจเพื่อรักษาประสิทธิภาพของสมองให้แข็งแรงแบบนี้ต่อไปนะครับ";
        adviceList.innerHTML = `
            <li>✅ ออกกำลังกายสม่ำเสมออย่างน้อย 30 นาทีต่อวัน เช่น เดินเร็ว หรือว่ายน้ำ เพื่อช่วยให้เลือดไปเลี้ยงสมองได้ดี</li>
            <li>✅ รับประทานอาหารครบ 5 หมู่ เน้นผักผลไม้ และปลา หลีกเลี่ยงอาหารหวานหรือเค็มจัด</li>
            <li>✅ นอนหลับพักผ่อนให้เพียงพอ 7–8 ชั่วโมงต่อวัน เพื่อให้สมองได้พักฟื้นและซ่อมแซมส่วนที่สึกหรอ</li>
            <li>✅ หากิจกรรมลับสมองทำสม่ำเสมอ เช่น อ่านหนังสือ เล่นเกมปริศนา หรือเรียนรู้ทักษะใหม่ๆ</li>
            <li>✅ ตรวจสุขภาพประจำปีอย่างสม่ำเสมอ และนำผลประเมินนี้ปรึกษาแพทย์หากมีความกังวลครับ</li>
        `;
    } else if (score >= 9) {
        riskCard.style.backgroundColor = "";
        riskCard.style.borderColor = "#ffd966";
        riskCard.style.borderWidth = "2px";
        riskCard.style.borderStyle = "solid";
        riskCard.style.color = "#2d2d2d";
        riskTitle.innerText = "เสี่ยงบกพร่องเล็กน้อย (MCI)";
        riskDesc.innerText = "เริ่มพบสัญญาณการทำงานของสมองที่ลดลงเล็กน้อย อาจมีปัญหาด้านความจำหรือสมาธิบ้างในชีวิตประจำวัน แต่ยังสามารถดูแลตัวเองได้ตามปกติ แนะนำให้ปรึกษาแพทย์เพื่อประเมินอย่างละเอียดต่อไปครับ";
        adviceList.innerHTML = `
            <li>⚠️ นัดพบแพทย์หรือผู้เชี่ยวชาญด้านสมองและระบบประสาทเพื่อตรวจประเมินอย่างละเอียด อย่าปล่อยทิ้งไว้นานครับ</li>
            <li>⚠️ ฝึกกิจกรรมกระตุ้นสมองทุกวัน เช่น เล่นเกมทายคำ ต่อเลข ฝึกจำชื่อคน หรือเขียนบันทึกประจำวัน</li>
            <li>⚠️ ออกกำลังกายเบาๆ สม่ำเสมอ เช่น เดินเร็ว โยคะ หรือรำมวยจีน อย่างน้อย 5 วันต่อสัปดาห์</li>
            <li>⚠️ ลดความเครียด หากิจกรรมผ่อนคลาย เช่น ฟังเพลง ทำสวน หรือนั่งสมาธิ เพราะความเครียดเรื้อรังทำลายสมองได้</li>
            <li>⚠️ แจ้งคนในครอบครัวให้รับทราบ เพื่อช่วยสังเกตอาการและให้กำลังใจในการดูแลสุขภาพ</li>
            <li>⚠️ หลีกเลี่ยงแอลกอฮอล์และบุหรี่ เพราะส่งผลเสียต่อการทำงานของสมองโดยตรง</li>
        `;
    } else {
        riskCard.style.backgroundColor = "";
        riskCard.style.borderColor = "#e06666";
        riskCard.style.borderWidth = "2px";
        riskCard.style.borderStyle = "solid";
        riskCard.style.color = "#2d2d2d";
        riskTitle.innerText = "ควรได้รับการดูแลพิเศษ";
        riskDesc.innerText = "จากการทดสอบเบื้องต้น พบว่าประสิทธิภาพการทำงานของสมองในหลายด้านอยู่ในเกณฑ์ที่ควรเฝ้าระวังครับ แนะนำให้ท่านเข้าพบแพทย์ผู้เชี่ยวชาญเพื่อรับการตรวจวินิจฉัยอย่างละเอียดโดยเร็วที่สุด เพื่อวางแผนการดูแลและรักษาสุขภาพสมองที่เหมาะสมกับท่านครับ";
        adviceList.innerHTML = `
            <li>🆘 นัดพบแพทย์เฉพาะทางด้านประสาทวิทยาหรืออายุรกรรมสมองโดยเร็วที่สุด</li>
            <li>🆘 แจ้งผลการประเมินนี้ให้แพทย์และสมาชิกในครอบครัวทราบเพื่อร่วมกันวางแผนการดูแล</li>
            <li>🆘 ครอบครัวควรเข้ามามีส่วนร่วมในการช่วยเหลือและดูแลกิจวัตรประจำวันอย่างใกล้ชิด</li>
            <li>🆘 ดูแลสุขภาพกายและควบคุมโรคประจำตัวอย่างเคร่งครัดตามคำแนะนำของแพทย์</li>
        `;
    }
}

// =====================================================
// ระบบค้นหาโรงพยาบาลและคลินิกความจำเกี่ยวกับอัลไซเมอร์ใกล้ฉัน
// =====================================================

const ALZHEIMER_HOSPITALS = [
    {
        name: "คลินิกความจำ โรงพยาบาลจุฬาลงกรณ์ สภากาชาดไทย",
        lat: 13.7319,
        lng: 100.5348,
        phone: "022564000",
        phoneDisplay: "02-256-4000",
        specialty: "คลินิกผู้สูงอายุและคลินิกความจำ (Memory Clinic) บริการตรวจวินิจฉัย รักษา และดูแลผู้ป่วยโรคสมองเสื่อมอย่างครบวงจรโดยทีมแพทย์ผู้เชี่ยวชาญเฉพาะทาง",
        address: "ถนนพระรามที่ 4 แขวงปทุมวัน เขตปทุมวัน กรุงเทพฯ"
    },
    {
        name: "คลินิกความจำ โรงพยาบาลศิริราช",
        lat: 13.7583,
        lng: 100.4856,
        phone: "024197000",
        phoneDisplay: "02-419-7000",
        specialty: "คลินิกความจำ ภาควิชาเวชศาสตร์ป้องกันและสังคม ให้บริการตรวจคัดกรอง วินิจฉัย ฟื้นฟูสมรรถภาพทางสมอง และฝึกทักษะการจำสำหรับผู้สูงอายุและผู้ป่วยสมองเสื่อม",
        address: "ถนนวังหลัง แขวงศิริราช เขตบางกอกน้อย กรุงเทพฯ"
    },
    {
        name: "คลินิกความจำและพฤติกรรม โรงพยาบาลรามาธิบดี",
        lat: 13.7667,
        lng: 100.5281,
        phone: "022011000",
        phoneDisplay: "02-201-1000",
        specialty: "ตรวจประเมินผู้ที่มีปัญหาด้านความจำ ทักษะการรู้คิด และพฤติกรรมที่ผิดปกติโดยคณะแพทย์ผู้เชี่ยวชาญเฉพาะทางด้านประสาทวิทยาและสมองเสื่อม",
        address: "ถนนพระรามที่ 6 แขวงทุ่งพญาไท เขตราชเทวี กรุงเทพฯ"
    },
    {
        name: "คลินิกผู้สูงอายุ สถาบันประสาทวิทยา",
        lat: 13.7656,
        lng: 100.5255,
        phone: "023069899",
        phoneDisplay: "02-306-9899",
        specialty: "สถาบันเฉพาะทางโรคสมองและประสาทวิทยา มีศูนย์ประเมินและดูแลผู้ป่วยภาวะสมองเสื่อมระดับตติยภูมิที่มีความเชี่ยวชาญและเครื่องมือพิเศษในการตรวจโดยเฉพาะ",
        address: "ถนนราชวิถี แขวงทุ่งพญาไท เขตราชเทวี กรุงเทพฯ"
    },
    {
        name: "คลินิกจิตเวชผู้สูงอายุ สถาบันจิตเวชศาสตร์สมเด็จเจ้าพระยา",
        lat: 13.7317,
        lng: 100.5019,
        phone: "024422500",
        phoneDisplay: "02-442-2500",
        specialty: "ดูแลผู้ป่วยสมองเสื่อม (Alzheimer's) ที่มีภาวะแทรกซ้อนทางด้านจิตวิทยา พฤติกรรม อารมณ์ และการนอนหลับ โดยทีมจิตแพทย์และนักกิจกรรมบำบัดผู้สูงอายุ",
        address: "ถนนสมเด็จเจ้าพระยา แขวงคลองสาน เขตคลองสาน กรุงเทพฯ"
    },
    {
        name: "ศูนย์สุขภาพผู้สูงอายุ โรงพยาบาลมหาราชนครเชียงใหม่",
        lat: 18.7898,
        lng: 98.9744,
        phone: "053936150",
        phoneDisplay: "053-936-150",
        specialty: "ศูนย์ดูแลสุขภาพผู้สูงอายุและบริการคลินิกความจำเฉพาะทางสำหรับภาคเหนือ ตรวจประเมิน คัดกรอง และรักษาฟื้นฟูโรคอัลไซเมอร์",
        address: "ถนนอินทวโรรส ตำบลศรีภูมิ อำเภอเมือง จ.เชียงใหม่"
    },
    {
        name: "คลินิกอายุรกรรมสมอง โรงพยาบาลสงขลานครินทร์",
        lat: 7.0094,
        lng: 100.4967,
        phone: "074455000",
        phoneDisplay: "074-455-000",
        specialty: "ให้บริการตรวจคัดกรอง ประเมินสุขภาพสมอง และรักษาผู้ป่วยที่มีปัญหาภาวะสมองเสื่อมและโรคอัลไซเมอร์ในเขตพื้นที่ภาคใต้",
        address: "ถนนกาญจนวณิชย์ ตำบลคอหงส์ อำเภอหาดใหญ่ จ.สงขลา"
    },
    {
        name: "คลินิกผู้สูงอายุ โรงพยาบาลศรีนครินทร์ (ม.ขอนแก่น)",
        lat: 16.4632,
        lng: 102.8274,
        phone: "043363666",
        phoneDisplay: "043-363-666",
        specialty: "ให้บริการรักษาโรคสมองเสื่อมและอัลไซเมอร์ระดับตติยภูมิในภาคตะวันออกเฉียงเหนือ มีทีมแพทย์เฉพาะทางระบบประสาทและเวชศาสตร์ผู้สูงอายุดูแลอย่างใกล้ชิด",
        address: "ถนนมิตรภาพ ตำบลในเมือง อำเภอเมือง จ.ขอนแก่น"
    }
];

// ฟังก์ชันคำนวณระยะทางจากพิกัด (Haversine Formula)
function getHaversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // รัศมีของโลกในหน่วยกิโลเมตร
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // ระยะทางเป็นกิโลเมตร
}

// เชื่อมโยงปุ่มกับ Event Listener
function initHospitalLocator() {
    const findHospitalBtn = document.getElementById('find-hospital-btn');
    const hospitalModal = document.getElementById('hospital-modal');
    const closeModalBtn = document.getElementById('close-hospital-modal');
    const loadingSec = document.getElementById('hospital-loading');
    const resultSec = document.getElementById('hospital-result');

    if (findHospitalBtn) {
        findHospitalBtn.addEventListener('click', () => {
            if (hospitalModal) {
                hospitalModal.style.display = 'flex';
                loadingSec.style.display = 'block';
                resultSec.style.display = 'none';
            }

            // ร้องขอตำแหน่ง Geolocation ของเบราว์เซอร์
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const userLat = position.coords.latitude;
                        const userLng = position.coords.longitude;
                        
                        // ค้นหาโรงพยาบาลที่อยู่ใกล้ที่สุด
                        let nearestHosp = null;
                        let minDistance = Infinity;

                        ALZHEIMER_HOSPITALS.forEach(hosp => {
                            const distance = getHaversineDistance(userLat, userLng, hosp.lat, hosp.lng);
                            if (distance < minDistance) {
                                minDistance = distance;
                                nearestHosp = hosp;
                            }
                        });

                        if (nearestHosp) {
                            renderHospitalResult(nearestHosp, minDistance);
                        } else {
                            showFallbackHospital();
                        }
                    },
                    (error) => {
                        console.warn("Geolocation access denied or failed:", error);
                        // หากปฏิเสธสิทธิ์ หรือหาไม่เจอ ให้แสดงโรงพยาบาลแนะนำ (เช่น รพ.จุฬาฯ เป็นค่าเริ่มต้น)
                        showFallbackHospital("กรุณาเปิดสิทธิ์เข้าถึงตำแหน่งเพื่อคำนวณระยะทางจริง หรือเลือกติดต่อโรงพยาบาลหลักด้านล่างนี้ครับ");
                    },
                    { enableHighAccuracy: true, timeout: 5000 }
                );
            } else {
                showFallbackHospital("เบราว์เซอร์ของคุณไม่รองรับการระบุพิกัด ตำแหน่งด้านล่างเป็นโรงพยาบาลแนะนำหลักครับ");
            }
        });
    }

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            if (hospitalModal) hospitalModal.style.display = 'none';
        });
    }

    // ปิดโมดอลเมื่อคลิกนอกพื้นที่กล่อง
    if (hospitalModal) {
        hospitalModal.addEventListener('click', (e) => {
            if (e.target === hospitalModal) {
                hospitalModal.style.display = 'none';
            }
        });
    }

    function renderHospitalResult(hosp, distance) {
        loadingSec.style.display = 'none';
        resultSec.style.display = 'block';

        document.getElementById('hosp-name').textContent = hosp.name;
        document.getElementById('hosp-distance').textContent = `📍 ห่างจากคุณประมาณ ${distance.toFixed(1)} กิโลเมตร`;
        document.getElementById('hosp-desc').textContent = hosp.specialty;
        document.getElementById('hosp-address').textContent = `ที่อยู่: ${hosp.address}`;

        const callBtn = document.getElementById('hosp-call-btn');
        callBtn.href = `tel:${hosp.phone}`;
        callBtn.textContent = `📞 โทร ${hosp.phoneDisplay}`;

        const mapBtn = document.getElementById('hosp-map-btn');
        mapBtn.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hosp.name)}`;
    }

    function showFallbackHospital(msg = "ระบบกำลังแสดงโรงพยาบาลหลักของกรุงเทพฯ เป็นค่าเริ่มต้น") {
        // ดึง รพ. จุฬาลงกรณ์ เป็นค่าเริ่มต้นสำหรับ Fallback
        const fallbackHosp = ALZHEIMER_HOSPITALS[0]; 
        loadingSec.style.display = 'none';
        resultSec.style.display = 'block';

        document.getElementById('hosp-name').textContent = fallbackHosp.name;
        document.getElementById('hosp-distance').textContent = `📍 ${msg}`;
        document.getElementById('hosp-desc').textContent = fallbackHosp.specialty;
        document.getElementById('hosp-address').textContent = `ที่อยู่: ${fallbackHosp.address}`;

        const callBtn = document.getElementById('hosp-call-btn');
        callBtn.href = `tel:${fallbackHosp.phone}`;
        callBtn.textContent = `📞 โทร ${fallbackHosp.phoneDisplay}`;

        const mapBtn = document.getElementById('hosp-map-btn');
        mapBtn.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fallbackHosp.name)}`;
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHospitalLocator);
} else {
    initHospitalLocator();
}