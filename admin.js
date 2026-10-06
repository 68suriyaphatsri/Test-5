let currentComputedStats = {};
// =====================================================
// Admin Dashboard Logic & Percentile Analytics Engine
// Username: Sunnysun | Password: Sunny13082552
// =====================================================

const ADMIN_USER = "Sunnysun";
const ADMIN_PASS = "Sunny13082552";

let rawTestResults = [];
let scatterChartInstance = null;
let curveChartInstance = null;
let rocChartInstance = null;
let activeModalResult = null;
let activeEditResult = null;
let pendingDeleteId = null;

// --- Initialize Page & Event Listeners ---
document.addEventListener("DOMContentLoaded", () => {
    checkAdminSession();
    initGeminiKey();
    bindAdminEvents();
});

function checkAdminSession() {
    const isAuth = sessionStorage.getItem("admin_authenticated");
    if (isAuth === "true") {
        document.getElementById("admin-login-screen").style.display = "none";
        document.getElementById("admin-dashboard-container").style.display = "block";
        loadDashboardData();
    } else {
        document.getElementById("admin-login-screen").style.display = "flex";
        document.getElementById("admin-dashboard-container").style.display = "none";
    }
}

function bindAdminEvents() {
    // Form Login
    const loginForm = document.getElementById("admin-login-form");
    if (loginForm) {
        loginForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const u = document.getElementById("admin-username").value.trim();
            const p = document.getElementById("admin-password").value.trim();

            if (u === ADMIN_USER && p === ADMIN_PASS) {
                sessionStorage.setItem("admin_authenticated", "true");
                document.getElementById("admin-login-screen").style.display = "none";
                document.getElementById("admin-dashboard-container").style.display = "block";
                loadDashboardData();
            } else {
                alert("ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง");
            }
        });
    }

    // Logout Button
    const logoutBtn = document.getElementById("admin-logout-btn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            sessionStorage.removeItem("admin_authenticated");
            location.reload();
        });
    }

    // Search Box Filter
    const searchBox = document.getElementById("table-search");
    if (searchBox) {
        searchBox.addEventListener("input", (e) => {
            const query = e.target.value.toLowerCase().trim();
            filterTableData(query);
        });
    }

    // Paper Modal Cancel
    const cancelModalBtn = document.getElementById("btn-cancel-modal");
    if (cancelModalBtn) {
        cancelModalBtn.addEventListener("click", closePaperModal);
    }

    // Paper Score Form Submit
    const paperForm = document.getElementById("paper-score-form");
    if (paperForm) {
        paperForm.addEventListener("submit", handlePaperScoreSubmit);
    }

    // Auto-update paper risk level เมื่อกรอกคะแนนกระดาษ
    const paperScoreInput = document.getElementById("input-paper-score");
    if (paperScoreInput) {
        paperScoreInput.addEventListener("input", () => {
            const score = parseInt(paperScoreInput.value);
            if (!isNaN(score) && score >= 0 && score <= 30) {
                const riskDropdown = document.getElementById("input-paper-risk");
                if (riskDropdown) riskDropdown.value = calcRiskLevel(score);
            }
        });
    }

    // Edit Modal Cancel
    const cancelEditBtn = document.getElementById("btn-cancel-edit");
    if (cancelEditBtn) {
        cancelEditBtn.addEventListener("click", closeEditModal);
    }

    // Edit Record Form Submit
    const editForm = document.getElementById("edit-record-form");
    if (editForm) {
        editForm.addEventListener("submit", handleEditSubmit);
    }

    // Auto-update risk_level dropdown เมื่อ Admin เปลี่ยนคะแนนใน Edit Modal
    const editScoreInput = document.getElementById("edit-total-score");
    if (editScoreInput) {
        editScoreInput.addEventListener("input", () => {
            const score = parseInt(editScoreInput.value);
            if (!isNaN(score)) {
                const riskDropdown = document.getElementById("edit-risk-level");
                if (riskDropdown) riskDropdown.value = calcRiskLevel(score);
            }
        });
    }

    // Delete Confirm Modal: Cancel
    const cancelDeleteBtn = document.getElementById("btn-cancel-delete");
    if (cancelDeleteBtn) {
        cancelDeleteBtn.addEventListener("click", () => {
            document.getElementById("delete-confirm-modal").style.display = "none";
            pendingDeleteId = null;
        });
    }

    // Delete Confirm Modal: Confirm
    const confirmDeleteBtn = document.getElementById("btn-confirm-delete");
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener("click", executeDelete);
    }

    // Close modals when clicking backdrop
    document.getElementById("edit-modal").addEventListener("click", (e) => {
        if (e.target === document.getElementById("edit-modal")) closeEditModal();
    });
    document.getElementById("delete-confirm-modal").addEventListener("click", (e) => {
        if (e.target === document.getElementById("delete-confirm-modal")) {
            document.getElementById("delete-confirm-modal").style.display = "none";
            pendingDeleteId = null;
        }
    });
}

// --- Load Data & Compute Percentiles ---
async function loadDashboardData() {
    try {
        rawTestResults = await MemoryGardenTools.getAllTestResults();
        computePercentilesAndStats();
    } catch (err) {
        console.error("Error loading dashboard data:", err);
    }
}

// --- Percentile Rank Algorithm & Math ---
// Formula: Standard Percentile Rank = ((c_L + 0.5 * f_i) / N) * 100
// c_L = count of scores less than X
// f_i = frequency of score X (count of equal scores)
// N = total sample size
function calculateStandardPercentileRank(scores, targetScore) {
    if (!scores || scores.length === 0) return 0;
    const N = scores.length;
    const c_L = scores.filter(s => s < targetScore).length;
    const f_i = scores.filter(s => s === targetScore).length;
    const rank = ((c_L + 0.5 * f_i) / N) * 100;
    return Math.round(rank * 10) / 10;
}

function computePercentilesAndStats() {
    if (!rawTestResults || rawTestResults.length === 0) {
        renderMetrics(0, 0, 0, 0, 0, null, null, null, null, 0);
        renderTable([]);
        return;
    }

    const N = rawTestResults.length;
    const allAppScores = rawTestResults.map(r => r.total_score || 0);

    // 1. Calculate Standard App Percentiles — using ALL records as reference group
    rawTestResults.forEach((record) => {
        const appScore = record.total_score || 0;
        record.app_percentile = calculateStandardPercentileRank(allAppScores, appScore);
    });

    // 2. Filter records that have paper scores
    const paperRecords = rawTestResults.filter((r) => r.paper_score !== null && r.paper_score !== undefined);
    const N_paper = paperRecords.length;

    let spearmanRs = 0;
    let maePct = 0;
    let diagnosticAccuracy = 0;
    let sensitivity = null, specificity = null, auc = null, optCutoff = null;

    if (N_paper > 0) {
        const groupAppScores = paperRecords.map(r => r.total_score || 0);
        const groupPaperScores = paperRecords.map(r => r.paper_score);

        // คำนวณ percentiles ในกลุ่มที่มีคะแนนกระดาษ
        paperRecords.forEach((record) => {
            record.paper_percentile = calculateStandardPercentileRank(groupPaperScores, record.paper_score);
            record.app_percentile_ingroup = calculateStandardPercentileRank(groupAppScores, record.total_score || 0);

            // Normalized Score comparison (|%App - %Paper|)
            const normAppPct = ((record.total_score || 0) / 30) * 100;
            const normPaperPct = (record.paper_score / 30) * 100;
            record.norm_score_diff = Math.round(Math.abs(normAppPct - normPaperPct) * 10) / 10;
        });

        // 3. Compute Medical Statistics
        spearmanRs = calculateSpearman(paperRecords);
        maePct = calculateMAE(paperRecords);

        // Clinical validity metrics & Optimal Cutoff using Youden's Index
        // ใช้ paperCutoff = 26 ตามมาตรฐาน MoCA (ปกติ >= 26, MCI < 26)
        const best = findOptimalCutoff(paperRecords, 25);
        optCutoff = best.cutoff;
        sensitivity = best.sens;
        specificity = best.spec;
        diagnosticAccuracy = best.accuracy;

        const aucResult = computeAUCROC(paperRecords, 25);
        auc = aucResult.auc;
    }

    const paperCount = N_paper;
    const paperPct = N > 0 ? Math.round((paperCount / N) * 100) : 0;

    // คำนวณเวลาทำแบบทดสอบเฉลี่ยทั้งหมด
    const validDurations = rawTestResults
        .map(r => (r.details && r.details.duration_seconds != null) ? r.details.duration_seconds : r.duration_seconds)
        .filter(d => typeof d === 'number' && d > 0);
    const avgDurationSec = validDurations.length ? Math.round(validDurations.reduce((a, b) => a + b, 0) / validDurations.length) : null;
    const avgDurationStr = avgDurationSec != null ? (Math.floor(avgDurationSec / 60) + ' นาที ' + (avgDurationSec % 60) + ' วินาที') : '-';

    currentComputedStats = {
        N,
        paperCount,
        paperPct,
        spearmanRs,
        maePct,
        sensitivity,
        specificity,
        auc,
        optCutoff,
        diagnosticAccuracy,
        avgDurationSec,
        avgDurationStr,
        paperRecordsCount: N_paper
    };

    renderMetrics(N, paperCount, paperPct, spearmanRs, maePct, sensitivity, specificity, auc, optCutoff, diagnosticAccuracy, avgDurationStr);
    renderCharts(rawTestResults, paperRecords);
    renderTable(rawTestResults);
    populateAiSingleSelect(rawTestResults);
}

