// =====================================================================
// ด่านใหม่ตามข้อเสนอแนะ IOC (เกณฑ์คะแนน v2)
//   - Attention: Digit span ไปข้างหน้า (1) + ย้อนหลัง (1) + Vigilance (1)  [+ Serial 7s 3 คะแนนใน script.js]
//   - Abstraction: บอกความเหมือน 2 คู่ (2)
// ดัดแปลงตามแนวทาง MoCA โดยใช้ชุดตัวเลข/คู่คำของแอปเอง
// ไฟล์นี้โหลดต่อจาก script.js และใช้ฟังก์ชันร่วม เช่น speakText, showCustomPopup, startMathTest, startRecallTest
// =====================================================================

const SCORE_VERSION = 2;

const THAI_DIGIT_WORDS = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];

// --- คะแนนและบันทึกผล ---
let digitForwardScore = 0;
let digitBackwardScore = 0;
let digitSpanLog = {};
let vigilanceScore = 0;
let vigilanceStats = { hits: 0, falseAlarms: 0, misses: 0, targets: 0 };
let abstractionScore = 0;
let abstractionAnswers = [];


// ---------------------------------------------------------------------
// 1. Digit span (2 คะแนน)
// ---------------------------------------------------------------------
// กติกาชุดตัวเลข: ไม่มีเลขซ้ำ, ไม่มีลำดับต่อเนื่อง (เช่น 3 4 5), ไม่ใช้ 0
const DIGIT_SPAN_FORWARD_POOL = [[3, 9, 1, 6, 2], [5, 2, 7, 4, 8], [6, 1, 9, 3, 5]];
const DIGIT_SPAN_BACKWARD_POOL = [[8, 3, 6], [5, 9, 2], [4, 7, 1]];

const DIGIT_SPAN_PHASES = {
    forward: {
        round: 'ส่วนที่ 1 / 2: จำตัวเลขตามลำดับ',
        instruction: 'ระบบจะแสดงและอ่านตัวเลข 5 ตัว ทีละตัว (รวมประมาณ 8 วินาที) ตั้งใจดูและฟังให้ดี เมื่อตัวเลขหายไป ให้กดตัวเลขตาม<b>ลำดับเดิม</b> (แสดงให้ดูได้ครั้งเดียวเท่านั้น)',
        voice: 'ระบบจะแสดงและอ่านตัวเลขห้าตัวทีละตัว เมื่อตัวเลขหายไป ให้กดตัวเลขตามลำดับเดิมครับ แสดงให้ดูได้ครั้งเดียวเท่านั้น',
        answerHint: 'กดตัวเลขตามลำดับที่เห็น'
    },
    backward: {
        round: 'ส่วนที่ 2 / 2: จำตัวเลขแล้วตอบย้อนหลัง',
        instruction: 'ครั้งนี้มีตัวเลข 3 ตัว เมื่อตัวเลขหายไป ให้กดตัวเลข<b>ย้อนหลังจากตัวสุดท้ายไปตัวแรก</b> เช่น เห็น 1 2 3 ให้ตอบ 3 2 1',
        voice: 'ครั้งนี้มีตัวเลขสามตัว เมื่อตัวเลขหายไป ให้กดตัวเลขย้อนหลัง จากตัวสุดท้ายไปตัวแรกครับ เช่น เห็นหนึ่ง สอง สาม ให้ตอบ สาม สอง หนึ่ง',
        answerHint: 'กดตัวเลขย้อนหลัง จากตัวสุดท้ายไปตัวแรก'
    }
};

let digitSpanPhase = 'forward';
let digitSpanCurrent = [];
let digitSpanTyped = [];
let digitSpanBusy = false;

function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function showOnly(containerIds, visibleId, display = 'block') {
    containerIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = (id === visibleId) ? display : 'none';
    });
}

function startDigitSpanTest() {
    digitForwardScore = 0;
    digitBackwardScore = 0;
    digitSpanLog = {};
    document.getElementById('digit-span-page').style.display = 'flex';
    setupDigitSpanKeypad();
    showDigitSpanIntro('forward');
}

