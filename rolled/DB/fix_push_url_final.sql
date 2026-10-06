-- FINAL FIX FOR NOTIFICATIONS
-- The deployed function is named "push-", but we were calling "push"
-- This updates the trigger to hit the correct URL.

create or replace function public.trigger_push_notification()
returns trigger
language plpgsql
security definer
as $$
declare
  -- CORRECT URL (Added the hyphen at the end)
  edge_function_url text := 'https://hbkslwngbsvwiudaxltb.supabase.co/functions/v1/push-';
begin
  perform net.http_post(
    url := edge_function_url,
    body := jsonb_build_object('record', row_to_json(NEW))::jsonb,
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  return NEW;
end;
$$;
