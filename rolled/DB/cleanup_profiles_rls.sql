-- CLEANUP PROFILES RLS
-- You have duplicate policies (e.g., "Users can update own profile" appears twice).
-- This script removes the clutter and sets ONE clear rule for everything.

-- 1. Drop existing policies (to clean up duplicates)
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles; -- variation without dot
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles; -- variation without dot
DROP POLICY IF EXISTS "Everyone can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own last_seen" ON public.profiles;

-- 2. Re-create Clean Policies

-- A. VIEW: Everyone can see basic profile info
CREATE POLICY "Enable read access for all users"
ON public.profiles FOR SELECT
USING (true);

-- B. INSERT: Users can create their own profile
CREATE POLICY "Enable insert for users based on user_id"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- C. UPDATE: Users can update ONLY their own profile
CREATE POLICY "Enable update for users based on user_id"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

-- 3. Verify the 'push_token' column exists (just in case)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'push_token') THEN
        ALTER TABLE public.profiles ADD COLUMN push_token text;
    END IF;
END $$;
