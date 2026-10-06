-- ACCOUNT DELETION SCRIPT
-- RUN THIS IN SUPABASE SQL EDITOR

-- Function to completely delete the current user's account
-- 1. Deletes Storage Objects (Images, etc.)
-- 2. Deletes Logic Data (Cascades from auth.users -> profiles -> everything else)
-- 3. Deletes Auth User

CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. Note: Storage Objects (Cloudinary/Cloudflare) are handled by pg_net webhooks.
  -- The on_post_delete_media and on_profile_delete_media triggers will automatically 
  -- fire Edge Functions to clean up external storage when the rows cascade delete.

  -- 2. Delete the User (Trigger Cascade)
  -- This will cascade to public.profiles -> public.posts, public.likes, public.anon_identities, etc.
  DELETE FROM auth.users
  WHERE id = current_user_id;

END;
$$;
