-- CRITICAL FIX: Enable Realtime for Notifications
-- Without this, the frontend will NOT receive updates when new likes/follows occur.

begin;
  -- Add specific table to the publication
  -- This allows 'postgres_changes' events to fire for this table
  alter publication supabase_realtime add table public.notifications;
commit;
