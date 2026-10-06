-- 43_profile_media_webhook.sql

-- 1. Create a function to trigger the edge function on PROFILE DELETE
CREATE OR REPLACE FUNCTION public.trigger_profile_media_on_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  edge_function_url text := 'https://hbkslwngbsvwiudaxltb.supabase.co/functions/v1/delete-post-media';
BEGIN
  -- We construct the payload exactly as the Edge Function expects:
  -- We send the deleted profile row. The edge function now knows how to look for avatar_url and bg_image_url.
  
  -- Optimization: Only fire the webhook if the profile actually had images attached.
  IF OLD.avatar_url IS NOT NULL OR OLD.bg_image_url IS NOT NULL THEN
    PERFORM net.http_post(
      url := edge_function_url,
      body := jsonb_build_object(
        'type', 'DELETE',
        'table', 'profiles',
        'schema', 'public',
        'record', null,
        'old_record', row_to_json(OLD)
      ),
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
  END IF;
  
  RETURN OLD;
END;
$$;

-- 2. Create the trigger on public.profiles
DROP TRIGGER IF EXISTS on_profile_delete_media ON public.profiles;

CREATE TRIGGER on_profile_delete_media
AFTER DELETE ON public.profiles
FOR EACH ROW
EXECUTE PROCEDURE public.trigger_profile_media_on_delete();

-- 3. Reload config to apply pg_net changes
NOTIFY pgrst, 'reload config';
