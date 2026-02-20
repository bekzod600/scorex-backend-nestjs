-- =========================================================
-- TRAINING CENTERS FULL MIGRATION
-- File: database/training-centers-migration.sql
--
-- Ishga tushirish:
--   psql -U postgres -d scorex -f database/training-centers-migration.sql
--
-- DIQQAT: Bu migration mavjud training_centers jadvaliga
-- yangi ustunlar qo'shadi va 2 ta yangi jadval yaratadi.
-- =========================================================

BEGIN;

-- =========================================================
-- 1. MAVJUD training_centers JADVALIGA USTUNLAR QO'SHISH
-- =========================================================

ALTER TABLE training_centers
  -- Location
  ADD COLUMN IF NOT EXISTS city          VARCHAR(100),
  ADD COLUMN IF NOT EXISTS address       VARCHAR(500),

  -- Contact
  ADD COLUMN IF NOT EXISTS phone         VARCHAR(50),
  ADD COLUMN IF NOT EXISTS telegram      VARCHAR(100),
  ADD COLUMN IF NOT EXISTS website       VARCHAR(500),

  -- Branding
  ADD COLUMN IF NOT EXISTS logo_url      TEXT,

  -- Rating (computed/cached)
  ADD COLUMN IF NOT EXISTS rating        DECIMAL(3,2) NOT NULL DEFAULT 0.00
                             CHECK (rating >= 0 AND rating <= 5),
  ADD COLUMN IF NOT EXISTS rating_count  INTEGER      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS students_count INTEGER     NOT NULL DEFAULT 0,

  -- Listing visibility (approved BUT hidden = unlisted)
  ADD COLUMN IF NOT EXISTS is_listed     BOOLEAN      NOT NULL DEFAULT TRUE,

  -- Admin moderation
  ADD COLUMN IF NOT EXISTS rejection_reason VARCHAR(500),
  ADD COLUMN IF NOT EXISTS approved_at  TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS reviewed_by  UUID REFERENCES users(id) ON DELETE SET NULL;

-- status CHECK constraint'ini kengaytirish
-- Eski: ('pending','approved','rejected')
-- Yangi: ('pending','approved','rejected') — is_listed orqali unlisted simulyatsiya
-- (is_listed=FALSE + status='approved' → "unlisted" holatda)

-- =========================================================
-- 2. CENTER RATINGS JADVALI
-- =========================================================
CREATE TABLE IF NOT EXISTS center_ratings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  center_id  UUID NOT NULL
               REFERENCES training_centers(id) ON DELETE CASCADE,

  user_id    UUID NOT NULL
               REFERENCES users(id) ON DELETE CASCADE,

  rating     SMALLINT NOT NULL
               CHECK (rating >= 1 AND rating <= 5),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Har bir foydalanuvchi bir martalik reyting berishi mumkin
  UNIQUE (center_id, user_id)
);

-- =========================================================
-- 3. CENTER ENROLLMENTS JADVALI
-- ("Men shu markazda o'qidim" belgisi)
-- =========================================================
CREATE TABLE IF NOT EXISTS center_enrollments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  center_id  UUID NOT NULL
               REFERENCES training_centers(id) ON DELETE CASCADE,

  user_id    UUID NOT NULL
               REFERENCES users(id) ON DELETE CASCADE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE (center_id, user_id)
);

-- =========================================================
-- 4. INDEXLAR
-- =========================================================

-- Asosiy list query: approved + listed, city filter, sort
CREATE INDEX IF NOT EXISTS idx_tc_status_listed
  ON training_centers (status, is_listed, rating DESC);

CREATE INDEX IF NOT EXISTS idx_tc_city
  ON training_centers (city);

CREATE INDEX IF NOT EXISTS idx_tc_owner_id
  ON training_centers (owner_id);

CREATE INDEX IF NOT EXISTS idx_tc_created_at
  ON training_centers (created_at DESC);

-- Ratings
CREATE INDEX IF NOT EXISTS idx_center_ratings_center_id
  ON center_ratings (center_id);

CREATE INDEX IF NOT EXISTS idx_center_ratings_user_id
  ON center_ratings (user_id);

-- Enrollments
CREATE INDEX IF NOT EXISTS idx_center_enrollments_center_id
  ON center_enrollments (center_id);

CREATE INDEX IF NOT EXISTS idx_center_enrollments_user_id
  ON center_enrollments (user_id);

-- =========================================================
-- 5. RATING AUTO-RECOMPUTE TRIGGER
-- Reyting qo'shilganda/o'zgartirilganda avtomatik hisoblash
-- =========================================================
CREATE OR REPLACE FUNCTION recompute_center_rating()
RETURNS TRIGGER AS $$
DECLARE
  v_center_id UUID;
  v_avg       DECIMAL(3,2);
  v_count     INTEGER;
BEGIN
  -- DELETE holatida OLD, INSERT/UPDATE holatida NEW ishlatiladi
  IF TG_OP = 'DELETE' THEN
    v_center_id := OLD.center_id;
  ELSE
    v_center_id := NEW.center_id;
  END IF;

  SELECT
    COALESCE(ROUND(AVG(rating)::DECIMAL, 2), 0),
    COUNT(*)
  INTO v_avg, v_count
  FROM center_ratings
  WHERE center_id = v_center_id;

  UPDATE training_centers
  SET
    rating       = v_avg,
    rating_count = v_count
  WHERE id = v_center_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_center_rating_change ON center_ratings;
CREATE TRIGGER trg_center_rating_change
  AFTER INSERT OR UPDATE OR DELETE ON center_ratings
  FOR EACH ROW
  EXECUTE FUNCTION recompute_center_rating();

-- =========================================================
-- 6. STUDENTS COUNT AUTO-UPDATE TRIGGER
-- Enrollment qo'shilganda/o'chirilganda students_count yangilanadi
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

  SELECT COUNT(*) INTO v_count
  FROM center_enrollments
  WHERE center_id = v_center_id;

  UPDATE training_centers
  SET students_count = v_count
  WHERE id = v_center_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_center_enrollment_change ON center_enrollments;
CREATE TRIGGER trg_center_enrollment_change
  AFTER INSERT OR DELETE ON center_enrollments
  FOR EACH ROW
  EXECUTE FUNCTION recompute_center_students();

-- =========================================================
-- 7. KOMMENTARLAR
-- =========================================================
COMMENT ON TABLE training_centers    IS 'Trading ta''lim markazlari — owner tomonidan ro''yxatdan o''tadi, admin tasdiqlaydi';
COMMENT ON TABLE center_ratings      IS 'Foydalanuvchilar tomonidan berilgan reytinglar (1-5 yulduz)';
COMMENT ON TABLE center_enrollments  IS '"Men shu markazda o''qidim" belgilash — students_count ni oshiradi';
COMMENT ON COLUMN training_centers.is_listed IS 'FALSE = admin tomonidan yashirilgan (approved lekin ko''rinmaydi)';

COMMIT;

-- =========================================================
-- TEKSHIRISH
-- =========================================================
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'training_centers'
ORDER BY ordinal_position;