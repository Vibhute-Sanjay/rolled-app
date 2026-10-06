-- The error you saw means "messages" is ALREADY in realtime, which is good!
-- We only need to run this ONE line to fix the "Delete" issue.
-- This ensures Supabase sends the "id" of the deleted row so the app can remove it.

alter table public.messages replica identity full;
