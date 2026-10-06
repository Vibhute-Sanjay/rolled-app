-- 🚨 FIX PERMISSIONS & RESTORE 🚨
-- The Trigger is failing to write to the Queue because of missing permissions.
-- We must GRANT permission to write to the 'net' tables.

-- 1. GRANT EVERYTHING on 'net' Schema (Tables & Sequences)
GRANT USAGE ON SCHEMA net TO postgres, anon, authenticated, service_role;

-- CRITICAL: Allow writing to the queue table
GRANT ALL ON ALL TABLES IN SCHEMA net TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA net TO postgres, anon, authenticated, service_role;

-- 2. RESTORE THE REAL FUNCTION (Using 'net.http_post')
CREATE OR REPLACE FUNCTION public.trigger_push_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net, extensions
AS $$
DECLARE
  edge_function_url text := 'https://hbkslwngbsvwiudaxltb.supabase.co/functions/v1/push-';
BEGIN
  -- Real Payload
  PERFORM net.http_post(
    url := edge_function_url,
    body := jsonb_build_object('record', row_to_json(NEW))::jsonb,
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  
  RETURN NEW;
END;
$$;

-- 3. Re-Attach Trigger
DROP TRIGGER IF EXISTS on_notification_created ON public.notifications;
CREATE TRIGGER on_notification_created
AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE PROCEDURE public.trigger_push_notification();
