-- 40_webhook_and_status.sql

-- 1. Create a function to trigger the new-post-notification edge function on UPDATE
CREATE OR REPLACE FUNCTION public.trigger_new_post_notification_on_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  edge_function_url text := 'https://hbkslwngbsvwiudaxltb.supabase.co/functions/v1/new-post-notification';
BEGIN
  IF OLD.status != 'published' AND NEW.status = 'published' THEN
    PERFORM net.http_post(
      url := edge_function_url,
      body := jsonb_build_object('record', row_to_json(NEW)),
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- 2. Create the trigger on public.posts
DROP TRIGGER IF EXISTS on_post_status_published ON public.posts;

CREATE TRIGGER on_post_status_published
AFTER UPDATE ON public.posts
FOR EACH ROW
EXECUTE PROCEDURE public.trigger_new_post_notification_on_update();

-- 3. Reload config just in case
NOTIFY pgrst, 'reload config';
