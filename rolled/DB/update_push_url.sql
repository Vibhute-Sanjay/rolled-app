-- RUN THIS ONLY IF YOUR URL IS WRONG
-- Replace 'YOUR_PROJECT_ID' with your actual Supabase Project Ref (seen in Dashboard > Settings > General)

create or replace function public.trigger_push_notification()
returns trigger
language plpgsql
security definer
as $$
declare
  -- UPDATE THIS LINE WITH YOUR CORRECT ID
  edge_function_url text := 'https://YOUR_PROJECT_ID.supabase.co/functions/v1/push';
begin
  perform net.http_post(
    url := edge_function_url,
    body := jsonb_build_object('record', row_to_json(NEW))::jsonb,
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  return NEW;
end;
$$;
