-- 34_cleanup_notifications.sql
-- PURPOSE: Remove notifications when the underlying action is undone (Unfollow, Unlike).
-- This prevents "tap-tap-tap" spam.

-- 1. UNFOLLOW CLEANUP
CREATE OR REPLACE FUNCTION public.handle_unfollow()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete the 'follow' or 'follow_request' notification linking these two users
  DELETE FROM public.notifications 
  WHERE type IN ('follow', 'follow_request')
    AND actor_id = OLD.follower_id 
    AND user_id = OLD.following_id;
    
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_unfollow ON public.follows;
CREATE TRIGGER on_unfollow
AFTER DELETE ON public.follows
FOR EACH ROW EXECUTE PROCEDURE public.handle_unfollow();


-- 2. UNLIKE CLEANUP
CREATE OR REPLACE FUNCTION public.handle_unlike()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete the 'like' notification for this specific post/user combo
  DELETE FROM public.notifications 
  WHERE type = 'like'
    AND actor_id = OLD.user_id 
    AND resource_id = OLD.post_id; -- resource_id stores post_id for likes
    
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_unlike ON public.likes;
CREATE TRIGGER on_unlike
AFTER DELETE ON public.likes
FOR EACH ROW EXECUTE PROCEDURE public.handle_unlike();
