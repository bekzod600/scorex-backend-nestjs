-- Add display_name and bio columns to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS display_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS bio VARCHAR(300);
