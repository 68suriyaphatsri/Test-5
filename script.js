// --- 0. Speech / Audio Assistant Utility ---
// --- High-Quality Thai Voice Engine ---
let cachedThaiVoice = null;
let currentUtterance = null;

function getBestThaiVoice() {
    if (!('speechSynthesis' in window)) return null;
    if (cachedThaiVoice) return cachedThaiVoice;

    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;

    // หาเสียงภาษาไทยทั้งหมด
    const thaiVoices = voices.filter(v => 
        v.lang === 'th-TH' || v.lang === 'th_TH' || v.lang.toLowerCase().startsWith('th')
    );

    if (thaiVoices.length === 0) return null;

    // ลำดับเสียงที่คมชัดและเป็นธรรมชาติที่สุด (Natural / Neural / Cloud Voices)
    const preferred = thaiVoices.find(v => v.name.includes('Google') || v.name.includes('ภาษาไทย')) ||
                      thaiVoices.find(v => v.name.includes('Natural') || v.name.includes('Premwadee') || v.name.includes('Niwat')) ||
                      thaiVoices.find(v => v.name.includes('Kanya') || v.name.includes('Narisa') || v.name.includes('Siri')) ||
                      thaiVoices.find(v => v.name.includes('Enhanced') || v.name.includes('Premium')) ||
                      thaiVoices.find(v => !v.localService) || // เสียง Cloud ความละเอียดสูง
                      thaiVoices[0];

    cachedThaiVoice = preferred;
    return preferred;
}

if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => {
        cachedThaiVoice = null;
        getBestThaiVoice();
    };
    getBestThaiVoice();
}

function speakText(text) {
    if (!('speechSynthesis' in window)) {
        alert("เบราว์เซอร์นี้ไม่รองรับการอ่านเสียง");
        return;
    }

    try {
        window.speechSynthesis.cancel(); // ล้างคิวเสียงเก่า
        if (window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'th-TH';

        const voice = getBestThaiVoice();
        if (voice) {
            utterance.voice = voice;
        }

        // ปรับแต่งความเร็วและระดับเสียงให้ออกเสียง ร/ล และวรรณยุกต์ชัดเจนที่สุด
        utterance.rate = 0.93;  // ความเร็วกำลังดี ชัดถ้อยชัดคำ
        utterance.pitch = 1.02; // โทนเสียงสดใสฟังง่าย
        utterance.volume = 1.0;

        currentUtterance = utterance;
        utterance.onend = () => { currentUtterance = null; };
        utterance.onerror = () => { currentUtterance = null; };

        window.speechSynthesis.speak(utterance);
    } catch (e) {
        console.warn('[TTS Error]:', e);
    }
}

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

// --- Global Variables ---
let fluencyScore = 0;  // Category Fluency score (max 4)
let sentenceRepeatScore = 0; // Sentence Repetition score (max 2)
let currentStory = null; // เรื่องที่ถูกสุ่มในรอบนี้

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
        // Initialize LIFF พร้อม timeout 2 วินาที ป้องกันโหลดค้าง
        const liffId = "2010532474-WfR6f2f3";
        const liffPromise = liff.init({
            liffId: liffId,
            withLoginOnExternalBrowser: false
        });
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('LIFF init timeout')), 2000));
        
        await Promise.race([liffPromise, timeoutPromise]);
        liffInitialized = true;

        if (liff.isInClient()) {
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
            isLineLogin = true;
            lineProfile = await liff.getProfile();
            userId = lineProfile.userId;
            localStorage.setItem('memory_garden_user_id', userId);
            console.log("Logged in via LINE (external browser). User ID:", userId);
        }
    } catch (err) {
        console.warn("LIFF Initialization skipped or timed out:", err.message);
    }

    // Bind LINE UI events
    const lineLoginBtn = document.getElementById('line-login-btn');
    if (lineLoginBtn) {
        lineLoginBtn.onclick = function () {
            if (liffInitialized) {
                if (liff.isInClient()) {
                    liff.login();
                } else {
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
    }, 400);
});

// Fallback timer ป้องกันหน้า loading ค้างในทุกกรณี
setTimeout(() => {
    const lw = document.getElementById('loader-wrapper');
    if (lw && lw.style.display !== 'none') {
        lw.style.display = 'none';
        goToLogin();
    }
}, 2500);

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
    if (histBestScore) histBestScore.textContent = best + '/30';
    if (histLastScore) histLastScore.textContent = last + '/30';

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
    const visuospatial = details.visuospatial ?? '-';
    const math = details.math ?? '-';
    const language = details.language ?? '-';
    const orientation = details.orientation ?? '-';
    const pct = Math.round((score / 30) * 100);

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
            <div class="history-total-score">${score}<span>/30</span></div>
            <div class="history-score-bar-wrap">
                <div class="history-score-bar-fill"
                    style="width: 0%; background: linear-gradient(90deg, ${barColor}, ${barColor}88);"
                    data-width="${pct}%"></div>
            </div>
            <div style="margin-left: 10px; font-size: 0.85rem; color: #888; min-width: 36px; text-align: right;">${pct}%</div>
        </div>
        <div class="history-detail-row">
            <div class="history-detail-chip">🧠 ความจำ: <strong>${memory}/5</strong></div>
            <div class="history-detail-chip">🕰️ นาฬิกา: <strong>${visuospatial}/5</strong></div>
            <div class="history-detail-chip">🛒 คิดเลข: <strong>${math}/5</strong></div>
            <div class="history-detail-chip">🌿 บอกชื่อ: <strong>${language}/5</strong></div>
            <div class="history-detail-chip">🗺️ วันเวลา: <strong>${orientation}/10</strong></div>
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

    // ข้ามหน้า LINE Login และเปิดหน้าแนะนำแอป (Intro Page) เป็นหน้าแรก
    if (linePage) {
        linePage.style.display = 'none';
    }
    showIntroPage();
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
        
        // ข้ามหน้า userid-page ไปยังหน้ายินดีต้อนรับสู่สวนความจำโดยตรง
        const welcomePage = document.getElementById('welcome-garden-page');
        if (welcomePage) { 
            welcomePage.style.display = 'flex'; 
            welcomePage.style.opacity = '1'; 
        }
        
        const userNameInput = document.getElementById('user-name')?.value;
        const displayName = (isLineLogin && lineProfile && lineProfile.displayName) ? lineProfile.displayName : (userNameInput || 'ผู้ใช้งาน');
        
        typeWriter(`สวัสดีคุณ ${displayName} ยินดีต้อนรับสู่สวนแห่งความทรงจำ...`, "typing-text", 50, () => {
            const btn = document.getElementById('start-journey-btn');
            if (btn) { 
                btn.style.display = 'inline-block'; 
                setTimeout(() => { btn.style.opacity = '1'; }, 100); 
            }
        });
    });
}


// --- 5. ด่านที่ 1: จดจำสิ่งของในสวน (Garden Memory Test - 5 ข้อ 5 คะแนน) ---
const GARDEN_STORIES = [
    {
        story: "ต้นไม้, แมว, นาฬิกา, ผีเสื้อ, ดอกไม้",
        words: ["ต้นไม้", "แมว", "นาฬิกา", "ผีเสื้อ", "ดอกไม้"],
        voice: "โปรดจดจำสิ่งของทั้ง 5 อย่างต่อไปนี้นะครับ ได้แก่ ต้นไม้, แมว, นาฬิกา, ผีเสื้อ, และดอกไม้ เมื่อจำได้แล้วให้กดปุ่มฉันจำได้แล้วเพื่อไปต่อครับ"
    },
    {
        story: "นกกระจอก, มะม่วง, กระถาง, กรรไกร, โต๊ะไม้",
        words: ["นกกระจอก", "มะม่วง", "กระถาง", "กรรไกร", "โต๊ะไม้"],
        voice: "โปรดจดจำสิ่งของทั้ง 5 อย่างต่อไปนี้นะครับ ได้แก่ นกกระจอก, มะม่วง, กระถาง, กรรไกร, และโต๊ะไม้ เมื่อจำได้แล้วให้กดปุ่มฉันจำได้แล้วเพื่อไปต่อครับ"
    },
    {
        story: "บัวรดน้ำ, น้ำใส, กระรอก, ผักกาด, บ้านสวน",
        words: ["บัวรดน้ำ", "น้ำใส", "กระรอก", "ผักกาด", "บ้านสวน"],
        voice: "โปรดจดจำสิ่งของทั้ง 5 อย่างต่อไปนี้นะครับ ได้แก่ บัวรดน้ำ, น้ำใส, กระรอก, ผักกาด, และบ้านสวน เมื่อจำได้แล้วให้กดปุ่มฉันจำได้แล้วเพื่อไปต่อครับ"
    }
];

function replayMemoryWordsVoice() {
    if (secretWords && secretWords.length > 0) {
        speakText("สิ่งของ 5 อย่างที่ต้องจดจำ ได้แก่ " + secretWords.join(", "));
    }
}

