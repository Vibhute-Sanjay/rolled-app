-- SAFE FIX TO STOP ANONYMOUS NOTIFICATIONS (Final Verified Version)
-- This ensures normal reply notifications still work EXACTLY as before, but anonymous ones are blocked.

BEGIN;

-- 1. Drop the Vote Notification Trigger (Safe, only affects anon votes)
DROP TRIGGER IF EXISTS on_new_anon_vote ON public.anon_votes;

-- 2. Update the Comment/Reply Notification Function to IGNORE Anonymous Replies
CREATE OR REPLACE FUNCTION public.handle_new_comment_fix() 
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE 
  v_post_owner_id uuid;
BEGIN
    -- ✅ SAFETY GUARD: If this is an Anonymous Reply (post_id is NULL), STOP HERE.
    IF NEW.post_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Standard Logic for Normal Public Posts
    SELECT user_id INTO v_post_owner_id FROM public.posts WHERE id = NEW.post_id;
    
    -- Only notify if not replying to self
    IF v_post_owner_id IS NOT NULL AND NEW.user_id != v_post_owner_id THEN
        INSERT INTO public.notifications (user_id, actor_id, type, resource_id, content, post_type)
        VALUES (
            v_post_owner_id, 
            NEW.user_id, 
            'reply', 
            NEW.post_id, 
            -- Exact original text formatting to preserve existing behavior
            'replied to your roll: ' || left(NEW.content, 20) || (CASE WHEN length(NEW.content) > 20 THEN '...' ELSE '' END),
            'post'
        );
    END IF;
    
    -- Handle Mentions (Only for public posts)
    PERFORM public.notify_inline_mentions(NEW.content, NEW.user_id, NEW.post_id, 'comment');

    RETURN NEW;
END;
$$;

-- 3. Clean up existing anonymous notifications
DELETE FROM public.notifications 
WHERE post_type = 'anon_post';

COMMIT;

NOTIFY pgrst, 'reload config';
