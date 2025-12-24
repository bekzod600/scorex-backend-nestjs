-- =========================================================
-- TELEGRAM AUTH MIGRATION
-- =========================================================

-- Add telegram_id to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS telegram_id BIGINT UNIQUE,
ADD COLUMN IF NOT EXISTS telegram_username VARCHAR(255),
ADD COLUMN IF NOT EXISTS telegram_first_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS telegram_last_name VARCHAR(255);

-- Make email and password nullable (optional for future use)
ALTER TABLE users 
ALTER COLUMN email DROP NOT NULL,
ALTER COLUMN password DROP NOT NULL;

-- Add constraint: user must have either email OR telegram_id
ALTER TABLE users
ADD CONSTRAINT user_identity_check 
CHECK (email IS NOT NULL OR telegram_id IS NOT NULL);

-- =========================================================
-- PENDING LOGINS TABLE
-- =========================================================
CREATE TABLE IF NOT EXISTS pending_logins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'CONFIRMED', 'EXPIRED')),
  
  telegram_id BIGINT,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  confirmed_at TIMESTAMP WITH TIME ZONE,
  
  -- Prevent replay attacks
  CONSTRAINT prevent_reuse CHECK (
    (status = 'PENDING' AND confirmed_at IS NULL) OR
    (status = 'CONFIRMED' AND confirmed_at IS NOT NULL) OR
    (status = 'EXPIRED')
  )
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_pending_logins_id_status 
  ON pending_logins(id, status) 
  WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_pending_logins_expires 
  ON pending_logins(expires_at) 
  WHERE status = 'PENDING';

-- =========================================================
-- UPDATE USERS TABLE INDEX
-- =========================================================
CREATE INDEX IF NOT EXISTS idx_users_telegram_id 
  ON users(telegram_id) 
  WHERE telegram_id IS NOT NULL;

-- =========================================================
-- CLEANUP EXPIRED LOGINS (OPTIONAL FUNCTION)
-- =========================================================
CREATE OR REPLACE FUNCTION cleanup_expired_logins()
RETURNS void AS $$
BEGIN
  UPDATE pending_logins
  SET status = 'EXPIRED'
  WHERE status = 'PENDING' 
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE pending_logins IS 'Stores temporary login sessions initiated from website, confirmed via Telegram bot';
COMMENT ON COLUMN users.telegram_id IS 'Telegram user ID - primary authentication identifier';