const startJourneyBtn = document.getElementById('start-journey-btn');
if (startJourneyBtn) {
    startJourneyBtn.addEventListener('click', async function () {
        // สุ่มชุดสิ่งของในสวน
        const selectedStory = GARDEN_STORIES[Math.floor(Math.random() * GARDEN_STORIES.length)];
        currentStory = selectedStory; // เก็บไว้ใช้ในขั้นตอน Sentence Repeat
        
        secretWords = selectedStory.words;
        secretWordsData = selectedStory.words.map(w => ({
            id: null,
            word: w,
            example_sentence: `สิ่งของในสวนคือ [.....]`
        }));

        document.getElementById('welcome-garden-page').style.display = 'none';
        document.getElementById('memory-test-page').style.display = 'flex';
        
        const wordsDisplay = document.getElementById('memory-words-display');
        if (wordsDisplay) {
            wordsDisplay.innerHTML = secretWords.map(w => `<span style="background:white;color:#2e4414;padding:8px 18px;border-radius:16px;box-shadow:0 3px 10px rgba(0,0,0,0.08);font-size:1.35rem;font-weight:bold;display:inline-block;">${w}</span>`).join(' ');
        }

        // อ่านเสียงโจทย์อัตโนมัติ
        speakText(selectedStory.voice);

        typeWriter("โปรดตั้งใจฟังและจดจำสิ่งของในสวนความทรงจำทั้ง 5 อย่างต่อไปนี้นะครับ...", "instruction-text", 45, () => {
            setTimeout(() => {
                const words = document.getElementById('words-container');
                words.style.display = 'block';
                setTimeout(() => { words.style.opacity = "1"; }, 100);
            }, 600);
        });
    });
}

// ผูกปุ่ม "ฉันจำได้แล้ว ไปต่อ" (ให้ผู้ใช้กดเมื่อพร้อม)
const memoryReadyBtn = document.getElementById('memory-ready-btn');
if (memoryReadyBtn) {
    memoryReadyBtn.onclick = function () {
        const words = document.getElementById('words-container');
        if (words) words.style.opacity = "0";
        setTimeout(() => {
            if (words) words.style.display = 'none';
            goToClockPage();
        }, 300);
    };
}


// --- 6. ด่านที่ 2: ระบบนาฬิกา (Clock Drawing Test - 3 คะแนน) ---
const CLOCK_TIME_POOL = [
    { h: 3, m: 0 }, { h: 6, m: 0 }, { h: 9, m: 0 }, { h: 12, m: 0 },
    { h: 1, m: 30 }, { h: 4, m: 30 }, { h: 7, m: 30 }, { h: 10, m: 30 },
    { h: 2, m: 15 }, { h: 5, m: 45 }, { h: 8, m: 15 }, { h: 11, m: 45 },
    { h: 3, m: 10 }, { h: 6, m: 20 }, { h: 9, m: 40 }, { h: 12, m: 50 },
    { h: 2, m: 0 }, { h: 5, m: 0 }, { h: 8, m: 0 }, { h: 11, m: 10 },
];
let targetHour = 0, targetMinute = 0;
let correctHourAngle = 0, correctMinuteAngle = 0;
let selectedNumberElement = null;
let contourScore = 0;
let canvasPoints = [];
let isDrawing = false;
let clockCanvasInited = false;

function goToClockPage() {
    // reset scores ทุกครั้งที่เริ่มใหม่
    clockScore = 0;
    handsScore = 0;
    contourScore = 0;
    canvasPoints = [];

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
    document.getElementById('clock-test-page').style.display = 'flex';
    
    // แสดง Canvas สำหรับวาดวงกลมก่อน ซ่อนส่วนวางตัวเลข
    document.getElementById('clock-canvas-container').style.display = 'flex';
    document.getElementById('clock-interactive-container').style.display = 'none';
    
    initClockCanvas();

    typeWriter(`อรุณสวัสดิ์ ตอนนี้นาฬิกาพังซะแล้ว กรุณาใช้นิ้ววาดวงกลมหน้าปัดนาฬิกาลงในกรอบด้านล่างก่อนนะครับ (เวลาที่ต้องตั้งคือ ${timeStr})`, "clock-instruction", 45, () => {
        speakText(`กรุณาใช้นิ้ววาดวงกลมหน้าปัดนาฬิกาลงในกรอบด้านล่างก่อนนะครับ`);
    });
}

