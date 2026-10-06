-- 🚀 FINAL THREADING & LIKES ENABLE SCRIPT 🚀
-- This script safely enables:
-- 1. Threaded Replies (for both Normal & Anon posts)
-- 2. Comment Likes (for both)
-- 3. Fixes crashes on Anon Replies

BEGIN;

-- ==========================================================
-- 1. PERMISSIONS (RLS) - Allow Users to Save Replies & Likes
-- ==========================================================

-- A. COMMENTS (Replies)
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- Allow Inserts linked to valid users
DROP POLICY IF EXISTS "Auth users can comment" ON public.comments;
CREATE POLICY "Auth users can comment" ON public.comments 
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow Viewing
DROP POLICY IF EXISTS "Public comments viewable" ON public.comments;
CREATE POLICY "Public comments viewable" ON public.comments 
FOR SELECT USING (true);


-- B. COMMENT LIKES (Hearts)
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

-- Allow Liking
DROP POLICY IF EXISTS "Auth users can like comments" ON public.comment_likes;
CREATE POLICY "Auth users can like comments" ON public.comment_likes 
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow Unliking
DROP POLICY IF EXISTS "Auth users can unlike comments" ON public.comment_likes;
CREATE POLICY "Auth users can unlike comments" ON public.comment_likes 
FOR DELETE USING (auth.uid() = user_id);

-- Allow Viewing
DROP POLICY IF EXISTS "Public comment likes viewable" ON public.comment_likes;
CREATE POLICY "Public comment likes viewable" ON public.comment_likes 
FOR SELECT USING (true);


-- ==========================================================
-- 2. TRIGGERS FIX (Prevents Crashes on "Reply to Reply")
-- ==========================================================

-- Fix 'handle_new_comment_fix'
-- Problem: It crashed if 'post_id' was missing (Anon) or if logic was brittle.
-- Solution: Gracefully handle NULL post_id.
CREATE OR REPLACE FUNCTION public.handle_new_comment_fix() 
RETURNS TRIGGER AS $$
DECLARE v_post_owner_id uuid;
BEGIN
    -- ✅ SAFETY: Skip explicit post notifications for Anon Comments (logic handled elsewhere or unnecessary)
    IF NEW.post_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT user_id INTO v_post_owner_id FROM public.posts WHERE id = NEW.post_id;
    
    -- Notify Post Owner of a new comment
    IF v_post_owner_id IS NOT NULL AND NEW.user_id != v_post_owner_id THEN
        INSERT INTO public.notifications (user_id, actor_id, type, resource_id, content)
        VALUES (v_post_owner_id, NEW.user_id, 'reply', NEW.post_id, 'replied to your roll');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Fix 'handle_comment_mentions'
-- Problem: Crashed on Anon posts.
CREATE OR REPLACE FUNCTION public.handle_comment_mentions() 
RETURNS TRIGGER AS $$
BEGIN
    -- ✅ SAFETY: Skip for now if no post_id, to prevent crash.
    IF NEW.post_id IS NULL THEN
        RETURN NEW;
    END IF;

    BEGIN
        IF NEW.content IS NOT NULL AND NEW.content != '' THEN
            PERFORM public.notify_inline_mentions(
                NEW.content, 
                NEW.user_id, 
                NEW.post_id, 
                'comment'
            );
        END IF;
    EXCEPTION WHEN OTHERS THEN NULL; END;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;

NOTIFY pgrst, 'reload config';
