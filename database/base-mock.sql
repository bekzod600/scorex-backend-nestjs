-- =========================================================
-- SCOREX DEMO DATA - CORRECTED VERSION
-- =========================================================
-- This file creates realistic demo data matching the actual schema
-- Run after schema initialization: psql -U user -d dbname -f demo-data.sql
-- =========================================================

-- Clear existing data (optional - comment out if you want to keep existing data)
TRUNCATE TABLE 
  rating_logs,
  signal_purchases,
  signals,
  saved_filters,
  notifications,
  p2p_topups,
  training_centers,
  wallet_transactions,
  wallets,
  pending_logins,
  users
CASCADE;

-- =========================================================
-- 1. USERS (Mix of Telegram and Email users)
-- =========================================================

-- Admin user (Telegram)
INSERT INTO users (id, telegram_id, telegram_username, telegram_first_name, role, score_x, created_at) VALUES
('00000000-0000-0000-0000-000000000001', 123456789, 'admin_scorex', 'ScoreX Admin', 'admin', 5000, NOW() - INTERVAL '180 days');

-- Professional traders (High ScoreX)
INSERT INTO users (id, telegram_id, telegram_username, telegram_first_name, role, score_x, created_at) VALUES
('11111111-1111-1111-1111-111111111111', 234567890, 'crypto_wolf', 'Alex', 'user', 2850, NOW() - INTERVAL '150 days'),
('11111111-1111-1111-1111-111111111112', 345678901, 'bull_trader', 'Sarah', 'user', 2420, NOW() - INTERVAL '120 days'),
('11111111-1111-1111-1111-111111111113', 456789012, 'chart_master', 'Mike', 'user', 2180, NOW() - INTERVAL '90 days'),
('11111111-1111-1111-1111-111111111114', 567890123, 'golden_eagle', 'Emma', 'user', 1950, NOW() - INTERVAL '75 days');

-- Medium-level traders
INSERT INTO users (id, telegram_id, telegram_username, telegram_first_name, role, score_x, created_at) VALUES
('22222222-2222-2222-2222-222222222221', 678901234, 'market_hunter', 'David', 'user', 1680, NOW() - INTERVAL '60 days'),
('22222222-2222-2222-2222-222222222222', 789012345, 'trend_seeker', 'Lisa', 'user', 1420, NOW() - INTERVAL '50 days'),
('22222222-2222-2222-2222-222222222223', 890123456, 'profit_maker', 'James', 'user', 1280, NOW() - INTERVAL '45 days'),
('22222222-2222-2222-2222-222222222224', 901234567, 'smart_investor', 'Anna', 'user', 1150, NOW() - INTERVAL '40 days');

-- New/Learning traders
INSERT INTO users (id, telegram_id, telegram_username, telegram_first_name, role, score_x, created_at) VALUES
('33333333-3333-3333-3333-333333333331', 112233445, 'crypto_newbie', 'Tom', 'user', 1050, NOW() - INTERVAL '30 days'),
('33333333-3333-3333-3333-333333333332', 223344556, 'learning_fast', 'Nina', 'user', 1020, NOW() - INTERVAL '25 days'),
('33333333-3333-3333-3333-333333333333', 334455667, 'first_timer', 'John', 'user', 1000, NOW() - INTERVAL '15 days'),
('33333333-3333-3333-3333-333333333334', 445566778, 'fresh_start', 'Kate', 'user', 1000, NOW() - INTERVAL '10 days');

-- Regular users (buyers/followers)
INSERT INTO users (id, telegram_id, telegram_username, telegram_first_name, role, score_x, created_at) VALUES
('44444444-4444-4444-4444-444444444441', 556677889, 'signal_follower', 'Bob', 'user', 1000, NOW() - INTERVAL '20 days'),
('44444444-4444-4444-4444-444444444442', 667788990, 'active_buyer', 'Lucy', 'user', 1000, NOW() - INTERVAL '18 days'),
('44444444-4444-4444-4444-444444444443', 778899001, 'premium_user', 'Mark', 'user', 1000, NOW() - INTERVAL '12 days');

-- =========================================================
-- 2. WALLETS (Initialize wallets for all users)
-- Note: Schema has no 'currency' column, only balance with default 'USD'
-- =========================================================

INSERT INTO wallets (user_id, balance) VALUES
-- Admin
('00000000-0000-0000-0000-000000000001', 10000.00),

