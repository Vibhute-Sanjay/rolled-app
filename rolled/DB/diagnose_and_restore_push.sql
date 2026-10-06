-- 🚨 EMERGENCY PUSH RESTORE 🚨
-- If Pushes stopped working, it's likely a Permissions or Extension issue.

-- 1. Ensure the Network Extension is ON
-- If this was somehow disabled, no pushes will go out.
CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA extensions;

-- 2. RESET Permissions (The "Nuclear" Option)
-- Ensure 'postgres' and 'authenticated' (users) can actually run the network request.
GRANT USAGE ON SCHEMA net TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA net TO postgres, anon, authenticated, service_role;

-- 3. RESTORE The Function (Exact Copy of last working version)
CREATE OR REPLACE FUNCTION public.trigger_push_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, net
AS $$
DECLARE
  -- The URL that was working before
  edge_function_url text := 'https://hbkslwngbsvwiudaxltb.supabase.co/functions/v1/push-';
BEGIN
  -- Execute the POST request
  PERFORM net.http_post(
    url := edge_function_url,
    body := jsonb_build_object('record', row_to_json(NEW))::jsonb,
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  
  RETURN NEW;
END;
$$;

-- 4. RE-ATTACH Trigger
DROP TRIGGER IF EXISTS on_notification_created ON public.notifications;

CREATE TRIGGER on_notification_created
AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE PROCEDURE public.trigger_push_notification();

-- 5. TEST (Optional: Check if extension is active)
-- You should see "pg_net" in your extensions list after running this.