function showDigitSpanIntro(phase) {
    digitSpanPhase = phase;
    const cfg = DIGIT_SPAN_PHASES[phase];
    digitSpanCurrent = pickRandom(phase === 'forward' ? DIGIT_SPAN_FORWARD_POOL : DIGIT_SPAN_BACKWARD_POOL);
    digitSpanTyped = [];

    document.getElementById('digit-span-round-label').textContent = cfg.round;
    document.getElementById('digit-span-instruction').innerHTML = cfg.instruction;
    document.getElementById('digit-span-answer-hint').textContent = cfg.answerHint;
    showOnly(['digit-span-intro', 'digit-span-show', 'digit-span-answer'], 'digit-span-intro');

    const readyBtn = document.getElementById('digit-span-ready-btn');
    readyBtn.disabled = false;
    readyBtn.onclick = () => {
        // นำเสนอได้ครั้งเดียว: ปิดปุ่มทันทีที่กด
        readyBtn.disabled = true;
        presentDigitSequence(digitSpanCurrent, showDigitSpanAnswer);
    };
    speakText(cfg.voice);
}

// เวลาดูตัวเลขรวมทั้งชุดประมาณ 8 วินาที ให้ผู้สูงอายุมีเวลาจำ (5 ตัว ≈ 1.6 วินาที/ตัว, 3 ตัว ≈ 2.7 วินาที/ตัว)
const DIGIT_SPAN_TOTAL_MS = 8000;

// แสดงและอ่านตัวเลขทีละตัว (แสดง 80% ของเวลาแต่ละตัว แล้วเว้นว่างให้เห็นว่าเปลี่ยนตัว)
function presentDigitSequence(digits, onDone) {
    if (digitSpanBusy) return;
    digitSpanBusy = true;
    showOnly(['digit-span-intro', 'digit-span-show', 'digit-span-answer'], 'digit-span-show');
    const digitEl = document.getElementById('digit-span-digit');
    digitEl.textContent = '';

    const itemMs = Math.round(DIGIT_SPAN_TOTAL_MS / digits.length);
    let i = 0;
    const next = () => {
        if (i >= digits.length) {
            digitEl.textContent = '';
            digitSpanBusy = false;
            setTimeout(onDone, 400);
            return;
        }
        const n = digits[i];
        digitEl.textContent = n;
        speakText(THAI_DIGIT_WORDS[n]);
        setTimeout(() => { digitEl.textContent = ''; }, Math.round(itemMs * 0.8));
        i++;
        setTimeout(next, itemMs);
    };
    // เว้นจังหวะให้เสียงคำสั่งจบก่อนเริ่มตัวแรก
    setTimeout(next, 600);
}

function showDigitSpanAnswer() {
    digitSpanTyped = [];
    renderDigitSpanTyped();
    showOnly(['digit-span-intro', 'digit-span-show', 'digit-span-answer'], 'digit-span-answer');
}

function setupDigitSpanKeypad() {
    const pad = document.getElementById('digit-span-keypad');
    if (!pad || pad.dataset.ready) return;
    pad.dataset.ready = 'true';
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 0].forEach(n => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'digit-key';
        btn.textContent = n;
        btn.onclick = () => {
            if (digitSpanTyped.length >= 8) return;
            digitSpanTyped.push(n);
            renderDigitSpanTyped();
        };
        pad.appendChild(btn);
    });
    document.getElementById('digit-span-backspace').onclick = () => {
        digitSpanTyped.pop();
        renderDigitSpanTyped();
    };
    document.getElementById('digit-span-submit').onclick = submitDigitSpan;
}

function renderDigitSpanTyped() {
    const el = document.getElementById('digit-span-typed');
    el.textContent = digitSpanTyped.length ? digitSpanTyped.join(' ') : '–';
}

