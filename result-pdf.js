// =====================================================================
// ส่งออกผลการประเมินเป็นไฟล์ PDF (หน้าสรุปผล)
// สร้างไฟล์ PDF จริงในเครื่องด้วย html2pdf.js (html2canvas + jsPDF) — ไม่ต้องใช้หน้าต่างพิมพ์
// จึงใช้ได้บนมือถือ/ในแอป LINE ที่เปิดหน้าต่างพิมพ์ไม่ได้
// ไฟล์นี้โหลดต่อจาก script.js และ attention-tests.js (ใช้ getDomainScores, showCustomPopup)
// =====================================================================

const HTML2PDF_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
let html2pdfLoading = null;

// โหลดไลบรารีเฉพาะตอนกดปุ่มครั้งแรก
function loadHtml2Pdf() {
    if (window.html2pdf) return Promise.resolve();
    if (html2pdfLoading) return html2pdfLoading;
    html2pdfLoading = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = HTML2PDF_SRC;
        s.onload = () => resolve();
        s.onerror = () => { html2pdfLoading = null; reject(new Error('โหลดตัวสร้าง PDF ไม่สำเร็จ')); };
        document.head.appendChild(s);
    });
    return html2pdfLoading;
}

function pdfEscape(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const PDF_GENDER_TH = { male: 'ชาย', female: 'หญิง', other: 'อื่นๆ' };

// รายละเอียดย่อยของแต่ละด้าน (เกณฑ์ v2)
function pdfDomainDetail(key, d) {
    const n = (v) => (v != null ? v : '-');
    switch (key) {
        case 'visuospatial':
            return `วาดวงกลม ${n(d.contour)} · ตัวเลขถูกตำแหน่ง ${n(d.clock_numbers)} · เข็มนาฬิกา ${n(d.clock_hands)}`;
        case 'attention':
            return `จำตัวเลขตามลำดับ ${n(d.digit_forward)}/1 · ย้อนหลัง ${n(d.digit_backward)}/1 · หาเลข 1 ${n(d.vigilance)}/1`
                + (d.vigilance_hits != null ? ` (แตะถูก ${d.vigilance_hits}, แตะผิด ${d.vigilance_false_alarms}, พลาด ${d.vigilance_misses})` : '')
                + ` · ลบ 7 ${n(d.math)}/3` + (d.serial7_correct_count != null ? ` (ถูก ${d.serial7_correct_count}/5 ข้อ)` : '');
        case 'language':
            return `พูดซ้ำประโยค ${n(d.sentenceRepeat)}/2 · บอกชื่อสัตว์ ${n(d.fluency)}/1` + (d.fluency_count != null ? ` (${d.fluency_count} คำ)` : '');
        case 'abstraction':
            if (Array.isArray(d.abstraction_answers) && d.abstraction_answers.length) {
                return d.abstraction_answers.map(a => `${pdfEscape(String(a.pair || '').replace('-', ' กับ '))}: "${a.cant_answer ? 'ตอบไม่ได้' : pdfEscape(a.answer)}"`).join(' · ');
            }
            return '';
        default:
            return '';
    }
}

function buildResultReportHtml() {
    const u = window.currentUserTestResult || {};
    const d = u.details || {};
    const now = new Date();
    const dateStr = now.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
        + ' เวลา ' + now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.';
    const total = u.totalScore != null ? u.totalScore : 0;
    const risk = u.riskLevel || '-';
    const riskColor = total >= 25 ? '#2e7d32' : total >= 18 ? '#e67e22' : '#c0392b';
    const eduBonus = u.education === 'ตํ่ากว่ามัธยมศึกษาปีที่ 6' || u.education === 'ไม่ได้เรียนหนังสือ / ประถมศึกษา';

    const rows = getDomainScores(d).map((x, i) => {
        const detail = pdfDomainDetail(x.key, d);
        return `<tr>
            <td style="padding:7px 10px;border:1px solid #dfe6d3;">${i + 1}. ${x.icon} ${x.label}
                ${detail ? `<div style="color:#777;font-size:11px;margin-top:2px;">${detail}</div>` : ''}</td>
            <td style="padding:7px 10px;border:1px solid #dfe6d3;text-align:center;font-weight:700;color:#4a5d23;white-space:nowrap;">${x.score != null ? x.score : '-'} / ${x.max}</td>
        </tr>`;
    }).join('');

    // เนื้อหาหลักของไฟล์คือผลประเมินจาก AI (exportResultPdf สั่งวิเคราะห์ให้ก่อนเสมอถ้ายังไม่มี)
    const aiEl = document.getElementById('user-ai-content');
    const aiHtml = aiEl && aiEl.innerText.trim() ? aiEl.innerHTML : '';

    const info = (label, value) => `<div><span style="color:#777;">${label}:</span> <b>${pdfEscape(value || '-')}</b></div>`;

    return `
    <div style="font-family:'Anuphan','Prompt',sans-serif;color:#2b3a1f;width:720px;padding:6px 4px;line-height:1.55;font-size:13px;background:#fff;">
        <div class="pdf-avoid" style="display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #82954b;padding-bottom:10px;margin-bottom:14px;">
            <div>
                <div style="font-size:22px;font-weight:700;color:#4a5d23;">🌿 Memory Garden</div>
                <div style="color:#666;">รายงานผลการประเมินสุขภาพสมองโดย AI (แบบทดสอบดัดแปลงตามแนวทาง MoCA)</div>
            </div>
            <div style="text-align:right;color:#666;font-size:12px;">ออกรายงาน ${dateStr}<br>รหัสอ้างอิง: <b>${pdfEscape(u.userId || '-')}</b></div>
        </div>

        <div class="pdf-avoid" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px 14px;background:#f8faf5;border:1px solid #dce7d1;border-radius:10px;padding:10px 14px;margin-bottom:14px;">
            ${info('ชื่อ', u.name)}
            ${info('อายุ', u.age ? u.age + ' ปี' : '')}
            ${info('เพศ', PDF_GENDER_TH[u.gender] || u.gender)}
            ${info('การศึกษา', u.education)}
            ${info('โรคประจำตัว', u.disease)}
            ${info('เวลาที่ใช้ทำ', d.duration_formatted)}
        </div>

        <div class="pdf-avoid" style="display:flex;gap:14px;align-items:center;border:2px solid ${riskColor};border-radius:12px;padding:12px 16px;margin-bottom:14px;">
            <div style="text-align:center;min-width:130px;">
                <div style="color:#666;font-size:12px;">คะแนนรวม</div>
                <div style="font-size:34px;font-weight:700;color:${riskColor};line-height:1.1;">${total}<span style="font-size:15px;color:#888;font-weight:400;"> / 30</span></div>
            </div>
            <div>
                <div style="font-size:17px;font-weight:700;color:${riskColor};">${pdfEscape(risk)}</div>
                <div style="color:#666;font-size:12px;">เกณฑ์: 25–30 ปกติ · 18–24 เสี่ยงบกพร่องเล็กน้อย (MCI) · ต่ำกว่า 18 ควรได้รับการดูแลพิเศษ</div>
                ${eduBonus ? '<div style="color:#4a5d23;font-size:12px;">รวมคะแนนชดเชยระดับการศึกษา +1 คะแนนแล้ว</div>' : ''}
            </div>
        </div>

        <style>.pdf-ai p, .pdf-ai li { font-size: 13px !important; line-height: 1.6 !important; margin: 0 0 6px !important; color: #2b3a1f !important; }
            .pdf-ai h2, .pdf-ai h3, .pdf-ai h4 { font-size: 14.5px !important; margin: 12px 0 4px !important; color: #2e5a27 !important; }
            .pdf-ai ul { margin: 0 0 6px !important; padding-left: 20px !important; }</style>
        <div class="pdf-ai" style="border:1.5px solid #a4ba74;border-radius:10px;padding:12px 16px;margin-bottom:14px;">
            <div style="font-weight:700;color:#2e5a27;font-size:16px;margin-bottom:4px;border-bottom:2px solid #82954b;padding-bottom:4px;">🤖 ผลการประเมินและคำแนะนำจาก AI</div>
            ${aiHtml || '<p>ไม่มีผลวิเคราะห์</p>'}
        </div>

        <div class="pdf-avoid" style="font-weight:700;color:#4a5d23;font-size:15px;margin-bottom:6px;">📊 ตารางคะแนนรายด้าน</div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:14px;">
            <thead><tr>
                <th style="background:#eef5e1;padding:7px 10px;border:1px solid #dfe6d3;text-align:left;">ด้านการประเมิน</th>
                <th style="background:#eef5e1;padding:7px 10px;border:1px solid #dfe6d3;width:90px;">คะแนน</th>
            </tr></thead>
            <tbody>${rows}</tbody>
        </table>

        <div class="pdf-avoid" style="background:#fff8e1;border:1px solid #ffe082;border-radius:8px;padding:8px 12px;font-size:11.5px;color:#795548;">
            <b>ข้อควรทราบ:</b> ผลวิเคราะห์จัดทำโดย AI จากคะแนนแบบทดสอบ เพื่อใช้คัดกรองเบื้องต้นเท่านั้น <b>ไม่ใช่การวินิจฉัยโรค</b> หากมีข้อกังวลเกี่ยวกับสุขภาพสมอง ควรนำรายงานนี้ไปปรึกษาแพทย์หรือคลินิกความจำ
        </div>
        <div style="text-align:center;color:#999;font-size:11px;margin-top:10px;">Memory Garden — สวนความทรงจำ</div>
    </div>`;
}

function setPdfStatus(text) {
    const el = document.getElementById('result-pdf-status');
    if (el) el.textContent = text || '';
}

function pdfFileName() {
    const d = new Date();
    const pad = (x) => String(x).padStart(2, '0');
    return `MemoryGarden-ผลประเมิน-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.pdf`;
}

// html2canvas หาจุดตัดบรรทัดภาษาไทยไม่เป็น (ภาษาไทยไม่เว้นวรรคระหว่างคำ) ทำให้ข้อความยาวๆ ทับกัน
// จึงตัดคำด้วย Intl.Segmenter แล้วแทรกช่องว่างความกว้างศูนย์ (U+200B) ให้มีจุดตัดบรรทัดตรงกับเบราว์เซอร์
function insertThaiWordBreaks(root) {
    if (typeof Intl === 'undefined' || !Intl.Segmenter) return;
    const segmenter = new Intl.Segmenter('th', { granularity: 'word' });
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
        if (!/[฀-๿]/.test(node.nodeValue)) return;
        node.nodeValue = Array.from(segmenter.segment(node.nodeValue), s => s.segment).join('​');
    });
}

