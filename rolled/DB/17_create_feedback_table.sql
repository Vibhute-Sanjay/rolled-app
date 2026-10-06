-- Create Feedback Table
create table if not exists public.feedback (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete set null,
    type text check (type in ('feedback', 'bug', 'other')) default 'feedback',
    message text not null,
    device_info jsonb,
    status text default 'open',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.feedback enable row level security;

-- Policies
create policy "Users can insert their own feedback"
    on public.feedback for insert
    with check (auth.uid() = user_id);

create policy "Admins can view feedback"
    on public.feedback for select
    using ( exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') );
