-- =========================================================
-- EXTENSIONS
-- =========================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================================================
-- USERS TABLE
-- =========================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255),

  role VARCHAR(20) NOT NULL DEFAULT 'user'
    CHECK (role IN ('user', 'admin')),

  score_x INTEGER NOT NULL DEFAULT 1000
    CHECK (score_x >= 1000),

  auto_renew_premium BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================================
-- WALLETS TABLE
-- =========================================================
CREATE TABLE IF NOT EXISTS wallets (
  user_id UUID PRIMARY KEY
    REFERENCES users(id) ON DELETE CASCADE,
  balance DECIMAL(15, 2) NOT NULL DEFAULT 0
    CHECK (balance >= 0),
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================================
-- WALLET TRANSACTIONS TABLE
-- =========================================================
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL
    REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  -- TOPUP | SIGNAL_BUY | SUBSCRIPTION_BUY | REFUND | ADJUSTMENT
  amount DECIMAL(15, 2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  status VARCHAR(20) NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('pending', 'confirmed', 'rejected')),
  provider VARCHAR(50),
  meta JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================================
-- SIGNALS TABLE (BUY-ONLY LIFECYCLE)
-- =========================================================
CREATE TABLE IF NOT EXISTS signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL
    REFERENCES users(id) ON DELETE CASCADE,
  ticker VARCHAR(50) NOT NULL,
  direction VARCHAR(10) NOT NULL DEFAULT 'BUY'
    CHECK (direction = 'BUY'),
  access_type VARCHAR(10) NOT NULL
    CHECK (access_type IN ('FREE', 'PAID')),
  price DECIMAL(15, 2),
  ep  DECIMAL(15, 2) NOT NULL,
  tp1 DECIMAL(15, 2) NOT NULL,
  tp2 DECIMAL(15, 2),
  sl  DECIMAL(15, 2) NOT NULL,

  status VARCHAR(20) NOT NULL DEFAULT 'WAIT_EP'
    CHECK (status IN (
      'WAIT_EP',
      'IN_TRADE',
      'CLOSED_TP',
      'CLOSED_SL',
      'CANCELED'
    )),

  islamicly_status VARCHAR(30),
  musaffa_status   VARCHAR(30),

  entered_at TIMESTAMP WITH TIME ZONE,
  closed_at  TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================================
-- SIGNAL PURCHASES TABLE
-- =========================================================
CREATE TABLE IF NOT EXISTS signal_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  signal_id UUID NOT NULL
    REFERENCES signals(id) ON DELETE CASCADE,

  user_id UUID NOT NULL
    REFERENCES users(id) ON DELETE CASCADE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE (signal_id, user_id)
);

-- =========================================================
-- RATING LOGS TABLE (ScoreX ENGINE)
-- =========================================================
CREATE TABLE IF NOT EXISTS rating_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL
    REFERENCES users(id) ON DELETE CASCADE,

  signal_id UUID NOT NULL
    REFERENCES signals(id) ON DELETE CASCADE,

  delta INTEGER NOT NULL,
  reason VARCHAR(20) NOT NULL,
  -- TP | SL | CANCEL | BONUS

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================================
-- SAVED FILTERS TABLE
-- =========================================================
CREATE TABLE IF NOT EXISTS saved_filters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL
    REFERENCES users(id) ON DELETE CASCADE,

  name VARCHAR(255) NOT NULL,

  max_price DECIMAL(15, 2),
  min_scorex INTEGER,

  signal_type VARCHAR(10) DEFAULT 'ANY'
    CHECK (signal_type IN ('FREE', 'PAID', 'ANY')),

  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================================
-- NOTIFICATIONS TABLE
-- =========================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL
    REFERENCES users(id) ON DELETE CASCADE,

  type VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,

  is_read BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================================
-- PRICE CACHE TABLE (PRICING ENGINE)
-- =========================================================
CREATE TABLE IF NOT EXISTS price_cache (
  symbol VARCHAR(50) PRIMARY KEY,

  price DECIMAL(15, 4),
  currency VARCHAR(10),

  market_time TIMESTAMP WITH TIME ZONE,
  fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================================
-- ACTIVE SYMBOLS TABLE
-- =========================================================
CREATE TABLE IF NOT EXISTS active_symbols (
  symbol VARCHAR(50) PRIMARY KEY,

  last_needed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reason VARCHAR(100),

  priority_score INTEGER DEFAULT 0
);

-- =========================================================
-- TRAINING CENTERS TABLE
-- =========================================================
CREATE TABLE IF NOT EXISTS training_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  owner_id UUID UNIQUE
    REFERENCES users(id) ON DELETE CASCADE,

  name VARCHAR(255) NOT NULL,
  description TEXT,

  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================================
-- P2P TOPUPS TABLE (ADMIN MODERATION)
-- =========================================================
CREATE TABLE IF NOT EXISTS p2p_topups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL
    REFERENCES users(id) ON DELETE CASCADE,

  amount DECIMAL(15, 2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',

  card_type VARCHAR(20),
  screenshot_url TEXT,

  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),

  admin_note TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE
);

-- =========================================================
-- INDEXES (PERFORMANCE)
-- =========================================================
CREATE INDEX IF NOT EXISTS idx_users_email
  ON users(email);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_id
  ON wallet_transactions(user_id);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at
  ON wallet_transactions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_signals_seller_id
  ON signals(seller_id);

CREATE INDEX IF NOT EXISTS idx_signals_status
  ON signals(status);

CREATE INDEX IF NOT EXISTS idx_signals_created_at
  ON signals(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_signal_purchases_signal_id
  ON signal_purchases(signal_id);

CREATE INDEX IF NOT EXISTS idx_signal_purchases_user_id
  ON signal_purchases(user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id
  ON notifications(user_id);

CREATE INDEX IF NOT EXISTS idx_price_cache_symbol
  ON price_cache(symbol);
