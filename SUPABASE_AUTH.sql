-- ============================================================
-- Run this in Supabase SQL Editor to enable customer auth
-- ============================================================

-- 1. Add customer_id to orders (links orders to auth users)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id uuid references auth.users(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_email text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name text;

-- 2. Create customer profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid references auth.users(id) primary key,
  email text,
  name text,
  phone text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. RLS policies for profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- 4. Allow authenticated users to read their own orders
CREATE POLICY "Users can read own orders"
  ON orders FOR SELECT USING (
    auth.uid() = customer_id OR customer_id IS NULL
  );

-- 5. Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