-- Professional traders
('11111111-1111-1111-1111-111111111111', 5420.50),
('11111111-1111-1111-1111-111111111112', 3890.75),
('11111111-1111-1111-1111-111111111113', 2750.00),
('11111111-1111-1111-1111-111111111114', 2180.25),

-- Medium traders
('22222222-2222-2222-2222-222222222221', 1650.00),
('22222222-2222-2222-2222-222222222222', 1230.50),
('22222222-2222-2222-2222-222222222223', 980.00),
('22222222-2222-2222-2222-222222222224', 750.75),

-- New traders
('33333333-3333-3333-3333-333333333331', 500.00),
('33333333-3333-3333-3333-333333333332', 350.00),
('33333333-3333-3333-3333-333333333333', 200.00),
('33333333-3333-3333-3333-333333333334', 150.00),

-- Regular users
('44444444-4444-4444-4444-444444444441', 1200.00),
('44444444-4444-4444-4444-444444444442', 850.00),
('44444444-4444-4444-4444-444444444443', 2500.00);

-- =========================================================
-- 3. WALLET TRANSACTIONS (Topups and purchases)
-- =========================================================

INSERT INTO wallet_transactions (user_id, type, amount, status, created_at) VALUES
-- Professional traders' topups
('11111111-1111-1111-1111-111111111111', 'TOPUP', 5000.00, 'confirmed', NOW() - INTERVAL '140 days'),
('11111111-1111-1111-1111-111111111111', 'TOPUP', 1000.00, 'confirmed', NOW() - INTERVAL '30 days'),
('11111111-1111-1111-1111-111111111112', 'TOPUP', 3000.00, 'confirmed', NOW() - INTERVAL '110 days'),
('11111111-1111-1111-1111-111111111112', 'TOPUP', 1500.00, 'confirmed', NOW() - INTERVAL '25 days'),
('11111111-1111-1111-1111-111111111113', 'TOPUP', 2500.00, 'confirmed', NOW() - INTERVAL '85 days'),
('11111111-1111-1111-1111-111111111114', 'TOPUP', 2000.00, 'confirmed', NOW() - INTERVAL '70 days'),

-- Regular users' topups
('44444444-4444-4444-4444-444444444441', 'TOPUP', 1000.00, 'confirmed', NOW() - INTERVAL '19 days'),
('44444444-4444-4444-4444-444444444441', 'TOPUP', 500.00, 'confirmed', NOW() - INTERVAL '5 days'),
('44444444-4444-4444-4444-444444444442', 'TOPUP', 1000.00, 'confirmed', NOW() - INTERVAL '17 days'),
('44444444-4444-4444-4444-444444444443', 'TOPUP', 2500.00, 'confirmed', NOW() - INTERVAL '11 days');

-- =========================================================
-- 4. SIGNALS - REALISTIC TRADING SIGNALS
-- Note: Schema has 'direction' with default 'BUY' (always BUY)
-- =========================================================

-- === CRYPTO SIGNALS (LIVE - WAIT_EP) ===
INSERT INTO signals (seller_id, ticker, access_type, price, ep, tp1, tp2, sl, status, created_at) VALUES
('11111111-1111-1111-1111-111111111111', 'BTCUSDT', 'PAID', 49.99, 95500.00, 98000.00, 101000.00, 94000.00, 'WAIT_EP', NOW() - INTERVAL '2 hours'),
('11111111-1111-1111-1111-111111111112', 'ETHUSDT', 'FREE', NULL, 3420.00, 3580.00, 3720.00, 3350.00, 'WAIT_EP', NOW() - INTERVAL '4 hours'),
('11111111-1111-1111-1111-111111111113', 'SOLUSDT', 'PAID', 39.99, 185.50, 195.00, 205.00, 180.00, 'WAIT_EP', NOW() - INTERVAL '6 hours'),
('22222222-2222-2222-2222-222222222221', 'BNBUSDT', 'FREE', NULL, 620.00, 645.00, 665.00, 610.00, 'WAIT_EP', NOW() - INTERVAL '8 hours'),
('11111111-1111-1111-1111-111111111114', 'ADAUSDT', 'PAID', 29.99, 0.98, 1.05, 1.12, 0.94, 'WAIT_EP', NOW() - INTERVAL '12 hours');

