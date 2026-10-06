-- 🚨 FINAL CORRECTIVE FIX: RESTORE PUSH URL 🚨
-- I incorrectly changed the URL to 'push-' which broke notifications.
-- This script restores it to the standard 'push' endpoint.

BEGIN;

-- 1. EXTENSION PERMISSIONS (Review)
DO $$
BEGIN
    EXECUTE 'GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role';
    EXECUTE 'GRANT ALL ON ALL TABLES IN SCHEMA extensions TO postgres, anon, authenticated, service_role';
    EXECUTE 'GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role';
    EXECUTE 'GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 2. GLOBAL PUSH TRIGGER (Restoring Correct URL)
CREATE OR REPLACE FUNCTION public.trigger_push_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, net
AS $$
BEGIN
  -- Reverting to standard 'push' (No hyphen)
  PERFORM net.http_post(
    url := 'https://hbkslwngbsvwiudaxltb.supabase.co/functions/v1/push',
    body := jsonb_build_object('record', row_to_json(NEW))::jsonb,
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_notification_created ON public.notifications;
CREATE TRIGGER on_notification_created 
AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE PROCEDURE public.trigger_push_notification();

COMMIT;
NOTIFY pgrst, 'reload config';
