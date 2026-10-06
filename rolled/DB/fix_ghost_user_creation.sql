-- 1. DROP the existing trigger that creates profiles on signup (INSERT)
-- You need to find its name. Common default names:
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- If your trigger had a different name (e.g., 'on_auth_user_insert'), drop that too.
-- DROP TRIGGER IF EXISTS on_auth_user_insert ON auth.users;

-- 2. Create/Update the function to insert profile from metadata
-- This function will now be called when the user becomes VERIFIED.
CREATE OR REPLACE FUNCTION public.handle_new_verified_user() 
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into profiles table
  INSERT INTO public.profiles (id, username, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'username',
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE(NEW.raw_user_meta_data->>'role', 'student')
  )
  ON CONFLICT (id) DO NOTHING; -- Safe against duplicate calls
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create the NEW trigger that runs on UPDATE of auth.users
-- It checks if email_confirmed_at changed from NULL to NOT NULL
DROP TRIGGER IF EXISTS on_auth_user_verified ON auth.users;

CREATE TRIGGER on_auth_user_verified
AFTER UPDATE ON auth.users
FOR EACH ROW
WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
EXECUTE PROCEDURE public.handle_new_verified_user();


-- 4. CLEANUP: Delete Existing Ghost Users
-- Remove profiles for users who are NOT verified yet
DELETE FROM public.profiles
WHERE id IN (
  SELECT id FROM auth.users WHERE email_confirmed_at IS NULL
);
