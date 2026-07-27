// =====================================================
// Admin Dashboard Logic & Percentile Analytics Engine
// Username: Sunnysun | Password: Sunny13082552
// =====================================================

const ADMIN_USER = "Sunnysun";
const ADMIN_PASS = "Sunny13082552";

let rawTestResults = [];
let scatterChartInstance = null;
let curveChartInstance = null;
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
// Formula: Percentile Rank = ((B + 0.5 * E) / N) * 100
function computePercentilesAndStats() {
    if (!rawTestResults || rawTestResults.length === 0) {
        renderMetrics(0, 0, 0, 0);
        renderTable([]);
        return;
    }

    const N = rawTestResults.length;

    // 1. Calculate App Percentiles — using ALL records as reference group
    rawTestResults.forEach((record) => {
        const appScore = record.total_score || 0;
        const B = rawTestResults.filter((r) => (r.total_score || 0) < appScore).length;
        const E = rawTestResults.filter((r) => (r.total_score || 0) === appScore).length;
        record.app_percentile = Math.round(((B + 0.5 * E) / N) * 100 * 10) / 10;
    });

    // 2. Filter records that have paper scores
    const paperRecords = rawTestResults.filter((r) => r.paper_score !== null && r.paper_score !== undefined);
    const N_paper = paperRecords.length;

    if (N_paper > 0) {
        // คำนวณ paper_percentile เทียบกับกลุ่มเดียวกัน (paperRecords)
        paperRecords.forEach((record) => {
            const paperScore = record.paper_score;
            const B = paperRecords.filter((r) => r.paper_score < paperScore).length;
            const E = paperRecords.filter((r) => r.paper_score === paperScore).length;
            record.paper_percentile = Math.round(((B + 0.5 * E) / N_paper) * 100 * 10) / 10;

            // คำนวณ app_percentile เทียบกับกลุ่มเดียวกัน (paperRecords) เพื่อให้ยุติธรรม
            const appScore = record.total_score || 0;
            const Bapp = paperRecords.filter((r) => (r.total_score || 0) < appScore).length;
            const Eapp = paperRecords.filter((r) => (r.total_score || 0) === appScore).length;
            record.app_percentile_ingroup = Math.round(((Bapp + 0.5 * Eapp) / N_paper) * 100 * 10) / 10;

            // Accuracy: ใช้สัดส่วนความใกล้เคียง (1 - diff/100), ยิ่งใกล้กัน = ยิ่งแม่น
            const diff = Math.abs(record.paper_percentile - record.app_percentile_ingroup);
            record.percentile_accuracy = Math.max(0, Math.round((100 - diff) * 10) / 10);
        });
    }

    // 3. Compute Metrics
    const paperCount = N_paper;
    const paperPct = N > 0 ? Math.round((paperCount / N) * 100) : 0;

    let avgAccuracy = 0;
    let correlationR2 = 0;

    if (N_paper > 0) {
        const sumAcc = paperRecords.reduce((sum, r) => sum + (r.percentile_accuracy || 0), 0);
        avgAccuracy = Math.round((sumAcc / N_paper) * 10) / 10;
        correlationR2 = calculateR2(paperRecords);
    }

    renderMetrics(N, paperCount, paperPct, correlationR2, avgAccuracy);
    renderCharts(rawTestResults, paperRecords);
    renderTable(rawTestResults);
}

