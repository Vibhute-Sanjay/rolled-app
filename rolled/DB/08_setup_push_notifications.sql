-- 1. Enable pg_net extension (Required for HTTP calls)
create extension if not exists pg_net;

-- 2. Create the Trigger Function
create or replace function public.trigger_push_notification()
returns trigger
language plpgsql
security definer
as $$
declare
  -- CHANGE THIS URL to your actual deployed Edge Function URL
  -- Example: 'https://<project-ref>.supabase.co/functions/v1/push'
  -- You can find this in the Supabase Dashboard > Edge Functions
  edge_function_url text := 'https://hbkslwngbsvwiudaxltb.supabase.co/functions/v1/push';
  
  -- Service Role Key (Optional: Access via Vault or just assume function is public/verified by JWT?)
  -- Typically Webhooks are signed, or we include a secret header. 
  -- For V1 simple setup, we'll just POST the record.
begin
  -- Perform Async HTTP Request via pg_net
  perform net.http_post(
    url := edge_function_url,
    body := jsonb_build_object('record', row_to_json(NEW))::jsonb,
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  
  return NEW;
end;
$$;

-- 3. Create the Trigger
drop trigger if exists on_notification_created on public.notifications;

create trigger on_notification_created
after insert on public.notifications
for each row
execute procedure public.trigger_push_notification();
