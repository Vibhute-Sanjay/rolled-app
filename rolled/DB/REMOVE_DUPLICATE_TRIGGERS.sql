-- 🧹 REMOVE DUPLICATE TRIGGERS (SAFE VERSION) 🧹
-- This script safely fixes the "Double Notification" bug.
-- It works by redefining the functions (to ensure they are correct) 
-- and then resetting the triggers to use only ONE trigger per action.
-- IT DOES NOT TOUCH: RLS, Auth Headers, or Push URLs. (Safe to run)

BEGIN;

-- ====================================================
-- 1. LIKES (The Source of Double Notifications)
-- ====================================================

-- A. Define the Single Function (Authoritative)
CREATE OR REPLACE FUNCTION public.handle_new_like() RETURNS TRIGGER AS $$
DECLARE post_author_id uuid;
BEGIN
    SELECT user_id INTO post_author_id FROM public.posts WHERE id = NEW.post_id;
    -- Only notify if not liking own post
    IF post_author_id != NEW.user_id THEN
        INSERT INTO public.notifications (user_id, actor_id, type, resource_id, content)
        VALUES (post_author_id, NEW.user_id, 'like', NEW.post_id, 'liked your roll.');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- B. Remove ALL possible ghost triggers
DROP TRIGGER IF EXISTS on_new_like ON public.likes;
DROP TRIGGER IF EXISTS on_like_created ON public.likes;
DROP TRIGGER IF EXISTS new_like_notification ON public.likes;
DROP TRIGGER IF EXISTS trigger_handle_new_like ON public.likes;
DROP TRIGGER IF EXISTS notify_on_like ON public.likes;

-- C. Add the ONE correct trigger
CREATE TRIGGER on_new_like
AFTER INSERT ON public.likes
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_like();


-- ====================================================
-- 2. COMMENTS / REPLIES
-- ====================================================

-- A. Define Function
CREATE OR REPLACE FUNCTION public.handle_new_comment_fix() RETURNS TRIGGER AS $$
DECLARE v_post_owner_id uuid;
BEGIN
    SELECT user_id INTO v_post_owner_id FROM public.posts WHERE id = NEW.post_id;
    IF NEW.user_id != v_post_owner_id THEN
        INSERT INTO public.notifications (user_id, actor_id, type, resource_id, content)
        VALUES (v_post_owner_id, NEW.user_id, 'reply', NEW.post_id, 'replied to your roll');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- B. Cleanup
DROP TRIGGER IF EXISTS on_new_comment ON public.comments;
DROP TRIGGER IF EXISTS on_post_comment ON public.comments;
DROP TRIGGER IF EXISTS on_comment_created ON public.comments;
DROP TRIGGER IF EXISTS notify_on_comment ON public.comments;

-- C. Add Trigger
CREATE TRIGGER on_new_comment
AFTER INSERT ON public.comments
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_comment_fix();


-- ====================================================
-- 3. FOLLOWS
-- ====================================================

-- A. Define Function
CREATE OR REPLACE FUNCTION public.handle_new_follow() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notifications (user_id, actor_id, type, content)
  VALUES (NEW.following_id, NEW.follower_id, 'follow', 'started following you.');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- B. Cleanup
DROP TRIGGER IF EXISTS on_new_follow ON public.follows;
DROP TRIGGER IF EXISTS on_follow_created ON public.follows;
DROP TRIGGER IF EXISTS notify_on_follow ON public.follows;

-- C. Add Trigger
CREATE TRIGGER on_new_follow
AFTER INSERT ON public.follows
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_follow();

COMMIT;
NOTIFY pgrst, 'reload config';
