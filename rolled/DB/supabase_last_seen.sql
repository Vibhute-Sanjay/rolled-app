-- Add last_seen to profiles
alter table public.profiles 
add column if not exists last_seen timestamp with time zone default timezone('utc'::text, now());

-- Policy to allow users to update their own last_seen
-- (Existing update policy might cover this, but ensuring it's open)
create policy "Users can update their own last_seen"
on public.profiles for update
using ( id = auth.uid() )
with check ( id = auth.uid() );
