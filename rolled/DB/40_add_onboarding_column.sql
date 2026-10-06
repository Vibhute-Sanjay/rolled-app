-- Migration 40: Add onboarding completion tracking
-- This ensures users complete their profile before accessing the app

-- 1. Add is_onboarded column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_onboarded BOOLEAN DEFAULT false;

-- 2. Backfill existing users who have complete profiles
-- Mark as onboarded if they have all required fields filled
UPDATE public.profiles
SET is_onboarded = true
WHERE full_name IS NOT NULL 
  AND full_name != ''
  AND major IS NOT NULL 
  AND major != ''
  AND year IS NOT NULL 
  AND year != '';

-- 3. Add index for performance (onboarding checks happen on every login)
CREATE INDEX IF NOT EXISTS idx_profiles_onboarded ON public.profiles(is_onboarded);

-- 4. Verify the migration
SELECT 
  COUNT(*) FILTER (WHERE is_onboarded = true) as onboarded_users,
  COUNT(*) FILTER (WHERE is_onboarded = false) as incomplete_profiles,
  COUNT(*) as total_profiles
FROM public.profiles;