async function createResultPdfBlob() {
    await loadHtml2Pdf();
    const container = document.createElement('div');
    container.innerHTML = buildResultReportHtml();
    const report = container.firstElementChild;
    insertThaiWordBreaks(report);

    const opt = {
        margin: [10, 10, 12, 10],
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        // ไม่ตัดกลางบรรทัด/แถวตาราง แต่ยอมให้กล่องผลวิเคราะห์ AI ที่ยาวแบ่งข้ามหน้าได้
        pagebreak: { mode: ['css'], avoid: ['tr', 'li', 'p', 'h2', 'h3', 'h4', '.pdf-avoid'] }
    };
    return window.html2pdf().set(opt).from(report).outputPdf('blob');
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// mode: 'download' = บันทึกไฟล์ลงเครื่อง, 'share' = ส่งไฟล์ผ่านแอปอื่น (LINE, อีเมล ฯลฯ) ถ้าอุปกรณ์รองรับ
async function exportResultPdf(mode) {
    if (!window.currentUserTestResult) {
        showCustomPopup('ยังไม่มีผลการประเมิน กรุณาทำแบบทดสอบให้ครบก่อนครับ', '⚠️');
        return;
    }
    const buttons = ['btn-result-pdf-download', 'btn-result-pdf-share'].map(id => document.getElementById(id));
    buttons.forEach(b => { if (b) b.disabled = true; });

    try {
        // ไฟล์ PDF ใช้ผลประเมินจาก AI — ถ้ายังไม่ได้กดวิเคราะห์ ให้ AI วิเคราะห์ก่อน
        // (generateUserAIAnalysis ใช้บทวิเคราะห์สำรองในเครื่องเองถ้าเรียก AI ไม่สำเร็จ)
        const aiEl = document.getElementById('user-ai-content');
        if (!aiEl || !aiEl.innerText.trim()) {
            setPdfStatus('🤖 กำลังให้ AI วิเคราะห์ผล... (ประมาณ 10–20 วินาที)');
            await generateUserAIAnalysis();
        }
        setPdfStatus('⏳ กำลังสร้างไฟล์ PDF...');
        const blob = await createResultPdfBlob();
        const filename = pdfFileName();

        if (mode === 'share') {
            const file = new File([blob], filename, { type: 'application/pdf' });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                try {
                    await navigator.share({ files: [file], title: 'ผลการประเมินสุขภาพสมอง Memory Garden' });
                    setPdfStatus('✅ ส่งไฟล์ PDF แล้ว');
                } catch (err) {
                    setPdfStatus(err && err.name === 'AbortError' ? '' : '❌ ส่งไฟล์ไม่สำเร็จ ลองกด "ดาวน์โหลด PDF" แทนครับ');
                }
                return;
            }
            // อุปกรณ์ส่งไฟล์โดยตรงไม่ได้ (เช่น คอมพิวเตอร์บางเครื่อง) → ดาวน์โหลดแทน
            downloadBlob(blob, filename);
            setPdfStatus('✅ ดาวน์โหลดแล้ว');
            showCustomPopup('อุปกรณ์นี้ส่งไฟล์โดยตรงไม่ได้ ระบบจึงดาวน์โหลดไฟล์ PDF ให้แทน\n\nสามารถแนบไฟล์จากโฟลเดอร์ดาวน์โหลดเพื่อส่งต่อทาง LINE หรืออีเมลได้ครับ', '📄');
            return;
        }

        downloadBlob(blob, filename);
        setPdfStatus('✅ ดาวน์โหลดไฟล์ ' + filename + ' แล้ว');
    } catch (err) {
        console.error('[PDF] export failed:', err);
        setPdfStatus('❌ สร้างไฟล์ PDF ไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่');
    } finally {
        buttons.forEach(b => { if (b) b.disabled = false; });
    }
}

