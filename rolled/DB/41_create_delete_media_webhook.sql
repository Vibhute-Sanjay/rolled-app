-- 41_create_delete_media_webhook.sql

-- 1. Create a function to trigger the delete-post-media edge function on DELETE
CREATE OR REPLACE FUNCTION public.trigger_delete_media_on_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  edge_function_url text := 'https://hbkslwngbsvwiudaxltb.supabase.co/functions/v1/delete-post-media';
BEGIN
  -- We construct the payload exactly as the Edge Function expects:
  -- { "type": "DELETE", "table": "posts", "schema": "public", "record": null, "old_record": { ... } }
  
  -- Optimization: Only fire the webhook if the post actually had media attached.
  -- This saves unnecessary Edge Function invocations and billing costs.
  IF (OLD.media_urls IS NOT NULL AND array_length(OLD.media_urls, 1) > 0) OR OLD.cloudflare_video_id IS NOT NULL THEN
    PERFORM net.http_post(
      url := edge_function_url,
      body := jsonb_build_object(
        'type', 'DELETE',
        'table', 'posts',
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

-- 2. Create the trigger on public.posts
DROP TRIGGER IF EXISTS on_post_delete_media ON public.posts;

CREATE TRIGGER on_post_delete_media
AFTER DELETE ON public.posts
FOR EACH ROW
EXECUTE PROCEDURE public.trigger_delete_media_on_delete();

-- 3. Reload config to apply pg_net changes
NOTIFY pgrst, 'reload config';