-- === CRYPTO SIGNALS (LIVE - IN_TRADE) ===
INSERT INTO signals (seller_id, ticker, access_type, price, ep, tp1, tp2, sl, status, entered_at, created_at) VALUES
('11111111-1111-1111-1111-111111111111', 'BTCUSDT', 'PAID', 49.99, 94000.00, 97500.00, 100000.00, 92500.00, 'IN_TRADE', NOW() - INTERVAL '17 hours 30 minutes', NOW() - INTERVAL '18 hours'),
('11111111-1111-1111-1111-111111111112', 'ETHUSDT', 'PAID', 39.99, 3350.00, 3500.00, 3650.00, 3280.00, 'IN_TRADE', NOW() - INTERVAL '23 hours', NOW() - INTERVAL '1 day'),
('22222222-2222-2222-2222-222222222222', 'XRPUSDT', 'FREE', NULL, 2.45, 2.65, 2.80, 2.35, 'IN_TRADE', NOW() - INTERVAL '23 hours', NOW() - INTERVAL '1 day'),
('11111111-1111-1111-1111-111111111113', 'AVAXUSDT', 'PAID', 34.99, 38.50, 42.00, 45.00, 36.80, 'IN_TRADE', NOW() - INTERVAL '1 day 23 hours', NOW() - INTERVAL '2 days'),
('22222222-2222-2222-2222-222222222221', 'DOTUSDT', 'FREE', NULL, 7.20, 7.80, 8.40, 6.90, 'IN_TRADE', NOW() - INTERVAL '1 day 23 hours', NOW() - INTERVAL '2 days');

-- === STOCK SIGNALS (LIVE - WAIT_EP) ===
INSERT INTO signals (seller_id, ticker, access_type, price, ep, tp1, tp2, sl, status, created_at) VALUES
('11111111-1111-1111-1111-111111111114', 'AAPL', 'PAID', 59.99, 225.00, 235.00, 245.00, 220.00, 'WAIT_EP', NOW() - INTERVAL '5 hours'),
('11111111-1111-1111-1111-111111111111', 'TSLA', 'PAID', 54.99, 380.00, 410.00, 440.00, 365.00, 'WAIT_EP', NOW() - INTERVAL '10 hours'),
('22222222-2222-2222-2222-222222222223', 'NVDA', 'FREE', NULL, 850.00, 900.00, 950.00, 820.00, 'WAIT_EP', NOW() - INTERVAL '14 hours');

