-- =========================================================
-- TRAINING CENTERS: ENROLLMENT REQUEST SYSTEM MIGRATION
-- File: database/enrollment-request-migration.sql
--
-- Ishga tushirish:
--   psql -U postgres -d scorex -f database/enrollment-request-migration.sql
--
-- Bu migration:
--   1. center_enrollments jadvaliga status ustuni qo'shadi
--   2. students_count trigger'ini faqat 'approved' statuslilarni sanashga o'zgartiradi
--   3. is_enrolled subquery'larini ham 'approved' filtrashga o'zgartirish kerak (service.ts da)
-- =========================================================

BEGIN;

-- =========================================================
-- 1. center_enrollments ga status ustuni qo'shish
-- =========================================================
ALTER TABLE center_enrollments
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS owner_note  VARCHAR(500);

-- =========================================================
-- 2. Mavjud yozuvlarni 'approved' ga o'tkazish
--    (migration dan oldingi enrollment'lar to'g'ridan to'g'ri kirgan edi)
-- =========================================================
UPDATE center_enrollments SET status = 'approved' WHERE status = 'pending';

-- =========================================================
-- 3. students_count trigger'ini yangilash
--    Faqat status='approved' bo'lganlarni sanaydi
-- =========================================================
CREATE OR REPLACE FUNCTION recompute_center_students()
RETURNS TRIGGER AS $$
DECLARE
  v_center_id UUID;
  v_count     INTEGER;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_center_id := OLD.center_id;
  ELSE
    v_center_id := NEW.center_id;
  END IF;

  -- FAQAT approved statuslilarni san
  SELECT COUNT(*) INTO v_count
  FROM center_enrollments
  WHERE center_id = v_center_id
    AND status = 'approved';

  UPDATE training_centers
  SET students_count = v_count
  WHERE id = v_center_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger mavjud bo'lsa qayta yaratiladi (OR REPLACE qilindi yuqorida)
-- Trigger allaqachon CREATE qilingan, faqat funksiya yangilandi

-- =========================================================
-- 4. Indexlar
-- =========================================================
CREATE INDEX IF NOT EXISTS idx_center_enrollments_status
  ON center_enrollments (center_id, status);

CREATE INDEX IF NOT EXISTS idx_center_enrollments_user_status
  ON center_enrollments (user_id, status);

-- =========================================================
-- 5. Kommentarlar
-- =========================================================
COMMENT ON COLUMN center_enrollments.status IS
  'pending = so''rov yuborildi, owner tasdiqlamagan; approved = tasdiqlangan student; rejected = rad etilgan';

COMMENT ON COLUMN center_enrollments.reviewed_at IS
  'Owner tomonidan qarab chiqilgan vaqt';

COMMIT;

-- Tekshirish
SELECT
  column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'center_enrollments'
ORDER BY ordinal_position;