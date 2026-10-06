-- 🚨 FINAL PUSH FIX: FORCE 'net' SCHEMA 🚨
-- The screenshot confirms: 'http_post' is in the 'net' schema.
-- So we MUST call 'net.http_post' and we MUST grant permissions to 'net'.

-- 1. Ensure Permissions on 'net' (The one from the screenshot)
GRANT USAGE ON SCHEMA net TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA net TO postgres, anon, authenticated, service_role;

-- 2. The Fix: Explicitly use 'net.http_post'
CREATE OR REPLACE FUNCTION public.trigger_push_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
-- Search path is just backup. We will use explicit names.
SET search_path = public, net, extensions
AS $$
DECLARE
  edge_function_url text := 'https://hbkslwngbsvwiudaxltb.supabase.co/functions/v1/push-';
BEGIN
  -- We explicitly say "net.http_post" because we SAW it there.
  PERFORM net.http_post(
    url := edge_function_url,
    body := jsonb_build_object('record', row_to_json(NEW))::jsonb,
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  
  RETURN NEW;
END;
$$;

-- 3. Re-Attach Trigger (Just to be sure)
DROP TRIGGER IF EXISTS on_notification_created ON public.notifications;
CREATE TRIGGER on_notification_created
AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE PROCEDURE public.trigger_push_notification();
