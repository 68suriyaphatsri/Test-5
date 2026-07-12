-- =====================================================
-- Migration: สร้างตาราง naming_pool สำหรับ Naming Test
-- รันใน Supabase Dashboard > SQL Editor
-- =====================================================

-- สร้างตาราง naming_pool เพื่อเก็บรูปสัตว์และชื่อภาษาไทย
CREATE TABLE IF NOT EXISTS naming_pool (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,             -- ชื่อสัตว์ภาษาไทย (คำตอบที่ถูกต้อง)
    image_filename TEXT NOT NULL,   -- ชื่อไฟล์รูปใน Storage
    image_url TEXT NOT NULL,        -- URL รูปเต็มจาก Supabase Storage
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- เปิด Row Level Security (RLS) ให้อ่านได้สาธารณะ
ALTER TABLE naming_pool ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on naming_pool"
ON naming_pool FOR SELECT
USING (true);

-- Insert รูปสัตว์ทั้ง 6 ตัว
INSERT INTO naming_pool (name, image_filename, image_url)
VALUES
    ('หมา',     'dog.jpg',         'https://wqllezztqhfabpygicuv.supabase.co/storage/v1/object/public/animal/dog.jpg'),
    ('แมว',     'cat.jpg',         'https://wqllezztqhfabpygicuv.supabase.co/storage/v1/object/public/animal/cat.jpg'),
    ('ผีเสื้อ', 'butterfly.jpg',   'https://wqllezztqhfabpygicuv.supabase.co/storage/v1/object/public/animal/butterfly.jpg'),
    ('เสือ',    'tiger.jpg',       'https://wqllezztqhfabpygicuv.supabase.co/storage/v1/object/public/animal/tiger.jpg'),
    ('อูฐ',     'camel.jpg',       'https://wqllezztqhfabpygicuv.supabase.co/storage/v1/object/public/animal/camel.jpg'),
    ('ตั๊กแตน', 'grasshopper.jpg', 'https://wqllezztqhfabpygicuv.supabase.co/storage/v1/object/public/animal/grasshopper.jpg')
ON CONFLICT DO NOTHING;

-- ตรวจสอบว่า insert สำเร็จ
SELECT id, name, image_filename FROM naming_pool ORDER BY created_at;