function initClockCanvas() {
    const canvas = document.getElementById('clock-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvasPoints = [];
    isDrawing = false;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const placeholder = document.getElementById('clock-canvas-placeholder');
    if (placeholder) placeholder.style.display = 'flex';

    if (clockCanvasInited) return;
    clockCanvasInited = true;

    function getPos(e) {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: (clientX - rect.left) * (canvas.width / rect.width),
            y: (clientY - rect.top) * (canvas.height / rect.height)
        };
    }

    function startDraw(e) {
        e.preventDefault();
        isDrawing = true;
        const pos = getPos(e);
        canvasPoints = [pos];
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        ctx.strokeStyle = '#4a5d23';
        ctx.lineWidth = 4.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (placeholder) placeholder.style.display = 'none';
    }

    function draw(e) {
        if (!isDrawing) return;
        e.preventDefault();
        const pos = getPos(e);
        canvasPoints.push(pos);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
    }

    function stopDraw(e) {
        if (!isDrawing) return;
        isDrawing = false;
    }

    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', draw);
    window.addEventListener('mouseup', stopDraw);

    canvas.addEventListener('touchstart', startDraw, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    window.addEventListener('touchend', stopDraw);

    const clearBtn = document.getElementById('clock-canvas-clear-btn');
    if (clearBtn) {
        clearBtn.onclick = function () {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            canvasPoints = [];
            if (placeholder) placeholder.style.display = 'flex';
        };
    }

    const confirmBtn = document.getElementById('clock-canvas-confirm-btn');
    if (confirmBtn) {
        confirmBtn.onclick = function () {
            if (canvasPoints.length < 15) {
                showCustomPopup("กรุณาใช้นิ้ววาดเส้นวงกลมหน้าปัดนาฬิกาก่อนนะครับ", "✍️");
                return;
            }

            // ประเมินความกลมของเส้นที่วาด (Circularity Evaluation)
            contourScore = evaluateCircularity(canvasPoints, canvas.width, canvas.height);
            console.log("Circularity Contour Score (0 or 1):", contourScore);

            // Morph / Snap สู่ Perfect Circle
            snapToPerfectClock();
        };
    }
}

// อัลกอริทึมประเมินความกลมของวงกลม (Circularity / Contour Metric)
function evaluateCircularity(points, width, height) {
    if (points.length < 15) return 0;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    let sumX = 0, sumY = 0;
    
    points.forEach(p => {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
        sumX += p.x;
        sumY += p.y;
    });

    const boxW = maxX - minX;
    const boxH = maxY - minY;
    if (boxW < 60 || boxH < 60) return 0; // ขนาดเล็กเกินไป

    const aspectRatio = boxW / boxH;
    if (aspectRatio < 0.60 || aspectRatio > 1.65) return 0; // เบี้ยวเป็นเส้นยาว

    const centerX = sumX / points.length;
    const centerY = sumY / points.length;

    // คำนวณระยะทางจากจุดศูนย์กลาง
    const radii = points.map(p => Math.hypot(p.x - centerX, p.y - centerY));
    const avgRadius = radii.reduce((a, b) => a + b, 0) / radii.length;
    if (avgRadius < 30) return 0;

    // ส่วนเบี่ยงเบนมาตรฐานของรัศมี (ความคงที่ของรัศมี)
    const variance = radii.reduce((sum, r) => sum + Math.pow(r - avgRadius, 2), 0) / radii.length;
    const stdDev = Math.sqrt(variance);
    const relativeStdDev = stdDev / avgRadius;

    // ตรวจสอบความชิดของจุดเริ่มต้นกับจุดสิ้นสุด (Closure Check)
    const startEndDist = Math.hypot(points[0].x - points[points.length - 1].x, points[0].y - points[points.length - 1].y);
    const isClosed = startEndDist < avgRadius * 0.95;

    // เกณฑ์ผ่าน: มีความกลมต่อเนื่องและเส้นบรรจบกันพอสมควร
    if (relativeStdDev <= 0.38 && isClosed) {
        return 1;
    }
    return 0;
}

function snapToPerfectClock() {
    const canvasContainer = document.getElementById('clock-canvas-container');
    const interactiveContainer = document.getElementById('clock-interactive-container');
    const clockFace = document.getElementById('clock-face');

    canvasContainer.style.display = 'none';
    interactiveContainer.style.display = 'flex';
    
    // Snap animation
    if (clockFace) {
        clockFace.classList.remove('clock-snap-animate');
        void clockFace.offsetWidth; // trigger reflow
        clockFace.classList.add('clock-snap-animate');
    }

    const timeStr = `${targetHour}:${String(targetMinute).padStart(2, '0')}`;
    const instr = document.getElementById('clock-instruction');
    if (instr) {
        instr.innerHTML = `เก่งมากครับ! ตอนนี้นำตัวเลข 1 ถึง 12 มาวางบนหน้าปัด และปรับเข็มให้ตรงเวลา <b>${timeStr}</b> นะครับ`;
    }
    speakText(`นำตัวเลข 1 ถึง 12 มาวางบนหน้าปัด และปรับเข็มให้ตรงเวลา ${timeStr} ครับ`);

    setupClockGame();
}

function setupClockGame() {
    const pile = document.getElementById('numbers-pile');
    const face = document.getElementById('clock-face');
    if (!pile || !face) return;

    const hint = document.getElementById('clock-hint');
    if (hint) {
        hint.innerHTML = "💡 แตะตัวเลขที่กองด้านบนแล้ว<b>แตะช่องบนหน้าปัดนาฬิกา</b>เพื่อวาง หรือแตะเลขบนหน้าปัดเพื่อนำกลับขึ้นมา";
        hint.style.display = 'block';
    }

    pile.innerHTML = "";
    face.querySelectorAll('.drop-zone').forEach(z => z.remove());
    selectedNumberElement = null;

    // สร้าง drop-zone ทั้ง 12 ตำแหน่งบนหน้าปัดก่อน (กระจายรัศมี 41% พอดีกับปุ่ม 34px)
    for (let i = 1; i <= 12; i++) {
        const angle = (i * 30 - 90) * (Math.PI / 180);
        const x = 50 + 41 * Math.cos(angle);
        const y = 50 + 41 * Math.sin(angle);

        const zone = document.createElement('div');
        zone.className = 'drop-zone';
        zone.id = `zone-${i}`;
        zone.style.left = x + '%';
        zone.style.top = y + '%';

        zone.addEventListener('click', () => {
            if (selectedNumberElement) {
                // ถ้ามีตัวเลขวางอยู่ในช่องนี้แล้ว ให้ส่งกลับคืน pile ก่อน
                if (zone.children.length > 0) {
                    const displaced = zone.children[0];
                    returnToPile(displaced);
                }

                const el = selectedNumberElement;
                el.classList.remove('selected');
                selectedNumberElement = null;

                zone.appendChild(el);
                zone.classList.add('filled');
                el.style.position = 'absolute';
                el.style.left = '50%';
                el.style.top = '50%';
                el.style.transform = 'translate(-50%, -50%)';

                checkClockState();
            }
        });

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
            const zones = document.querySelectorAll('.drop-zone');

            zones.forEach(zone => {
                zone.querySelectorAll('.draggable-number').forEach(num => {
                    returnToPile(num);
                });
                zone.classList.remove('filled');
            });

            if (selectedNumberElement) {
                selectedNumberElement.classList.remove('selected');
                selectedNumberElement = null;
            }

            // Reset เข็มนาฬิกากลับตำแหน่งเริ่มต้น
            hourAngle = 0;
            minuteAngle = 0;
            const hrHand = document.getElementById('hour-hand');
            const mnHand = document.getElementById('minute-hand');
            if (hrHand) hrHand.style.transform = `translateX(-50%) rotate(0deg)`;
            if (mnHand) mnHand.style.transform = `translateX(-50%) rotate(0deg)`;

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
    el.addEventListener('click', (e) => {
        e.stopPropagation();

        const parentZone = el.parentElement;
        if (parentZone && parentZone.classList.contains('drop-zone')) {
            // ถ้าอยู่บนหน้าปัดนาฬิกา แตะเพื่อนำกลับไปที่กองเดิม
            parentZone.classList.remove('filled');
            returnToPile(el);
            if (selectedNumberElement === el) {
                el.classList.remove('selected');
                selectedNumberElement = null;
            }
            checkClockState();
        } else {
            // ถ้าอยู่ในกองตัวเลข
            if (selectedNumberElement === el) {
                // ยกเลิกการเลือก
                el.classList.remove('selected');
                selectedNumberElement = null;
            } else {
                // เลือกตัวเลขนี้
                if (selectedNumberElement) {
                    selectedNumberElement.classList.remove('selected');
                }
                el.classList.add('selected');
                selectedNumberElement = el;
            }
        }
    });
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
    const numbersCount = document.querySelectorAll('.drop-zone .draggable-number').length;
    if (numbersCount < 12) {
        showCustomPopup("กรุณาวางตัวเลขให้ครบทั้ง 12 ตัวบนหน้าปัดนาฬิกาก่อนส่งคำตอบครับ", "⚠️");
        return;
    }
    
    const numbersScore = (numbersCount === 12) ? 1 : 0;
    handsScore = (hourAngle === correctHourAngle && minuteAngle === correctMinuteAngle) ? 1 : 0;
    
    // รวมคะแนนนาฬิกาเต็ม 3 คะแนน (Contour 1 + Numbers 1 + Hands 1)
    clockScore = contourScore + numbersScore + handsScore;
    
    document.getElementById('clock-test-page').style.display = 'none';
    startMathTest();
};

// --- 7. ด่านที่ 3: ระบบคิดเลข 100 ลบ 7 ต่อเนื่อง (Serial 7s Math Test - 5 ข้อ 5 คะแนน) ---
const mathSubtractor = 7;

function startMathTest() {
    const mathPage = document.getElementById('math-test-page');
    mathCurrentValue = 100;
    mathStep = 1;
    mathCorrectCount = 0;
    mathScore = 0;
    
    mathPage.style.display = 'flex';
    setTimeout(() => {
        document.getElementById('math-caption').style.opacity = "1";
        setTimeout(() => {
            document.getElementById('math-question-container').style.opacity = "1";
            document.getElementById('math-next-btn').style.opacity = "1";
            updateMathUI();
        }, 800);
    }, 400);
}

function updateMathUI() {
    const scenarioEl = document.getElementById('math-scenario-text');
    if (scenarioEl) {
        if (mathStep === 1) {
            scenarioEl.innerHTML = `เริ่มต้นจากตัวเลข <b>100</b> <br>🧮 ข้อที่ 1: <b>100 ลบออก 7</b> <br>👉 เหลือเท่าไหร่ครับ?`;
        } else {
            scenarioEl.innerHTML = `จากผลลัพธ์เดิม <b>${mathCurrentValue}</b> <br>🧮 ข้อที่ ${mathStep}: <b>ลบออกอีก 7</b> <br>👉 เหลือเท่าไหร่ครับ?`;
        }
    }
    
    document.getElementById('current-num').innerText = mathCurrentValue;
    document.getElementById('math-subtractor').innerText = 7;
    document.getElementById('math-step').innerText = mathStep;
    
    const input = document.getElementById('math-answer');
    input.value = "";
    input.focus();
}

document.getElementById('math-next-btn').onclick = async function () {
    const userAnswer = parseInt(document.getElementById('math-answer').value);
    if (isNaN(userAnswer)) { 
        showCustomPopup("กรุณากรอกตัวเลขคำตอบก่อนนะครับ"); 
        return; 
    }
    
    const expected = mathCurrentValue - 7;
    if (userAnswer === expected) {
        mathCorrectCount++;
    }
    
    mathCurrentValue = expected;
    mathStep++;
    
    if (mathStep <= 5) {
        updateMathUI();
    } else {
        // ให้คะแนนตามเกณฑ์ Serial 7s
        if (mathCorrectCount >= 4) mathScore = 3;
        else if (mathCorrectCount >= 2) mathScore = 2;
        else if (mathCorrectCount === 1) mathScore = 1;
        else mathScore = 0;
        
        document.getElementById('math-test-page').style.display = 'none';
        await startNamingTest();
    }
};



// --- 8. ด่านที่ 3.5: การบอกชื่อสิ่งของ/เครื่องมือทำสวน (Naming Test - 5 ข้อ 5 คะแนน) ---
let namingScore = 0;
let namingSelectedObjects = [];

async function startNamingTest() {
    const page = document.getElementById('naming-test-page');
    const container = document.getElementById('naming-cards-container');
    page.style.display = 'flex';
    container.innerHTML = '<p style="color:#82954b;font-size:1rem;text-align:center;">กำลังโหลดภาพเครื่องมือและสิ่งของในสวน...</p>';
    namingScore = 0;

    // ดึงรายการสิ่งของ/เครื่องมือทำสวน 5 ชิ้น (เต็ม 5 คะแนน)
    namingSelectedObjects = await MemoryGardenTools.fetchNamingItems(5);

    container.innerHTML = '';
    namingSelectedObjects.forEach((obj, i) => {
        const card = document.createElement('div');
        card.style.cssText = 'width:100%;max-width:440px;background:#fff;border-radius:16px;padding:12px 14px;box-shadow:0 4px 16px rgba(0,0,0,0.08);display:flex;flex-direction:row;align-items:center;gap:12px;box-sizing:border-box;border:1.5px solid #e8ede0;';

        const imgWrapper = document.createElement('div');
        imgWrapper.style.cssText = 'width:75px;height:75px;flex-shrink:0;background:#f5f8f0;border-radius:12px;display:flex;align-items:center;justify-content:center;overflow:hidden;border:1px solid #e0ebd2;';

        const img = document.createElement('img');
        img.src = obj.image_url;
        img.alt = '?';
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:10px;';
        img.onerror = () => {
            imgWrapper.innerHTML = '<span style="font-size:40px;">🪴</span>';
        };

        imgWrapper.appendChild(img);

        const rightDiv = document.createElement('div');
        rightDiv.style.cssText = 'flex:1;min-width:0;display:flex;flex-direction:column;gap:5px;';

        const label = document.createElement('label');
        label.textContent = `สิ่งของ/สัตว์ในภาพที่ ${i + 1} (ข้อที่ ${i + 1}/5)`;
        label.style.cssText = 'font-size:0.85rem;color:#4a5d23;font-weight:bold;white-space:normal;word-break:break-word;line-height:1.3;';

        // Input Row: ช่องพิมพ์ + ปุ่มไมค์
        const inputRow = document.createElement('div');
        inputRow.style.cssText = 'display:flex;gap:6px;align-items:center;width:100%;min-width:0;';

        const input = document.createElement('input');
        input.type = 'text';
        input.id = `naming-answer-${i}`;
        input.placeholder = 'พิมพ์ชื่อสิ่งของ หรือแตะเลือก';
        input.style.cssText = 'flex:1;min-width:0;width:0;padding:8px 10px;border:1.5px solid #ddd;border-radius:10px;font-size:0.95rem;outline:none;box-sizing:border-box;font-family:\'Anuphan\',sans-serif;transition:border-color 0.2s;';
        input.oninput = () => {
            input.style.borderColor = '#ddd';
            input.style.background = '#fff';
        };

        // ปุ่มไมค์ 🎙️
        const micBtn = document.createElement('button');
        micBtn.type = 'button';
        micBtn.id = `naming-mic-${i}`;
        micBtn.title = 'กดแล้วพูดชื่อสิ่งของ';
        micBtn.innerHTML = '🎙️';
        micBtn.style.cssText = 'flex-shrink:0;width:38px;height:38px;background:#e8ede0;border:1.5px solid #82954b;border-radius:10px;font-size:1.1rem;cursor:pointer;color:#4a5d23;display:flex;align-items:center;justify-content:center;transition:all 0.2s;';
        micBtn.onclick = () => toggleNamingMic(i, input, micBtn);

        inputRow.appendChild(input);
        inputRow.appendChild(micBtn);

        // Choice suggestions for easier tapping
        const chipsDiv = document.createElement('div');
        chipsDiv.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;margin-top:2px;';
        const distractorOptions = ['จอบ', 'บัวรดน้ำ', 'กรรไกรตัดกิ่ง', 'กระถางต้นไม้', 'ผีเสื้อ', 'แมว', 'กระรอก', 'เสียม', 'สายยาง', 'นก'];
        const quickOptions = [...new Set([obj.name, ...distractorOptions.filter(d => d !== obj.name).slice(0, 2)])].sort(() => Math.random() - 0.5);
        quickOptions.forEach(opt => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.innerText = opt;
            btn.style.cssText = 'padding:3px 8px;background:#f0f7e6;color:#4a5d23;border:1px solid #82954b;border-radius:12px;font-size:0.8rem;cursor:pointer;font-family:\'Anuphan\',sans-serif;';
            btn.onclick = () => {
                input.value = opt;
                input.style.borderColor = '#ddd';
                input.style.background = '#fff';
            };
            chipsDiv.appendChild(btn);
        });

        rightDiv.appendChild(label);
        rightDiv.appendChild(inputRow);
        rightDiv.appendChild(chipsDiv);
        card.appendChild(imgWrapper);
        card.appendChild(rightDiv);
        container.appendChild(card);
    });
}

// --- ฟังก์ชันไมค์สำหรับแต่ละ Naming Card ---
let namingRecognition = null;
let namingActiveMicIndex = null;

function toggleNamingMic(index, inputEl, micBtn) {
    // หยุดไมค์เดิมก่อน (ถ้ากำลังฟังอยู่)
    if (namingRecognition) {
        try { namingRecognition.stop(); } catch(e) {}
        namingRecognition = null;
    }
    // reset ปุ่มเดิม
    if (namingActiveMicIndex !== null && namingActiveMicIndex !== index) {
        const prevBtn = document.getElementById(`naming-mic-${namingActiveMicIndex}`);
        if (prevBtn) {
            prevBtn.innerHTML = '🎙️';
            prevBtn.style.background = '#e8ede0';
            prevBtn.style.borderColor = '#82954b';
        }
    }
    // ถ้ากดปุ่มเดิมขณะกำลังฟัง → หยุด
    if (namingActiveMicIndex === index && micBtn.style.background === 'rgb(130, 149, 75)') {
        namingActiveMicIndex = null;
        micBtn.innerHTML = '🎙️';
        micBtn.style.background = '#e8ede0';
        micBtn.style.borderColor = '#82954b';
        return;
    }

    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        showCustomPopup('เบราว์เซอร์ไม่รองรับการพูด กรุณาพิมพ์คำตอบแทนครับ', '⚠️');
        return;
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    namingRecognition = new SR();
    namingRecognition.lang = 'th-TH';
    namingRecognition.interimResults = false;
    namingRecognition.maxAlternatives = 1;
    namingRecognition.continuous = false;

    // แสดงสถานะกำลังฟัง
    namingActiveMicIndex = index;
    micBtn.innerHTML = '🔴';
    micBtn.style.background = '#82954b';
    micBtn.style.borderColor = '#4a5d23';
    micBtn.title = 'กำลังฟัง... กดเพื่อหยุด';

    namingRecognition.onresult = (event) => {
        const spoken = event.results[0][0].transcript.trim();
        inputEl.value = spoken;
        inputEl.style.borderColor = '#82954b';
        inputEl.style.background = '#f0f7e6';
        resetNamingMic(index, micBtn);
    };
    namingRecognition.onerror = () => resetNamingMic(index, micBtn);
    namingRecognition.onend = () => resetNamingMic(index, micBtn);
    namingRecognition.start();
}

function resetNamingMic(index, micBtn) {
    namingRecognition = null;
    namingActiveMicIndex = null;
    if (micBtn) {
        micBtn.innerHTML = '🎙️';
        micBtn.style.background = '#e8ede0';
        micBtn.style.borderColor = '#82954b';
        micBtn.title = 'กดแล้วพูดชื่อสิ่งของ';
    }
}


document.getElementById('naming-submit-btn').onclick = function () {
    const inputs = namingSelectedObjects.map((_, i) =>
        document.getElementById(`naming-answer-${i}`)
    );

    let hasEmpty = false;
    inputs.forEach(inp => {
        if (!inp || !inp.value.trim()) {
            if (inp) {
                inp.style.borderColor = '#e74c3c';
                inp.style.background = '#fff8f8';
            }
            hasEmpty = true;
        } else {
            inp.style.borderColor = '#ddd';
            inp.style.background = '#fff';
        }
    });

    if (hasEmpty) {
        showCustomPopup("กรุณากรอกคำตอบให้ครบทั้ง 5 ภาพก่อนส่งคำตอบครับ", "⚠️");
        return;
    }

    namingScore = 0;
    inputs.forEach((inp, i) => {
        const correct = namingSelectedObjects[i].name.trim().toLowerCase();
        if (inp.value.trim().toLowerCase() === correct) namingScore++;
    });

    document.getElementById('naming-test-page').style.display = 'none';
    startSentenceRepeatTest();
};


// --- 8.3 ด่านการพูดซ้ำประโยค (Sentence Repetition - 2 คะแนน 2 ขั้นตอน) ---
const SENTENCE_REPEAT_POOLS = [
    [
        "คุณยายรดน้ำต้นไม้ในสวนดอกไม้ทุกเช้าตรู่",
        "แมวสีขาวชอบนอนหลับอยู่ใต้ต้นไม้ใหญ่ริมสระน้ำ"
    ],
    [
        "ฉันรู้เพียงว่าสมชายเป็นคนเดียวที่มาช่วยงานวันนี้",
        "นกกระจอกบินมารอรับอาหารที่วางไว้บนโต๊ะไม้"
    ],
    [
        "ลมพัดเย็นสบายในสวนหลังบ้านยามบ่าย",
        "กระรอกน้อยวิ่งกระโดดไปตามกิ่งมะม่วงอย่างรวดเร็ว"
    ]
];

let sentenceRepeatParts = [];
let currentRepeatIndex = 0;

function startSentenceRepeatTest() {
    sentenceRepeatScore = 0;
    currentRepeatIndex = 0;

    // สุ่มชุดประโยคภาษาไทยที่สมบูรณ์ 2 ข้อ (ข้อละ 1 คะแนน รวม 2 คะแนน)
    const selectedPair = SENTENCE_REPEAT_POOLS[Math.floor(Math.random() * SENTENCE_REPEAT_POOLS.length)];
    sentenceRepeatParts = [...selectedPair];

    showRepeatRound(0);
}

function showRepeatRound(index) {
    if (index >= sentenceRepeatParts.length) {
        // เสร็จแล้ว → ไป Fluency
        document.getElementById('sentence-repeat-page').style.display = 'none';
        startFluencyTest();
        return;
    }

    currentRepeatIndex = index;
    const part = sentenceRepeatParts[index];
    const page = document.getElementById('sentence-repeat-page');
    page.style.display = 'flex';

    const listenCard = document.getElementById('repeat-listen-card');
    const actionCard = document.getElementById('repeat-action-card');
    
    // เริ่มต้นแสดงการ์ดฟังประโยคก่อน (Step 1)
    if (listenCard) listenCard.style.display = 'block';
    if (actionCard) actionCard.style.display = 'none';

    const listenRoundLabel = document.getElementById('repeat-listen-round-label');
    const actionRoundLabel = document.getElementById('repeat-action-round-label');
    const sentenceEl = document.getElementById('repeat-sentence-display');
    const inputEl = document.getElementById('repeat-input');
    const statusEl = document.getElementById('repeat-speech-status');
    const feedbackEl = document.getElementById('repeat-feedback');

    if (listenRoundLabel) listenRoundLabel.textContent = `ประโยคที่ ${index + 1} / ${sentenceRepeatParts.length}`;
    if (actionRoundLabel) actionRoundLabel.textContent = `ประโยคที่ ${index + 1} / ${sentenceRepeatParts.length}`;
    if (sentenceEl) sentenceEl.textContent = part;
    if (inputEl) { inputEl.value = ''; }
    if (statusEl) statusEl.style.display = 'none';
    if (feedbackEl) { feedbackEl.textContent = ''; feedbackEl.style.display = 'none'; }

    // อ่านเสียงประโยค
    speakText(`ฟังให้ดีและจดจำประโยค: ${part}`);

    // Replay button
    const replayBtn = document.getElementById('repeat-replay-btn');
    if (replayBtn) replayBtn.onclick = () => speakText(part);

    // Ready button -> Switch to Action Card (Step 2 - ซ่อนประโยค ทวนจากความจำ)
    const readyBtn = document.getElementById('repeat-ready-btn');
    if (readyBtn) {
        readyBtn.onclick = () => {
            if (listenCard) listenCard.style.display = 'none';
            if (actionCard) actionCard.style.display = 'block';
            if (inputEl) {
                inputEl.value = '';
                inputEl.focus();
            }
            // Auto-speak พร้อมคำแนะนำเมื่อเข้า Step 2
            setTimeout(() => speakText('โปรดพูดหรือพิมพ์ประโยคที่ท่านได้ยินเมื่อสักครู่ครับ'), 200);
        };
    }

    // Wire mic button
    const micBtn = document.getElementById('repeat-mic-btn');
    if (micBtn) micBtn.onclick = () => toggleRepeatMic(part);

    // Wire submit button  
    const submitBtn = document.getElementById('repeat-submit-btn');
    if (submitBtn) submitBtn.onclick = () => submitRepeat(part);

    // Wire Enter key
    if (inputEl) {
        inputEl.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); submitRepeat(part); } };
    }
}