-- === CLOSED SIGNALS - TP HIT (Successful trades) ===
INSERT INTO signals (seller_id, ticker, access_type, price, ep, tp1, tp2, sl, status, entered_at, closed_at, created_at) VALUES
('11111111-1111-1111-1111-111111111111', 'BTCUSDT', 'PAID', 49.99, 92000.00, 95000.00, 98000.00, 90500.00, 'CLOSED_TP', NOW() - INTERVAL '4 days 23 hours', NOW() - INTERVAL '2 days', NOW() - INTERVAL '5 days'),
('11111111-1111-1111-1111-111111111112', 'ETHUSDT', 'PAID', 39.99, 3200.00, 3400.00, 3600.00, 3100.00, 'CLOSED_TP', NOW() - INTERVAL '5 days 23 hours', NOW() - INTERVAL '3 days', NOW() - INTERVAL '6 days'),
('11111111-1111-1111-1111-111111111113', 'SOLUSDT', 'FREE', NULL, 175.00, 185.00, 195.00, 170.00, 'CLOSED_TP', NOW() - INTERVAL '6 days 23 hours', NOW() - INTERVAL '4 days', NOW() - INTERVAL '7 days'),
('11111111-1111-1111-1111-111111111111', 'BNBUSDT', 'PAID', 44.99, 600.00, 625.00, 650.00, 590.00, 'CLOSED_TP', NOW() - INTERVAL '7 days 23 hours', NOW() - INTERVAL '5 days', NOW() - INTERVAL '8 days'),
('11111111-1111-1111-1111-111111111114', 'ADAUSDT', 'FREE', NULL, 0.88, 0.95, 1.02, 0.85, 'CLOSED_TP', NOW() - INTERVAL '8 days 23 hours', NOW() - INTERVAL '6 days', NOW() - INTERVAL '9 days'),
('22222222-2222-2222-2222-222222222221', 'XRPUSDT', 'PAID', 34.99, 2.20, 2.40, 2.60, 2.10, 'CLOSED_TP', NOW() - INTERVAL '9 days 23 hours', NOW() - INTERVAL '7 days', NOW() - INTERVAL '10 days'),
('11111111-1111-1111-1111-111111111112', 'LINKUSDT', 'FREE', NULL, 22.00, 24.50, 27.00, 21.00, 'CLOSED_TP', NOW() - INTERVAL '10 days 23 hours', NOW() - INTERVAL '8 days', NOW() - INTERVAL '11 days'),
('22222222-2222-2222-2222-222222222222', 'AVAXUSDT', 'PAID', 39.99, 35.00, 38.00, 41.00, 33.50, 'CLOSED_TP', NOW() - INTERVAL '11 days 23 hours', NOW() - INTERVAL '9 days', NOW() - INTERVAL '12 days'),
('11111111-1111-1111-1111-111111111113', 'MATICUSDT', 'FREE', NULL, 0.75, 0.82, 0.89, 0.72, 'CLOSED_TP', NOW() - INTERVAL '12 days 23 hours', NOW() - INTERVAL '10 days', NOW() - INTERVAL '13 days'),
('11111111-1111-1111-1111-111111111111', 'DOTUSDT', 'PAID', 29.99, 6.80, 7.40, 8.00, 6.50, 'CLOSED_TP', NOW() - INTERVAL '13 days 23 hours', NOW() - INTERVAL '11 days', NOW() - INTERVAL '14 days'),
('11111111-1111-1111-1111-111111111114', 'ATOMUSDT', 'FREE', NULL, 10.50, 11.20, 11.90, 10.00, 'CLOSED_TP', NOW() - INTERVAL '14 days 23 hours', NOW() - INTERVAL '12 days', NOW() - INTERVAL '15 days'),
('22222222-2222-2222-2222-222222222223', 'UNIUSDT', 'PAID', 34.99, 12.00, 13.50, 15.00, 11.50, 'CLOSED_TP', NOW() - INTERVAL '15 days 23 hours', NOW() - INTERVAL '13 days', NOW() - INTERVAL '16 days'),
('11111111-1111-1111-1111-111111111112', 'LTCUSDT', 'FREE', NULL, 98.00, 105.00, 112.00, 95.00, 'CLOSED_TP', NOW() - INTERVAL '16 days 23 hours', NOW() - INTERVAL '14 days', NOW() - INTERVAL '17 days'),
('11111111-1111-1111-1111-111111111111', 'APTUSDT', 'PAID', 44.99, 11.00, 12.50, 14.00, 10.50, 'CLOSED_TP', NOW() - INTERVAL '17 days 23 hours', NOW() - INTERVAL '15 days', NOW() - INTERVAL '18 days'),
('22222222-2222-2222-2222-222222222221', 'OPUSDT', 'FREE', NULL, 3.20, 3.60, 4.00, 3.00, 'CLOSED_TP', NOW() - INTERVAL '18 days 23 hours', NOW() - INTERVAL '16 days', NOW() - INTERVAL '19 days'),
('11111111-1111-1111-1111-111111111111', 'AAPL', 'PAID', 59.99, 210.00, 225.00, 240.00, 205.00, 'CLOSED_TP', NOW() - INTERVAL '19 days 23 hours', NOW() - INTERVAL '17 days', NOW() - INTERVAL '20 days'),
('11111111-1111-1111-1111-111111111113', 'MSFT', 'PAID', 54.99, 380.00, 400.00, 420.00, 370.00, 'CLOSED_TP', NOW() - INTERVAL '20 days 23 hours', NOW() - INTERVAL '18 days', NOW() - INTERVAL '21 days'),
('11111111-1111-1111-1111-111111111114', 'GOOGL', 'FREE', NULL, 145.00, 155.00, 165.00, 140.00, 'CLOSED_TP', NOW() - INTERVAL '21 days 23 hours', NOW() - INTERVAL '19 days', NOW() - INTERVAL '22 days'),
('22222222-2222-2222-2222-222222222222', 'NVDA', 'PAID', 49.99, 800.00, 850.00, 900.00, 780.00, 'CLOSED_TP', NOW() - INTERVAL '22 days 23 hours', NOW() - INTERVAL '20 days', NOW() - INTERVAL '23 days'),
('11111111-1111-1111-1111-111111111112', 'TSLA', 'FREE', NULL, 350.00, 380.00, 410.00, 340.00, 'CLOSED_TP', NOW() - INTERVAL '23 days 23 hours', NOW() - INTERVAL '21 days', NOW() - INTERVAL '24 days');

