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
        await liff.init({ liffId: liffId });
        liffInitialized = true;
        if (liff.isLoggedIn() || liff.isInClient()) {
            isLineLogin = true;
            lineProfile = await liff.getProfile();
            userId = lineProfile.userId;
            localStorage.setItem('memory_garden_user_id', userId);
            console.log("Logged in via LINE. User ID:", userId);
        }
    } catch (err) {
        console.error("LIFF Initialization failed", err);
    }

    // Bind LINE UI events
    const lineLoginBtn = document.getElementById('line-login-btn');
    if (lineLoginBtn) {
        lineLoginBtn.onclick = function () {
            if (liffInitialized) {
                liff.login();
            } else {
                alert("ระบบ LINE LIFF ยังไม่พร้อมทำงาน กรุณารอสักครู่หรือลองใหม่อีกครั้ง");
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
        const fadeOverlay = document.getElementById('white-fade-overlay');
        if (fadeOverlay) {
            fadeOverlay.style.display = 'block';
            fadeOverlay.style.opacity = '1';

            setTimeout(() => {
                if (loaderWrapper) loaderWrapper.style.display = 'none';
                updateLineLoginUI();
                goToLogin();
                fadeOverlay.style.opacity = '0';
                setTimeout(() => { fadeOverlay.style.display = 'none'; }, 600);
            }, 600);
        }
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

    document.getElementById('intro-start-btn').onclick = function () {
        if (introPage) introPage.style.display = 'none';
        if (login) {
            login.style.display = 'flex';
            login.style.opacity = '1';
        }
    };
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

// --- 4. หน้า Login & เริ่มต้นเดินทาง ---
const infoForm = document.getElementById('info-form');
if (infoForm) {
    infoForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const fade = document.getElementById('white-fade-overlay');

        if (fade) {
            fade.style.display = 'block';
            fade.style.opacity = '1';
        }

        setTimeout(() => {
            document.getElementById('login-container').style.display = 'none';

            if (isLineLogin) {
                // ถ้าล็อกอินผ่าน LINE ข้ามหน้ารหัสประจำตัวไปเลย
                const welcomePage = document.getElementById('welcome-garden-page');
                if (welcomePage) {
                    welcomePage.style.display = 'flex';
                    welcomePage.style.opacity = '1';
                }
                typeWriter(`สวัสดีคุณ ${lineProfile ? (lineProfile.displayName || 'ผู้ใช้งาน') : 'ผู้ใช้งาน'} ยินดีต้อนรับเข้าสู่สวนแห่งความทรงจำ...`, "typing-text", 50, () => {
                    const btn = document.getElementById('start-journey-btn');
                    if (btn) {
                        btn.style.display = 'inline-block';
                        setTimeout(() => { btn.style.opacity = '1'; }, 100);
                    }
                });
            } else {
                // แสดงหน้า User ID แบบปกติ
                document.getElementById('userid-display').innerText = userId;
                document.getElementById('userid-page').style.display = 'flex';
            }

            if (fade) fade.style.opacity = '0';
            setTimeout(() => { if (fade) fade.style.display = 'none'; }, 600);
        }, 600);
    });
}

document.getElementById('userid-next-btn').onclick = function () {
    const fade = document.getElementById('white-fade-overlay');
    fade.style.display = 'block';
    fade.style.opacity = '1';
    setTimeout(() => {
        document.getElementById('userid-page').style.display = 'none';
        const welcomePage = document.getElementById('welcome-garden-page');
        welcomePage.style.display = 'flex';
        welcomePage.style.opacity = '1';
        fade.style.opacity = '0';
        setTimeout(() => {
            typeWriter("ยินดีต้อนรับสู่สวนความจำที่แสนอบอุ่น พวกเราจะนําพาทุกท่านเดินเล่นและทบทวนความทรงจำไปด้วยกัน", "typing-text", 50, () => {
                const btn = document.getElementById('start-journey-btn');
                btn.style.display = 'inline-block';
                setTimeout(() => { btn.style.opacity = '1'; }, 100);
            });
        }, 500);
    }, 600);
};

// --- 5. ด่านที่ 1: จดจำ 3 คำ (ดึงจาก Supabase) ---
const startJourneyBtn = document.getElementById('start-journey-btn');
if (startJourneyBtn) {
    startJourneyBtn.addEventListener('click', async function () {
        document.getElementById('welcome-garden-page').style.display = 'none';
        document.getElementById('memory-test-page').style.display = 'flex';

        // ดึงคำจาก Supabase ผ่าน MCP Tool (พร้อม offline fallback)
        let wordsData = await MemoryGardenTools.fetchRecallSet(userId, 3);

        const FALLBACK_POOL = [
            { id: null, word: 'แมว', definition: '', example_sentence: 'เจ้า[.....]ชอบกินปลาและนอนบนโซฟา' },
            { id: null, word: 'บ้าน', definition: '', example_sentence: 'ฉันกำลังเดินทางกลับ[.....]หลังเลิกงาน' },
            { id: null, word: 'ต้นไม้', definition: '', example_sentence: 'ในสวนมี[.....]ใหญ่ที่ให้ร่มเงาดีมาก' },
            { id: null, word: 'นาฬิกา', definition: '', example_sentence: 'คุณช่วยดู[.....]หน่อยสิว่ากี่โมงแล้ว' },
            { id: null, word: 'ดอกไม้', definition: '', example_sentence: 'ฉันชอบกลิ่นหอมของ[.....]ในตอนเช้า' },
        ];

        // ถ้าได้มาไม่ครบ 3 คำ (อาจจะยังไม่มีคำที่ต้องทบทวนเพิ่ม) ให้เอา fallback มาเติมให้ครบ
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
    // สุ่มเวลา
    const pick = CLOCK_TIME_POOL[Math.floor(Math.random() * CLOCK_TIME_POOL.length)];
    targetHour = pick.h;
    targetMinute = pick.m;

    // คำนวณ angle ที่ถูกต้อง
    // เข็มนาที: 1 นาที = 6°
    correctMinuteAngle = targetMinute * 6;
    // เข็มชั่วโมง: 1 ชั่วโมง = 30°, บวก offset จากนาที (1 นาที = 0.5°)
    correctHourAngle = ((targetHour % 12) * 30 + targetMinute * 0.5) % 360;
    // ปัดเป็น step 30° ที่ใกล้ที่สุด (เพราะ user หมุนทีละ 30°)
    correctHourAngle = Math.round(correctHourAngle / 30) * 30 % 360;

    // reset angle
    hourAngle = 0;
    minuteAngle = 0;
    document.getElementById('clock-hand-btns').style.display = 'none';

    const timeStr = `${targetHour}:${String(targetMinute).padStart(2, '0')}`;
    document.getElementById('memory-test-page').style.display = 'none';
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

    const size = face.offsetWidth;
    const radius = size * 0.39;
    const centerX = size / 2;
    const centerY = size / 2;

    for (let i = 1; i <= 12; i++) {
        const angle = (i * 30 - 90) * (Math.PI / 180);
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);

        const zone = document.createElement('div');
        zone.className = 'drop-zone';
        zone.id = `zone-${i}`;
        zone.style.left = x + 'px';
        zone.style.top = y + 'px';
        face.appendChild(zone);

        const num = document.createElement('div');
        num.className = 'draggable-number';
        num.innerText = i;
        num.id = `num-${i}`;
        makeElementDraggable(num);
        pile.appendChild(num);
    }

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
                    currentPile.appendChild(num);
                    num.style.position = 'static';
                    num.style.transform = 'none';
                });
                zone.classList.remove('filled');
            });

            checkClockState();
        };
    }

    checkClockState();
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
                    document.getElementById('numbers-pile').appendChild(el);
                    el.style.position = 'static';
                    el.style.transform = 'none';
                    el.style.left = '';
                    el.style.top = '';
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
    let dropped = false;
    const oldParentZone = el.parentElement;

    zones.forEach(zone => {
        const r1 = el.getBoundingClientRect(),
            r2 = zone.getBoundingClientRect();
        const dist = Math.sqrt(Math.pow((r1.left + r1.width / 2) - (r2.left + r2.width / 2), 2) + Math.pow((r1.top + r1.height / 2) - (r2.top + r2.height / 2), 2));

        if (dist < 45) {
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
            // Case 2: The zone is occupied by another number
            else if (zone.children.length === 1 && zone.children[0] !== el) {
                const existingEl = zone.children[0];

                // If we dragged from another zone, swap them
                if (oldParentZone && oldParentZone.classList.contains('drop-zone')) {
                    oldParentZone.appendChild(existingEl);
                    existingEl.style.position = 'absolute';
                    existingEl.style.left = '50%';
                    existingEl.style.top = '50%';
                    existingEl.style.transform = 'translate(-50%, -50%)';
                    oldParentZone.classList.add('filled');

                    zone.appendChild(el);
                    zone.classList.add('filled');
                    el.style.position = 'absolute';
                    el.style.left = '50%';
                    el.style.top = '50%';
                    el.style.transform = 'translate(-50%, -50%)';
                    dropped = true;
                }
                // If dragged from the pile, swap (existingEl back to pile)
                else {
                    document.getElementById('numbers-pile').appendChild(existingEl);
                    existingEl.style.position = 'static';
                    existingEl.style.transform = 'none';

                    zone.appendChild(el);
                    zone.classList.add('filled');
                    el.style.position = 'absolute';
                    el.style.left = '50%';
                    el.style.top = '50%';
                    el.style.transform = 'translate(-50%, -50%)';
                    dropped = true;
                }
            }
            // Case 3: We dragged it but let go in its own zone
            else if (zone.children[0] === el) {
                el.style.position = 'absolute';
                el.style.left = '50%';
                el.style.top = '50%';
                el.style.transform = 'translate(-50%, -50%)';
                dropped = true;
            }
        }
    });

    if (!dropped) {
        if (oldParentZone && oldParentZone.classList.contains('drop-zone')) {
            oldParentZone.classList.remove('filled');
        }
        document.getElementById('numbers-pile').appendChild(el);
        el.style.position = 'static';
        el.style.transform = 'none';
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
    const overlay = document.getElementById('white-fade-overlay');
    overlay.style.display = 'block';
    overlay.style.opacity = '1';
    setTimeout(() => {
        document.getElementById('clock-test-page').style.display = 'none';
        startMathTest();
        overlay.style.opacity = '0';
        setTimeout(() => overlay.style.display = 'none', 500);
    }, 800);
};

