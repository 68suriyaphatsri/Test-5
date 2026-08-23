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
        const best = findOptimalCutoff(paperRecords, 26);
        optCutoff = best.cutoff;
        sensitivity = best.sens;
        specificity = best.spec;
        diagnosticAccuracy = best.accuracy;

        const aucResult = computeAUCROC(paperRecords, 26);
        auc = aucResult.auc;
    }

    const paperCount = N_paper;
    const paperPct = N > 0 ? Math.round((paperCount / N) * 100) : 0;

    renderMetrics(N, paperCount, paperPct, spearmanRs, maePct, sensitivity, specificity, auc, optCutoff, diagnosticAccuracy);
    renderCharts(rawTestResults, paperRecords);
    renderTable(rawTestResults);
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
function computeSensSpec(records, appCutoff, paperCutoff = 26) {
    let TP = 0, FP = 0, TN = 0, FN = 0;
    records.forEach(r => {
        const appPos = (r.total_score || 0) < appCutoff;  // แอปบอกว่าเป็น MCI
        const paperPos = r.paper_score < paperCutoff;     // กระดาษบอกว่าเป็น MCI
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
function findOptimalCutoff(records, paperCutoff = 26) {
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
function computeAUCROC(records, paperCutoff = 26) {
    const points = [];
    for (let c = 0; c <= 30; c++) {
        const { sensitivity, specificity } = computeSensSpec(records, c, paperCutoff);
        points.push({ fpr: 1 - specificity, tpr: sensitivity, cutoff: c });
    }
    // เรียงตาม FPR จากน้อยไปหามาก
    points.sort((a, b) => a.fpr - b.fpr || a.tpr - b.tpr);
    // เพิ่ม (0,0) และ (1,1) ถ้ายังไม่มี
    if (!points.find(p => p.fpr === 0 && p.tpr === 0)) points.unshift({ fpr: 0, tpr: 0 });
    if (!points.find(p => p.fpr === 1 && p.tpr === 1)) points.push({ fpr: 1, tpr: 1 });

    let auc = 0;
    for (let i = 1; i < points.length; i++) {
        const dx = points[i].fpr - points[i - 1].fpr;
        const avgY = (points[i].tpr + points[i - 1].tpr) / 2;
        auc += dx * avgY;
    }
    return { auc: Math.max(0, Math.min(1, auc)), rocPoints: points };
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
                            return `${p.name}: แอป P${p.x} vs กระดาษ P${p.y}`;
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
            const { rocPoints } = computeAUCROC(paperRecords, 26);
            const rocData = rocPoints.map(p => ({
                x: parseFloat(p.fpr.toFixed(4)),
                y: parseFloat(p.tpr.toFixed(4))
            }));

            rocChartInstance = new Chart(rocCtx.getContext("2d"), {
                type: "scatter",
                data: {
                    datasets: [
                        {
                            label: "ROC Curve (App vs MoCA < 26)",
                            data: rocData,
                            borderColor: "#7b5ea7",
                            backgroundColor: "rgba(123, 94, 167, 0.12)",
                            showLine: true, fill: true, tension: 0.2,
                            pointRadius: 4, pointHoverRadius: 7
                        },
                        {
                            label: "\u0e40\u0e2a\u0e49\u0e19\u0e2a\u0e38\u0e48\u0e21 (Random Classifier)",
                            data: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
                            borderColor: "rgba(180,180,180,0.6)",
                            borderDash: [6, 4],
                            pointRadius: 0,
                            showLine: true, fill: false
                        }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    scales: {
                        x: { type: "linear", min: 0, max: 1, title: { display: true, text: "1 - Specificity (False Positive Rate)" } },
                        y: { min: 0, max: 1, title: { display: true, text: "Sensitivity (True Positive Rate)" } }
                    },
                    plugins: {
                        tooltip: {
                            callbacks: {
                                label: (ctx) => {
                                    const p = ctx.raw;
                                    return `FPR: ${(p.x * 100).toFixed(1)}%, TPR: ${(p.y * 100).toFixed(1)}%`;
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
        tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:30px; color:#888;">ไม่พบข้อมูลผลการทดสอบ</td></tr>`;
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

        const appScore = record.total_score !== undefined ? `${record.total_score} / 30` : "-";
        const appP = record.app_percentile !== undefined ? `P<sub>${record.app_percentile}%</sub>` : "-";
        const paperScore = record.paper_score !== null && record.paper_score !== undefined ? `${record.paper_score} / 30` : `<span style='color:#bbb;'>ยังไม่ลงคะแนน</span>`;
        const paperP = record.paper_percentile !== undefined && record.paper_score !== null ? `P<sub>${record.paper_percentile}%</sub>` : "-";
        const compareP = record.app_percentile_ingroup !== undefined && record.paper_score !== null
            ? `P<sub>${record.app_percentile_ingroup}%</sub>`
            : appP;
        const normDiff = record.norm_score_diff !== undefined && record.paper_score !== null ? `|Δ| ${record.norm_score_diff}%` : "-";

        tr.innerHTML = `
            <td>${dateStr}</td>
            <td><strong>${record.name || "ไม่ระบุชื่อ"}</strong><br><span style="font-size:0.78rem;color:#888;">ID: ${record.user_id}</span></td>
            <td>${record.age || "-"}</td>
            <td><strong style="color:#4a5d23;">${appScore}</strong></td>
            <td>${appP}</td>
            <td>${paperScore}</td>
            <td>${paperP}</td>
            <td title="เปรียบเทียบ app (ในกลุ่ม) vs กระดาษ">${compareP} → ${paperP}</td>
            <td style="color:#2e7d32;"><strong>${normDiff}</strong></td>
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
}

function closeEditModal() {
    document.getElementById("edit-modal").style.display = "none";
    activeEditResult = null;
}

async function handleEditSubmit(e) {
    e.preventDefault();
    if (!activeEditResult) return;

    const submitBtn = e.target.querySelector("button[type='submit']");
    const originalText = submitBtn.textContent;
    submitBtn.textContent = "กำลังบันทึก...";
    submitBtn.disabled = true;

    const paperScoreVal = document.getElementById("edit-paper-score").value;
    const updatedData = {
        name: document.getElementById("edit-name").value.trim() || null,
        age: parseInt(document.getElementById("edit-age").value) || null,
        gender: document.getElementById("edit-gender").value,
        education: document.getElementById("edit-education").value,
        disease: document.getElementById("edit-disease").value.trim() || null,
        total_score: parseInt(document.getElementById("edit-total-score").value),
        risk_level: document.getElementById("edit-risk-level").value,
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
