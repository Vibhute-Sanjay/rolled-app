-- 🚨 FIX PUSH: SCHEMA PERMISSIONS & PATH 🚨
-- The problem: 'pg_net' is in the 'extensions' schema, but we were calling 'net.http_post'.
-- The Fix: We'll use the Search Path to find the function automatically.

-- 1. CLEANUP (Remove the Bomb)
DROP FUNCTION IF EXISTS public.send_message_push(UUID, UUID, UUID, TEXT);

-- 2. ENSURE PERMISSIONS (On 'extensions' schema too!)
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA extensions TO postgres, anon, authenticated, service_role;

-- 3. THE FIX: Schema-Agnostic Push Function
CREATE OR REPLACE FUNCTION public.trigger_push_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
-- We add 'extensions' to the path so it finds 'http_post' wherever it is
SET search_path = public, extensions, net
AS $$
DECLARE
  edge_function_url text := 'https://hbkslwngbsvwiudaxltb.supabase.co/functions/v1/push-';
BEGIN
  -- We call 'http_post' WITHOUT 'net.' prefix.
  -- The search_path will find it in 'extensions' or 'net'.
  PERFORM http_post(
    url := edge_function_url,
    body := jsonb_build_object('record', row_to_json(NEW))::jsonb,
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  
  RETURN NEW;
END;
$$;

-- 4. Re-Verify Trigger
DROP TRIGGER IF EXISTS on_notification_created ON public.notifications;
CREATE TRIGGER on_notification_created
AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE PROCEDURE public.trigger_push_notification();