// --- 7. ด่านที่ 3: ระบบคำนวณ (Math Test) ---
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

document.getElementById('math-next-btn').onclick = function () {
    const userAnswer = parseInt(document.getElementById('math-answer').value);
    if (isNaN(userAnswer)) { alert("กรุณาใส่คำตอบ"); return; }
    if (userAnswer === (mathCurrentValue - 7)) mathCorrectCount++;
    mathCurrentValue -= 7;
    mathStep++;
    if (mathStep <= 5) updateMathUI();
    else {
        if (mathCorrectCount >= 4) mathScore = 3;
        else if (mathCorrectCount >= 2) mathScore = 2;
        else if (mathCorrectCount === 1) mathScore = 1;
        document.getElementById('math-test-page').style.display = 'none';
        startNamingTest();
    }
};

// --- 8. ด่านที่ 3.5: การบอกชื่อสิ่งของ (Naming Test) ---
const OBJECT_POOL = [
    { emoji: '🐱', name: 'แมว' },
    { emoji: '🌳', name: 'ต้นไม้' },
    { emoji: '🏠', name: 'บ้าน' },
    { emoji: '🌸', name: 'ดอกไม้' },
    { emoji: '🐟', name: 'ปลา' },
    { emoji: '🐦', name: 'นก' },
    { emoji: '🍎', name: 'แอปเปิ้ล' },
    { emoji: '🚲', name: 'รถจักรยาน' },
];
let namingScore = 0;
let namingSelectedObjects = [];