async function submitDigitSpan() {
    if (digitSpanTyped.length === 0) {
        const confirmed = await showCustomPopup('ยังไม่ได้กดตัวเลขเลยครับ\n\nหากจำไม่ได้ กดยืนยันเพื่อไปต่อ (ส่วนนี้จะได้ 0 คะแนน)', '⚠️', true);
        if (!confirmed) return;
    }
    const expected = digitSpanPhase === 'forward' ? digitSpanCurrent : [...digitSpanCurrent].reverse();
    const correct = digitSpanTyped.length === expected.length && digitSpanTyped.every((n, i) => n === expected[i]);

    digitSpanLog[digitSpanPhase] = { shown: digitSpanCurrent.join(''), answer: digitSpanTyped.join(''), correct };
    if (digitSpanPhase === 'forward') {
        digitForwardScore = correct ? 1 : 0;
        showDigitSpanIntro('backward');
    } else {
        digitBackwardScore = correct ? 1 : 0;
        document.getElementById('digit-span-page').style.display = 'none';
        startVigilanceTest();
    }
}


// ---------------------------------------------------------------------
// 2. Vigilance (1 คะแนน) — ดัดแปลง: มองตัวเลขบนจอแทนการฟังตัวอักษร
// ---------------------------------------------------------------------
const VIGILANCE_TARGET = 1;
// ชุดตายตัว 30 ตัว มีเลขเป้าหมาย 11 ตัว เพื่อให้ความยากเท่ากันทุกคน
const VIGILANCE_SEQUENCES = [
    [5, 2, 1, 8, 3, 1, 1, 6, 9, 4, 7, 1, 5, 1, 9, 3, 2, 1, 1, 1, 6, 1, 4, 8, 2, 1, 1, 7, 3, 5],
    [3, 7, 1, 4, 9, 1, 2, 1, 1, 8, 5, 6, 1, 3, 1, 7, 9, 1, 1, 4, 2, 1, 6, 8, 1, 5, 3, 1, 9, 2]
];
const VIGILANCE_PRACTICE = [4, 1, 7, 1, 3];
const VIGILANCE_ITEM_MS = 5000;   // ตัวละ 5 วินาที ให้ผู้สูงอายุมีเวลาคิดก่อนแตะ (MoCA ต้นฉบับ 1 วินาที)
const VIGILANCE_SHOW_MS = 4500;   // แสดง 4.5 วินาที แล้วเว้นว่าง 0.5 วินาที ให้เห็นว่าเปลี่ยนตัว
const VIGILANCE_GRACE_MS = 300;   // กดช้าไม่เกิน 300 ms หลังเปลี่ยนตัว ยังนับเป็นการกดตัวก่อนหน้า

let vigRun = null;

function startVigilanceTest() {
    vigilanceScore = 0;
    vigilanceStats = { hits: 0, falseAlarms: 0, misses: 0, targets: 0 };
    document.getElementById('vigilance-page').style.display = 'flex';
    showOnly(['vig-intro', 'vig-stage', 'vig-after-practice'], 'vig-intro');
    document.getElementById('vig-practice-btn').onclick = () => runVigilance(VIGILANCE_PRACTICE, true);
    document.getElementById('vig-start-btn').onclick = () => runVigilance(pickRandom(VIGILANCE_SEQUENCES), false);
    document.getElementById('vig-hit-btn').onclick = onVigilancePress;
    speakText('ระบบจะแสดงตัวเลขทีละตัว ตัวละห้าวินาที เมื่อเห็นเลขหนึ่ง ให้แตะปุ่มเจอแล้ว ถ้าเป็นเลขอื่นไม่ต้องแตะครับ เริ่มจากรอบฝึกก่อนนะครับ');
}

function runVigilance(sequence, isPractice) {
    showOnly(['vig-intro', 'vig-stage', 'vig-after-practice'], 'vig-stage');
    document.getElementById('vig-phase-label').textContent = isPractice ? 'รอบฝึก (ไม่คิดคะแนน)' : 'รอบจริง';
    document.getElementById('vig-feedback').textContent = '';
    const digitEl = document.getElementById('vig-digit');
    digitEl.textContent = '';

    vigRun = {
        sequence, isPractice,
        index: -1, windowStart: 0,
        hit: new Array(sequence.length).fill(false),
        falseAlarm: new Array(sequence.length).fill(false),
        finished: false
    };

    const run = vigRun;
    let i = 0;
    const next = () => {
        if (run !== vigRun) return;
        if (i >= sequence.length) {
            digitEl.textContent = '';
            // รอช่วงผ่อนผันของตัวสุดท้ายก่อนสรุปผล
            setTimeout(() => finishVigilance(run), VIGILANCE_GRACE_MS);
            return;
        }
        const cur = i;
        run.index = cur;
        run.windowStart = performance.now();
        digitEl.textContent = sequence[cur];
        setTimeout(() => { if (run.index === cur) digitEl.textContent = ''; }, VIGILANCE_SHOW_MS);
        i++;
        setTimeout(next, VIGILANCE_ITEM_MS);
    };
    setTimeout(next, 800);
}

