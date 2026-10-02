-- ================================================================
-- RUN THIS IN SUPABASE SQL EDITOR — fixes the order flow
-- Safe to run even if you ran previous migrations
-- ================================================================

-- 1. Drop and recreate the status constraint with ALL required values
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending','new','claimed','delivered','cancelled','rejected'));

-- 2. Make sure default is 'pending'
ALTER TABLE orders ALTER COLUMN status SET DEFAULT 'pending';

-- 3. Add all store columns (IF NOT EXISTS = safe to re-run)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS rejection_reason      text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS rejected_items        text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS rejected_at           timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS approved_at           timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_payment_intent text;

-- 4. Fix operators role constraint
ALTER TABLE operators DROP CONSTRAINT IF EXISTS operators_role_check;
ALTER TABLE operators ADD CONSTRAINT operators_role_check
  CHECK (role IN ('admin','operator','store'));

-- 5. Add store operator if not already there
INSERT INTO operators (name, pin, role) VALUES ('Store', '9999', 'store')
  ON CONFLICT DO NOTHING;

-- 6. Verify — this should show your recent orders with their statuses
-- SELECT id, order_number, status, created_at FROM orders ORDER BY created_at DESC LIMIT 10;