// Spearman's Rank Correlation (r_s) with tied ranks handling
function calculateSpearman(paperRecords) {
    if (paperRecords.length < 2) return 0;
    const x = paperRecords.map((r) => r.total_score || 0);
    const y = paperRecords.map((r) => r.paper_score);

    const rank = (arr) => {
        const sorted = arr.map((val, idx) => ({ val, idx })).sort((a, b) => a.val - b.val);
        const ranks = new Array(arr.length);
        let i = 0;
        while (i < sorted.length) {
            let j = i;
            while (j < sorted.length && sorted[j].val === sorted[i].val) {
                j++;
            }
            const meanRank = (i + 1 + j) / 2;
            for (let k = i; k < j; k++) {
                ranks[sorted[k].idx] = meanRank;
            }
            i = j;
        }
        return ranks;
    };

    const rx = rank(x);
    const ry = rank(y);
    const n = x.length;

    const meanRx = rx.reduce((a, b) => a + b, 0) / n;
    const meanRy = ry.reduce((a, b) => a + b, 0) / n;

    let num = 0, denX = 0, denY = 0;
    for (let i = 0; i < n; i++) {
        const dx = rx[i] - meanRx;
        const dy = ry[i] - meanRy;
        num += dx * dy;
        denX += dx * dx;
        denY += dy * dy;
    }

    if (denX === 0 || denY === 0) return 0;
    const rs = num / Math.sqrt(denX * denY);
    return Math.round(rs * 100) / 100;
}

// Mean Absolute Error (MAE) of Normalized Score (0-100%)
function calculateMAE(paperRecords) {
    if (paperRecords.length === 0) return 0;
    const totalDiff = paperRecords.reduce((sum, r) => {
        const normAppPct = ((r.total_score || 0) / 30) * 100;
        const normPaperPct = (r.paper_score / 30) * 100;
        return sum + Math.abs(normAppPct - normPaperPct);
    }, 0);
    return Math.round((totalDiff / paperRecords.length) * 10) / 10;
}

// --- Render Metrics Cards ---
function renderMetrics(totalUsers, paperCount, paperPct, spearmanRs, maePct, sensitivity, specificity, auc, optCutoff, diagnosticAccuracy) {
    document.getElementById("metric-total-users").textContent = totalUsers;
    document.getElementById("metric-paper-count").textContent = paperCount;
    document.getElementById("metric-paper-pct").textContent = `${paperPct}% ของผู้ทดสอบทั้งหมด`;
    document.getElementById("metric-correlation").textContent = spearmanRs.toFixed(2);
    document.getElementById("metric-avg-accuracy").textContent = `${diagnosticAccuracy.toFixed(1)}%`;
    if (document.getElementById("metric-mae")) {
        document.getElementById("metric-mae").textContent = `${maePct.toFixed(1)}%`;
    }

    // Clinical metrics
    const fmt = (v) => v !== null ? `${(v * 100).toFixed(1)}%` : `-`;
    document.getElementById("metric-sensitivity").textContent = fmt(sensitivity);
    document.getElementById("metric-specificity").textContent = fmt(specificity);
    document.getElementById("metric-auc").textContent = auc !== null ? auc.toFixed(3) : `-`;
    document.getElementById("metric-opt-cutoff").textContent = optCutoff !== null ? `< ${optCutoff}/30` : `-`;
}

// --- Clinical Validity Functions ---

// คำนวณ Sensitivity, Specificity และ Diagnostic Accuracy ((TP + TN) / N)
// paperCutoff = 25: มาตรฐาน MoCA (ปกติ >= 25, MCI < 25)
function computeSensSpec(records, appCutoff, paperCutoff = 25) {
    let TP = 0, FP = 0, TN = 0, FN = 0;
    records.forEach(r => {
        const appPos = (r.total_score || 0) < appCutoff;  // แอปบอกว่าเป็น MCI
        const paperPos = r.paper_score < paperCutoff;     // กระดาษบอกว่าเป็น MCI (< 25 = MoCA มาตรฐาน)
        if (appPos && paperPos)   TP++;
        else if (appPos && !paperPos) FP++;
        else if (!appPos && !paperPos) TN++;
        else FN++;
    });
    const N = records.length;
    const sensitivity = (TP + FN) > 0 ? TP / (TP + FN) : 0;
    const specificity = (TN + FP) > 0 ? TN / (TN + FP) : 0;
    const accuracy = N > 0 ? ((TP + TN) / N) * 100 : 0;
    return { sensitivity, specificity, accuracy, TP, FP, TN, FN };
}

// หา cutoff ที่ดีที่สุดด้วย Youden's Index (Sens + Spec - 1)
function findOptimalCutoff(records, paperCutoff = 25) {
    let best = { cutoff: 25, youden: -Infinity, sens: 0, spec: 0, accuracy: 0 };
    for (let c = 1; c <= 30; c++) {
        const { sensitivity, specificity, accuracy } = computeSensSpec(records, c, paperCutoff);
        const youden = sensitivity + specificity - 1;
        if (youden > best.youden) {
            best = { cutoff: c, youden, sens: sensitivity, spec: specificity, accuracy };
        }
    }
    return best;
}

// คำนวณ AUC-ROC ด้วย Trapezoidal Rule
function computeAUCROC(records, paperCutoff = 25) {
    const points = [];
    for (let c = 0; c <= 31; c++) {
        const { sensitivity, specificity } = computeSensSpec(records, c, paperCutoff);
        points.push({ fpr: 1 - specificity, tpr: sensitivity, cutoff: c });
    }

    // เรียงตาม FPR จากน้อยไปหามาก
    // เมื่อ FPR เท่ากัน ให้เรียง TPR จากมากไปน้อย (highest first) เพื่อ staircase ที่ถูกต้อง
    points.sort((a, b) => a.fpr - b.fpr || b.tpr - a.tpr);

    // [BUG FIX] dedup ตาม FPR โดยใช้ epsilon-comparison:
    // เก็บเฉพาะจุดแรก (TPR สูงสุด) สำหรับแต่ละ FPR ที่ไม่ซ้ำกัน
    // เดิมใช้ strict equality ซึ่งทำให้ cutoff หลายค่าที่มี FPR เท่ากัน
    // แต่ TPR ต่างกันถูกพล็อตแยกกัน → เส้นหยักย้อนกลับ (non-monotonic)
    const EPS = 1e-9;
    const unique = points.filter((p, i, arr) =>
        i === 0 || Math.abs(p.fpr - arr[i - 1].fpr) > EPS
    );

    // Safety net: บังคับให้ TPR เป็น non-decreasing (monotonic) ตลอดเส้น
    for (let i = 1; i < unique.length; i++) {
        if (unique[i].tpr < unique[i - 1].tpr) {
            unique[i].tpr = unique[i - 1].tpr;
        }
    }

    // เพิ่ม anchor (0,0) และ (1,1) ถ้ายังไม่มี
    if (unique.length === 0 || unique[0].fpr > EPS || unique[0].tpr > EPS) {
        unique.unshift({ fpr: 0, tpr: 0 });
    }
    if (unique[unique.length - 1].fpr < 1 - EPS || unique[unique.length - 1].tpr < 1 - EPS) {
        unique.push({ fpr: 1, tpr: 1 });
    }

    let auc = 0;
    for (let i = 1; i < unique.length; i++) {
        const dx = unique[i].fpr - unique[i - 1].fpr;
        const avgY = (unique[i].tpr + unique[i - 1].tpr) / 2;
        auc += dx * avgY;
    }
    return { auc: Math.max(0, Math.min(1, auc)), rocPoints: unique };
}

