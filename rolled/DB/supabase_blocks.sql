-- Create blocks table
create table if not exists public.blocks (
  id uuid default gen_random_uuid() primary key,
  blocker_id uuid references public.profiles(id) not null,
  blocked_id uuid references public.profiles(id) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(blocker_id, blocked_id)
);

-- RLS
alter table public.blocks enable row level security;

create policy "Users can see their own blocks"
  on public.blocks for select
  using (auth.uid() = blocker_id);

create policy "Users can block others"
  on public.blocks for insert
  with check (auth.uid() = blocker_id);

create policy "Users can unblock"
  on public.blocks for delete
  using (auth.uid() = blocker_id);
