-- Add push_token column to profiles
alter table public.profiles
add column if not exists push_token text;

-- Comment
comment on column public.profiles.push_token is 'Expo Push Token for notifications';
