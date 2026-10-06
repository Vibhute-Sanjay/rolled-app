-- 1. Add is_verified column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT false;

-- 2. Backfill existing verified users
-- We assume if they have a confirmed_at in auth.users, they are verified.
UPDATE public.profiles
SET is_verified = true
FROM auth.users
WHERE public.profiles.id = auth.users.id
AND auth.users.email_confirmed_at IS NOT NULL;

-- 3. Update the trigger that handles new user creation (if you have one)
-- You likely have a function like 'public.handle_new_user'.
-- You don't need to change the insert, as it defaults to false.
-- BUT you need a NEW trigger to update it when they verify.

-- 4. Create a function to handle verification updates
CREATE OR REPLACE FUNCTION public.handle_user_verification() 
RETURNS TRIGGER AS $$
BEGIN
  -- If email_confirmed_at was null and is now NOT null
  IF OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL THEN
    UPDATE public.profiles
    SET is_verified = true
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create the trigger on auth.users
-- Note: You run this in Supabase SQL Editor.
DROP TRIGGER IF EXISTS on_auth_user_verification ON auth.users;
CREATE TRIGGER on_auth_user_verification
AFTER UPDATE ON auth.users
FOR EACH ROW
EXECUTE PROCEDURE public.handle_user_verification();

-- 6. (Optional) Update RLS Policies or Views to only show verified users
-- Example: 
-- CREATE POLICY "Public profiles are visible if verified" 
-- ON public.profiles FOR SELECT 
-- USING ( is_verified = true );
