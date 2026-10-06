-- Enable Realtime for Messages Table
-- This is required for clients to receive 'INSERT' updates.

-- 1. Add table to publication
alter publication supabase_realtime add table public.messages;

-- 2. (Optional) Add chat_rooms if you want room updates
alter publication supabase_realtime add table public.chat_rooms;
