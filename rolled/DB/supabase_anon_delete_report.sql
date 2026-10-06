-- 1. ENABLE DELETION FOR AUTHORS
-- We need to allow a user to delete a post IF they own the identity that created it.
-- Since RLS on 'anon_posts' hides identity linkage from public, we usually can't join easily without a secure function or exposing identity.
-- HOWEVER, 'anon_posts' has 'identity_id'. 'anon_identities' has 'user_id'.
-- We can add a policy using a subquery.

create policy "Authors can delete own anon posts" 
on public.anon_posts for delete 
using (
  identity_id in (
    select id from public.anon_identities where user_id = auth.uid()
  )
);

-- 2. REPORTING SYSTEM

create table if not exists public.anon_reports (
  id uuid default gen_random_uuid() primary key,
  post_id uuid references public.anon_posts(id) on delete cascade not null,
  reporter_identity_id uuid references public.anon_identities(id) on delete set null, -- Nullable if we allow real-user reports too, but let's stick to anon context
  reason text not null, -- 'Harassment', 'Spam', etc.
  details text, -- "He said bad words..."
  status text default 'pending', -- 'pending', 'resolved', 'dismissed'
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS for Reports
alter table public.anon_reports enable row level security;

-- Reporters can view their own reports (optional, good for history)
create policy "Users can view own reports" 
on public.anon_reports for select 
using (
  reporter_identity_id in (
    select id from public.anon_identities where user_id = auth.uid()
  )
);

-- Reporters can create reports
-- We need a secure function or a policy. A policy is fine if we trust the client to send correct identity_id.
-- BUT to be safe and automatic, let's use a function like we did for posting.

create or replace function create_anon_report(
  target_post_id uuid, 
  reason_text text, 
  details_text text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  my_identity_id uuid;
begin
  -- Get ID
  select id into my_identity_id from public.anon_identities where user_id = auth.uid();
  
  if my_identity_id is null then
    return json_build_object('error', 'No anonymous identity found');
  end if;

  -- Insert Report
  insert into public.anon_reports (post_id, reporter_identity_id, reason, details)
  values (target_post_id, my_identity_id, reason_text, details_text);

  return json_build_object('success', true);
end;
$$;
