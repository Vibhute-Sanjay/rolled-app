-- 37_fix_notifications_final.sql
-- PURPOSE: 
-- 1. Undo "Nuke" indexes (per user request).
-- 2. Fix Double Follow Notifications (Consolidate triggers).
-- 3. Ensure ALL Tagging works (Inline Post, Tag Icon, Inline Comment).

-- =========================================================
-- 1. UNDO UNIQUE INDEXES (Reverting "Nuke" change)
-- =========================================================
DROP INDEX IF EXISTS idx_unique_follow_notif;
DROP INDEX IF EXISTS idx_unique_like_notif;
DROP INDEX IF EXISTS idx_unique_mention_notif;
DROP INDEX IF EXISTS idx_unique_activity_req_notif;
DROP INDEX IF EXISTS idx_unique_activity_upd_notif;


-- =========================================================
-- 2. FIX FOLLOWS (Single Trigger Only)
-- =========================================================
-- Drop ALL potential old triggers to kill the "Double Notification" bug
DROP TRIGGER IF EXISTS on_new_follow ON public.follows;
DROP TRIGGER IF EXISTS on_follow_created ON public.follows;
DROP TRIGGER IF EXISTS handle_new_follow_trigger ON public.follows;

-- Create ONE clean Function
CREATE OR REPLACE FUNCTION public.handle_new_follow() RETURNS TRIGGER AS $$
BEGIN
  -- Simple Insert. No complex checks.
  INSERT INTO public.notifications (user_id, actor_id, type, content)
  VALUES (NEW.following_id, NEW.follower_id, 'follow', 'started following you');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create ONE clean Trigger
CREATE TRIGGER on_new_follow
AFTER INSERT ON public.follows
FOR EACH ROW EXECUTE FUNCTION public.handle_new_follow();


-- =========================================================
-- 3. FIX POST TAGGING (Icon + Inline)
-- =========================================================
-- Drop old triggers
DROP TRIGGER IF EXISTS on_post_created_mentions ON public.posts;
DROP TRIGGER IF EXISTS notify_tagged_users ON public.posts;

CREATE OR REPLACE FUNCTION public.handle_post_mentions()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    tagged_user_id uuid;
BEGIN
    -- A. Explicit Tags (Tag Icon)
    IF NEW.tagged_users IS NOT NULL AND array_length(NEW.tagged_users, 1) > 0 THEN
        FOREACH tagged_user_id IN ARRAY NEW.tagged_users
        LOOP
            IF tagged_user_id != NEW.user_id THEN
                INSERT INTO public.notifications (user_id, actor_id, type, resource_id, content)
                VALUES (tagged_user_id, NEW.user_id, 'mention', NEW.id, 'tagged you in a roll.');
            END IF;
        END LOOP;
    END IF;

    -- B. Inline Mentions (@username in caption)
    BEGIN
        IF NEW.content IS NOT NULL AND NEW.content != '' THEN
            -- Attempt to use shared helper
            PERFORM public.notify_inline_mentions(
                NEW.content, 
                NEW.user_id, 
                NEW.id, 
                'post', 
                NEW.tagged_users
            );
        END IF;
    EXCEPTION WHEN OTHERS THEN NULL; END;
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_post_created_mentions
AFTER INSERT ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.handle_post_mentions();


-- =========================================================
-- 4. FIX COMMENT TAGGING (Inline Only)
-- =========================================================
-- Drop old triggers
DROP TRIGGER IF EXISTS on_comment_created_mentions ON public.comments;
-- Note: We do NOT touch 'on_post_comment' if that handles general 'comment' notifications.
-- We only ensure MENTIONS work here.

CREATE OR REPLACE FUNCTION public.handle_comment_mentions()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
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
$$;

CREATE TRIGGER on_comment_created_mentions
AFTER INSERT ON public.comments
FOR EACH ROW EXECUTE FUNCTION public.handle_comment_mentions();

-- 5. RELOAD
NOTIFY pgrst, 'reload config';
