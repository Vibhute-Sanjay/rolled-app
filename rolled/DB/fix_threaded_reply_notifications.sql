-- FIX THREADED REPLY NOTIFICATIONS
-- This ensures that when someone replies to a comment, BOTH the post owner AND the comment author get notified

CREATE OR REPLACE FUNCTION public.handle_new_comment_fix() 
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE 
    v_post_owner_id uuid;
    v_parent_author_id uuid;
BEGIN
    -- Get the post owner
    SELECT user_id INTO v_post_owner_id FROM public.posts WHERE id = NEW.post_id;
    
    -- 1. Notify Post Owner (if not replying to own post)
    IF v_post_owner_id IS NOT NULL AND NEW.user_id != v_post_owner_id THEN
        INSERT INTO public.notifications (user_id, actor_id, type, resource_id, content)
        VALUES (
            v_post_owner_id, 
            NEW.user_id, 
            'reply', 
            NEW.post_id, 
            'replied to your roll: ' || left(NEW.content, 20) || (CASE WHEN length(NEW.content) > 20 THEN '...' ELSE '' END)
        );
    END IF;

    -- 2. Notify Parent Comment Author (if this is a reply to a reply)
    IF NEW.parent_id IS NOT NULL THEN
        SELECT user_id INTO v_parent_author_id FROM public.comments WHERE id = NEW.parent_id;
        
        -- Only notify if:
        -- - Parent comment author exists
        -- - Not replying to own comment
        -- - Parent author is NOT the post owner (to avoid double notification)
        IF v_parent_author_id IS NOT NULL 
           AND v_parent_author_id != NEW.user_id 
           AND v_parent_author_id != v_post_owner_id THEN
            
            INSERT INTO public.notifications (user_id, actor_id, type, resource_id, content)
            VALUES (
                v_parent_author_id, 
                NEW.user_id, 
                'reply', 
                NEW.post_id, 
                'replied to your rollback: ' || left(NEW.content, 20) || (CASE WHEN length(NEW.content) > 20 THEN '...' ELSE '' END)
            );
        END IF;
    END IF;

    -- Also handle inline mentions (existing logic)
    PERFORM public.notify_inline_mentions(NEW.content, NEW.user_id, NEW.post_id, 'comment');
    
    RETURN NEW;
END;
$$;

-- Reload to apply immediately
NOTIFY pgrst, 'reload config';