function startNamingTest() {
    const page = document.getElementById('naming-test-page');
    const container = document.getElementById('naming-cards-container');
    page.style.display = 'flex';
    container.innerHTML = '';
    namingScore = 0;

    // สุ่มเลือก 2 สิ่งของ
    const shuffled = [...OBJECT_POOL].sort(() => Math.random() - 0.5);
    namingSelectedObjects = shuffled.slice(0, 2);

    namingSelectedObjects.forEach((obj, i) => {
        const card = document.createElement('div');
        card.style.cssText = 'width:100%;background:#fff;border-radius:16px;padding:14px 18px;box-shadow:0 4px 16px rgba(0,0,0,0.08);display:flex;flex-direction:row;align-items:center;gap:16px;box-sizing:border-box;border:1.5px solid #e8ede0;';

        const emojiDiv = document.createElement('div');
        emojiDiv.setAttribute('role', 'img');
        emojiDiv.setAttribute('aria-label', obj.name);
        emojiDiv.style.cssText = 'font-size:64px;line-height:1;width:80px;height:80px;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:#f5f8f0;border-radius:12px;';
        emojiDiv.textContent = obj.emoji;

        const rightDiv = document.createElement('div');
        rightDiv.style.cssText = 'flex:1;display:flex;flex-direction:column;gap:8px;';

        const label = document.createElement('label');
        label.textContent = `ชื่อสิ่งของที่ ${i + 1}`;
        label.style.cssText = 'font-size:0.9rem;color:#82954b;font-weight:bold;';

        const input = document.createElement('input');
        input.type = 'text';
        input.id = `naming-answer-${i}`;
        input.placeholder = 'พิมพ์ชื่อสิ่งของ';
        input.style.cssText = 'width:100%;padding:10px 14px;border:1.5px solid #ddd;border-radius:10px;font-size:1rem;outline:none;box-sizing:border-box;font-family:\'Anuphan\',sans-serif;';

        rightDiv.appendChild(label);
        rightDiv.appendChild(input);
        card.appendChild(emojiDiv);
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

    const overlay = document.getElementById('white-fade-overlay');
    overlay.style.display = 'block';
    overlay.style.opacity = '1';
    setTimeout(() => {
        document.getElementById('naming-test-page').style.display = 'none';
        startRecallTest();
        overlay.style.opacity = '0';
        setTimeout(() => overlay.style.display = 'none', 500);
    }, 800);
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

    // โหลด progress bar แบบ real-time
    updateProgressBar();

    setTimeout(() => {
        typeWriter("เมื่อคืนเราฝันอะไรก็ไม่รู้แต่พอจำลางๆได้ว่ามีของ3อย่างนั้นอยู่ด้วยคุณช่วยเรานึกออกมาได้มั้ย?", "recall-caption", 50, () => {
            setTimeout(() => {
                inputCon.style.transition = "opacity 1s ease";
                inputCon.style.opacity = "1";
                document.getElementById('recall-1').focus();
            }, 800);
        });
    }, 500);
}

// --- Multi-stage Progressive Hint System ---
document.getElementById('recall-hint-btn').onclick = function () {
    // Stage 0 → 1: แสดงคำเตือนก่อนครั้งแรก
    if (recallHintStage === 0) {
        const confirmed = confirm("⚠️ คำเตือน\n\nการดูคำใบ้จะทำให้คะแนนส่วนนี้เป็น 0\n\nยืนยันจะดูคำใบ้ระดับที่ 1 (Pattern) ไหม?");
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

    const overlay = document.getElementById('white-fade-overlay');
    overlay.style.display = 'block';
    overlay.style.opacity = '1';
    setTimeout(() => {
        document.getElementById('recall-test-page').style.display = 'none';
        startOrientationTest();
        overlay.style.opacity = '0';
        setTimeout(() => overlay.style.display = 'none', 500);
    }, 800);
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

    setTimeout(() => {
        // ใช้ Unicode Escape เพื่อป้องกันปัญหาเรื่อง Encoding ของไฟล์
        const msg = "\u0E02\u0E2D\u0E1A\u0E04\u0E38\u0E13\u0E21\u0E32\u0E01\u0E04\u0E23\u0E31\u0E1A\u0E17\u0E35\u0E48\u0E0a\u0E48\u0E27\u0E22\u0E40\u0E23\u0E32\u0E21\u0E32\u0E15\u0E25\u0E2D\u0E14 \u0E40\u0E2B\u0E25\u0E37\u0E2D\u0E04\u0E33\u0E16\u0E32\u0E21\u0E2A\u0E38\u0E14\u0E17\u0E49\u0E32\u0E22\u0E41\u0E25\u0E49\u0E27\u0E04\u0E23\u0E31\u0E1A \u0E40\u0E23\u0E32\u0E22\u0E32\u0E01\u0E17\u0E23\u0E32\u0E1A\u0E27\u0E48\u0E32\u0E43\u0E19\u0E42\u0E25\u0E01\u0E02\u0E2D\u0E07\u0E04\u0E38\u0E13 \u0E27\u0E31\u0E19\u0E19\u0E35\u0E49\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48\u0E40\u0E17\u0E48\u0E32\u0E44\u0E2B\u0E23\u0E48 \u0E40\u0E14\u0E37\u0E2D\u0E19\u0E2D\u0E30\u0E44\u0E23 \u0E1B\u0E35\u0E2D\u0E30\u0E44\u0E23 \u0E27\u0E31\u0E19\u0E2D\u0E30\u0E44\u0E23\u0E43\u0E19\u0E2A\u0E31\u0E1B\u0E14\u0E32\u0E2B\u0E4C \u0E41\u0E25\u0E30\u0E04\u0E38\u0E13\u0E2D\u0E22\u0E39\u0E48\u0E17\u0E35\u0E48\u0E08\u0E31\u0E07\u0E2B\u0E27\u0E31\u0E14\u0E2D\u0E30\u0E44\u0E23\u0E04\u0E23\u0E31\u0E1A";
        typeWriter(msg, "orientation-caption", 50, () => {
            setTimeout(() => {
                inputCon.style.transition = "opacity 1s ease";
                inputCon.style.opacity = "1";
                document.getElementById('ori-date').focus();
            }, 800);
        });
    }, 500);
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
        alert("กรุณากรอกข้อมูลให้ครบถ้วน");
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
    // ปิดหน้าเก่า เปิดหน้าใหม่
    document.getElementById('orientation-test-page').style.display = 'none';
    const farewellPage = document.getElementById('farewell-page');

    if (farewellPage) {
        farewellPage.style.display = 'flex'; // CSS จะจัดการสีดำและการจัดวางให้เอง
    }

    const msg = "ขอบคุณนะที่ช่วยเหลือเราตลอดและทำให้เรามีรอยยิ้ม แต่ว่ามันคงถึงเวลาที่เราต้องจากกันแล้วละ โชคดีนะ...";

    // เรียกใช้ Typewriter ตามปกติ
    typeWriter(msg, "farewell-text", 70, () => {
        setTimeout(() => {
            calculateAndShowResult();
        }, 3000);
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
        name: document.getElementById('user-name')?.value || "Anonymous",
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