// Pearson Correlation Coefficient R^2
function calculateR2(paperRecords) {
    if (paperRecords.length < 2) return 0;
    const x = paperRecords.map((r) => r.app_percentile_ingroup);
    const y = paperRecords.map((r) => r.paper_percentile);

    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumX2 = x.reduce((sum, val) => sum + val * val, 0);
    const sumY2 = y.reduce((sum, val) => sum + val * val, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    if (denominator === 0) return 0;
    const r = numerator / denominator;
    return Math.round(r * r * 100) / 100;
}

// --- Render Metrics Cards ---
function renderMetrics(totalUsers, paperCount, paperPct, r2, avgAccuracy) {
    document.getElementById("metric-total-users").textContent = totalUsers;
    document.getElementById("metric-paper-count").textContent = paperCount;
    document.getElementById("metric-paper-pct").textContent = `${paperPct}% ของผู้ทดสอบทั้งหมด`;
    document.getElementById("metric-correlation").textContent = r2.toFixed(2);
    document.getElementById("metric-avg-accuracy").textContent = `${avgAccuracy.toFixed(1)}%`;
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
                    pointHoverRadius: 9
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
                    title: { display: true, text: "Percentile แอป — กลุ่มเดียวกัน (App Rank %)" },
                    min: 0,
                    max: 100
                },
                y: {
                    title: { display: true, text: "Percentile กระดาษ (Paper Rank %)" },
                    min: 0,
                    max: 100
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const pt = ctx.raw;
                            if (!pt.name) return null; // ซ่อน tooltip ของเส้น reference
                            return `${pt.name}: แอป P${pt.x}% vs กระดาษ P${pt.y}%`;
                        }
                    }
                }
            }
        }
    });

    // Cumulative Chart — แสดง 2 กราฟแยก scale (แอป 0-15, กระดาษ 0-30)
    const curveCtx = document.getElementById("curveChart").getContext("2d");
    if (curveChartInstance) curveChartInstance.destroy();

    // App: x-axis 0–15, paper: x-axis 0–30 → normalize ทั้งคู่เป็น percentile (%) บน x-axis เดียวกัน
    const appLabels = Array.from({ length: 16 }, (_, i) => i);  // 0–15
    const paperLabels = Array.from({ length: 31 }, (_, i) => i); // 0–30

    // ใช้เฉพาะ paperRecords — คนที่ยังไม่ได้ใส่คะแนนกระดาษจะไม่ถูกนำมาคำนวณ
    const appScoresSorted = [...paperRecords].map((r) => r.total_score || 0).sort((a, b) => a - b);
    const paperScoresSorted = paperRecords.map((r) => r.paper_score).sort((a, b) => a - b);

    // normalize เป็น % ของ max score เพื่อให้ใช้ x-axis เดียวกัน
    const appCumulative = appLabels.map((val) => {
        if (appScoresSorted.length === 0) return 0;
        const count = appScoresSorted.filter((s) => s <= val).length;
        return Math.round((count / appScoresSorted.length) * 100);
    });

    const paperCumulative = paperLabels.map((val) => {
        if (paperScoresSorted.length === 0) return 0;
        const count = paperScoresSorted.filter((s) => s <= val).length;
        return Math.round((count / paperScoresSorted.length) * 100);
    });

    curveChartInstance = new Chart(curveCtx, {
        type: "line",
        data: {
            labels: paperLabels, // ใช้ 0-30 เป็น base
            datasets: [
                {
                    label: "เส้นสะสมแอป (เฉพาะกลุ่มที่มีคะแนนกระดาษแล้ว, 0-15)",
                    data: appLabels.map((v, i) => ({ x: v * 2, y: appCumulative[i] })), // scale to 0-30
                    borderColor: "#82954b",
                    backgroundColor: "rgba(130, 149, 75, 0.1)",
                    fill: true,
                    tension: 0.3,
                    pointRadius: 3
                },
                {
                    label: "เส้นสะสมกระดาษ (คะแนน 0-30)",
                    data: paperLabels.map((v, i) => ({ x: v, y: paperCumulative[i] })),
                    borderColor: "#e06666",
                    backgroundColor: "rgba(224, 102, 102, 0.1)",
                    fill: true,
                    tension: 0.3,
                    pointRadius: 3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: "linear",
                    title: { display: true, text: "ระดับคะแนน (แอป ×2 / กระดาษ, ช่วง 0-30)" },
                    min: 0, max: 30
                },
                y: {
                    title: { display: true, text: "เปอร์เซ็นต์สะสม (%)" },
                    min: 0, max: 100
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        title: (items) => `คะแนน: ${items[0].parsed.x}`,
                        label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y}%`
                    }
                }
            }
        }
    });

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

        const appScore = record.total_score !== undefined ? `${record.total_score} / 15` : "-";
        const appP = record.app_percentile !== undefined ? `P<sub>${record.app_percentile}%</sub>` : "-";
        const paperScore = record.paper_score !== null && record.paper_score !== undefined ? `${record.paper_score} / 30` : `<span style='color:#bbb;'>ยังไม่ลงคะแนน</span>`;
        const paperP = record.paper_percentile !== undefined && record.paper_score !== null ? `P<sub>${record.paper_percentile}%</sub>` : "-";
        const compareP = record.app_percentile_ingroup !== undefined && record.paper_score !== null
            ? `P<sub>${record.app_percentile_ingroup}%</sub>`
            : appP;
        const accuracy = record.percentile_accuracy !== undefined && record.paper_score !== null ? `<strong>${record.percentile_accuracy}%</strong>` : "-";

        tr.innerHTML = `
            <td>${dateStr}</td>
            <td><strong>${record.name || "ไม่ระบุชื่อ"}</strong><br><span style="font-size:0.78rem;color:#888;">ID: ${record.user_id}</span></td>
            <td>${record.age || "-"}</td>
            <td><strong style="color:#4a5d23;">${appScore}</strong></td>
            <td>${appP}</td>
            <td>${paperScore}</td>
            <td>${paperP}</td>
            <td title="เปรียบเทียบ app (ในกลุ่ม) vs กระดาษ">${compareP} → ${paperP}</td>
            <td style="color:#2e7d32;">${accuracy}</td>
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
