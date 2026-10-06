-- FIX FOR "NO LOGS" / 401 UNAUTHORIZED
-- Supabase Edge Functions reject requests without an Auth Header by default.
-- This script adds your Anon Key to the request headers.

create or replace function public.trigger_push_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  edge_function_url text := 'https://hbkslwngbsvwiudaxltb.supabase.co/functions/v1/push-';
  -- Your Anon Key (Public safe)
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
