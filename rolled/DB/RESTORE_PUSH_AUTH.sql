-- 🚨 RESTORE PUSH AUTHENTICATION 🚨
-- The root cause was missing the 'Authorization' header in my previous scripts.
-- This script restores the working configuration from 'fix_push_auth.sql'.

BEGIN;

-- 1. Ensure Permissions
DO $$
BEGIN
    EXECUTE 'GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role';
    EXECUTE 'GRANT ALL ON ALL TABLES IN SCHEMA extensions TO postgres, anon, authenticated, service_role';
    EXECUTE 'GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role';
    EXECUTE 'GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 2. Restore Function with AUTH HEADER and CORRECT URL
create or replace function public.trigger_push_notification()
returns trigger
language plpgsql
security definer
-- Ensure we can find 'net'
set search_path = public, extensions, net
as $$
declare
  -- The URL that was working in fix_push_auth.sql
  edge_function_url text := 'https://hbkslwngbsvwiudaxltb.supabase.co/functions/v1/push-';
  
  -- The Key that was working in fix_push_auth.sql
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhia3Nsd25nYnN2d2l1ZGF4bHRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxMjg1MzUsImV4cCI6MjA4MjcwNDUzNX0.7ZfT_oTDbdVGqK3dXGE_T3F6qvkEqdInrFzrgK7XLV0';
begin
  perform net.http_post(
    url := edge_function_url,
    body := jsonb_build_object('record', row_to_json(NEW))::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anon_key
    )
  );
  return NEW;
end;
$$;

DROP TRIGGER IF EXISTS on_notification_created ON public.notifications;
CREATE TRIGGER on_notification_created 
AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE PROCEDURE public.trigger_push_notification();

COMMIT;
NOTIFY pgrst, 'reload config';
