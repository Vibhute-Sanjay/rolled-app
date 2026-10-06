-- 🚑 EMERGENCY FIX: NON-BLOCKING TRIGGER 🚑
-- The previous script blocked the main app because of strict error handling.
-- We must ensure that even if Push fails, the Message/Like SUCCESS.

CREATE OR REPLACE FUNCTION public.trigger_push_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net, extensions
AS $$
DECLARE
  edge_function_url text := 'https://hbkslwngbsvwiudaxltb.supabase.co/functions/v1/push-';
  -- If you haven't put the key yet, this will fail.
  -- BUT we wrap it so it doesn't kill the app.
  service_role_key text := 'YOUR_SUPABASE_SERVICE_ROLE_KEY_HERE'; -- ⬅️ REPLACE THIS IF NEEDED
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
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || service_role_key
        )
      ) INTO req_id;

      -- Log Success
      INSERT INTO public.debug_logs (message, details) 
      VALUES ('HTTP Request Sent', jsonb_build_object('request_id', req_id));

  EXCEPTION WHEN OTHERS THEN
      -- 🛡️ SAFETY NET: Log the error but DO NOT FAIL the transaction
      INSERT INTO public.debug_logs (message, details) 
      VALUES ('Trigger Error (Ignored)', jsonb_build_object('error', SQLERRM));
      -- We swallow the error so the user's message still sends.
  END;
  
  RETURN NEW;
END;
$$;