// --- Render Charts ---
function renderCharts(allRecords, paperRecords) {
    // 1. Scatter Plot: App Percentile vs Paper Percentile
    const scatterCtx = document.getElementById("scatterChart").getContext("2d");
    if (scatterChartInstance) scatterChartInstance.destroy();

    const scatterData = paperRecords.map((r) => ({
        x: r.app_percentile_ingroup,
        y: r.paper_percentile,
        name: r.name || r.user_id
    }));

    scatterChartInstance = new Chart(scatterCtx, {
        type: "scatter",
        data: {
            datasets: [
                {
                    label: "ผู้รับการประเมิน (Percentile Rank)",
                    data: scatterData,
                    backgroundColor: "#82954b",
                    pointRadius: 6,
                    pointHoverRadius: 8
                },
                {
                    // เส้น Perfect Correlation y=x
                    label: "เส้นอ้างอิง (Perfect Match)",
                    data: [{ x: 0, y: 0 }, { x: 100, y: 100 }],
                    type: "line",
                    borderColor: "rgba(200,200,200,0.6)",
                    borderDash: [6, 4],
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    min: 0, max: 100,
                    title: { display: true, text: "เปอร์เซ็นไทล์ในกลุ่ม (แอป)" },
                    grid: { color: "rgba(0,0,0,0.05)" }
                },
                y: {
                    min: 0, max: 100,
                    title: { display: true, text: "เปอร์เซ็นไทล์ตามเกณฑ์กระดาษ" },
                    grid: { color: "rgba(0,0,0,0.05)" }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const p = ctx.raw;
                            return `${p.name} | แอป (X): P${p.x} | กระดาษ (Y): P${p.y}`;
                        }
                    }
                }
            }
        }
    });

    // 2. Cumulative Score Comparison Curve
    const curveCanvas = document.getElementById("curveChart");
    if (!curveCanvas) return;
    const curveCtx = curveCanvas.getContext("2d");
    if (curveChartInstance) curveChartInstance.destroy();

    if (paperRecords.length === 0) {
        curveChartInstance = new Chart(curveCtx, {
            type: "line",
            data: { datasets: [] },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false },
                    title: { display: true, text: "⏳ ยังไม่มีข้อมูลคะแนนกระดาษ — กรุณาบันทึกคะแนนกระดาษก่อน", color: "#888", font: { size: 14 } }
                }
            }
        });
    } else {
        // แสดงเส้นโค้งสะสม
        // ใช้ % ของคะแนนสูงสุดเป็น x-axis (app: /30, paper: /30) เพื่อให้ทั้งคู่อยู่บน scale 0-100%
        const appScoresSorted = [...paperRecords].map(r => r.total_score || 0).sort((a, b) => a - b);
        const paperScoresSorted = paperRecords.map(r => r.paper_score).sort((a, b) => a - b);

        const appPoints = Array.from({ length: 31 }, (_, i) => ({
            x: Math.round((i / 30) * 100),  // % ของ max 30
            y: Math.round((appScoresSorted.filter(s => s <= i).length / appScoresSorted.length) * 100)
        }));
        const paperPoints = Array.from({ length: 31 }, (_, i) => ({
            x: Math.round((i / 30) * 100),  // % ของ max 30
            y: Math.round((paperScoresSorted.filter(s => s <= i).length / paperScoresSorted.length) * 100)
        }));

        curveChartInstance = new Chart(curveCtx, {
            type: "scatter",
            data: {
                datasets: [
                    {
                        label: "แอป (0-30, พิกัดเป็น %)",
                        data: appPoints,
                        borderColor: "#82954b",
                        backgroundColor: "rgba(130,149,75,0.1)",
                        showLine: true, fill: true, tension: 0.3, pointRadius: 3
                    },
                    {
                        label: "กระดาษ MoCA (0-30)",
                        data: paperPoints,
                        borderColor: "#e06666",
                        backgroundColor: "rgba(224,102,102,0.1)",
                        showLine: true, fill: true, tension: 0.3, pointRadius: 3
                    }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    x: { type: "linear", min: 0, max: 100, title: { display: true, text: "% ของคะแนนเต็ม (Normalized)" } },
                    y: { min: 0, max: 100, title: { display: true, text: "เปอร์เซ็นต์สะสม (%)" } }
                }
            }
        });
    }

    // 3. ROC Curve Chart
    const rocCtx = document.getElementById("rocChart");
    if (rocCtx) {
        if (rocChartInstance) rocChartInstance.destroy();

        if (paperRecords.length === 0) {
            rocChartInstance = new Chart(rocCtx.getContext("2d"), {
                type: "line",
                data: { datasets: [] },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false },
                        title: { display: true, text: "⏳ ยังไม่มีข้อมูล — บันทึกคะแนนกระดาษเพื่อดู ROC Curve", color: "#888", font: { size: 14 } }
                    }
                }
            });
        } else {
            const { rocPoints } = computeAUCROC(paperRecords, 25);
            const rocData = rocPoints.map(p => ({
                x: parseFloat(p.fpr.toFixed(4)),
                y: parseFloat(p.tpr.toFixed(4))
            }));

            rocChartInstance = new Chart(rocCtx.getContext("2d"), {
                type: "scatter",
                data: {
                    datasets: [
                        {
                            label: "ROC Curve (App vs MoCA < 25)",
                            data: rocData,
                            borderColor: "#7b5ea7",
                            backgroundColor: "rgba(123, 94, 167, 0.12)",
                            showLine: true, fill: true, tension: 0,  // tension: 0 = เส้นตรง (piecewise linear) ป้องกัน bezier โค้งเกินจุด
                            pointRadius: 4, pointHoverRadius: 7
                        },
                        {
                            label: "เส้นสุ่ม (Random Classifier)",
                            data: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
                            borderColor: "rgba(180,180,180,0.6)",
                            borderDash: [6, 4],
                            borderWidth: 2,
                            pointRadius: 0,
                            showLine: true, fill: false
                        }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    scales: {
                        x: { type: "linear", min: 0, max: 1, title: { display: true, text: "1 - Specificity (False Positive Rate)" } },
                        y: { type: "linear", min: 0, max: 1, title: { display: true, text: "Sensitivity (True Positive Rate)" } }
                    },
                    plugins: {
                        tooltip: {
                            callbacks: {
                                label: (ctx) => {
                                    const p = ctx.raw;
                                    return `FPR: ${(p.x * 100).toFixed(1)}% | TPR: ${(p.y * 100).toFixed(1)}%`;
                                }
                            }
                        }
                    }
                }
            });
        }
    }
} // end renderCharts

// --- Render Table ---
function renderTable(results) {
    const tbody = document.getElementById("results-table-body");
    tbody.innerHTML = "";

    if (!results || results.length === 0) {
        tbody.innerHTML = `<tr><td colspan="12" style="text-align:center; padding:30px; color:#888;">ไม่พบข้อมูลผลการทดสอบ</td></tr>`;
        return;
    }

    results.forEach((record) => {
        const tr = document.createElement("tr");

        const dateStr = record.created_at
            ? new Date(record.created_at).toLocaleDateString("th-TH", {
                  day: "numeric",
                  month: "short",
                  year: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit"
              })
            : "-";

        const durFormatted = (record.details && record.details.duration_formatted) 
            || (record.details && record.details.duration_seconds != null ? (Math.floor(record.details.duration_seconds / 60) + ' นาที ' + (record.details.duration_seconds % 60) + ' วินาที') : null)
            || (record.duration_seconds != null ? (Math.floor(record.duration_seconds / 60) + ' นาที ' + (record.duration_seconds % 60) + ' วินาที') : '-');

        const appScore = record.total_score !== undefined ? `${record.total_score} / 30` : "-";
        const appP = record.app_percentile !== undefined ? `P<sub>${record.app_percentile}%</sub>` : "-";
        const paperScore = record.paper_score !== null && record.paper_score !== undefined ? `${record.paper_score} / 30` : `<span style='color:#bbb;'>ยังไม่ลงคะแนน</span>`;
        const paperP = record.paper_percentile !== undefined && record.paper_score !== null ? `P<sub>${record.paper_percentile}%</sub>` : "-";
        const compareP = record.app_percentile_ingroup !== undefined && record.paper_score !== null
            ? `P<sub>${record.app_percentile_ingroup}%</sub>`
            : appP;
        const normDiff = record.norm_score_diff !== undefined && record.paper_score !== null ? `|Δ| ${record.norm_score_diff}%` : "-";

        // ปุ่มแผนที่ — แสดงเฉพาะถ้ามีข้อมูล GPS
        const hasGPS = record.latitude !== null && record.latitude !== undefined
                    && record.longitude !== null && record.longitude !== undefined;
        const mapBtn = hasGPS
            ? `<button class="btn-action-map" onclick="openMap(${record.latitude}, ${record.longitude}, '${(record.name || record.user_id).replace(/'/g, "\\'")}')" title="ดูตำแหน่งบน Google Maps">🗺️ ดูตำแหน่ง</button>`
            : `<button class="btn-action-map btn-action-map--disabled" disabled title="ไม่มีข้อมูล GPS">📍 ไม่มี GPS</button>`;

        tr.innerHTML = `
            <td>${dateStr}</td>
            <td><strong>${record.name || "ไม่ระบุชื่อ"}</strong><br><span style="font-size:0.78rem;color:#888;">ID: ${record.user_id}</span></td>
            <td>${record.age || "-"}</td>
            <td><span style="font-size:0.85rem;color:#4a5d23;font-weight:600;">${durFormatted}</span></td>
            <td><strong style="color:#4a5d23;">${appScore}</strong></td>
            <td>${appP}</td>
            <td>${paperScore}</td>
            <td>${paperP}</td>
            <td>${compareP} → ${paperP}</td>
            <td>${normDiff}</td>
            <td>${mapBtn}</td>
            <td>
                <div class="action-cell">
                    <button class="btn-action" onclick="openPaperModal('${record.id}')">📝 บันทึกคะแนน</button>
                    <button class="btn-action-edit" onclick="openEditModal('${record.id}')">✏️ แก้ไขข้อมูล</button>
                    <button class="btn-action-delete" onclick="confirmDeleteRecord('${record.id}', '${(record.name || record.user_id).replace(/'/g, "\\'")}')">🗑️ ลบข้อมูล</button>
                </div>
            </td>
        `;

        tbody.appendChild(tr);
    });
}


function filterTableData(query) {
    if (!query) {
        renderTable(rawTestResults);
    populateAiSingleSelect(rawTestResults);
        return;
    }
    const filtered = rawTestResults.filter(
        (r) =>
            (r.name && r.name.toLowerCase().includes(query)) ||
            (r.user_id && r.user_id.toLowerCase().includes(query))
    );
    renderTable(filtered);
}

// --- Paper Score Modal Handlers ---
function openPaperModal(id) {
    const record = rawTestResults.find((r) => r.id === id);
    if (!record) return;

    activeModalResult = record;
    document.getElementById("modal-result-id").value = record.id;
    document.getElementById("modal-user-name").textContent = record.name || record.user_id;
    document.getElementById("modal-user-score").textContent = record.total_score || 0;

    document.getElementById("input-paper-score").value = record.paper_score !== null && record.paper_score !== undefined ? record.paper_score : "";
    document.getElementById("input-paper-risk").value = record.paper_risk_level || "ปกติ (Normal)";
    document.getElementById("input-paper-notes").value = record.paper_notes || "";

    const modal = document.getElementById("paper-modal");
    modal.style.display = "flex";
}

function closePaperModal() {
    const modal = document.getElementById("paper-modal");
    modal.style.display = "none";
    activeModalResult = null;
}

