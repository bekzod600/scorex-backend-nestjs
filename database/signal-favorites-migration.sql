-- =========================================================
-- SIGNAL FAVORITES MIGRATION
-- =========================================================

-- Create signal_favorites table
CREATE TABLE IF NOT EXISTS signal_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  user_id UUID NOT NULL
    REFERENCES users(id) ON DELETE CASCADE,
  
  signal_id UUID NOT NULL
    REFERENCES signals(id) ON DELETE CASCADE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE (user_id, signal_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_signal_favorites_user_id
  ON signal_favorites(user_id);

CREATE INDEX IF NOT EXISTS idx_signal_favorites_signal_id
  ON signal_favorites(signal_id);

CREATE INDEX IF NOT EXISTS idx_signal_favorites_created_at
  ON signal_favorites(created_at DESC);

COMMENT ON TABLE signal_favorites IS 'Stores user favorite signals';