function onVigilancePress() {
    const run = vigRun;
    if (!run || run.finished || run.index < 0) return;
    const i = run.index;
    const seq = run.sequence;
    const sinceStart = performance.now() - run.windowStart;

    let result;
    if (seq[i] === VIGILANCE_TARGET) {
        if (!run.hit[i]) run.hit[i] = true;
        result = 'hit';
    } else if (i > 0 && seq[i - 1] === VIGILANCE_TARGET && !run.hit[i - 1] && sinceStart <= VIGILANCE_GRACE_MS) {
        // กดช้าเล็กน้อยหลังเลขเป้าหมายเพิ่งหายไป
        run.hit[i - 1] = true;
        result = 'hit';
    } else {
        // กดหลายครั้งในตัวเดียวกันนับเป็นการกดผิด 1 ครั้ง
        run.falseAlarm[i] = true;
        result = 'false';
    }

    const btn = document.getElementById('vig-hit-btn');
    btn.classList.add('vig-pressed');
    setTimeout(() => btn.classList.remove('vig-pressed'), 150);

    if (run.isPractice) {
        document.getElementById('vig-feedback').textContent = result === 'hit' ? '✅ ถูกต้อง!' : '❌ ยังไม่ใช่เลข 1';
    }
}

function finishVigilance(run) {
    if (run.finished) return;
    run.finished = true;

    const targets = run.sequence.filter(n => n === VIGILANCE_TARGET).length;
    const hits = run.hit.filter(Boolean).length;
    const falseAlarms = run.falseAlarm.filter(Boolean).length;
    const misses = targets - hits;

    if (run.isPractice) {
        document.getElementById('vig-practice-result').textContent =
            `รอบฝึก: แตะถูก ${hits} จาก ${targets} ครั้ง` + (falseAlarms ? ` แตะผิด ${falseAlarms} ครั้ง` : '');
        showOnly(['vig-intro', 'vig-stage', 'vig-after-practice'], 'vig-after-practice');
        speakText('จบรอบฝึกแล้วครับ เมื่อพร้อมกดปุ่มเริ่มรอบจริงได้เลย');
        return;
    }

    vigilanceStats = { hits, falseAlarms, misses, targets };
    // เกณฑ์ MoCA: ผิดรวม (กดผิด + ไม่ได้กด) ตั้งแต่ 2 ครั้งขึ้นไป = 0 คะแนน
    vigilanceScore = (falseAlarms + misses) >= 2 ? 0 : 1;
    vigRun = null;

    document.getElementById('vigilance-page').style.display = 'none';
    startMathTest();
}


// ---------------------------------------------------------------------
// 3. Abstraction (2 คะแนน)
// ---------------------------------------------------------------------
// คำตอบที่ได้คะแนนต้องเป็นหมวดหมู่/หน้าที่ร่วมกัน ส่วนลักษณะภายนอก (สี รูปร่าง วัสดุ) ไม่ได้คะแนน
// ให้ผู้เชี่ยวชาญยืนยันรายการ accept ก่อนใช้งานจริง
const ABSTRACTION_EXAMPLE = { a: 'รถยนต์', b: 'เรือ', answer: 'เป็นยานพาหนะ ใช้เดินทางเหมือนกัน' };
const ABSTRACTION_SETS = [
    [
        { a: 'มะม่วง', b: 'ฝรั่ง', concept: 'ผลไม้', accept: ['ผลไม้', 'ไม้ผล'] },
        { a: 'ไม้บรรทัด', b: 'ตาชั่ง', concept: 'เครื่องวัด', accept: ['วัด', 'ชั่งตวง', 'ตวง'] }
    ],
    [
        { a: 'กลอง', b: 'ขลุ่ย', concept: 'เครื่องดนตรี', accept: ['ดนตรี', 'เล่นเพลง', 'บรรเลง'] },
        { a: 'เสื้อ', b: 'กางเกง', concept: 'เครื่องแต่งกาย', accept: ['แต่งกาย', 'แต่งตัว', 'เสื้อผ้า', 'นุ่งห่ม', 'สวมใส่', 'ใช้ใส่', 'ไว้ใส่'] }
    ]
];