let repeatRecognition = null;

function toggleRepeatMic(expectedSentence) {
    const micBtn = document.getElementById('repeat-mic-btn');
    const statusEl = document.getElementById('repeat-speech-status');

    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        showCustomPopup('เบราว์เซอร์ไม่รองรับเสียงพูด กรุณาพิมพ์แทนครับ', '⚠️');
        return;
    }
    // ถ้ากำลังฟังอยู่ → หยุด
    if (repeatRecognition) {
        stopRepeatMic();
        return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    repeatRecognition = new SR();
    repeatRecognition.lang = 'th-TH';
    repeatRecognition.interimResults = false;
    repeatRecognition.maxAlternatives = 1;
    repeatRecognition.continuous = false;
    repeatRecognition.onresult = (event) => {
        const spoken = event.results[0][0].transcript.trim();
        const inputEl = document.getElementById('repeat-input');
        if (inputEl) inputEl.value = spoken;
        stopRepeatMic();
        submitRepeat(expectedSentence);
    };
    repeatRecognition.onerror = () => stopRepeatMic();
    repeatRecognition.onend = () => stopRepeatMic();
    repeatRecognition.start();
    // เปลี่ยนสีปุ่มเดิมเพื่อแสดงสถานะกำลังฟัง
    if (micBtn) {
        micBtn.innerHTML = '🔴 กำลังฟัง...';
        micBtn.style.background = '#82954b';
        micBtn.style.color = 'white';
        micBtn.style.borderColor = '#4a5d23';
    }
    if (statusEl) statusEl.style.display = 'block';
}

