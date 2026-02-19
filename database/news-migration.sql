-- =========================================================
-- NEWS POSTS MIGRATION
-- File: database/news-migration.sql
--
-- Run with:
--   psql -U <DB_USER> -d <DB_NAME> -f database/news-migration.sql
--
-- Or from backend root:
--   PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f database/news-migration.sql
-- =========================================================

-- =========================================================
-- 1. CREATE TABLE
-- =========================================================
CREATE TABLE IF NOT EXISTS news_posts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  title        VARCHAR(255)  NOT NULL,
  summary      VARCHAR(500)  NOT NULL,
  content      TEXT          NOT NULL,
  cover_image  TEXT,

  published    BOOLEAN       NOT NULL DEFAULT FALSE,

  author_id    UUID          NOT NULL
                 REFERENCES users(id) ON DELETE SET NULL
                 DEFERRABLE INITIALLY DEFERRED,

  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================================
-- 2. INDEXES
-- =========================================================
-- Most common query: list published posts newest first
CREATE INDEX IF NOT EXISTS idx_news_posts_published_created
  ON news_posts (published, created_at DESC);

-- Admin: fetch all posts by date
CREATE INDEX IF NOT EXISTS idx_news_posts_created_at
  ON news_posts (created_at DESC);

-- Author lookup
CREATE INDEX IF NOT EXISTS idx_news_posts_author_id
  ON news_posts (author_id);

-- =========================================================
-- 3. AUTO-UPDATE updated_at TRIGGER
-- =========================================================
CREATE OR REPLACE FUNCTION set_news_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_news_posts_updated_at ON news_posts;
CREATE TRIGGER trg_news_posts_updated_at
  BEFORE UPDATE ON news_posts
  FOR EACH ROW
  EXECUTE FUNCTION set_news_updated_at();

-- =========================================================
-- 4. COMMENTS
-- =========================================================
COMMENT ON TABLE  news_posts              IS 'Platform news and announcements';
COMMENT ON COLUMN news_posts.published    IS 'FALSE = draft, TRUE = visible to all users';
COMMENT ON COLUMN news_posts.cover_image  IS 'URL to cover image (CDN or relative path)';

-- =========================================================
-- 5. DEMO SEED DATA (optional - remove in production)
-- =========================================================
-- NOTE: Replace <ADMIN_USER_ID> with an actual user UUID from your users table.
--       You can find it with: SELECT id FROM users WHERE role = 'super_admin' LIMIT 1;
-- 
-- INSERT INTO news_posts (title, summary, content, published, author_id) VALUES
-- (
--   'ScoreX Platform Update v2.0',
--   'Major improvements to the platform including faster signal delivery and enhanced mobile experience.',
--   'We are excited to announce major improvements to the platform including faster signal delivery, improved leaderboard analytics, and enhanced mobile experience. This update brings a completely redesigned signals page with advanced filtering options, real-time price updates, and better performance across all devices.',
--   TRUE,
--   '<ADMIN_USER_ID>'
-- ),
-- (
--   'New Payment Methods Available',
--   'P2P payments are now available with 0% fees. Support for local cards has been added.',
--   'P2P payments are now available with 0% fees. Support for Visa, MasterCard, Uzcard, and Humo cards has been added.',
--   TRUE,
--   '<ADMIN_USER_ID>'
-- );

-- =========================================================
-- VERIFY
-- =========================================================
SELECT 
  table_name, 
  column_name, 
  data_type 
FROM information_schema.columns 
WHERE table_name = 'news_posts'
ORDER BY ordinal_position;