async function handlePaperScoreSubmit(e) {
    e.preventDefault();
    if (!activeModalResult) return;

    const paperScore = parseInt(document.getElementById("input-paper-score").value);
    const paperRisk = document.getElementById("input-paper-risk").value;
    const paperNotes = document.getElementById("input-paper-notes").value.trim();

    if (isNaN(paperScore) || paperScore < 0 || paperScore > 30) {
        alert("กรุณากรอกคะแนนกระดาษเป็นตัวเลขระหว่าง 0 ถึง 30 คะแนน");
        return;
    }

    // Temporary set paper score for calculation
    activeModalResult.paper_score = paperScore;
    activeModalResult.paper_risk_level = paperRisk;
    activeModalResult.paper_notes = paperNotes;

    // Recalculate percentiles for all
    computePercentilesAndStats();

    // Save to Supabase via MCP
    const success = await MemoryGardenTools.savePaperScore(activeModalResult.id, {
        paper_score: paperScore,
        paper_risk_level: paperRisk,
        paper_notes: paperNotes,
        paper_percentile: activeModalResult.paper_percentile,
        app_percentile: activeModalResult.app_percentile,
        percentile_accuracy: activeModalResult.percentile_accuracy
    });

    if (success) {
        alert("บันทึกคะแนนกระดาษและคำนวณ Percentile สำเร็จ!");
        closePaperModal();
    } else {
        alert("เกิดข้อผิดพลาดในการบันทึกข้อมูลลง Supabase");
    }
}

// =====================================================
// Edit Record Handlers
// =====================================================

function openEditModal(id) {
    const record = rawTestResults.find((r) => r.id === id);
    if (!record) return;

    activeEditResult = record;
    document.getElementById("edit-record-id").value = record.id;
    document.getElementById("edit-name").value = record.name || "";
    document.getElementById("edit-age").value = record.age || "";
    document.getElementById("edit-gender").value = record.gender || "male";
    document.getElementById("edit-education").value = record.education || "";
    document.getElementById("edit-disease").value = record.disease || "";
    document.getElementById("edit-total-score").value = record.total_score !== undefined ? record.total_score : "";
    document.getElementById("edit-risk-level").value = record.risk_level || "ปกติ (Normal)";
    document.getElementById("edit-paper-score").value = record.paper_score !== null && record.paper_score !== undefined ? record.paper_score : "";
    document.getElementById("edit-paper-risk").value = record.paper_risk_level || "";
    document.getElementById("edit-paper-notes").value = record.paper_notes || "";

    document.getElementById("edit-modal").style.display = "flex";

    // Live-update risk_level dropdown เมื่อแก้คะแนน
    const scoreInput = document.getElementById("edit-total-score");
    const riskSelect = document.getElementById("edit-risk-level");
    // ถอด listener เก่าออกก่อน (ป้องกัน duplicate)
    const newScoreInput = scoreInput.cloneNode(true);
    scoreInput.parentNode.replaceChild(newScoreInput, scoreInput);
    newScoreInput.value = record.total_score !== undefined ? record.total_score : "";
    newScoreInput.addEventListener("input", () => {
        const s = parseInt(newScoreInput.value);
        if (!isNaN(s) && s >= 0 && s <= 30) {
            riskSelect.value = calcRiskLevel(s);
        }
    });

    // Live-update paper_risk เมื่อพิมพ์คะแนนกระดาษ
    const paperScoreInput = document.getElementById("edit-paper-score");
    const paperRiskSelect = document.getElementById("edit-paper-risk");
    const newPaperScoreInput = paperScoreInput.cloneNode(true);
    paperScoreInput.parentNode.replaceChild(newPaperScoreInput, paperScoreInput);
    newPaperScoreInput.value = record.paper_score !== null && record.paper_score !== undefined ? record.paper_score : "";
    newPaperScoreInput.addEventListener("input", () => {
        const ps = parseInt(newPaperScoreInput.value);
        if (!isNaN(ps) && ps >= 0 && ps <= 30) {
            paperRiskSelect.value = calcRiskLevel(ps);
        }
    });
} // end openEditModal

function closeEditModal() {
    document.getElementById("edit-modal").style.display = "none";
    activeEditResult = null;
}

// คำนวณ risk_level จากคะแนน (ใช้มาตรฐาน MoCA: ปกติ >= 26)
function calcRiskLevel(score) {
    if (score >= 25) return 'ปกติ (Normal)';
    if (score >= 18) return 'เสี่ยงบกพร่องเล็กน้อย (MCI)';
    return 'ควรได้รับการดูแลพิเศษ';
}

async function handleEditSubmit(e) {
    e.preventDefault();
    if (!activeEditResult) return;

    const submitBtn = e.target.querySelector("button[type='submit']");
    const originalText = submitBtn.textContent;
    submitBtn.textContent = "กำลังบันทึก...";
    submitBtn.disabled = true;

    const newTotalScore = parseInt(document.getElementById("edit-total-score").value);
    const paperScoreVal = document.getElementById("edit-paper-score").value;
    const updatedData = {
        name: document.getElementById("edit-name").value.trim() || null,
        age: parseInt(document.getElementById("edit-age").value) || null,
        gender: document.getElementById("edit-gender").value,
        education: document.getElementById("edit-education").value,
        disease: document.getElementById("edit-disease").value.trim() || null,
        total_score: newTotalScore,
        // ถ้า Admin ไม่ได้เปลี่ยน dropdown เอง ให้คำนวณใหม่จากคะแนน
        risk_level: document.getElementById("edit-risk-level").value || calcRiskLevel(newTotalScore),
        paper_score: paperScoreVal !== "" ? parseInt(paperScoreVal) : null,
        paper_risk_level: document.getElementById("edit-paper-risk").value || null,
        paper_notes: document.getElementById("edit-paper-notes").value.trim() || null,
    };

    // Update locally
    const idx = rawTestResults.findIndex((r) => r.id === activeEditResult.id);
    if (idx !== -1) {
        rawTestResults[idx] = { ...rawTestResults[idx], ...updatedData };
    }

    // Save to Supabase
    const success = await MemoryGardenTools.updateTestResult(activeEditResult.id, updatedData);

    submitBtn.textContent = originalText;
    submitBtn.disabled = false;

    if (success) {
        computePercentilesAndStats();
        closeEditModal();
        showToast("✅ แก้ไขข้อมูลสำเร็จ!", "success");
    } else {
        showToast("❌ เกิดข้อผิดพลาดในการบันทึก", "error");
    }
}

// =====================================================
// Delete Record Handlers
// =====================================================

function confirmDeleteRecord(id, name) {
    pendingDeleteId = id;
    document.getElementById("delete-confirm-msg").innerHTML =
        `คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลของ<br><strong style="color:#c62828;">${name}</strong>?<br><span style="font-size:0.85rem;">การดำเนินการนี้ไม่สามารถย้อนกลับได้</span>`;
    document.getElementById("delete-confirm-modal").style.display = "flex";
}

async function executeDelete() {
    if (!pendingDeleteId) return;

    const confirmBtn = document.getElementById("btn-confirm-delete");
    confirmBtn.textContent = "กำลังลบ...";
    confirmBtn.disabled = true;

    const success = await MemoryGardenTools.deleteTestResult(pendingDeleteId);

    confirmBtn.textContent = "ลบข้อมูล";
    confirmBtn.disabled = false;

    if (success) {
        rawTestResults = rawTestResults.filter((r) => r.id !== pendingDeleteId);
        document.getElementById("delete-confirm-modal").style.display = "none";
        pendingDeleteId = null;
        computePercentilesAndStats();
        showToast("🗑️ ลบข้อมูลสำเร็จ", "success");
    } else {
        document.getElementById("delete-confirm-modal").style.display = "none";
        pendingDeleteId = null;
        showToast("❌ เกิดข้อผิดพลาดในการลบ", "error");
    }
}

// =====================================================
// Toast Notification Helper
// =====================================================