function stopRepeatMic() {
    const micBtn = document.getElementById('repeat-mic-btn');
    const statusEl = document.getElementById('repeat-speech-status');
    try { if (repeatRecognition) repeatRecognition.stop(); } catch (e) {}
    repeatRecognition = null;
    // เรียกคืน visual กลับเดิม
    if (micBtn) {
        micBtn.innerHTML = '🎙️ พูด';
        micBtn.style.background = '#e8ede0';
        micBtn.style.color = '#4a5d23';
        micBtn.style.borderColor = '#82954b';
        micBtn.classList.remove('listening');
    }
    if (statusEl) statusEl.style.display = 'none';
}

function submitRepeat(expectedSentence) {
    const inputEl = document.getElementById('repeat-input');
    const feedbackEl = document.getElementById('repeat-feedback');
    const answer = (inputEl ? inputEl.value.trim() : '').replace(/\s+/g, ' ');
    const expected = expectedSentence.replace(/\s+/g, ' ').trim();

    // เปรียบเทียบความคล้ายคลึง (Fuzzy: คิดเป็น % ของคำตรงกัน)
    const correct = fuzzyMatch(answer, expected);
    if (correct) sentenceRepeatScore++;

    if (feedbackEl) {
        feedbackEl.style.display = 'block';
        feedbackEl.innerHTML = correct
            ? `<span style="color:#4caf50;">✅ ถูกต้อง! +1 คะแนน</span>`
            : `<span style="color:#e74c3c;">❌ ไม่ถูกต้อง</span>`;
    }

    // หน่วง 1.2 วินาทีแล้วไปรอบถัดไป
    setTimeout(() => {
        showRepeatRound(currentRepeatIndex + 1);
    }, 1200);
}

function fuzzyMatch(answer, expected) {
    if (!answer || !expected) return false;
    const normalize = s => s.replace(/[^\u0E00-\u0E7Fa-zA-Z0-9]/g, '').toLowerCase();
    const a = normalize(answer);
    const e = normalize(expected);
    if (a === e) return true;
    // ตรงกัน ≥ 75% = ถือว่าถูก (รองรับเสียงพูดที่อาจเพี้ยนเล็กน้อย)
    const minLen = Math.min(a.length, e.length);
    let matches = 0;
    for (let i = 0; i < minLen; i++) { if (a[i] === e[i]) matches++; }
    return e.length > 0 && (matches / e.length) >= 0.75;
}


// --- 8.5 ด่านความคล่องแคล่วทางภาษา (Category Fluency Test - 4 คะแนน พร้อม Thai Animal Dictionary) ---
const THAI_ANIMALS_SET = new Set([
    "หมา", "สุนัข", "แมว", "ช้าง", "ม้า", "วัว", "ควาย", "หมู", "เป็ด", "ไก่", "ห่าน",
    "นก", "นกแก้ว", "นกพิราบ", "นกกระจอก", "นกขุนทอง", "นกฮูก", "นกอินทรี", "นกยูง", "นกกระจอกเทศ", "นกนางนวล",
    "ปลา", "ปลาดุก", "ปลาช่อน", "ปลาทู", "ปลากัด", "ปลาทอง", "ปลาวาฬ", "ปลาโลมา", "ปลาฉลาม", "ปลากระพง", "ปลาแซลมอน",
    "ลิง", "ชะนี", "ค่าง", "กอริลลา", "ค่างแว่น", "เสือ", "สิงโต", "เสือดาว", "เสือดำ", "เสือชีตาห์", "แมวดาว",
    "หมี", "หมีควาย", "หมีแพนด้า", "หมีขอ", "กวาง", "เก้ง", "ละองละมั่ง", "กระจง", "ยีราฟ", "ม้าลาย",
    "ฮิปโป", "ฮิปโปโปเตมัส", "แรด", "สมเสร็จ", "จิงโจ้", "โคอาล่า", "แพะ", "แกะ", "อูฐ", "ลามะ",
    "กระต่าย", "กระรอก", "กระแต", "หนู", "บ่าง", "พังพอน", "ตัวตุ่น", "ตัวกินมด", "เม่น", "ลิ่น",
    "จระเข้", "เต่า", "เต่าตนุ", "ตะพาบ", "งู", "งูจงอาง", "งูเห่า", "งูเหลือม", "งูหลาม", "งูเขียว",
    "กบ", "เขียด", "คางคก", "อึ่งอ่าง", "ปาด", "ซาลาแมนเดอร์",
    "จิ้งจก", "ตุ๊กแก", "กิ้งก่า", "กิ้งก่าคาเมเลี่ยน", "ตัวเงินตัวทอง", "เหี้ย", "ตะกวด",
    "กุ้ง", "กุ้งมังกร", "กุ้งก้ามกราม", "ปู", "ปูม้า", "ปูดำ", "ปูเสฉวน", "หอย", "หอยแครง", "หอยแมลงภู่", "หอยทาก", "หอยเชลล์",
    "หมึก", "ปลาหมึก", "หมึกยักษ์", "หมึกกล้วย", "แมงกะพรุน", "ดาวทะเล", "ปลาดาว", "ม้าน้ำ", "เม่นทะเล", "ปลิงทะเล",
    "ผึ้ง", "ต่อ", "แตน", "มด", "ปลวก", "แมลงวัน", "ยุง", "แมลงสาบ", "ผีเสื้อ", "ตั๊กแตน", "จิ้งหรีด", "ด้วง", "แมลงปอ", "จักจั่น",
    "แมงมุม", "แมงป่อง", "ตะขาบ", "กิ้งกือ", "ไส้เดือน", "หนอน", "ดักแด้", "หิ่งห้อย", "หมัด", "เห็บ", "เหา",
    "ค้างคาว", "วาฬ", "โลมา", "พะยูน", "แมวน้ำ", "สิงโตทะเล", "วอลรัส", "เพนกวิน"
]);