-- === CLOSED SIGNALS - SL HIT (Failed trades) ===
INSERT INTO signals (seller_id, ticker, access_type, price, ep, tp1, tp2, sl, status, entered_at, closed_at, created_at) VALUES
('22222222-2222-2222-2222-222222222223', 'BTCUSDT', 'PAID', 39.99, 96000.00, 99000.00, 102000.00, 94500.00, 'CLOSED_SL', NOW() - INTERVAL '24 days 23 hours', NOW() - INTERVAL '23 days', NOW() - INTERVAL '25 days'),
('22222222-2222-2222-2222-222222222224', 'ETHUSDT', 'FREE', NULL, 3400.00, 3550.00, 3700.00, 3300.00, 'CLOSED_SL', NOW() - INTERVAL '25 days 23 hours', NOW() - INTERVAL '24 days', NOW() - INTERVAL '26 days'),
('33333333-3333-3333-3333-333333333331', 'SOLUSDT', 'PAID', 29.99, 190.00, 200.00, 210.00, 185.00, 'CLOSED_SL', NOW() - INTERVAL '26 days 23 hours', NOW() - INTERVAL '25 days', NOW() - INTERVAL '27 days'),
('22222222-2222-2222-2222-222222222221', 'XRPUSDT', 'FREE', NULL, 2.50, 2.70, 2.90, 2.40, 'CLOSED_SL', NOW() - INTERVAL '27 days 23 hours', NOW() - INTERVAL '26 days', NOW() - INTERVAL '28 days'),
('33333333-3333-3333-3333-333333333332', 'ADAUSDT', 'PAID', 24.99, 0.92, 0.98, 1.04, 0.88, 'CLOSED_SL', NOW() - INTERVAL '28 days 23 hours', NOW() - INTERVAL '27 days', NOW() - INTERVAL '29 days');

-- === CANCELED SIGNALS ===
INSERT INTO signals (seller_id, ticker, access_type, price, ep, tp1, tp2, sl, status, closed_at, created_at) VALUES
('33333333-3333-3333-3333-333333333331', 'BTCUSDT', 'FREE', NULL, 97000.00, 100000.00, 103000.00, 95500.00, 'CANCELED', NOW() - INTERVAL '29 days 22 hours', NOW() - INTERVAL '30 days'),
('22222222-2222-2222-2222-222222222224', 'ETHUSDT', 'PAID', 34.99, 3450.00, 3600.00, 3750.00, 3350.00, 'CANCELED', NOW() - INTERVAL '30 days 22 hours', NOW() - INTERVAL '31 days'),
('33333333-3333-3333-3333-333333333333', 'BNBUSDT', 'FREE', NULL, 630.00, 655.00, 680.00, 620.00, 'CANCELED', NOW() - INTERVAL '31 days 22 hours', NOW() - INTERVAL '32 days');

-- =========================================================
-- 5. SIGNAL PURCHASES
-- Get signal IDs dynamically to insert purchases
-- =========================================================

-- We'll insert purchases after signals are created
-- For now, we use a workaround with DO block
DO $$
DECLARE
  sig_rec RECORD;
  buyer_ids UUID[] := ARRAY[
    '44444444-4444-4444-4444-444444444441'::UUID,
    '44444444-4444-4444-4444-444444444442'::UUID,
    '44444444-4444-4444-4444-444444444443'::UUID
  ];
  buyer_id UUID;
  purchase_count INT;
BEGIN
  -- Get PAID signals and create purchases
  FOR sig_rec IN 
    SELECT id, created_at 
    FROM signals 
    WHERE access_type = 'PAID' 
    AND status IN ('CLOSED_TP', 'CLOSED_SL', 'IN_TRADE')
    ORDER BY created_at DESC
    LIMIT 15
  LOOP
    -- Randomly assign 1-3 buyers to each signal
    purchase_count := 1 + floor(random() * 3)::INT;
    
    FOR i IN 1..purchase_count LOOP
      buyer_id := buyer_ids[1 + floor(random() * 3)::INT];
      
      -- Insert if not exists
      INSERT INTO signal_purchases (signal_id, user_id, created_at)
      VALUES (sig_rec.id, buyer_id, sig_rec.created_at + INTERVAL '1 hour')
      ON CONFLICT (signal_id, user_id) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- Add corresponding wallet transactions for purchases
INSERT INTO wallet_transactions (user_id, type, amount, status, created_at)
SELECT 
  sp.user_id,
  'SIGNAL_BUY'::VARCHAR(50),
  -s.price,
  'confirmed'::VARCHAR(20),
  sp.created_at
FROM signal_purchases sp
JOIN signals s ON sp.signal_id = s.id
WHERE s.price IS NOT NULL;

-- =========================================================
-- 6. RATING LOGS (ScoreX changes)
-- =========================================================

