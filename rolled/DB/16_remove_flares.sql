-- Remove Flare Stories Feature (Robust Script)

-- 1. Drop Dependencies (Triggers & Functions)
-- Must drop trigger first because it depends on columns
DROP TRIGGER IF EXISTS set_flare_expiration ON public.posts;
DROP FUNCTION IF EXISTS public.calculate_flare_expiration();
DROP FUNCTION IF EXISTS public.get_active_flare_users(uuid);

-- 2. Clean up RLS Policies
-- Drop the policy that uses 'expires_at' (created in fix_flare_logic.sql)
DROP POLICY IF EXISTS "Everyone can view active posts" ON public.posts;

-- Restore standard public access
-- (We recreate the main policy to ensure feed is visible)
DROP POLICY IF EXISTS "Everyone can read posts" ON public.posts;
CREATE POLICY "Everyone can read posts" ON public.posts FOR SELECT USING (true);

-- 3. Drop Columns
ALTER TABLE public.posts 
DROP COLUMN IF EXISTS is_flare,
DROP COLUMN IF EXISTS flare_duration,
DROP COLUMN IF EXISTS expires_at;
