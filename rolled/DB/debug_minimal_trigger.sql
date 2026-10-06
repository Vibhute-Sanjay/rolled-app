-- 🧪 DIAGNOSTIC: MINIMAL TRIGGER PAYLOAD 🧪
-- The Manual Test passed. The Trigger fires.
-- But the Real Trigger fails.
-- Hypothesis: Maybe 'row_to_json(NEW)' is crashing/failing silently?

CREATE OR REPLACE FUNCTION public.trigger_push_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net, extensions
AS $$
DECLARE
  edge_function_url text := 'https://hbkslwngbsvwiudaxltb.supabase.co/functions/v1/push-';
BEGIN
  -- 🧪 SEND HARDCODED DATA (Like the Manual Test)
  -- We ignore 'NEW' for a moment to see if the connection works.
  PERFORM net.http_post(
    url := edge_function_url,
    body := '{"type": "TEST_FROM_TRIGGER"}'::jsonb,
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  
  RETURN NEW;
END;
$$;