function isValidAnimalWord(rawWord) {
    if (!rawWord) return false;
    const word = rawWord.trim().replace(/\s+/g, '');
    if (THAI_ANIMALS_SET.has(word)) return true;
    
    // Check animal prefixes in Thai
    const prefixes = ["นก", "ปลา", "แมลง", "กุ้ง", "หอย", "ปู", "เป็ด", "ไก่", "หมู", "หมา", "แมว", "งู", "เต่า", "กบ", "หนู", "ลิง", "เสือ", "หมี", "มด", "ผึ้ง", "หนอน"];
    for (const p of prefixes) {
        if (word.startsWith(p) && word.length > p.length) return true;
    }
    return false;
}

let fluencyWords = [];
let fluencyTimerInterval = null;
let fluencyTimeLeft = 60;
let fluencyRecognition = null;

function startFluencyTest() {
    fluencyWords = [];
    fluencyScore = 0;
    fluencyTimeLeft = 60;
    if (fluencyTimerInterval) clearInterval(fluencyTimerInterval);

    const page = document.getElementById('fluency-test-page');
    page.style.display = 'flex';

    // Reset UI
    const container = document.getElementById('fluency-words-container');
    const countBadge = document.getElementById('fluency-count-badge');
    const timerDisplay = document.getElementById('fluency-timer-display');
    const input = document.getElementById('fluency-input');
    const submitBtn = document.getElementById('fluency-submit-btn');

    if (container) container.innerHTML = '<span style="color:#aaa;font-size:0.88rem;">ยังไม่มีคำตอบ — พิมพ์หรือพูดชื่อสัตว์แล้วกดเพิ่ม</span>';
    if (countBadge) countBadge.textContent = '0 คำ';
    if (timerDisplay) {
        timerDisplay.textContent = '60 วินาที';
        timerDisplay.style.color = '#e74c3c';
        timerDisplay.style.animation = 'none';
    }
    if (input) { input.value = ''; input.focus(); }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.style.cursor = 'not-allowed';
        submitBtn.style.background = '#bbb';
        submitBtn.style.opacity = '0.8';
        submitBtn.textContent = '⏳ กำลังจับเวลา (เหลือ 60 วินาที)';
    }

    speakText('บอกชื่อสัตว์ให้ได้มากที่สุดในเวลา 60 วินาทีครับ พิมพ์หรือกดไมค์พูดได้เลยครับ');

    // Start countdown
    fluencyTimerInterval = setInterval(() => {
        fluencyTimeLeft--;
        if (timerDisplay) {
            timerDisplay.textContent = `${fluencyTimeLeft} วินาที`;
            if (fluencyTimeLeft <= 15) timerDisplay.style.color = '#c0392b';
            if (fluencyTimeLeft <= 10) timerDisplay.style.animation = 'micPulse 0.5s infinite alternate';
        }
        if (submitBtn) {
            if (fluencyTimeLeft > 0) {
                submitBtn.textContent = `⏳ กำลังจับเวลา (เหลือ ${fluencyTimeLeft} วินาที)`;
            } else {
                submitBtn.disabled = false;
                submitBtn.style.cursor = 'pointer';
                submitBtn.style.background = 'linear-gradient(135deg, #82954b, #6a7a3a)';
                submitBtn.style.opacity = '1';
                submitBtn.textContent = 'เสร็จสิ้น / ไปต่อ →';
            }
        }
        if (fluencyTimeLeft <= 0) {
            clearInterval(fluencyTimerInterval);
            fluencyTimerInterval = null;
            stopFluencyRecognition();
            if (timerDisplay) {
                timerDisplay.textContent = '⏰ หมดเวลา!';
                timerDisplay.style.animation = 'none';
            }
            submitFluency();
        }
    }, 1000);

    // Wire Add button
    const addBtn = document.getElementById('fluency-add-btn');
    if (addBtn) addBtn.onclick = () => addFluencyWord();

    // Wire Enter key on input
    if (input) {
        input.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); addFluencyWord(); } };
    }

    // Wire mic button
    const micBtn = document.getElementById('fluency-mic-btn');
    if (micBtn) micBtn.onclick = () => toggleFluencyMic();

    // Wire submit button
    if (submitBtn) {
        submitBtn.onclick = () => {
            if (fluencyTimeLeft > 0) {
                showCustomPopup(`กรุณาบอกชื่อสัตว์ให้ได้มากที่สุดจนหมดเวลา 60 วินาทีครับ (เหลือเวลาอีก ${fluencyTimeLeft} วินาที)`, "⏳");
                return;
            }
            clearInterval(fluencyTimerInterval);
            stopFluencyRecognition();
            submitFluency();
        };
    }
}

function addFluencyWord() {
    if (fluencyTimeLeft <= 0) return;
    const input = document.getElementById('fluency-input');
    if (!input) return;
    const word = input.value.trim();
    if (!word) return;

    // ตรวจสอบว่าคำนี้เป็นสัตว์หรือไม่ (Animal Validation)
    if (!isValidAnimalWord(word)) {
        const statusEl = document.getElementById('fluency-speech-status');
        if (statusEl) {
            statusEl.style.display = 'block';
            statusEl.style.color = '#e74c3c';
            statusEl.textContent = `⚠️ คำว่า "${word}" ไม่ใช่ชื่อสัตว์ จึงไม่นับคะแนนครับ`;
            setTimeout(() => {
                statusEl.style.color = '#4a5d23';
                statusEl.style.display = 'none';
            }, 2500);
        }
        input.value = '';
        input.focus();
        return;
    }

    // Dedup (case-insensitive)
    const already = fluencyWords.some(w => w.toLowerCase() === word.toLowerCase());
    if (already) {
        input.value = '';
        input.focus();
        return;
    }

    fluencyWords.push(word);
    renderFluencyWord(word);
    input.value = '';
    input.focus();

    const countBadge = document.getElementById('fluency-count-badge');
    if (countBadge) countBadge.textContent = `${fluencyWords.length} คำ`;
}

function renderFluencyWord(word) {
    const container = document.getElementById('fluency-words-container');
    if (!container) return;
    // Remove placeholder if first word
    if (fluencyWords.length === 1) container.innerHTML = '';

    const chip = document.createElement('span');
    chip.className = 'fluency-word-chip';
    chip.innerHTML = `${word} <span class="chip-delete" title="ลบ">✕</span>`;
    chip.querySelector('.chip-delete').onclick = () => {
        fluencyWords = fluencyWords.filter(w => w !== word);
        chip.remove();
        if (fluencyWords.length === 0) container.innerHTML = '<span style="color:#aaa;font-size:0.88rem;">ยังไม่มีคำตอบ — พิมพ์หรือพูดชื่อสัตว์แล้วกดเพิ่ม</span>';
        const countBadge = document.getElementById('fluency-count-badge');
        if (countBadge) countBadge.textContent = `${fluencyWords.length} คำ`;
    };
    container.appendChild(chip);
}

