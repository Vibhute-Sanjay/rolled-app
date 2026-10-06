-- Enable Realtime for Likes and Comments
begin;
  alter publication supabase_realtime add table public.likes;
  alter publication supabase_realtime add table public.comments;
  alter publication supabase_realtime add table public.notifications; -- ensure it is added
commit;
