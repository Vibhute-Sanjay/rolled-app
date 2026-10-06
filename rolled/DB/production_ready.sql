-- PRODUCTION READY SETUP
-- Run this in Supabase SQL Editor

BEGIN;

-- 1. Enable Realtime for all interactive tables
-- This ensures 'PostCard' and 'FeedHeader' update instantly
ALTER PUBLICATION supabase_realtime ADD TABLE public.likes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
-- (In case they were missing)
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_rooms;

-- 2. Ensure RLS Policies allow "Select" (Reading)
-- LIKES: Everyone can see likes
CREATE POLICY "Public can view likes" ON public.likes FOR SELECT USING (true);

-- COMMENTS: Everyone can see comments
CREATE POLICY "Public can view comments" ON public.comments FOR SELECT USING (true);

-- NOTIFICATIONS: Users can see their own
-- (Existing policy likely exists, but this ensures it)
-- CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);

COMMIT;