DO $$
DECLARE
  sig_rec RECORD;
BEGIN
  -- Create rating logs for all closed signals
  FOR sig_rec IN 
    SELECT id, seller_id, status, access_type, ep, tp1, closed_at
    FROM signals 
    WHERE status IN ('CLOSED_TP', 'CLOSED_SL', 'CANCELED')
  LOOP
    IF sig_rec.status = 'CLOSED_TP' THEN
      -- TP hit - positive points
      IF sig_rec.access_type = 'PAID' THEN
        INSERT INTO rating_logs (user_id, signal_id, delta, reason, created_at)
        VALUES (sig_rec.seller_id, sig_rec.id, 2, 'TP', sig_rec.closed_at);
      ELSE
        INSERT INTO rating_logs (user_id, signal_id, delta, reason, created_at)
        VALUES (sig_rec.seller_id, sig_rec.id, 1, 'TP', sig_rec.closed_at);
      END IF;
    ELSIF sig_rec.status = 'CLOSED_SL' THEN
      -- SL hit - negative points
      IF sig_rec.access_type = 'PAID' THEN
        INSERT INTO rating_logs (user_id, signal_id, delta, reason, created_at)
        VALUES (sig_rec.seller_id, sig_rec.id, -3, 'SL', sig_rec.closed_at);
      ELSE
        INSERT INTO rating_logs (user_id, signal_id, delta, reason, created_at)
        VALUES (sig_rec.seller_id, sig_rec.id, -2, 'SL', sig_rec.closed_at);
      END IF;
    ELSIF sig_rec.status = 'CANCELED' THEN
      -- Canceled
      IF sig_rec.access_type = 'PAID' THEN
        INSERT INTO rating_logs (user_id, signal_id, delta, reason, created_at)
        VALUES (sig_rec.seller_id, sig_rec.id, -1, 'CANCEL', sig_rec.closed_at);
      ELSE
        INSERT INTO rating_logs (user_id, signal_id, delta, reason, created_at)
        VALUES (sig_rec.seller_id, sig_rec.id, 0, 'CANCEL', sig_rec.closed_at);
      END IF;
    END IF;
  END LOOP;
END $$;

-- =========================================================
-- 7. SAVED FILTERS
-- =========================================================

INSERT INTO saved_filters (user_id, name, max_price, min_scorex, signal_type, is_active, created_at) VALUES
('44444444-4444-4444-4444-444444444441', 'Premium Signals Only', 50.00, 2000, 'PAID', true, NOW() - INTERVAL '15 days'),
('44444444-4444-4444-4444-444444444441', 'Free High ScoreX', NULL, 1500, 'FREE', true, NOW() - INTERVAL '10 days'),
('44444444-4444-4444-4444-444444444442', 'Affordable Paid', 40.00, 1200, 'PAID', true, NOW() - INTERVAL '12 days'),
('44444444-4444-4444-4444-444444444443', 'Top Traders', NULL, 2500, 'ANY', true, NOW() - INTERVAL '8 days'),
('22222222-2222-2222-2222-222222222221', 'Budget Signals', 30.00, 1000, 'PAID', false, NOW() - INTERVAL '20 days');

-- =========================================================
-- 8. NOTIFICATIONS
-- =========================================================

INSERT INTO notifications (user_id, type, message, is_read, created_at) VALUES
-- Recent notifications for active buyers
('44444444-4444-4444-4444-444444444441', 'FILTER_MATCH', 'New signal matched: BTCUSDT', false, NOW() - INTERVAL '2 hours'),
('44444444-4444-4444-4444-444444444441', 'SIGNAL_UPDATE', 'Your signal ETHUSDT entered trade!', false, NOW() - INTERVAL '1 day'),
('44444444-4444-4444-4444-444444444441', 'SIGNAL_UPDATE', 'TP1 Hit! Signal BTCUSDT closed successfully', true, NOW() - INTERVAL '5 days'),

('44444444-4444-4444-4444-444444444442', 'FILTER_MATCH', 'New signal matched: SOLUSDT', false, NOW() - INTERVAL '6 hours'),
('44444444-4444-4444-4444-444444444442', 'SIGNAL_UPDATE', 'Your signal AVAXUSDT entered trade!', true, NOW() - INTERVAL '2 days'),

