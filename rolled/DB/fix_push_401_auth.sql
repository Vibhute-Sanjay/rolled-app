-- Fix 401 Unauthorized Error for Push Notifications
-- The trigger_push_notification function needs to include the anon key in headers

CREATE OR REPLACE FUNCTION public.trigger_push_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, net, extensions
AS $$
BEGIN
  -- Include Authorization header with anon key
  PERFORM net.http_post(
    url := 'https://hbkslwngbsvwiudaxltb.supabase.co/functions/v1/push',
    body := jsonb_build_object('record', row_to_json(NEW))::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('request.headers')::json->>'authorization'
    )
  );
  RETURN NEW;
END;
$$;

-- Reload
NOT IFY pgrst, 'reload config';
