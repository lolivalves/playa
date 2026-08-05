-- ============================================================
-- Run this in Supabase SQL Editor to enable the Store panel
-- ============================================================

-- 1. Update orders status to include pending and rejected
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending','new','claimed','delivered','cancelled','rejected'));

-- 2. Add store-related columns
ALTER TABLE orders ADD COLUMN IF NOT EXISTS rejection_reason   text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS rejected_items      text; -- comma-separated list of unavailable items
ALTER TABLE orders ADD COLUMN IF NOT EXISTS rejected_at        timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS approved_at        timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_payment_intent text;

-- 3. New orders now start as 'pending' (store must approve first)
ALTER TABLE orders ALTER COLUMN status SET DEFAULT 'pending';

-- 4. Add 'store' role to operators table
ALTER TABLE operators DROP CONSTRAINT IF EXISTS operators_role_check;
ALTER TABLE operators ADD CONSTRAINT operators_role_check
  CHECK (role IN ('admin','operator','store'));

-- 5. Insert a store person — change the PIN '9999' to whatever you want
INSERT INTO operators (name, pin, role) VALUES ('Store', '9999', 'store')
  ON CONFLICT DO NOTHING;
