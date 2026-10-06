-- 🕵️‍♂️ FLIGHT RECORDER: DEBUG LOGGING 🕵️‍♂️
-- We are solving a paradox: The code runs (no crash), but no output (no queue).
-- We will create a log table to track EXACTLY what the trigger does step-by-step.

-- 1. Create a Debug Table
CREATE TABLE IF NOT EXISTS public.debug_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    message TEXT,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Grant Access so the trigger can write to it
GRANT ALL ON public.debug_logs TO postgres, anon, authenticated, service_role;

-- 2. Update the Function with Logging
CREATE OR REPLACE FUNCTION public.trigger_push_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net, extensions
AS $$
DECLARE
  edge_function_url text := 'https://hbkslwngbsvwiudaxltb.supabase.co/functions/v1/push-';
  req_id bigint;
BEGIN
  -- Log Start
  INSERT INTO public.debug_logs (message, details) 
  VALUES ('Trigger Started', row_to_json(NEW)::jsonb);

  BEGIN
      -- Attempt Network Request
      SELECT net.http_post(
        url := edge_function_url,
        body := jsonb_build_object('record', row_to_json(NEW))::jsonb,
        headers := '{"Content-Type": "application/json"}'::jsonb
      ) INTO req_id;

      -- Log Success
      INSERT INTO public.debug_logs (message, details) 
      VALUES ('HTTP Request Sent', jsonb_build_object('request_id', req_id, 'url', edge_function_url));

  EXCEPTION WHEN OTHERS THEN
      -- Log Failure
      INSERT INTO public.debug_logs (message, details) 
      VALUES ('Trigger Failed', jsonb_build_object('error', SQLERRM, 'state', SQLSTATE));
  END;
  
  RETURN NEW;
END;
$$;

-- 3. Re-Verify Trigger
DROP TRIGGER IF EXISTS on_notification_created ON public.notifications;
CREATE TRIGGER on_notification_created
AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE PROCEDURE public.trigger_push_notification();

-- 4. Check Logs (Run this AFTER sending a message)
SELECT * FROM public.debug_logs ORDER BY created_at DESC LIMIT 5;
