-- COMPREHENSIVE FIX FOR SOCIAL NOTIFICATIONS (Likes, Replies, Votes)
-- This fixes TWO major issues:
-- 1. Regular post notifications routing to /unrolled (wrong screen)
-- 2. Anonymous posts have NO notification triggers at all

-- ============================================
-- PART 1: ADD POST_TYPE FIELD TO NOTIFICATIONS
-- ============================================

-- Add a field to distinguish between 'post' (regular) and 'anon_post' (anonymous)
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS post_type text CHECK (post_type IN ('post', 'anon_post', NULL));

-- ============================================
-- PART 2: UPDATE REGULAR POST TRIGGERS TO SET post_type
-- ============================================

-- A. Likes on regular posts
CREATE OR REPLACE FUNCTION public.handle_new_like()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  post_author_id uuid;
BEGIN
    SELECT user_id INTO post_author_id FROM public.posts WHERE id = NEW.post_id;
    
    IF post_author_id != NEW.user_id THEN
        INSERT INTO public.notifications (user_id, actor_id, type, resource_id, content, post_type)
        VALUES (post_author_id, NEW.user_id, 'like', NEW.post_id, 'liked your roll.', 'post');
    END IF;
    
    RETURN NEW;
END;
$$;

-- B. Comments/Replies on regular posts
CREATE OR REPLACE FUNCTION public.handle_new_comment_fix()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post_owner_id uuid;
BEGIN
    SELECT user_id INTO v_post_owner_id FROM public.posts WHERE id = NEW.post_id;
    
    IF NEW.user_id != v_post_owner_id THEN
        INSERT INTO public.notifications (user_id, actor_id, type, resource_id, content, post_type)
        VALUES (
            v_post_owner_id, 
            NEW.user_id, 
            'reply', 
            NEW.post_id, 
            'replied to your roll: ' || left(NEW.content, 20) || (CASE WHEN length(NEW.content) > 20 THEN '...' ELSE '' END),
            'post'
        );
    END IF;
    
    -- Also handle inline mentions
    PERFORM public.notify_inline_mentions(NEW.content, NEW.user_id, NEW.post_id, 'comment');
    
    RETURN NEW;
END;
$$;

-- ============================================
-- PART 3: CREATE TRIGGERS FOR ANONYMOUS POSTS
-- ============================================

-- C. Upvotes/Downvotes on anonymous posts (anon_votes table)
CREATE OR REPLACE FUNCTION public.handle_new_anon_vote()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  post_identity_id uuid;
  voter_identity_id uuid;
  vote_action text;
BEGIN
    -- Get the post's identity
    SELECT identity_id INTO post_identity_id 
    FROM public.anon_posts WHERE id = NEW.post_id;
    
    -- Get voter's identity (from the anon_identities table via user mapping)
    -- Since anon_votes doesn't store identity_id, we need the user's anon identity
    SELECT id INTO voter_identity_id 
    FROM public.anon_identities WHERE user_id = auth.uid() LIMIT 1;
    
    -- Only notify if it's not the same person
    IF post_identity_id != voter_identity_id AND post_identity_id IS NOT NULL THEN
        -- Determine vote action text
        vote_action := CASE 
            WHEN NEW.vote_type = 1 THEN 'upvoted'
            WHEN NEW.vote_type = -1 THEN 'downvoted'
            ELSE 'voted on'
        END;
        
        -- Get the user_id of the post author from anon_identities
        INSERT INTO public.notifications (user_id, actor_id, type, resource_id, content, post_type)
        SELECT 
            ai.user_id,  -- Post author
            auth.uid(),  -- Voter
            'like',      -- Using 'like' type for consistency
            NEW.post_id,
            vote_action || ' your roll.',
            'anon_post'
        FROM public.anon_identities ai
        WHERE ai.id = post_identity_id;
    END IF;
    
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_new_anon_vote ON public.anon_votes;
CREATE TRIGGER on_new_anon_vote
AFTER INSERT ON public.anon_votes
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_anon_vote();

-- D. Replies on anonymous posts (anon_replies table)
CREATE OR REPLACE FUNCTION public.handle_new_anon_reply()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  post_identity_id uuid;
  commenter_identity_id uuid;
BEGIN
    -- Get the post's identity
    SELECT identity_id INTO post_identity_id 
    FROM public.anon_posts WHERE id = NEW.post_id;
    
    -- Get commenter's identity
    SELECT id INTO commenter_identity_id 
    FROM public.anon_identities WHERE user_id = auth.uid() LIMIT 1;
    
    -- Only notify if it's not the same person
    IF post_identity_id != commenter_identity_id AND post_identity_id IS NOT NULL THEN
        -- Get the user_id of the post author
        INSERT INTO public.notifications (user_id, actor_id, type, resource_id, content, post_type)
        SELECT 
            ai.user_id,  -- Post author
            auth.uid(),  -- Commenter
            'reply',
            NEW.post_id,
            'replied to your roll: ' || left(NEW.content, 20) || (CASE WHEN length(NEW.content) > 20 THEN '...' ELSE '' END),
            'anon_post'
        FROM public.anon_identities ai
        WHERE ai.id = post_identity_id;
    END IF;
    
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_new_anon_reply ON public.anon_replies;
CREATE TRIGGER on_new_anon_reply
AFTER INSERT ON public.anon_replies
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_anon_reply();

-- ============================================
-- PART 4: RELOAD
-- ============================================

NOTIFY pgrst, 'reload config';
