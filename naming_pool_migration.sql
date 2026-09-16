-- =====================================================
-- Migration: อัปเดตตาราง naming_pool สำหรับ Naming Test (ของใช้/เครื่องมือ ใน bucket item 2)
-- รันใน Supabase Dashboard > SQL Editor
-- =====================================================

-- สร้างตาราง naming_pool เพื่อเก็บรูปสิ่งของเครื่องใช้และชื่อภาษาไทย
CREATE TABLE IF NOT EXISTS naming_pool (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,             -- ชื่อสิ่งของเครื่องใช้ภาษาไทย (คำตอบที่ถูกต้อง)
    image_filename TEXT NOT NULL,   -- ชื่อไฟล์รูปใน Storage (bucket: item 2)
    image_url TEXT NOT NULL,        -- URL รูปเต็มจาก Supabase Storage (bucket: item 2)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- เปิด Row Level Security (RLS) ให้อ่านได้สาธารณะ
ALTER TABLE naming_pool ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on naming_pool"
ON naming_pool FOR SELECT
USING (true);

-- ล้างข้อมูลชุดเดิมออกก่อน
DELETE FROM naming_pool;

-- Insert รูปสิ่งของเครื่องใช้จาก bucket: item 2
INSERT INTO naming_pool (name, image_filename, image_url)
VALUES
    ('จอบ',     'hoe.jpg',          'https://wqllezztqhfabpygicuv.supabase.co/storage/v1/object/public/item%202/hoe.jpg'),
    ('บัวรดน้ำ', 'watering_can.jpg', 'https://wqllezztqhfabpygicuv.supabase.co/storage/v1/object/public/item%202/watering_can.jpg'),
    ('ครก',     'mortar.jpg',       'https://wqllezztqhfabpygicuv.supabase.co/storage/v1/object/public/item%202/mortar.jpg'),
    ('เคียว',   'sickle.jpg',       'https://wqllezztqhfabpygicuv.supabase.co/storage/v1/object/public/item%202/sickle.jpg'),
    ('ตะกร้า',  'basket.jpg',       'https://wqllezztqhfabpygicuv.supabase.co/storage/v1/object/public/item%202/basket.jpg');

-- ตรวจสอบว่า insert สำเร็จ
SELECT id, name, image_filename, image_url FROM naming_pool ORDER BY created_at;
