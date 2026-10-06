-- 🔓 ENABLE THREADING & LIKES PERMISSIONS 🔓
-- This script ensures users can Reply and Like comments.
-- It is SAFE and does NOT touch Messages or Notifications.

BEGIN;

-- 1. COMMENTS TABLE (Replies)
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- Allow Inserts for Authenticated Users (Fixes "Reply Failed")
DROP POLICY IF EXISTS "Auth users can comment" ON public.comments;
CREATE POLICY "Auth users can comment" ON public.comments 
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow Viewing (Public)
DROP POLICY IF EXISTS "Public comments viewable" ON public.comments;
CREATE POLICY "Public comments viewable" ON public.comments 
FOR SELECT USING (true);


-- 2. COMMENT_LIKES TABLE (Hearts)
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

-- Allow Inserts (Fixes "Like Failed")
DROP POLICY IF EXISTS "Auth users can like comments" ON public.comment_likes;
CREATE POLICY "Auth users can like comments" ON public.comment_likes 
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow Deletes (Fixes "Unlike Failed")
DROP POLICY IF EXISTS "Auth users can unlike comments" ON public.comment_likes;
CREATE POLICY "Auth users can unlike comments" ON public.comment_likes 
FOR DELETE USING (auth.uid() = user_id);

-- Allow Viewing
DROP POLICY IF EXISTS "Public comment likes viewable" ON public.comment_likes;
CREATE POLICY "Public comment likes viewable" ON public.comment_likes 
FOR SELECT USING (true);

COMMIT;
NOTIFY pgrst, 'reload config';