('44444444-4444-4444-4444-444444444443', 'FILTER_MATCH', 'New signal matched: AAPL', false, NOW() - INTERVAL '5 hours'),
('44444444-4444-4444-4444-444444444443', 'SIGNAL_UPDATE', 'Your signal BTCUSDT entered trade!', false, NOW() - INTERVAL '18 hours'),
('44444444-4444-4444-4444-444444444443', 'SIGNAL_UPDATE', 'TP1 Hit! Signal ETHUSDT closed successfully', true, NOW() - INTERVAL '6 days'),

-- Seller notifications
('11111111-1111-1111-1111-111111111111', 'SIGNAL_PURCHASE', 'Someone purchased your signal!', true, NOW() - INTERVAL '1 hour'),
('11111111-1111-1111-1111-111111111111', 'RATING_UPDATE', 'Your ScoreX increased by 2 points!', true, NOW() - INTERVAL '5 days'),
('11111111-1111-1111-1111-111111111112', 'SIGNAL_PURCHASE', 'Someone purchased your signal!', true, NOW() - INTERVAL '23 hours'),
('11111111-1111-1111-1111-111111111113', 'RATING_UPDATE', 'Your ScoreX increased by 2 points!', true, NOW() - INTERVAL '21 days');

-- =========================================================
-- 9. PRICE CACHE (Current prices)
-- Skip duplicates if already exist
-- =========================================================

INSERT INTO price_cache (symbol, price, currency, market_time, fetched_at) VALUES
-- Crypto
('BTCUSDT', 95800.00, 'USD', NOW(), NOW()),
('ETHUSDT', 3445.50, 'USD', NOW(), NOW()),
('SOLUSDT', 187.20, 'USD', NOW(), NOW()),
('BNBUSDT', 622.80, 'USD', NOW(), NOW()),
('ADAUSDT', 0.99, 'USD', NOW(), NOW()),
('XRPUSDT', 2.52, 'USD', NOW(), NOW()),
('AVAXUSDT', 39.80, 'USD', NOW(), NOW()),
('DOTUSDT', 7.35, 'USD', NOW(), NOW()),
('LINKUSDT', 23.50, 'USD', NOW(), NOW()),
('MATICUSDT', 0.78, 'USD', NOW(), NOW()),
('UNIUSDT', 12.80, 'USD', NOW(), NOW()),
('ATOMUSDT', 10.90, 'USD', NOW(), NOW()),
('LTCUSDT', 102.50, 'USD', NOW(), NOW()),
('APTUSDT', 11.80, 'USD', NOW(), NOW()),
('OPUSDT', 3.35, 'USD', NOW(), NOW()),
-- Stocks
('AAPL', 227.50, 'USD', NOW(), NOW()),
('TSLA', 392.00, 'USD', NOW(), NOW()),
('NVDA', 865.00, 'USD', NOW(), NOW()),
('MSFT', 395.00, 'USD', NOW(), NOW()),
('GOOGL', 152.00, 'USD', NOW(), NOW())
ON CONFLICT (symbol) DO UPDATE SET
  price = EXCLUDED.price,
  market_time = EXCLUDED.market_time,
  fetched_at = EXCLUDED.fetched_at;

-- =========================================================
-- 10. ACTIVE SYMBOLS
-- =========================================================

INSERT INTO active_symbols (symbol, last_needed_at, reason, priority_score) VALUES
('BTCUSDT', NOW(), 'signal_created', 100),
('ETHUSDT', NOW() - INTERVAL '30 minutes', 'signal_created', 95),
('SOLUSDT', NOW() - INTERVAL '1 hour', 'signal_created', 90),
('BNBUSDT', NOW() - INTERVAL '2 hours', 'signal_created', 85),
('XRPUSDT', NOW() - INTERVAL '3 hours', 'signal_created', 80),
('ADAUSDT', NOW() - INTERVAL '4 hours', 'signal_created', 75),
('AVAXUSDT', NOW() - INTERVAL '5 hours', 'signal_created', 70),
('DOTUSDT', NOW() - INTERVAL '6 hours', 'signal_created', 65),
('AAPL', NOW() - INTERVAL '7 hours', 'signal_created', 60),
('TSLA', NOW() - INTERVAL '8 hours', 'signal_created', 55),
('NVDA', NOW() - INTERVAL '9 hours', 'signal_created', 50)
ON CONFLICT (symbol) DO UPDATE SET
  last_needed_at = EXCLUDED.last_needed_at,
  priority_score = EXCLUDED.priority_score;

-- =========================================================
-- 11. TRAINING CENTERS
-- =========================================================

