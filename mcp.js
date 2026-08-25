// =====================================================
// MCP Layer: Model Context Protocol / Supabase Bridge
// แยก Logic ทั้งหมดออกจาก UI Components
// =====================================================

const SUPABASE_URL = 'https://wqllezztqhfabpygicuv.supabase.co';       // ← ใส่ URL ของคุณ
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxbGxlenp0cWhmYWJweWdpY3V2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1NzAwMDAsImV4cCI6MjA5NDE0NjAwMH0.lSEas5G_SS3tEjONycp-PBFe6bXxPa-PVcoK_vJlccA'; // ← ใส่ Anon Key ของคุณ

// สร้าง client — ใช้ชื่อ supabaseClient เพื่อไม่ชนกับ global `supabase` จาก CDN
const supabaseClient = (typeof window.supabase !== 'undefined' && window.supabase.createClient) 
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) 
    : null;

if (!supabaseClient) {
    console.warn('[MCP] Supabase SDK is not loaded yet or failed to initialize.');
}

// -------------------------------------------------
// MCP Tools Object
// -------------------------------------------------
const MemoryGardenTools = {

    // ---------- 1. ดึงคำศัพท์สุ่มสำหรับทดสอบ ----------
    async fetchRecallSet(userId, limit = 3) {
        try {
            const { data, error } = await supabaseClient.rpc('fetch_recall_set', {
                p_user_id: userId,
                p_limit: limit
            });
            if (error) throw error;

            // Cache ลง localStorage สำหรับ offline fallback
            if (data && data.length > 0) {
                localStorage.setItem('cached_recall_set', JSON.stringify(data));
            }
            return data || [];
        } catch (err) {
            console.warn('[MCP] fetchRecallSet failed, using cache:', err.message);
            const cached = localStorage.getItem('cached_recall_set');
            return cached ? JSON.parse(cached) : [];
        }
    },

    // ---------- 2. บันทึกผลการตอบ + คำนวณ SRS ----------
    async updateWordStatus(userId, wordId, isCorrect) {
        try {
            const { error } = await supabaseClient.rpc('update_word_status', {
                p_user_id: userId,
                p_word_id: wordId,
                p_is_correct: isCorrect
            });
            if (error) throw error;
        } catch (err) {
            console.error('[MCP] updateWordStatus failed:', err.message);
            // เก็บ pending update ไว้ใน localStorage เผื่อ retry ทีหลัง
            const pending = JSON.parse(localStorage.getItem('pending_updates') || '[]');
            pending.push({ userId, wordId, isCorrect, timestamp: Date.now() });
            localStorage.setItem('pending_updates', JSON.stringify(pending));
        }
    },

    // ---------- 3. ดึง progress ทบทวนวันนี้ ----------
    async getProgress(userId) {
        try {
            const { data, error } = await supabaseClient.rpc('get_user_progress', {
                p_user_id: userId
            });
            if (error) throw error;
            return data || { reviewed_today: 0, total_due: 0 };
        } catch (err) {
            console.warn('[MCP] getProgress failed:', err.message);
            return { reviewed_today: 0, total_due: 0 };
        }
    },

    // ---------- 4. ดึงภาพพื้นหลังจาก Supabase Storage ----------
    getBackgrounds() {
        const baseUrl = `${SUPABASE_URL}/storage/v1/object/public/Back%20image%201`;
        return {
            garden: `${baseUrl}/garden.gif`,
            sleep: `${baseUrl}/sleep.gif`,
            sleep2_gif: `${baseUrl}/sleep%202.gif`,
            sleep3: `${baseUrl}/sleep%203.png`,
            sleep4: `${baseUrl}/sleep%204.png`,
            sleep5: `${baseUrl}/sleep%205.png`
        };
    },

    // ---------- 5. ดึงจำนวนผู้ใช้ทั้งหมด (สำหรับ Sequential ID) ----------
    async getUserCount() {
        try {
            const { count, error } = await supabaseClient
                .from('test_results')
                .select('*', { count: 'exact', head: true });
            if (error) throw error;
            return count || 0;
        } catch (err) {
            console.warn('[MCP] getUserCount failed:', err.message);
            return 0;
        }
    },

    // ---------- 6. บันทึกผลการทดสอบลง Supabase ----------
    async saveTestResult(userData) {
        try {
            const { error } = await supabaseClient
                .from('test_results')
                .insert([{
                    user_id: userData.userId,
                    name: userData.name,
                    age: parseInt(userData.age),
                    gender: userData.gender,
                    education: userData.education,
                    disease: userData.disease,
                    total_score: userData.totalScore,
                    risk_level: userData.riskLevel,
                    details: userData.details,
                    latitude: userData.latitude,
                    longitude: userData.longitude
                }]);
            if (error) throw error;
            console.log('[MCP] บันทึกผลลง Supabase สำเร็จ');
        } catch (err) {
            console.error('[MCP] saveTestResult failed:', err.message);
        }
    },

    // ---------- 7. Retry pending offline updates ----------
    async retryPendingUpdates() {
        const pending = JSON.parse(localStorage.getItem('pending_updates') || '[]');
        if (pending.length === 0) return;

        const remaining = [];
        for (const item of pending) {
            try {
                const { error } = await supabaseClient.rpc('update_word_status', {
                    p_user_id: item.userId,
                    p_word_id: item.wordId,
                    p_is_correct: item.isCorrect
                });
                if (error) throw error;
                // สำเร็จ → ไม่ต้องเก็บ
            } catch {
                remaining.push(item);
            }
        }
        localStorage.setItem('pending_updates', JSON.stringify(remaining));
    },

    // ---------- 8. ดึงประวัติผลการทดสอบของผู้ใช้ ----------
    async getUserHistory(userId) {
        try {
            const { data, error } = await supabaseClient
                .from('test_results')
                .select('id, total_score, risk_level, details, created_at, age, gender, education')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(20);
            if (error) throw error;
            return data || [];
        } catch (err) {
            console.warn('[MCP] getUserHistory failed:', err.message);
            return [];
        }
    },

    // ---------- 9. ดึงรายการสิ่งของ/เครื่องมือสำหรับ Naming Test จาก naming_pool ----------
    async fetchNamingItems(limit = 5) {
        // Fallback: เครื่องมือทำสวน อุปกรณ์วิถีไทย และสัตว์ในสวน
        const FALLBACK_NAMING = [
            { id: null, name: 'จอบ', image_url: 'https://images.unsplash.com/photo-1617576683096-00fc8eecb3af?w=300&auto=format&fit=crop&q=60' },
            { id: null, name: 'บัวรดน้ำ', image_url: 'https://images.unsplash.com/photo-1599423300746-b62533397364?w=300&auto=format&fit=crop&q=60' },
            { id: null, name: 'กรรไกรตัดกิ่ง', image_url: 'https://images.unsplash.com/photo-1590402494682-cd3fb53b1f70?w=300&auto=format&fit=crop&q=60' },
            { id: null, name: 'กระถางต้นไม้', image_url: 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=300&auto=format&fit=crop&q=60' },
            { id: null, name: 'ผีเสื้อ', image_url: `${SUPABASE_URL}/storage/v1/object/public/animal/butterfly.jpg` },
            { id: null, name: 'แมว', image_url: `${SUPABASE_URL}/storage/v1/object/public/animal/cat.jpg` },
            { id: null, name: 'กระรอก', image_url: 'https://images.unsplash.com/photo-1507666405895-422eee7d517f?w=300&auto=format&fit=crop&q=60' },
            { id: null, name: 'เสียม', image_url: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=300&auto=format&fit=crop&q=60' },
            { id: null, name: 'สายยาง', image_url: 'https://images.unsplash.com/photo-1584473457406-6240486418e9?w=300&auto=format&fit=crop&q=60' },
            { id: null, name: 'นก', image_url: 'https://images.unsplash.com/photo-1444464666168-49d633b86797?w=300&auto=format&fit=crop&q=60' }
        ];

        try {
            const { data, error } = await supabaseClient
                .from('naming_pool')
                .select('id, name, image_url');
            if (error) throw error;
            if (data && data.length >= limit) {
                // สุ่มเลือก limit ตัวจากทั้งหมด
                const shuffled = [...data].sort(() => Math.random() - 0.5);
                return shuffled.slice(0, limit);
            }
            throw new Error('ข้อมูลใน naming_pool ไม่เพียงพอ');
        } catch (err) {
            console.warn('[MCP] fetchNamingItems failed, using fallback:', err.message);
            // ใช้ fallback และสุ่มเลือก limit ตัว
            const shuffled = [...FALLBACK_NAMING].sort(() => Math.random() - 0.5);
            return shuffled.slice(0, limit);
        }
    },

    // ---------- 10. ดึงผลการทดสอบทั้งหมดสำหรับ Admin ----------
    async getAllTestResults() {
        try {
            if (!supabaseClient) throw new Error("Supabase is not initialized");
            const { data, error } = await supabaseClient
                .from('test_results')
                .select('*')
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data || [];
        } catch (err) {
            console.error('[MCP] getAllTestResults failed:', err.message);
            return [];
        }
    },

    // ---------- 11. อัปเดตคะแนนกระดาษและเปอร์เซ็นต์ความแม่นยำสำหรับ Admin ----------
    async savePaperScore(id, paperData) {
        try {
            if (!supabaseClient) throw new Error("Supabase is not initialized");
            const { error } = await supabaseClient
                .from('test_results')
                .update({
                    paper_score: paperData.paper_score,
                    paper_risk_level: paperData.paper_risk_level,
                    paper_notes: paperData.paper_notes,
                    paper_percentile: paperData.paper_percentile,
                    app_percentile: paperData.app_percentile,
                    percentile_accuracy: paperData.percentile_accuracy
                })
                .eq('id', id);
            if (error) throw error;
            console.log('[MCP] บันทึกคะแนนกระดาษเรียบร้อย');
            return true;
        } catch (err) {
            console.error('[MCP] savePaperScore failed:', err.message);
            return false;
        }
    },

    // ---------- 12. ลบข้อมูลผลการทดสอบ (Admin) ----------
    async deleteTestResult(id) {
        try {
            if (!supabaseClient) throw new Error("Supabase is not initialized");
            const { error } = await supabaseClient
                .from('test_results')
                .delete()
                .eq('id', id);
            if (error) throw error;
            console.log('[MCP] ลบข้อมูลเรียบร้อย:', id);
            return true;
        } catch (err) {
            console.error('[MCP] deleteTestResult failed:', err.message);
            return false;
        }
    },

    // ---------- 13. แก้ไขข้อมูลผลการทดสอบ (Admin) ----------
    async updateTestResult(id, updatedData) {
        try {
            if (!supabaseClient) throw new Error("Supabase is not initialized");
            const { error } = await supabaseClient
                .from('test_results')
                .update(updatedData)
                .eq('id', id);
            if (error) throw error;
            console.log('[MCP] แก้ไขข้อมูลเรียบร้อย:', id);
            return true;
        } catch (err) {
            console.error('[MCP] updateTestResult failed:', err.message);
            return false;
        }
    }
};


// Retry pending updates เมื่อกลับมาออนไลน์
window.addEventListener('online', () => {
    MemoryGardenTools.retryPendingUpdates();
});

// Expose ให้ script.js เรียกใช้ได้
window.MemoryGardenTools = MemoryGardenTools;