function toggleFluencyMic() {
    if (fluencyTimeLeft <= 0) return;
    const micBtn = document.getElementById('fluency-mic-btn');
    const statusEl = document.getElementById('fluency-speech-status');

    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        showCustomPopup('ขออภัย เบราว์เซอร์นี้ไม่รองรับการรับเสียงพูด กรุณาพิมพ์คำตอบแทนครับ', '⚠️');
        return;
    }

    if (fluencyRecognition && micBtn.classList.contains('listening')) {
        stopFluencyRecognition();
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    fluencyRecognition = new SpeechRecognition();
    fluencyRecognition.lang = 'th-TH';
    fluencyRecognition.interimResults = false;
    fluencyRecognition.maxAlternatives = 1;
    fluencyRecognition.continuous = false;

    fluencyRecognition.onresult = (event) => {
        const spoken = event.results[0][0].transcript.trim();
        if (spoken) {
            const input = document.getElementById('fluency-input');
            if (input) input.value = spoken;
            addFluencyWord();
        }
        stopFluencyRecognition();
    };
    fluencyRecognition.onerror = () => stopFluencyRecognition();
    fluencyRecognition.onend = () => stopFluencyRecognition();

    fluencyRecognition.start();
    micBtn.classList.add('listening');
    if (statusEl) statusEl.style.display = 'block';
}

function stopFluencyRecognition() {
    const micBtn = document.getElementById('fluency-mic-btn');
    const statusEl = document.getElementById('fluency-speech-status');
    try { if (fluencyRecognition) fluencyRecognition.stop(); } catch (e) {}
    fluencyRecognition = null;
    if (micBtn) micBtn.classList.remove('listening');
    if (statusEl) statusEl.style.display = 'none';
}

function submitFluency() {
    // คำนวณคะแนน Fluency ตามเกณฑ์ MoCA Thai (สัตว์)
    const count = fluencyWords.length;
    if (count >= 11) fluencyScore = 4;
    else if (count >= 8) fluencyScore = 3;
    else if (count >= 5) fluencyScore = 2;
    else if (count >= 2) fluencyScore = 1;
    else fluencyScore = 0;

    document.getElementById('fluency-test-page').style.display = 'none';
    startRecallTest();
}

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

