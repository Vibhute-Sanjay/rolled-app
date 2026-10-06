-- Force FULL replica identity to receive all columns on DELETE/UPDATE events
-- This allows us to filter DELETE events by 'room_id' (which is otherwise missing in the 'old' payload)
alter table public.messages replica identity full;

-- Ensure Publication includes messages (Redundant if already done, but safe)
alter publication supabase_realtime add table public.messages;
