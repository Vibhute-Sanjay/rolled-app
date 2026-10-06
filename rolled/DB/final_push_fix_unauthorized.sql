-- FINAL AUTO-FIX FOR PUSH NOTIFICATIONS
-- NO MANUAL EDITS REQUIRED - JUST COPY AND RUN

CREATE OR REPLACE FUNCTION public.trigger_push_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, net, extensions
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://hbkslwngbsvwiudaxltb.supabase.co/functions/v1/push',
    body := jsonb_build_object('record', row_to_json(NEW))::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhia3Nsd25nYnN2d2l1ZGF4bHRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxMjg1MzUsImV4cCI6MjA4MjcwNDUzNX0.7ZfT_oTDbdVGqK3dXGE_T3F6qvkEqdInrFzrgK7XLV0'
    )
  );
  RETURN NEW;
END;
$$;

-- Reload configuration to apply immediately
NOTIFY pgrst, 'reload config';
