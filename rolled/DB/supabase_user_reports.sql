-- User Reports Table (reporting profiles)
create table if not exists public.user_reports (
  id uuid default gen_random_uuid() primary key,
  target_user_id uuid references public.profiles(id) on delete cascade not null,
  reporter_id uuid references public.profiles(id) on delete set null not null,
  reason text not null,
  details text,
  status text default 'pending',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS
alter table public.user_reports enable row level security;

create policy "Users can create user reports" 
on public.user_reports for insert 
to authenticated 
with check (
  auth.uid() = reporter_id
);

create policy "Users can view own user reports" 
on public.user_reports for select 
using (
  auth.uid() = reporter_id
);