let abstractionPairs = [];
let abstractionIndex = 0;

function startAbstractionTest() {
    abstractionScore = 0;
    abstractionAnswers = [];
    abstractionPairs = pickRandom(ABSTRACTION_SETS);
    abstractionIndex = 0;

    document.getElementById('abstraction-page').style.display = 'flex';
    document.getElementById('abs-example-pair').textContent = `${ABSTRACTION_EXAMPLE.a} กับ ${ABSTRACTION_EXAMPLE.b}`;
    document.getElementById('abs-example-answer').textContent = ABSTRACTION_EXAMPLE.answer;
    showOnly(['abs-example', 'abs-question'], 'abs-example');
    document.getElementById('abs-example-next').onclick = () => showAbstractionQuestion(0);
    document.getElementById('abs-submit-btn').onclick = () => submitAbstraction(false);
    document.getElementById('abs-cant-btn').onclick = () => submitAbstraction(true);
    document.getElementById('abs-input').onkeydown = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); submitAbstraction(false); }
    };
    speakText(`ด่านนี้ถามว่าสิ่งของสองอย่างเหมือนกันอย่างไร ตัวอย่างเช่น ${ABSTRACTION_EXAMPLE.a} กับ ${ABSTRACTION_EXAMPLE.b} ${ABSTRACTION_EXAMPLE.answer}`);
}

function showAbstractionQuestion(index) {
    abstractionIndex = index;
    const pair = abstractionPairs[index];
    showOnly(['abs-example', 'abs-question'], 'abs-question');
    document.getElementById('abs-round-label').textContent = `ข้อที่ ${index + 1} / ${abstractionPairs.length}`;
    document.getElementById('abs-pair').textContent = `${pair.a} กับ ${pair.b}`;
    const input = document.getElementById('abs-input');
    input.value = '';
    input.focus();
    const question = `${pair.a} กับ ${pair.b} เหมือนกันอย่างไรครับ`;
    document.getElementById('abs-speak-btn').onclick = () => speakText(question);
    speakText(question);
}

function scoreAbstractionAnswer(answer, pair) {
    const clean = (answer || '').replace(/[\s.,!?'"()-]/g, '');
    if (!clean) return 0;
    return pair.accept.some(k => clean.includes(k)) ? 1 : 0;
}

async function submitAbstraction(cantAnswer) {
    const pair = abstractionPairs[abstractionIndex];
    const input = document.getElementById('abs-input');
    let answer = cantAnswer ? '' : input.value.trim();

    if (!cantAnswer && !answer) {
        showCustomPopup('กรุณาพิมพ์คำตอบ หรือกดปุ่ม "ตอบไม่ได้" ครับ', '⚠️');
        return;
    }

    const score = cantAnswer ? 0 : scoreAbstractionAnswer(answer, pair);
    abstractionScore += score;
    // เก็บคำตอบดิบไว้ให้ผู้ดูแลตรวจทานคะแนนอัตโนมัติภายหลัง
    abstractionAnswers.push({ pair: `${pair.a}-${pair.b}`, concept: pair.concept, answer, cant_answer: cantAnswer, auto_score: score });

    if (abstractionIndex + 1 < abstractionPairs.length) {
        showAbstractionQuestion(abstractionIndex + 1);
    } else {
        document.getElementById('abstraction-page').style.display = 'none';
        startRecallTest();
    }
}
