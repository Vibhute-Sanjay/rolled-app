-- SAFE FIX FOR SOCIAL NOTIFICATIONS
-- This ONLY updates what exists and won't break anything
-- Adds post_type field to route regular posts correctly

-- ============================================
-- PART 1: ADD POST_TYPE FIELD (SAFE - adds optional column)
-- ============================================

ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS post_type text CHECK (post_type IN ('post', 'anon_post', NULL));

-- ============================================
-- PART 2: UPDATE REGULAR POST TRIGGERS
-- ============================================

-- A. Likes on regular posts (existing trigger - just adding post_type)
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

-- B. Comments/Replies on regular posts (existing trigger - just adding post_type)
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
    
    -- Also handle inline mentions (existing logic)
    PERFORM public.notify_inline_mentions(NEW.content, NEW.user_id, NEW.post_id, 'comment');
    
    RETURN NEW;
END;
$$;

-- ============================================
-- PART 3: ADD ANONYMOUS POST VOTE NOTIFICATIONS
-- ============================================

-- C. Upvotes/Downvotes on anonymous posts (NEW - safe to add)
CREATE OR REPLACE FUNCTION public.handle_new_anon_vote()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  post_identity_id uuid;
  vote_action text;
BEGIN
    -- Get the post's identity
    SELECT identity_id INTO post_identity_id 
    FROM public.anon_posts WHERE id = NEW.post_id;
    
    -- Only notify if it's not the voter's own post
    IF post_identity_id != NEW.identity_id AND post_identity_id IS NOT NULL THEN
        -- Determine vote action text
        vote_action := CASE 
            WHEN NEW.vote_type = 1 THEN 'upvoted'
            WHEN NEW.vote_type = -1 THEN 'downvoted'
            ELSE 'voted on'
        END;
        
        -- Get the user_id of the post author from anon_identities and insert notification
        INSERT INTO public.notifications (user_id, actor_id, type, resource_id, content, post_type)
        SELECT 
            ai.user_id,                          -- Post author (real user)
            voter_ai.user_id,                    -- Voter (real user)
            'like',                              -- Using 'like' type for consistency
            NEW.post_id,                         -- The anon post ID
            vote_action || ' your roll.',
            'anon_post'
        FROM public.anon_identities ai
        LEFT JOIN public.anon_identities voter_ai ON voter_ai.id = NEW.identity_id
        WHERE ai.id = post_identity_id AND voter_ai.user_id IS NOT NULL;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Only create trigger if it doesn't exist (safe)
DROP TRIGGER IF EXISTS on_new_anon_vote ON public.anon_votes;
CREATE TRIGGER on_new_anon_vote
AFTER INSERT ON public.anon_votes
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_anon_vote();

-- ============================================
-- PART 4: RELOAD (SAFE)
-- ============================================

NOTIFY pgrst, 'reload config';