function showToast(message, type = "success") {
    // Remove existing toast
    const existing = document.getElementById("admin-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.id = "admin-toast";
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 32px;
        right: 32px;
        z-index: 999999;
        padding: 14px 24px;
        border-radius: 50px;
        font-size: 0.95rem;
        font-weight: 600;
        color: white;
        box-shadow: 0 8px 24px rgba(0,0,0,0.2);
        background: ${type === "success" ? "linear-gradient(135deg, #43a047, #2e7d32)" : "linear-gradient(135deg, #e53935, #b71c1c)"};
        animation: slideInToast 0.3s ease;
        font-family: 'Prompt', sans-serif;
    `;

    // Inject keyframes if not already done
    if (!document.getElementById("toast-style")) {
        const style = document.createElement("style");
        style.id = "toast-style";
        style.textContent = `
            @keyframes slideInToast {
                from { transform: translateY(20px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.transition = "opacity 0.5s ease";
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

// =====================================================
// Map Helper — เปิด Google Maps ด้วย GPS coordinates
// =====================================================
function openMap(lat, lon, name = '') {
    const label = encodeURIComponent(name || 'ตำแหน่งผู้ทดสอบ');
    const url = `https://www.google.com/maps?q=${lat},${lon}&z=15&t=m`;
    window.open(url, '_blank', 'noopener,noreferrer');
}


// =====================================================
// AI Analysis System -- PDPA Compliant Gemini Integration
// =====================================================

function initGeminiKey() {
    const DEFAULT_KEY = 'AQ.Ab8RN6Is5QjKRzSbxxhl7VHSzSXJgiqXOQRRd-J-EPie2RzzSg';
    if (!localStorage.getItem('mg_gemini_api_key') && DEFAULT_KEY) {
        localStorage.setItem('mg_gemini_api_key', DEFAULT_KEY);
    }
    const saved = localStorage.getItem('mg_gemini_api_key');
    if (saved) {
        const inp = document.getElementById('gemini-api-key-input');
        if (inp) inp.value = saved;
        showKeyStatus('API Key Ready', '#2e7d32');
    }
}

function saveGeminiKey() {
    const val = (document.getElementById('gemini-api-key-input')?.value || '').trim();
    if (!val) { showToast('กรุณากรอก API Key ก่อน', 'error'); return; }
    localStorage.setItem('mg_gemini_api_key', val);
    showKeyStatus('บันทึก API Key เรียบร้อยแล้ว', '#2e7d32');
    showToast('บันทึก Gemini API Key สำเร็จ', 'success');
}

function clearGeminiKey() {
    localStorage.removeItem('mg_gemini_api_key');
    const inp = document.getElementById('gemini-api-key-input');
    if (inp) inp.value = '';
    showKeyStatus('ล้าง API Key แล้ว', '#e53935');
}

function showKeyStatus(msg, color) {
    const el = document.getElementById('ai-key-status');
    if (!el) return;
    el.textContent = msg;
    el.style.color = color;
    el.style.display = 'block';
}

function switchAiMode(mode, btn) {
    document.querySelectorAll('.ai-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.ai-mode-content').forEach(c => {
        c.classList.remove('active');
        c.style.display = 'none';
    });
    const panel = document.getElementById('ai-mode-' + mode);
    if (panel) { panel.style.display = 'block'; panel.classList.add('active'); }
    document.getElementById('ai-result-container').style.display = 'none';
    document.getElementById('ai-loading').style.display = 'none';
}

function populateAiSingleSelect(records) {
    const sel = document.getElementById('ai-single-select');
    if (!sel) return;
    sel.innerHTML = '<option value="">-- เลือกผู้ทดสอบที่ต้องการวิเคราะห์ --</option>';
    records.forEach((r, i) => {
        const label = (r.name || 'ไม่ระบุชื่อ') + ' | อายุ ' + (r.age || '?') + ' | คะแนน ' + (r.total_score != null ? r.total_score : '?') + '/30 | ' + (r.created_at ? r.created_at.substring(0, 10) : '');
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = label;
        sel.appendChild(opt);
    });
    const gc = document.getElementById('ai-group-count');
    if (gc) gc.textContent = records.length;
}

function deidentifyRecord(r) {
    const d = r.details || {};
    return {
        age: r.age != null ? r.age : null,
        gender: r.gender || null,
        education: r.education || null,
        disease: r.disease || null,
        total_score: r.total_score != null ? r.total_score : null,
        risk_level: r.risk_level || null,
        duration_seconds: d.duration_seconds != null ? d.duration_seconds : (r.duration_seconds != null ? r.duration_seconds : null),
        duration_formatted: d.duration_formatted || r.duration_formatted || null,
        scores: {
            memory:      d.memory != null ? d.memory : (d.memory_score != null ? d.memory_score : null),
            visuospatial: d.visuospatial != null ? d.visuospatial : (d.clock_score != null ? d.clock_score : null),
            contour:     d.contour != null ? d.contour : null,
            naming:      d.naming != null ? d.naming : (d.naming_score != null ? d.naming_score : null),
            sentence:    d.sentenceRepeat != null ? d.sentenceRepeat : (d.sentence_score != null ? d.sentence_score : (d.sentence != null ? d.sentence : null)),
            fluency:     d.fluency != null ? d.fluency : (d.fluency_count != null ? d.fluency_count : null),
            math:        d.math != null ? d.math : (d.math_score != null ? d.math_score : null),
            orientation: d.orientation != null ? d.orientation : (d.orientation_score != null ? d.orientation_score : null),
        },
        test_date: r.created_at ? r.created_at.substring(0, 10) : null,
        paper_score: r.paper_score != null ? r.paper_score : null,
        paper_risk: r.paper_risk_level || r.paper_risk || null,
        app_percentile: r.app_percentile != null ? r.app_percentile : null,
        paper_percentile: r.paper_percentile != null ? r.paper_percentile : null
    };
}

function buildSinglePrompt(d) {
    const s = d.scores;
    const dur = d.duration_formatted || (d.duration_seconds != null
        ? (Math.floor(d.duration_seconds / 60) + ' นาที ' + (d.duration_seconds % 60) + ' วินาที')
        : 'ไม่มีข้อมูลเวลา');
    const paperInfo = d.paper_score != null
        ? '\n- คะแนนแบบกระดาษมาตรฐาน (MoCA): ' + d.paper_score + '/30 (' + (d.paper_risk || '-') + ')' + (d.paper_percentile != null ? ' | Percentile: P' + d.paper_percentile + '%' : '')
        : '';
    const appPercentileInfo = d.app_percentile != null ? (' | Percentile ในกลุ่ม: P' + d.app_percentile + '%') : '';

    return 'คุณเป็นนักประสาทจิตวิทยาและแพทย์ผู้เชี่ยวชาญด้านเวชศาสตร์ผู้สูงอายุ\n' +
'กรุณาวิเคราะห์ผลการทดสอบสมรรถภาพสมองรายบุคคล (De-identified) จากแอป Memory Garden ร่วมกับคะแนนมาตรฐาน MoCA ในภาษาไทยอย่างละเอียด\n\n' +
'## 👤 ข้อมูลผู้รับการทดสอบ\n' +
'- อายุ: ' + (d.age || 'ไม่ระบุ') + ' ปี\n' +
'- เพศ: ' + (d.gender || 'ไม่ระบุ') + '\n' +
'- ระดับการศึกษา: ' + (d.education || 'ไม่ระบุ') + '\n' +
'- โรคประจำตัว: ' + (d.disease || 'ไม่มี') + '\n' +
'- วันที่ทำแบบทดสอบ: ' + (d.test_date || 'ไม่ระบุ') + '\n' +
'- เวลาที่ใช้ในการทำ: ' + dur + '\n\n' +
'## 📊 ผลคะแนน Memory Garden ดิจิทัล\n' +
'- คะแนนรวม: ' + (d.total_score != null ? d.total_score : 'N/A') + '/30 (' + (d.risk_level || 'N/A') + ')' + appPercentileInfo + paperInfo + '\n' +
'- 🧠 ความจำระยะสั้น (Memory): ' + (s.memory != null ? s.memory : 'N/A') + '/5\n' +
'- 🕰️ มิติสัมพันธ์และการวางแผนนาฬิกา (Visuospatial/Clock): ' + (s.visuospatial != null ? s.visuospatial : 'N/A') + '/3' + (s.contour != null ? ' (Contour: ' + s.contour + ')' : '') + '\n' +
'- 🗣️ การบอกชื่อสิ่งของ (Naming): ' + (s.naming != null ? s.naming : 'N/A') + '/5\n' +
'- 💬 การพูดซ้ำประโยค (Sentence): ' + (s.sentence != null ? s.sentence : 'N/A') + '/2\n' +
'- ⚡ ความคล่องแคล่วทางภาษา (Fluency): ' + (s.fluency != null ? s.fluency : 'N/A') + ' / 4\n' +
'- 🧮 สมาธิและการคำนวณเงินทอน (Math & Attention): ' + (s.math != null ? s.math : 'N/A') + '/5\n' +
'- 🗺️ การรับรู้วันเวลาและสถานที่ (Orientation): ' + (s.orientation != null ? s.orientation : 'N/A') + '/6\n\n' +
'## 🎯 เกณฑ์มาตรฐาน: >=25 ปกติ | 18-24 เสี่ยงบกพร่องเล็กน้อย (MCI) | <18 ควรได้รับการดูแลพิเศษ\n\n' +
'กรุณาวิเคราะห์เป็น Markdown ภาษาไทย จัดหัวข้อน่าอ่าน: \n' +
'1. **สรุปสถานะการทำงานของสมองภาพรวม**\n' +
'2. **วิเคราะห์จุดแข็ง (Cognitive Strengths)**\n' +
'3. **วิเคราะห์มิติที่ต้องระวัง (Areas of Concern)**\n' +
'4. **การแปลผลเวลาที่ใช้ (Speed & Efficiency)**\n' +
'5. **การเปรียบเทียบกับคะแนนมาตรฐานกระดาษ (ถ้ามี)**\n' +
'6. **แผนการดูแลและกิจกรรมกระตุ้นสมองเฉพาะบุคคล**\n' +
'7. **ข้อพิจารณาทางการแพทย์ & ข้อจำกัดของการคัดกรองเบื้องต้น**';
}

function buildGroupPrompt(records) {
    const n = records.length;
    if (n === 0) return null;
    const scores = records.map(function(r) { return r.total_score; }).filter(function(v) { return v != null; });
    const avgScore = scores.length ? (scores.reduce(function(a,b){return a+b;},0)/scores.length).toFixed(1) : 'N/A';
    
    // คำนวณ Standard Deviation และ Median
    let scoreStd = 'N/A';
    let scoreMedian = 'N/A';
    if (scores.length > 0) {
        const sorted = [...scores].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        scoreMedian = sorted.length % 2 !== 0 ? sorted[mid] : ((sorted[mid - 1] + sorted[mid]) / 2).toFixed(1);
        const mean = parseFloat(avgScore);
        const variance = scores.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / scores.length;
        scoreStd = Math.sqrt(variance).toFixed(2);
    }

    const durRecs = records.filter(function(r){ return r.duration_seconds != null; });
    const avgDurSec = durRecs.length ? Math.round(durRecs.reduce(function(s,r){return s+r.duration_seconds;},0)/durRecs.length) : null;
    const avgDurStr = avgDurSec != null ? (Math.floor(avgDurSec/60)+' นาที '+(avgDurSec%60)+' วินาที') : (currentComputedStats.avgDurationStr || 'ไม่มีข้อมูล');

    const riskCount = {};
    records.forEach(function(r){ const k = r.risk_level || 'ไม่ระบุ'; riskCount[k] = (riskCount[k]||0)+1; });
    const riskLines = Object.keys(riskCount).map(function(k){ return '- '+k+': '+riskCount[k]+' คน ('+Math.round(riskCount[k]/n*100)+'%)'; }).join('\n');
    
    const getAvg = function(key) {
        const vals = records.map(function(r){ return r.scores && r.scores[key] != null ? r.scores[key] : null; }).filter(function(v){ return v!=null; });
        return vals.length ? (vals.reduce(function(a,b){return a+b;},0)/vals.length).toFixed(1) : 'N/A';
    };

    // ดึงค่าสถิติและการคำนวณทางการแพทย์
    const cs = currentComputedStats || {};
    const rsStr = cs.spearmanRs != null ? cs.spearmanRs.toFixed(2) : 'N/A';
    const sensStr = cs.sensitivity != null ? (cs.sensitivity * 100).toFixed(1) + '%' : 'N/A';
    const specStr = cs.specificity != null ? (cs.specificity * 100).toFixed(1) + '%' : 'N/A';
    const aucStr = cs.auc != null ? cs.auc.toFixed(3) : 'N/A';
    const accStr = cs.diagnosticAccuracy != null ? cs.diagnosticAccuracy.toFixed(1) + '%' : 'N/A';
    const maeStr = cs.maePct != null ? cs.maePct.toFixed(1) + '%' : 'N/A';
    const optCutoffStr = cs.optCutoff != null ? ('< ' + cs.optCutoff + '/30') : 'N/A';
    const paperN = cs.paperCount || 0;
    const paperPctStr = cs.paperPct != null ? (cs.paperPct + '%') : '0%';

    return 'คุณเป็นนักระบาดวิทยา ผู้เชี่ยวชาญด้านประสาทจิตวิทยา และนักสถิติทางการแพทย์ชาวไทย\n' +
'กรุณาวิเคราะห์ข้อมูลสุขภาพสมองและประสิทธิภาพของเครื่องมือคัดกรอง "Memory Garden" ของกลุ่มผู้สูงอายุ โดยใช้ทั้ง **ข้อมูลสถิติที่คำนวณได้ทั้งหมด** และ **ข้อมูลการกระจายตัวของกราฟต่างๆ**\n\n' +
'## 📊 1. ข้อมูลสถิติเชิงคำนวณและตัวชี้วัดความแม่นยำ (Calculated Medical & Statistical Metrics)\n' +
'- จำนวนกลุ่มตัวอย่างทั้งหมด (N): ' + n + ' คน\n' +
'- จำนวนผู้ได้รับการตรวจคู่ขนานด้วยแบบประเมินกระดาษ MoCA มาตรฐาน: ' + paperN + ' คน (' + paperPctStr + ' ของกลุ่มตัวอย่าง)\n' +
'- คะแนนเฉลี่ยแอป: ' + avgScore + ' / 30 (ค่ามัธยฐาน Median: ' + scoreMedian + ', ค่าเบี่ยงเบนมาตรฐาน SD: ' + scoreStd + ')\n' +
'- เวลาเฉลี่ยในการทำแบบประเมิน: ' + avgDurStr + '\n' +
'- ค่าสัมประสิทธิ์สหสัมพันธ์เชิงลำดับยศ Spearman (r_s): ' + rsStr + ' (วัดความสอดคล้องกับ MoCA กระดาษ)\n' +
'- ความแม่นยำในการจำแนกโรค Diagnostic Accuracy: ' + accStr + ' ((TP + TN) / N)\n' +
'- ความไวในการคัดกรอง Sensitivity (True Positive Rate ต่อ MCI): ' + sensStr + '\n' +
'- ความจำเพาะ Specificity (True Negative Rate ไม่ชี้คนปกติผิด): ' + specStr + '\n' +
'- พื้นที่ใต้กราฟ ROC (AUC-ROC): ' + aucStr + ' (เกณฑ์: >0.8 ดี, >0.9 ดีเยี่ยม)\n' +
'- คะแนนตัดจุดที่เหมาะสมที่สุด (Optimal Cutoff via Youden Index): ' + optCutoffStr + '\n' +
'- ผลต่างเฉลี่ยสัมบูรณ์ Normalized Score MAE: ' + maeStr + ' (|%App - %Paper|)\n\n' +
'## 📈 2. ข้อมูลการกระจายตัวและกราฟการประเมิน (Graph & Distribution Data)\n' +
'1. **กราฟการกระจายระดับความเสี่ยง (Risk Distribution)**:\n' + riskLines + '\n' +
'2. **คะแนนเฉลี่ยแยก 5 มิติ (Cognitive Domains Breakdown)**:\n' +
'   - 🧠 ความจำระยะสั้น (Memory): ' + getAvg('memory') + ' / 5\n' +
'   - 🕰️ มิติสัมพันธ์และการวางแผน (Visuospatial/Clock): ' + getAvg('visuospatial') + ' / 3\n' +
'   - 🗣️ การเรียกชื่อสิ่งของ (Naming): ' + getAvg('naming') + ' / 5\n' +
'   - 💬 การพูดซ้ำประโยค (Sentence): ' + getAvg('sentence') + ' / 2\n' +
'   - ⚡ ความคล่องแคล่วทางภาษา (Fluency): ' + getAvg('fluency') + ' / 4\n' +
'   - 🧮 สมาธิและการคิดคำนวณ (Math & Attention): ' + getAvg('math') + ' / 5\n' +
'   - 🗺️ การรับรู้วันเวลาและสถานที่ (Orientation): ' + getAvg('orientation') + ' / 6\n' +
'3. **กราฟ Scatter Plot (ความสัมพันธ์ Percentile Rank App vs Paper)**: แสดงความสอดคล้องเชิงลำดับยศตามค่า r_s = ' + rsStr + '\n' +
'4. **กราฟ ROC Curve**: วิเคราะห์ความสามารถในการแยกแยะระหว่างผู้สูงอายุภาวะปกติและภาวะ MCI\n\n' +
'## 📝 โครงสร้างรายงานการวิเคราะห์ที่ต้องการ (เป็น Markdown ภาษาไทยอย่างมืออาชีพ):\n' +
'### 🏛️ 1. บทสรุปสถานการณ์สุขภาพสมองของกลุ่มตัวอย่าง (Epidemiological Overview)\n' +
'### 🔬 2. การแปลผลข้อมูลสถิติที่คำนวณได้และความเที่ยงตรงเชิงคลินิก (Clinical Validity & Diagnostic Metrics Interpretation)\n' +
'(วิเคราะห์เชิงลึกเรื่อง Sensitivity, Specificity, AUC, r_s, Optimal Cutoff และเวลาเฉลี่ย)\n' +
'### 📊 3. การวิเคราะห์ข้อมูลจากกราฟและรูปแบบคะแนนรายมิติ (Graph Insights & Cognitive Domain Patterns)\n' +
'(ชี้ให้เห็นมิติที่กลุ่มทำได้ดี และมิติที่มีความเสี่ยงถดถอยมากที่สุด เช่น ความจำ หรือ มิติสัมพันธ์)\n' +
'### 💡 4. ข้อเสนอแนะเชิงกิจกรรมและการดูแลในระดับชุมชน/องค์กร (Community Intervention & Cognitive Activities)\n' +
'### 📋 5. ข้อเสนอแนะเชิงนโยบายและการติดตามผล (Policy & Monitoring Recommendations)\n' +
'### ⚠️ 6. ข้อจำกัดของเครื่องมือและข้อควรระวัง (Limitations & Ethical Considerations)';
}

async function callGeminiAPI(prompt) {
    const apiKey = localStorage.getItem('mg_gemini_api_key');
    if (!apiKey) throw new Error('ยังไม่ได้ตั้งค่า API Key');
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=' + apiKey;
    const body = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 2500 }
    };
    const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (!resp.ok) {
        const err = await resp.json().catch(function(){ return {}; });
        throw new Error((err.error && err.error.message) ? err.error.message : 'HTTP ' + resp.status);
    }
    const data = await resp.json();
    return (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text) ? data.candidates[0].content.parts[0].text : 'ไม่ได้รับผลลัพธ์';
}

function renderMarkdown(md) {
    if (!md) return '<p>(ไม่มีข้อมูล)</p>';
    // Normalize line endings
    md = md.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    // Split into lines and process each
    var lines = md.split('\n');
    var html = [];
    var inList = false;
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        // Bold text
        line = line.replace(/\*\*(.+?)\*\*/g, '<strong>\</strong>');
        // Italic
        line = line.replace(/\*(.+?)\*/g, '<em>\</em>');
        if (/^### (.+)/.test(line)) {
            if (inList) { html.push('</ul>'); inList = false; }
            html.push('<h3>' + line.replace(/^### /, '') + '</h3>');
        } else if (/^## (.+)/.test(line)) {
            if (inList) { html.push('</ul>'); inList = false; }
            html.push('<h2>' + line.replace(/^## /, '') + '</h2>');
        } else if (/^# (.+)/.test(line)) {
            if (inList) { html.push('</ul>'); inList = false; }
            html.push('<h1>' + line.replace(/^# /, '') + '</h1>');
        } else if (/^[-*] (.+)/.test(line)) {
            if (!inList) { html.push('<ul>'); inList = true; }
            html.push('<li>' + line.replace(/^[-*] /, '') + '</li>');
        } else if (/^\d+\. (.+)/.test(line)) {
            if (!inList) { html.push('<ul>'); inList = true; }
            html.push('<li>' + line.replace(/^\d+\. /, '') + '</li>');
        } else if (line.trim() === '') {
            if (inList) { html.push('</ul>'); inList = false; }
            html.push('');
        } else {
            if (inList) { html.push('</ul>'); inList = false; }
            html.push('<p>' + line + '</p>');
        }
    }
    if (inList) html.push('</ul>');
    return html.join('\n');
}

async function runSingleAnalysis() {
    const selEl = document.getElementById('ai-single-select');
    const idx = selEl ? selEl.value : '';
    console.log('[AI] runSingleAnalysis called, idx=', idx, 'rawTestResults count=', rawTestResults ? rawTestResults.length : 'null');
    if (idx === '' || idx == null) { showToast('กรุณาเลือกผู้ทดสอบก่อน', 'error'); return; }
    const record = rawTestResults[parseInt(idx)];
    if (!record) { showToast('ไม่พบข้อมูล', 'error'); return; }
    const loadingEl = document.getElementById('ai-loading');
    if (loadingEl) loadingEl.style.display = 'flex';
    document.querySelectorAll('.btn-analyze').forEach(function(b){ b.disabled = true; });
    try {
        const deidentified = deidentifyRecord(record);
        console.log('[AI] Deidentified:', JSON.stringify(deidentified).substring(0, 100));
        const prompt = buildSinglePrompt(deidentified);
        console.log('[AI] Calling Gemini API...');
        const result = await callGeminiAPI(prompt);
        console.log('[AI] Got result length:', result ? result.length : 0);
        showAiResult('ผลวิเคราะห์รายบุคคล (ข้อมูล De-identified)', result);
    } catch (e) {
        console.error('[AI] Error:', e);
        alert('AI Error: ' + e.message);
        showToast('Error: ' + e.message, 'error');
    } finally {
        if (loadingEl) loadingEl.style.display = 'none';
        document.querySelectorAll('.btn-analyze').forEach(function(b){ b.disabled = false; });
    }
}

async function runGroupAnalysis() {
    if (!rawTestResults || rawTestResults.length === 0) { showToast('ยังไม่มีข้อมูล', 'error'); return; }
    setAiLoading(true);
    try {
        const deidentifiedAll = rawTestResults.map(function(r){ return deidentifyRecord(r); });
        const prompt = buildGroupPrompt(deidentifiedAll);
        if (!prompt) { showToast('ข้อมูลไม่เพียงพอ', 'error'); setAiLoading(false); return; }
        const result = await callGeminiAPI(prompt);
        showAiResult('ผลวิเคราะห์ภาพรวมกลุ่ม ' + rawTestResults.length + ' คน', result);
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    } finally {
        setAiLoading(false);
    }
}

function setAiLoading(on) {
    const loading = document.getElementById('ai-loading');
    const result = document.getElementById('ai-result-container');
    if (loading) loading.style.display = on ? 'flex' : 'none';
    if (result) result.style.display = on ? 'none' : 'block';
    document.querySelectorAll('.btn-analyze').forEach(function(b){ b.disabled = on; });
}

function showAiResult(title, markdown) {
    const titleEl = document.getElementById('ai-result-title');
    const bodyEl = document.getElementById('ai-result-body');
    const container = document.getElementById('ai-result-container');
    if (titleEl) titleEl.textContent = title;
    if (bodyEl) bodyEl.innerHTML = renderMarkdown(markdown);
    if (container) { container.style.display = 'block'; container.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
}

function copyAiResult() {
    const body = document.getElementById('ai-result-body');
    const text = body ? body.innerText : '';
    navigator.clipboard.writeText(text).then(function(){ showToast('คัดลอกผลการวิเคราะห์แล้ว', 'success'); });
}

function printAiResult() {
    var titleEl = document.getElementById('ai-result-title');
    var bodyEl  = document.getElementById('ai-result-body');
    var title   = titleEl ? titleEl.textContent : 'AI Analysis';
    var body    = bodyEl  ? bodyEl.innerHTML    : '';
    var now     = new Date().toLocaleDateString('th-TH', { year:'numeric', month:'long', day:'numeric' });

    var win = window.open('', '_blank');
    if (!win) { showToast('กรุณาอนุญาต Pop-up ในเบราว์เซอร์', 'error'); return; }

    var css = [
        '<meta charset="UTF-8">',
        '<link href="https://fonts.googleapis.com/css2?family=Prompt:wght@400;600;700&display=swap" rel="stylesheet">',
        '<style>',
        '* { box-sizing: border-box; }',
        'body { font-family: Prompt, Sarabun, sans-serif; background: #fff; color: #2c3e50; line-height: 1.8; }',
        '.pdf-page { max-width: 760px; margin: 0 auto; padding: 40px 32px; }',
        '.pdf-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #4a5d23; padding-bottom: 14px; margin-bottom: 24px; }',
        '.pdf-logo { font-size: 1.3rem; font-weight: 800; color: #4a5d23; }',
        '.pdf-meta { text-align: right; font-size: 0.78rem; color: #888; }',
        '.pdf-title { font-size: 1.4rem; font-weight: 700; color: #4a5d23; margin-bottom: 4px; }',
        '.pdf-subtitle { font-size: 0.88rem; color: #777; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px dashed #ddd; }',
        '.pdf-badge { display: inline-block; background: #e8f5e9; color: #2e7d32; border: 1px solid #a5d6a7; border-radius: 20px; padding: 4px 14px; font-size: 0.78rem; font-weight: 600; margin-bottom: 18px; }',
        'h1, h2 { color: #4a5d23; border-bottom: 1px solid #c8d8a0; padding-bottom: 5px; margin: 20px 0 8px; }',
        'h3 { color: #5a7030; margin: 16px 0 6px; }',
        'p { margin-bottom: 10px; font-size: 0.93rem; }',
        'ul, ol { padding-left: 20px; margin-bottom: 10px; }',
        'li { margin-bottom: 4px; font-size: 0.93rem; }',
        'strong { color: #4a5d23; }',
        '.pdf-disclaimer { background: #fff8e1; border: 1px solid #ffe082; border-radius: 8px; padding: 14px 18px; margin-top: 28px; font-size: 0.8rem; color: #795548; }',
        '.pdf-footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #eee; font-size: 0.75rem; color: #aaa; text-align: center; }',
        '@media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }',
        '</style>'
    ].join('\n');

    var htmlContent = [
        '<!DOCTYPE html><html lang="th"><head>', css, '</head><body>',
        '<div class="pdf-page">',
        '<div class="pdf-header">',
        '<div class="pdf-logo">&#x1F333; Memory Garden</div>',
        '<div class="pdf-meta">ผลการวิเคราะห์ AI<br>' + now + '</div>',
        '</div>',
        '<div class="pdf-title">' + title + '</div>',
        '<div class="pdf-subtitle">ผลการประเมินโดย Gemini AI | Memory Garden</div>',
        '<div class="pdf-badge">&#x1F512; PDPA — ข้อมูล De-identified</div>',
        '<div>' + body + '</div>',
        '<div class="pdf-disclaimer">',
        '<strong>&#x26A0; ข้อควรระวัง:</strong> ผลนี้ผลิตโดย AI เพื่อสนับสนุนเบื้องต้นเท่านั้น ',
        '<strong>ไม่ใช่การวินิจฉัยโรค</strong> กรุณาปรึกษาแพทย์เสมอ',
        '</div>',
        '<div class="pdf-footer">Memory Garden &copy; 2025-2026</div>',
        '</div>',
        '<script>setTimeout(function(){ window.print(); }, 600);<\/script>',
        '</body></html>'
    ].join('');

    win.document.write(htmlContent);
    win.document.close();
}

function triggerSpecificGraphAnalysis(graphType) {
    const sel = document.getElementById('ai-graph-type-select');
    if (sel) sel.value = graphType;

    const tabs = document.querySelectorAll('.ai-tab');
    if (tabs && tabs[2]) {
        switchAiMode('graph', tabs[2]);
    }

    const aiSection = document.querySelector('.ai-analysis-section');
    if (aiSection) {
        aiSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // เรียกวิเคราะห์ทันที
    setTimeout(() => {
        runGraphAnalysis(graphType);
    }, 400);
}

function buildGraphAnalysisPrompt(graphType = 'all') {
    const paperRecords = (rawTestResults || []).filter(r => r.paper_score !== null && r.paper_score !== undefined);
    const N_total = (rawTestResults || []).length;
    const N_paper = paperRecords.length;
    const cs = currentComputedStats || {};

    if (N_paper === 0 && graphType !== 'curve') {
        return null;
    }

    // 1. สกัดข้อมูล Scatter Plot
    const scatterPoints = paperRecords.map(r => {
        const appP = r.app_percentile_ingroup !== undefined ? r.app_percentile_ingroup : (r.app_percentile || 0);
        const paperP = r.paper_percentile || 0;
        return {
            name: r.name || 'Anonymous',
            appScore: r.total_score || 0,
            paperScore: r.paper_score,
            appP: appP,
            paperP: paperP,
            diffP: Math.round(Math.abs(appP - paperP) * 10) / 10
        };
    });

    const highConcordanceCount = scatterPoints.filter(p => p.diffP <= 10).length;
    const appHigherCount = scatterPoints.filter(p => p.appP > p.paperP + 10).length;
    const paperHigherCount = scatterPoints.filter(p => p.paperP > p.appP + 10).length;

    // 2. สกัดข้อมูล Cumulative Curve
    const appScoresSorted = [...(rawTestResults || [])].map(r => r.total_score || 0).sort((a, b) => a - b);
    const paperScoresSorted = paperRecords.map(r => r.paper_score).sort((a, b) => a - b);
    
    const appMedian = appScoresSorted.length ? appScoresSorted[Math.floor(appScoresSorted.length / 2)] : 0;
    const paperMedian = paperScoresSorted.length ? paperScoresSorted[Math.floor(paperScoresSorted.length / 2)] : 0;

    // 3. สกัดข้อมูล ROC Curve
    let rocPointsData = [];
    let bestCutoff = cs.optCutoff || 25;
    let sensitivity = cs.sensitivity != null ? (cs.sensitivity * 100).toFixed(1) + '%' : 'N/A';
    let specificity = cs.specificity != null ? (cs.specificity * 100).toFixed(1) + '%' : 'N/A';
    let aucValue = cs.auc != null ? cs.auc.toFixed(3) : 'N/A';

    if (N_paper > 0) {
        const { rocPoints } = computeAUCROC(paperRecords, 25);
        rocPointsData = rocPoints.map(p => ({
            cutoff: p.cutoff,
            fpr: Math.round(p.fpr * 1000) / 1000,
            tpr: Math.round(p.tpr * 1000) / 1000,
            sensitivity: Math.round(p.tpr * 100) + '%',
            specificity: Math.round((1 - p.fpr) * 100) + '%'
        }));
    }

    let prompt = 'คุณเป็นนักสถิติชีวเวชศาสตร์ (Biostatistician) และผู้เชี่ยวชาญด้านประสาทจิตวิทยาคลินิก\n' +
        'กรุณาวิเคราะห์และแปลผลทางสถิติการแพทย์เชิงลึกจากข้อมูลกราฟของระบบประเมิน Memory Garden (ดิจิทัล) เปรียบเทียบกับแบบทดสอบกระดาษมาตรฐาน MoCA\n\n';

    if (graphType === 'scatter' || graphType === 'all') {
        prompt += '### 📈 ข้อมูลกราฟที่ 1: Percentile Rank Scatter Plot (Paper vs App)\n' +
            '- ค่าสัมประสิทธิ์สหสัมพันธ์เชิงลำดับยศ Spearman (r_s): ' + (cs.spearmanRs != null ? cs.spearmanRs.toFixed(2) : 'N/A') + '\n' +
            '- จำนวนจุดข้อมูลเปรียบเทียบคู่ขนาน: ' + N_paper + ' จุด (จากประชากรทั้งหมด ' + N_total + ' คน)\n' +
            '- ความสอดคล้องระดับสูง (|Δ Percentile| ≤ 10%): ' + highConcordanceCount + ' คน (' + (N_paper ? Math.round(highConcordanceCount/N_paper*100) : 0) + '%)\n' +
            '- จุดที่คะแนนแอปสูงกว่ากระดาษเกิน 10%: ' + appHigherCount + ' คน\n' +
            '- จุดที่คะแนนกระดาษสูงกว่าแอปเกิน 10%: ' + paperHigherCount + ' คน\n' +
            '- ค่าเฉลี่ยผลต่างสัมบูรณ์ Normalized Score MAE: ' + (cs.maePct != null ? cs.maePct.toFixed(1) + '%' : 'N/A') + '\n\n';
    }

    if (graphType === 'curve' || graphType === 'all') {
        prompt += '### 📊 ข้อมูลกราฟที่ 2: Cumulative Distribution Curve (เส้นโค้งเปอร์เซ็นไทล์สะสม)\n' +
            '- คะแนนมัธยฐานแอป (Median App Score): ' + appMedian + ' / 30 คะแนน\n' +
            '- คะแนนมัธยฐานกระดาษ MoCA (Median Paper Score): ' + paperMedian + ' / 30 คะแนน\n' +
            '- สัดส่วนผู้ที่ได้คะแนนในโซนปกติ (≥ 25): ' + (appScoresSorted.length ? Math.round(appScoresSorted.filter(s => s >= 25).length / appScoresSorted.length * 100) : 0) + '% (แอป) vs ' + (paperScoresSorted.length ? Math.round(paperScoresSorted.filter(s => s >= 25).length / paperScoresSorted.length * 100) : 0) + '% (กระดาษ)\n' +
            '- สัดส่วนผู้ที่ได้คะแนนในโซนเสี่ยง MCI (18-24): ' + (appScoresSorted.length ? Math.round(appScoresSorted.filter(s => s >= 18 && s < 25).length / appScoresSorted.length * 100) : 0) + '%\n' +
            '- สัดส่วนผู้ที่ได้คะแนนในโซนควรดูแลพิเศษ (< 18): ' + (appScoresSorted.length ? Math.round(appScoresSorted.filter(s => s < 18).length / appScoresSorted.length * 100) : 0) + '%\n\n';
    }

    if (graphType === 'roc' || graphType === 'all') {
        prompt += '### 🎯 ข้อมูลกราฟที่ 3: ROC Curve & Diagnostic Power Analysis\n' +
            '- พื้นที่ใต้เส้นโค้ง ROC (AUC-ROC): ' + aucValue + ' (เกณฑ์: >0.8 = ดี, >0.9 = ยอดเยี่ยม)\n' +
            '- คะแนนจุดตัดที่เหมาะสมที่สุด (Optimal Cutoff by Youden Index): < ' + bestCutoff + ' / 30 คะแนน\n' +
            '- ความไว Sensitivity (True Positive Rate ต่อภาวะ MCI): ' + sensitivity + '\n' +
            '- ความจำเพาะ Specificity (True Negative Rate ต่อภาวะปกติ): ' + specificity + '\n' +
            '- ความแม่นยำรวม Diagnostic Accuracy: ' + (cs.diagnosticAccuracy != null ? cs.diagnosticAccuracy.toFixed(1) + '%' : 'N/A') + '\n' +
            '- พิกัดจุดตัดที่สำคัญบน ROC Curve:\n' +
            rocPointsData.slice(0, 7).map(p => '   * Cutoff < ' + p.cutoff + ': TPR (Sens) = ' + p.tpr + ', FPR (1-Spec) = ' + p.fpr + ' (Spec = ' + p.specificity + ')').join('\n') + '\n\n';
    }

    prompt += '## 📝 โครงสร้างการวิเคราะห์ผลจากกราฟที่ต้องการ (Markdown ภาษาไทยอย่างเป็นทางการ):\n' +
        '### 🔍 1. การแปลผลเชิงภาพและพฤติกรรมของกราฟ (Visual & Trend Interpretation)\n' +
        '(อธิบายลักษณะการเกาะกลุ่มของจุด ความชัน เส้นโค้ง และความเบี่ยงเบนจากเส้นทแยงมุมหรือเส้นอ้างอิง)\n\n' +
        '### 📐 2. ความเที่ยงตรงและความสอดคล้องในการวัด (Measurement Reliability & Concordance)\n' +
        '(วิเคราะห์ว่าผลจากแอปดิจิทัลสะท้อนคะแนนกระดาษมาตรฐาน MoCA ได้แม่นยำเพียงใด มี Outlier หรือ Bias หรือไม่)\n\n' +
        '### 🎯 3. การประเมินประสิทธิภาพการคัดกรองทางคลินิก (Clinical Screening Efficacy)\n' +
        '(วิเคราะห์ค่า AUC, Sensitivity, Specificity และจุดตัด Cutoff ที่เหมาะสมที่สุดในการนำไปใช้คัดกรองจริงในชุมชน)\n\n' +
        '### 💡 4. ข้อสรุปและคำแนะนำสำหรับทีมวิจัย / ผู้ดูแลระบบ (Actionable Insights & Recommendations)\n' +
        '(คำแนะนำในการปรับปรุงเกณฑ์คะแนน หรือการนำกราฟไปนำเสนอในงานวิจัย/นโยบายสาธารณสุข)';

    return prompt;
}

async function runGraphAnalysis(forcedType) {
    const sel = document.getElementById('ai-graph-type-select');
    const graphType = forcedType || (sel ? sel.value : 'all');
    
    const paperRecords = (rawTestResults || []).filter(r => r.paper_score !== null && r.paper_score !== undefined);
    if (paperRecords.length === 0 && graphType !== 'curve') {
        showToast('กรุณาบันทึกคะแนนกระดาษอย่างน้อย 1 รายการเพื่อวิเคราะห์กราฟ', 'error');
        return;
    }

    setAiLoading(true);
    try {
        const prompt = buildGraphAnalysisPrompt(graphType);
        if (!prompt) {
            showToast('ข้อมูลกราฟไม่เพียงพอสำหรับการวิเคราะห์', 'error');
            setAiLoading(false);
            return;
        }

        const graphNameMap = {
            'all': 'วิเคราะห์กราฟทั้งหมดรวมกัน (Comprehensive Graph Analysis)',
            'scatter': 'วิเคราะห์กราฟ Scatter Plot (Rank Correlation)',
            'curve': 'วิเคราะห์กราฟ Cumulative Distribution Curve',
            'roc': 'วิเคราะห์กราฟ ROC Curve & Diagnostic Power'
        };

        const result = await callGeminiAPI(prompt);
        showAiResult('ผลการวิเคราะห์จากกราฟ: ' + (graphNameMap[graphType] || 'Graph AI Analysis'), result);
    } catch (e) {
        console.error('[Graph AI Error]:', e);
        showToast('Error: ' + e.message, 'error');
    } finally {
        setAiLoading(false);
    }
}