// --- 9. ด่านที่ 4: ระบบระลึกถึงความจำ (Recall Test - 5 ข้อ 5 คะแนน) ---
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
    for (let i = 1; i <= 5; i++) {
        const el = document.getElementById(`recall-${i}`);
        if (el) el.value = '';
    }
    inputCon.style.opacity = '0';
    recallPage.style.display = 'flex';

    // สร้างตัวเลือกคำตอบแบบปุ่มกด (Choice Chips) สุ่มรวมกับตัวหลอก เพื่อให้ผู้สูงอายุแตะเลือกได้ง่าย
    const choicesContainer = document.getElementById('recall-choices-chips');
    if (choicesContainer) {
        choicesContainer.innerHTML = '';
        const distractorWords = ['กุหลาบ', 'สายน้ำ', 'เก้าอี้', 'ร่มเงา', 'สุนัข', 'พลั่ว'];
        const combinedPool = [...new Set([...secretWords, ...distractorWords.slice(0, 4)])]
            .sort(() => Math.random() - 0.5);

        combinedPool.forEach(word => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.innerText = word;
            chip.style.cssText = 'padding: 6px 14px; background: #f0f7e6; color: #4a5d23; border: 1.5px solid #82954b; border-radius: 20px; font-size: 0.95rem; font-weight: 600; cursor: pointer; transition: all 0.2s ease;';
            chip.onclick = () => {
                // เติมลงในช่องที่ยังว่างใน 5 ช่อง
                for (let k = 1; k <= 5; k++) {
                    const inEl = document.getElementById(`recall-${k}`);
                    if (inEl && !inEl.value) {
                        inEl.value = word;
                        return;
                    }
                }
                // ถ้าเต็มหมดแล้ว ให้แทนที่ช่องแรก
                const in1 = document.getElementById('recall-1');
                if (in1) in1.value = word;
            };
            choicesContainer.appendChild(chip);
        });
    }

    // แสดงข้อความด้วย typeWriter ให้ตัวหนังสือค่อยๆ พิมพ์
    typeWriter("เมื่อสักครู่นี้ในสวนความทรงจำ มีสิ่งของ 5 อย่างอยู่ด้วย คุณช่วยเรานึกออกมาได้มั้ยครับ? (ข้อละ 1 คะแนน)", "recall-caption", 45, () => {
        setTimeout(() => {
            inputCon.style.transition = "opacity 0.8s ease";
            inputCon.style.opacity = "1";
            document.getElementById('recall-1')?.focus();
        }, 200);
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
    speakText(word);
}

document.getElementById('recall-next-btn').onclick = async function () {
    const rawAnswers = [];
    for (let i = 1; i <= 5; i++) {
        const val = document.getElementById(`recall-${i}`)?.value.trim() || '';
        rawAnswers.push(val);
    }
    const filledAnswers = rawAnswers.filter(a => a !== "");

    // อนุญาตให้ผ่านได้แม้จำไม่ได้ทุกคำ เพื่อไม่บิดเบือนผลทางคลินิก
    // แต่ต้องกรอกอย่างน้อย 1 ช่อง หรือยืนยันว่าจำไม่ได้
    if (filledAnswers.length === 0) {
        const confirmed = await showCustomPopup("คุณยังไม่ได้กรอกคำตอบเลย\n\nหากจำไม่ได้จริงๆ กดยืนยันเพื่อไปต่อ (คะแนนความจำจะเป็น 0)", "⚠️", true);
        if (!confirmed) return;
    }

    recallScore = 0;
    if (!recallHintUsed) {
        const correctAnswers = new Set();
        rawAnswers.forEach(ans => {
            if (ans && secretWords.includes(ans)) {
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
    const timeOfDay = document.getElementById('ori-timeofday')?.value || '';

    if (!d || !m || !y || dayVal === '' || !province || !timeOfDay) {
        showCustomPopup("กรุณากรอกข้อมูลให้ครบถ้วน รวมถึงช่วงเวลาปัจจุบัน");
        return;
    }

    const now = new Date();
    orientationScore = 0;
    // ข้อละ 1 คะแนน ตามมาตรฐาน MoCA (รวม 6 คะแนน)
    if (d === now.getDate()) orientationScore += 1; // วันที่
    if (m === (now.getMonth() + 1)) orientationScore += 1; // เดือน
    if (y === now.getFullYear() || y === (now.getFullYear() + 543)) orientationScore += 1; // ปี
    if (parseInt(dayVal) === now.getDay()) orientationScore += 1; // วันในสัปดาห์

    // ช่วงเวลาปัจจุบัน 1 คะแนน
    const hour = now.getHours();
    const correctTimeOfDay =
        hour >= 6 && hour < 12 ? 'morning' :
        hour >= 12 && hour < 14 ? 'noon' :
        hour >= 14 && hour < 18 ? 'afternoon' :
        hour >= 18 && hour < 21 ? 'evening' : 'night';
    if (timeOfDay === correctTimeOfDay) orientationScore += 1;

    // จังหวัด/สถานที่ 1 คะแนน
    if (detectedProvince) {
        if (province === detectedProvince) orientationScore += 1;
    } else {
        orientationScore += 1; // GPS ไม่พร้อม → ให้คะแนนเสมอ
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
    formData.append("entry.1212631587", `คะแนน: ${userData.totalScore}/30, ระดับ: ${userData.riskLevel}, รายละเอียด: ${JSON.stringify(userData.details)}`); // ใส่คะแนนและรายละเอียดในช่องข้อเสนอแนะ

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

    // --- คำนวณคะแนนเต็ม 30 คะแนน (5 โดเมนหลักตามมาตรฐาน MoCA) ---
    // 1. ด้านความจำ (Memory Story Recall): 5 ข้อ -> ข้อละ 1 คะแนน = 5 คะแนนเต็ม
    const memoryScoreScaled = Math.min(5, Math.max(0, recallScore));

    // 2. ด้านมิติสัมพันธ์และนาฬิกา (Visuospatial Clock): ตามมาตรฐาน MoCA ต้นฉบับ = 3 คะแนน
    //    Contour (วาดวงกลมหน้าปัดด้วยตัวเอง): 1 คะแนน (ประเมินจากความกลม contourScore)
    //    Numbers (วางตัวเลข 1–12 ครบถ้วน): 1 คะแนน
    //    Hands (เข็มสั้น + เข็มยาวถูกต้องทั้งคู่): 1 คะแนน
    const numbersScore = (document.querySelectorAll('.drop-zone .draggable-number').length === 12) ? 1 : 0;
    const handsCorrect = (hourAngle === correctHourAngle && minuteAngle === correctMinuteAngle) ? 1 : 0;
    const visuoScoreScaled = Math.min(3, Math.max(0, contourScore + numbersScore + handsCorrect));

    // 3. ด้านสมาธิและคิดเงินทอนในตลาด (Math & Attention): 5 ข้อ -> ข้อละ 1 คะแนน = 5 คะแนนเต็ม
    const mathScoreScaled = Math.min(5, Math.max(0, mathCorrectCount));

    // 4. ด้านภาษา (Language): Naming 5 + Sentence Repeat 2 + Fluency 4 = 11 คะแนนเต็ม
    const namingScoreScaled = Math.min(5, Math.max(0, namingScore));
    const repeatScoreScaled = Math.min(2, Math.max(0, sentenceRepeatScore));
    const fluencyScoreScaled = Math.min(4, Math.max(0, fluencyScore));
    const langScoreScaled = namingScoreScaled + repeatScoreScaled + fluencyScoreScaled;  // max 11

    // 5. ด้านการรับรู้วันเวลาและสถานที่ (Orientation): ข้อละ 1 คะแนน 6 ข้อ = 6 คะแนนเต็ม
    const orientScoreScaled = Math.min(6, Math.max(0, orientationScore));

    // รวม: 5 + 3 + 5 + 11 + 6 = 30 คะแนน
    let totalScore = memoryScoreScaled + visuoScoreScaled + mathScoreScaled + langScoreScaled + orientScoreScaled;

    const eduLevel = document.getElementById('user-education').value;
    let hasEduBonus = false;
    // ปรับคะแนนตามระดับการศึกษา (Education Correction: +1 สำหรับผู้ที่มีวุฒิ ≤ 12 ปี หรือ ไม่ได้เรียน/ประถม)
    if (eduLevel === "ตํ่ากว่ามัธยมศึกษาปีที่ 6" || eduLevel === "ไม่ได้เรียนหนังสือ / ประถมศึกษา") {
        totalScore += 1;
        hasEduBonus = true;
    }

    if (totalScore > 30) totalScore = 30;

    document.getElementById('farewell-page').style.display = 'none';
    document.getElementById('result-page').style.display = 'flex';
    document.body.style.overflowY = "auto";

    const eduBadge = document.getElementById('edu-bonus-badge');
    if (eduBadge) {
        eduBadge.style.display = hasEduBonus ? 'inline-block' : 'none';
    }

    // อัปเดตผลคะแนนแยก 5 โดเมนหลัก (เต็ม 30 คะแนน)
    const memEl = document.getElementById('score-memory-val');
    const visEl = document.getElementById('score-visuo-val');
    const matEl = document.getElementById('score-math-val');
    const lanEl = document.getElementById('score-lang-val');
    const oriEl = document.getElementById('score-ori-val');
    if (memEl) memEl.innerText = `${memoryScoreScaled} / 5`;
    if (visEl) visEl.innerText = `${visuoScoreScaled} / 3 (วาดวงกลม: ${contourScore} + ตัวเลข: ${numbersScore} + เข็ม: ${handsCorrect})`;
    if (matEl) matEl.innerText = `${mathScoreScaled} / 5`;
    if (lanEl) lanEl.innerText = `${langScoreScaled} / 11 (Naming: ${namingScoreScaled} + Repeat: ${repeatScoreScaled} + Fluency: ${fluencyScoreScaled})`;
    if (oriEl) oriEl.innerText = `${orientScoreScaled} / 6`;

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
        maxScore: 30,
        riskLevel: document.getElementById('risk-level-title').innerText,
        latitude: userLatitude,
        longitude: userLongitude,
        details: {
            memory: memoryScoreScaled,
            visuospatial: visuoScoreScaled,
            contour: contourScore,
            math: mathScoreScaled,
            naming: namingScoreScaled,
            sentenceRepeat: repeatScoreScaled,
            fluency: fluencyScoreScaled,
            language: langScoreScaled,
            orientation: orientScoreScaled
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

    // เกณฑ์มาตรฐาน MoCA 30 คะแนน: ปกติ (>= 25), เสี่ยงบกพร่องเล็กน้อย MCI (18 - 24), ควรได้รับการดูแลพิเศษ (< 18)
    if (score >= 25) {
        riskCard.style.backgroundColor = "";
        riskCard.style.borderColor = "#82954b";
        riskCard.style.borderWidth = "2px";
        riskCard.style.borderStyle = "solid";
        riskCard.style.color = "#2d2d2d";
        riskTitle.innerText = `ปกติ (Normal) — ${score}/30 คะแนน`;
        riskDesc.innerText = "ขณะนี้สุขภาพสมองของท่านอยู่ในเกณฑ์ปกติครับ การทดสอบด้านสมาธิ การจดจำ มิติสัมพันธ์ และการรับรู้วันเวลาทำได้ดีมาก ขอให้ท่านหมั่นดูแลสุขภาพกายและใจเพื่อรักษาประสิทธิภาพของสมองให้แข็งแรงแบบนี้ต่อไปนะครับ";
        adviceList.innerHTML = `
            <li>✅ ออกกำลังกายสม่ำเสมออย่างน้อย 30 นาทีต่อวัน เช่น เดินเร็ว หรือว่ายน้ำ เพื่อช่วยให้เลือดไปเลี้ยงสมองได้ดี</li>
            <li>✅ รับประทานอาหารครบ 5 หมู่ เน้นผักผลไม้ และปลา หลีกเลี่ยงอาหารหวานหรือเค็มจัด</li>
            <li>✅ นอนหลับพักผ่อนให้เพียงพอ 7–8 ชั่วโมงต่อวัน เพื่อให้สมองได้พักฟื้นและซ่อมแซมส่วนที่สึกหรอ</li>
            <li>✅ หากิจกรรมลับสมองทำสม่ำเสมอ เช่น อ่านหนังสือ เล่นเกมปริศนา หรือเรียนรู้ทักษะใหม่ๆ</li>
            <li>✅ ตรวจสุขภาพประจำปีอย่างสม่ำเสมอ และนำผลประเมินนี้ปรึกษาแพทย์หากมีความกังวลครับ</li>
        `;
    } else if (score >= 18) {
        riskCard.style.backgroundColor = "";
        riskCard.style.borderColor = "#ffd966";
        riskCard.style.borderWidth = "2px";
        riskCard.style.borderStyle = "solid";
        riskCard.style.color = "#2d2d2d";
        riskTitle.innerText = `เสี่ยงบกพร่องเล็กน้อย (MCI) — ${score}/30 คะแนน`;
        riskDesc.innerText = "เริ่มพบสัญญาณการทำงานของสมองที่ลดลงเล็กน้อย อาจมีปัญหาด้านความจำหรือสมาธิบ้างในชีวิตประจำวัน แต่ยังสามารถดูแลตัวเองได้ตามปกติ แนะนำให้ปรึกษาแพทย์เพื่อประเมินอย่างละเอียดต่อไปครับ";
        adviceList.innerHTML = `
            <li>⚠️ นัดพบแพทย์หรือผู้เชี่ยวชาญด้านสมองและระบบประสาทเพื่อตรวจประเมินอย่างละเอียด อย่าปล่อยทิ้งไว้นานครับ</li>
            <li>⚠️ ฝึกกิจกรรมกระตุ้นสมองทุกวัน เช่น เล่นเกมทายคำ ต่อเลข ฝึกจำชื่อคน หรือเขียนบันทึกประจำวัน</li>
            <li>⚠️ ออกกำลังกายเบาๆ สม่ำเสมอ เช่น เดินเร็ว โยคะ หรือรำมวยจีน อย่างน้อย 5 วันต่อสัปดาห์</li>
            <li>⚠️ ลดความเครียด หากิจกรรมผ่อนคลาย เช่น ฟังเพลง ทำสวน หรือนั่งสมาธิ</li>
            <li>⚠️ แจ้งคนในครอบครัวให้รับทราบ เพื่อช่วยสังเกตอาการและให้กำลังใจในการดูแลสุขภาพ</li>
            <li>⚠️ หลีกเลี่ยงแอลกอฮอล์และบุหรี่ เพราะส่งผลเสียต่อการทำงานของสมองโดยตรง</li>
        `;
    } else {
        riskCard.style.backgroundColor = "";
        riskCard.style.borderColor = "#e06666";
        riskCard.style.borderWidth = "2px";
        riskCard.style.borderStyle = "solid";
        riskCard.style.color = "#2d2d2d";
        riskTitle.innerText = `ควรได้รับการดูแลพิเศษ — ${score}/30 คะแนน`;
        riskDesc.innerText = "ผลการประเมินพบข้อจำกัดในการทำงานของสมองในหลายด้าน แนะนำให้ญาติหรือผู้ดูแลพาไปพบแพทย์เฉพาะทางด้านสมองหรือคลินิกความจำเพื่อรับการตรวจวินิจฉัยและวางแผนการรักษาอย่างเหมาะสมครับ";
        adviceList.innerHTML = `
            <li>🚨 นัดหมายพบแพทย์เฉพาะทางด้านสมองและระบบประสาท หรือคลินิกความจำโดยเร็วเพื่อตรวจประเมินอย่างละเอียด</li>
            <li>🚨 ให้ญาติหรือผู้ดูแลช่วยดูแลความปลอดภัยในชีวิตประจำวันอย่างใกล้ชิด เช่น การใช้ยา การเดินทาง และการใช้เครื่องใช้ไฟฟ้า</li>
            <li>🚨 จัดสิ่งแวดล้อมในบ้านให้ปลอดภัย มีแสงสว่างเพียงพอ และลดสิ่งกีดขวางที่อาจทำให้หกล้ม</li>
            <li>🚨 สร้างกิจวัตรประจำวันที่แน่นอน เช่น เวลารับประทานอาหาร เวลาเข้านอน เพื่อลดความสับสน</li>
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