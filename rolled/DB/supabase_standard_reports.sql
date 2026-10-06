-- Standard Reports Table (for public/campus posts)
create table if not exists public.reports (
  id uuid default gen_random_uuid() primary key,
  post_id uuid references public.posts(id) on delete cascade not null,
  reporter_id uuid references public.profiles(id) on delete set null not null,
  reason text not null,
  details text,
  status text default 'pending', -- 'pending', 'resolved', 'dismissed'
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS: Secure the table
alter table public.reports enable row level security;

-- Policy: Authenticated users can create reports
create policy "Users can create reports" 
on public.reports for insert 
to authenticated 
with check (
  auth.uid() = reporter_id
);

-- Policy: Users can view their own reports
create policy "Users can view own reports" 
on public.reports for select 
using (
  auth.uid() = reporter_id
);