INSERT INTO training_centers (owner_id, name, description, status, created_at) VALUES
('11111111-1111-1111-1111-111111111111', 'Crypto Wolf Academy', 'Advanced cryptocurrency trading strategies and technical analysis', 'approved', NOW() - INTERVAL '100 days'),
('11111111-1111-1111-1111-111111111112', 'Bull Market Institute', 'Learn how to profit in trending markets with proven strategies', 'approved', NOW() - INTERVAL '80 days'),
('22222222-2222-2222-2222-222222222221', 'Market Hunters Training', 'Identify market opportunities and execute profitable trades', 'pending', NOW() - INTERVAL '5 days'),
('22222222-2222-2222-2222-222222222223', 'Beginner Trading Hub', 'Start your trading journey with fundamentals and risk management', 'rejected', NOW() - INTERVAL '15 days');

-- =========================================================
-- 12. P2P TOPUPS
-- =========================================================

INSERT INTO p2p_topups (user_id, amount, currency, card_type, screenshot_url, status, admin_note, created_at, reviewed_at) VALUES
-- Approved topups
('44444444-4444-4444-4444-444444444441', 500.00, 'USD', 'Visa', 'https://example.com/screenshot1.png', 'approved', NULL, NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'),
('44444444-4444-4444-4444-444444444442', 300.00, 'USD', 'Mastercard', 'https://example.com/screenshot2.png', 'approved', NULL, NOW() - INTERVAL '8 days', NOW() - INTERVAL '8 days'),
('22222222-2222-2222-2222-222222222222', 750.00, 'USD', 'Visa', 'https://example.com/screenshot3.png', 'approved', NULL, NOW() - INTERVAL '12 days', NOW() - INTERVAL '12 days'),

-- Pending topups
('44444444-4444-4444-4444-444444444443', 1000.00, 'USD', 'Visa', 'https://example.com/screenshot4.png', 'pending', NULL, NOW() - INTERVAL '2 hours', NULL),
('33333333-3333-3333-3333-333333333332', 200.00, 'USD', 'Mastercard', 'https://example.com/screenshot5.png', 'pending', NULL, NOW() - INTERVAL '1 day', NULL),

-- Rejected topups
('33333333-3333-3333-3333-333333333331', 150.00, 'USD', 'Visa', 'https://example.com/screenshot6.png', 'rejected', 'Screenshot unclear', NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days');

-- =========================================================
-- SUMMARY & STATISTICS
-- =========================================================

DO $$
DECLARE
  total_users INT;
  total_signals INT;
  total_purchases INT;
  total_wallet_balance DECIMAL;
  live_signals INT;
  closed_signals INT;
BEGIN
  SELECT COUNT(*) INTO total_users FROM users;
  SELECT COUNT(*) INTO total_signals FROM signals;
  SELECT COUNT(*) INTO total_purchases FROM signal_purchases;
  SELECT COALESCE(SUM(balance), 0) INTO total_wallet_balance FROM wallets;
  SELECT COUNT(*) INTO live_signals FROM signals WHERE status IN ('WAIT_EP', 'IN_TRADE');
  SELECT COUNT(*) INTO closed_signals FROM signals WHERE status IN ('CLOSED_TP', 'CLOSED_SL', 'CANCELED');
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'DEMO DATA LOADED SUCCESSFULLY!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total Users: %', total_users;
  RAISE NOTICE 'Total Signals: %', total_signals;
  RAISE NOTICE 'Total Purchases: %', total_purchases;
  RAISE NOTICE 'Total Wallet Balance: $ %', total_wallet_balance;
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Signal Status Breakdown:';
  RAISE NOTICE '- WAIT_EP (Waiting): % signals', (SELECT COUNT(*) FROM signals WHERE status = 'WAIT_EP');
  RAISE NOTICE '- IN_TRADE (Active): % signals', (SELECT COUNT(*) FROM signals WHERE status = 'IN_TRADE');
  RAISE NOTICE '- CLOSED_TP (Won): % signals', (SELECT COUNT(*) FROM signals WHERE status = 'CLOSED_TP');
  RAISE NOTICE '- CLOSED_SL (Lost): % signals', (SELECT COUNT(*) FROM signals WHERE status = 'CLOSED_SL');
  RAISE NOTICE '- CANCELED: % signals', (SELECT COUNT(*) FROM signals WHERE status = 'CANCELED');
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Live Signals: %', live_signals;
  RAISE NOTICE 'Closed Signals: %', closed_signals;
  RAISE NOTICE '========================================';
END $$;