-- FIX CHAT MESSAGES SCHEMA
-- It seems the 'messages' table might be missing the columns needed for sharing content,
-- causing fetchMessages to fail when it tries to join 'posts' or 'activities'.

-- 1. Add 'post_id' (for sharing Standard Rolls)
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS post_id UUID REFERENCES public.posts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_messages_post_id ON public.messages(post_id);

-- 2. Add 'activity_id' (for sharing Activities)
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS activity_id UUID REFERENCES public.activities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_messages_activity_id ON public.messages(activity_id);

-- 3. Add 'anon_post_id' (for sharing Anonymous Rolls)
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS anon_post_id UUID REFERENCES public.anon_posts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_messages_anon_post_id ON public.messages(anon_post_id);

-- 4. Verify RLS for these related tables (Just in case)
-- Ensure 'anon_posts' and 'activities' are public readable so joins don't fail RLS
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone can view activities" ON public.activities FOR SELECT USING (true);
-- (Note: Policy name might conflict if exists, but pure 'create policy' errors if exists. 
-- Using 'DO' block or just assuming user can ignore 'policy exists' error is safer, or dropping first.)
DROP POLICY IF EXISTS "Everyone can view activities" ON public.activities;
CREATE POLICY "Everyone can view activities" ON public.activities FOR SELECT USING (true);
