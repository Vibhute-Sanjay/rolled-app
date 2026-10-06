-- 39_fix_deletion_constraints.sql
-- Fixes critical database issues preventing users from deleting their accounts.

-- 1. Fix Reporting Contradiction
-- Rule: Keep the report, but allow the reporter reference to be cleared if they delete their account.
-- This prevents the "null value violates not-null constraint" error.
ALTER TABLE IF EXISTS public.unified_reports ALTER COLUMN reporter_id DROP NOT NULL;
ALTER TABLE IF EXISTS public.message_reports ALTER COLUMN reporter_id DROP NOT NULL;

-- 2. Fix Posts Cleanup (CASCADE)
-- Rule: When a user is deleted, their posts should be deleted automatically.
-- We drop the existing constraint (if any) and recreate it with ON DELETE CASCADE.
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_user_id_fkey;
ALTER TABLE public.posts ADD CONSTRAINT posts_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 3. Fix Activities Cleanup (CASCADE)
-- Rule: When a user (club) is deleted, their events/rollouts should be deleted automatically.
ALTER TABLE public.activities DROP CONSTRAINT IF EXISTS activities_organizer_id_fkey;
ALTER TABLE public.activities ADD CONSTRAINT activities_organizer_id_fkey 
    FOREIGN KEY (organizer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 4. Fix Blocks Cleanup (CASCADE)
-- Rule: When a user is deleted, their block list entries should be removed.
ALTER TABLE public.blocks DROP CONSTRAINT IF EXISTS blocks_blocker_id_fkey;
ALTER TABLE public.blocks DROP CONSTRAINT IF EXISTS blocks_blocked_id_fkey;
ALTER TABLE public.blocks ADD CONSTRAINT blocks_blocker_id_fkey 
    FOREIGN KEY (blocker_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.blocks ADD CONSTRAINT blocks_blocked_id_fkey 
    FOREIGN KEY (blocked_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 5. Extra Security: Ensure Profiles <-> Auth Users sync is robust
-- Profiles already have "on delete cascade" in supabase_schema.sql, but we ensure it here.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_id_fkey 
    FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
-- 6. Fix Activity Media Cleanup (Trigger)
-- Rule: When an item is deleted, it must trigger the consolidated Edge Function to delete its images.

-- Ensure 'net' schema permissions
GRANT USAGE ON SCHEMA net TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA net TO postgres, anon, authenticated, service_role;

-- Update/Create the generic media trigger function (handles mapping)
CREATE OR REPLACE FUNCTION public.trigger_media_cleanup()
RETURNS TRIGGER AS $$
DECLARE
  service_role_key text := 'YOUR_SERVICE_ROLE_KEY'; 
  url text := 'https://hbkslwngbsvwiudaxltb.supabase.co/functions/v1/delete-cloudinary-asset';
  media_urls_to_delete text[];
BEGIN
  -- Extract URLs based on table structure
  IF TG_TABLE_NAME = 'posts' THEN
    media_urls_to_delete := OLD.media_urls;
  ELSIF TG_TABLE_NAME = 'activities' THEN
    -- Combine cover image and gallery images
    media_urls_to_delete := array_append(COALESCE(OLD.additional_images, '{}'), OLD.cover_image);
  END IF;

  -- Filter out nulls/empty entries
  SELECT array_agg(u) INTO media_urls_to_delete 
  FROM unnest(media_urls_to_delete) u 
  WHERE u IS NOT NULL AND u != '';

  IF media_urls_to_delete IS NOT NULL AND array_length(media_urls_to_delete, 1) > 0 THEN
    -- Correct Call: net.http_post with named arguments
    PERFORM net.http_post(
      url := url,
      body := jsonb_build_object('urls', to_jsonb(media_urls_to_delete)),
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || service_role_key)
    );
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, net;

-- Sync Triggers (Posts)
DROP TRIGGER IF EXISTS on_post_delete_media ON public.posts;
CREATE TRIGGER on_post_delete_media
  AFTER DELETE ON public.posts
  FOR EACH ROW EXECUTE PROCEDURE public.trigger_media_cleanup();

-- Sync Triggers (Activities)
DROP TRIGGER IF EXISTS on_activity_delete_media ON public.activities;
CREATE TRIGGER on_activity_delete_media
  AFTER DELETE ON public.activities
  FOR EACH ROW EXECUTE PROCEDURE public.trigger_media_cleanup();
