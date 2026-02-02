-- =========================================================
-- SUBSCRIPTION PLAN MIGRATION
-- =========================================================
-- Adds subscription plan support to users table
-- Run: psql -U user -d dbname -f subscription-migration.sql
-- =========================================================

-- Add subscription fields to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(20) NOT NULL DEFAULT 'free'
  CHECK (subscription_plan IN ('free', 'premium')),
ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS subscription_auto_renew BOOLEAN DEFAULT FALSE;

-- Create index for subscription queries
CREATE INDEX IF NOT EXISTS idx_users_subscription_plan
  ON users(subscription_plan)
  WHERE subscription_plan = 'premium';

CREATE INDEX IF NOT EXISTS idx_users_subscription_expires
  ON users(subscription_expires_at)
  WHERE subscription_expires_at IS NOT NULL;

-- =========================================================
-- SUBSCRIPTION TRANSACTIONS TABLE
-- =========================================================
CREATE TABLE IF NOT EXISTS subscription_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  user_id UUID NOT NULL
    REFERENCES users(id) ON DELETE CASCADE,
  
  type VARCHAR(20) NOT NULL
    CHECK (type IN ('purchase', 'renewal', 'cancel', 'expire')),
  
  amount DECIMAL(15, 2),
  
  plan VARCHAR(20) NOT NULL DEFAULT 'premium',
  
  starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_transactions_user_id
  ON subscription_transactions(user_id);

-- =========================================================
-- UPDATE ADMIN USER TO ALWAYS HAVE ACCESS
-- =========================================================
-- Admins don't need subscription, their role gives them full access
-- But we can set them as premium for consistency

UPDATE users
SET subscription_plan = 'premium',
    subscription_expires_at = NOW() + INTERVAL '100 years'
WHERE role = 'admin';

-- =========================================================
-- COMMENTS
-- =========================================================
COMMENT ON COLUMN users.subscription_plan IS 'User subscription plan: free or premium';
COMMENT ON COLUMN users.subscription_expires_at IS 'When premium subscription expires (NULL for free users)';
COMMENT ON COLUMN users.subscription_auto_renew IS 'Auto-renew subscription using wallet balance';

-- =========================================================
-- HELPER FUNCTION: Check if user has active premium
-- =========================================================
CREATE OR REPLACE FUNCTION user_has_active_premium(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = user_id
    AND (
      u.role = 'admin'
      OR (
        u.subscription_plan = 'premium'
        AND u.subscription_expires_at > NOW()
      )
    )
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION user_has_active_premium IS 'Returns true if user is admin or has active premium subscription';