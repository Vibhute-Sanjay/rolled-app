-- 🚨 FINAL AUTH FIX: ADD THE KEY 🚨
-- The error is 401: "Missing authorization header".
-- The Edge Function protects itself. We need to send the Service Role Key.

-- 1. Create the Function with the Auth Header
CREATE OR REPLACE FUNCTION public.trigger_push_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net, extensions
AS $$
DECLARE
  edge_function_url text := 'https://hbkslwngbsvwiudaxltb.supabase.co/functions/v1/push-';
  service_role_key text := 'YOUR_SUPABASE_SERVICE_ROLE_KEY_HERE'; -- ⬅️ REPLACE THIS!
  req_id bigint;
BEGIN
  -- Log Start
  INSERT INTO public.debug_logs (message, details) 
  VALUES ('Trigger Started', row_to_json(NEW)::jsonb);

  BEGIN
      -- Attempt Network Request WITH AUTH HEADER
      SELECT net.http_post(
        url := edge_function_url,
        body := jsonb_build_object('record', row_to_json(NEW))::jsonb,
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || service_role_key
        )
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
