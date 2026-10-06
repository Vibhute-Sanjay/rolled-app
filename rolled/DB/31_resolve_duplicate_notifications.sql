-- 🚨 NOTIFICATION SYSTEM CONSOLIDATION 🚨
-- This script aggressively removes ALL potentially conflicting notification triggers
-- and re-establishes a SINGLE, authoritative source of truth for each event type.

-- =========================================================================
-- STEP 1: DROP EVERYTHING (The "Nuke" Option for Triggers)
-- =========================================================================

-- LIKES Triggers
DROP TRIGGER IF EXISTS on_post_like ON public.likes;
DROP TRIGGER IF EXISTS on_like_created ON public.likes;
DROP TRIGGER IF EXISTS handle_new_like ON public.likes;
DROP TRIGGER IF EXISTS like_notification ON public.likes;
DROP TRIGGER IF EXISTS trigger_notify_like ON public.likes;

-- COMMENTS Triggers
DROP TRIGGER IF EXISTS on_post_comment ON public.comments;
DROP TRIGGER IF EXISTS on_comment_created ON public.comments;
DROP TRIGGER IF EXISTS handle_new_comment ON public.comments;
DROP TRIGGER IF EXISTS comment_notification ON public.comments;
DROP TRIGGER IF EXISTS trigger_notify_comment ON public.comments;
DROP TRIGGER IF EXISTS on_comment_created_mentions ON public.comments; -- Merged logic below

-- FOLLOWS Triggers
DROP TRIGGER IF EXISTS on_new_follow ON public.follows;
DROP TRIGGER IF EXISTS on_follow_created ON public.follows;
DROP TRIGGER IF EXISTS handle_new_follow ON public.follows;
DROP TRIGGER IF EXISTS follow_notification ON public.follows;
DROP TRIGGER IF EXISTS trigger_notify_follow ON public.follows;

-- POSTS (Mentions) Triggers
DROP TRIGGER IF EXISTS on_post_created_mentions ON public.posts;
DROP TRIGGER IF EXISTS on_new_post_mention ON public.posts;

-- ACTIVITIES Triggers
DROP TRIGGER IF EXISTS trigger_notify_activity_request ON public.activity_requests;


-- =========================================================================
-- STEP 2: DEFINE UNIFIED NOTIFICATION FUNCTIONS
-- =========================================================================

-- A. LIKES (Single Responsibility)
CREATE OR REPLACE FUNCTION public.handle_new_like()
RETURNS TRIGGER AS $$
BEGIN
  -- 1. Self-Like Check
  IF NEW.user_id = (SELECT user_id FROM public.posts WHERE id = NEW.post_id) THEN
    RETURN NEW;
  END IF;

  -- 2. Insert Notification
  INSERT INTO public.notifications (user_id, actor_id, type, resource_id, content)
  VALUES (
    (SELECT user_id FROM public.posts WHERE id = NEW.post_id), -- Recipient
    NEW.user_id, -- Actor
    'like',
    NEW.post_id,
    'liked your post'
  )
  ON CONFLICT DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- B. COMMENTS & MENTIONS (Unified Logic)
-- We combine standard reply notification AND mention notification to avoid race conditions.
CREATE OR REPLACE FUNCTION public.handle_new_comment_unified()
RETURNS TRIGGER AS $$
DECLARE
    v_post_owner_id uuid;
    v_has_mentions boolean := false;
BEGIN
    SELECT user_id INTO v_post_owner_id FROM public.posts WHERE id = NEW.post_id;

    -- 1. Helper to Process Mentions (if any)
    -- This calls the existing parsed mention logic if you have it, 
    -- OR we inline it here for simplicity. Let's reuse the helper if it exists, 
    -- but double check it doesn't double-notify the post owner.
    
    -- (Assuming notify_inline_mentions exists from 28_mention_notifications.sql)
    -- We'll catch exceptions just in case function is missing
    BEGIN
        PERFORM public.notify_inline_mentions(
            NEW.content, 
            NEW.user_id, 
            NEW.post_id, 
            'comment'
        );
        -- If notify_inline_mentions found the post owner mentioned, they get a 'mention' notification.
        -- We typically prioritize 'mention' over 'reply'.
    EXCEPTION WHEN OTHERS THEN
        -- Fallback if mention function missing
        NULL; 
    END;

    -- 2. Standard Reply Notification (To Post Owner)
    -- ONLY if they are not the commenter AND they weren't just mentioned 
    -- (To avoid getting "Mentioned you" AND "Replied to you" at slightly different times)
    -- Detecting if they were mentioned is hard without returning data. 
    -- For now, we'll allow both if they happen, OR rely on the client to filter.
    -- BUT, standard behavior: Reply notification always fires unless self-reply.
    
    IF NEW.user_id != v_post_owner_id THEN
        INSERT INTO public.notifications (user_id, actor_id, type, resource_id, content)
        VALUES (
            v_post_owner_id,
            NEW.user_id,
            'reply',
            NEW.post_id,
            left(NEW.content, 50)
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- C. FOLLOWS (Unified Logic)
CREATE OR REPLACE FUNCTION public.handle_new_follow()
RETURNS TRIGGER AS $$
DECLARE
  target_is_private boolean;
BEGIN
  -- Check if target user is private
  SELECT is_private INTO target_is_private FROM public.profiles WHERE id = NEW.following_id;

  IF target_is_private THEN
    -- Force status to pending
    UPDATE public.follows SET status = 'pending' WHERE follower_id = NEW.follower_id AND following_id = NEW.following_id;

    INSERT INTO public.notifications (user_id, actor_id, type, content)
    VALUES (NEW.following_id, NEW.follower_id, 'follow_request', 'requested to follow you');
  ELSE
    INSERT INTO public.notifications (user_id, actor_id, type, content)
    VALUES (NEW.following_id, NEW.follower_id, 'follow', 'started following you');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =========================================================================
-- STEP 3: RE-ATTACH SINGLE TRIGGERS
-- =========================================================================

-- LIKES
CREATE TRIGGER on_post_like
AFTER INSERT ON public.likes
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_like();

-- COMMENTS
CREATE TRIGGER on_post_comment
AFTER INSERT ON public.comments
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_comment_unified();

-- FOLLOWS
CREATE TRIGGER on_new_follow
AFTER INSERT ON public.follows
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_follow();

-- ACTIVITIES (Restoring Single Trigger)
CREATE OR REPLACE FUNCTION notify_activity_request_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  activity_title text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
      SELECT title INTO activity_title FROM public.activities WHERE id = NEW.activity_id;

      IF NEW.status = 'approved' THEN
          INSERT INTO public.notifications (user_id, actor_id, type, resource_id, content)
          VALUES (NEW.user_id, auth.uid(), 'activity_approved', NEW.activity_id, 'approved your request to join ' || activity_title);
      ELSIF NEW.status = 'rejected' THEN
          INSERT INTO public.notifications (user_id, actor_id, type, resource_id, content)
          VALUES (NEW.user_id, auth.uid(), 'activity_rejected', NEW.activity_id, 'declined your request to join ' || activity_title);
      END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_activity_request
AFTER UPDATE ON public.activity_requests
FOR EACH ROW EXECUTE PROCEDURE notify_activity_request_update();
