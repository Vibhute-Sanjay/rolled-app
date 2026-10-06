-- 📝 FIX NOTIFICATION TEXT & COUNTS 📝
-- 1. Change "replied to your comment" -> "replied to your rollback"
-- 2. Ensure Counts logic is correct (Actually, standard `count(*)` on comments table per post_id is already correct).

BEGIN;

CREATE OR REPLACE FUNCTION public.handle_new_comment_fix() 
RETURNS TRIGGER AS $$
DECLARE v_post_owner_id uuid;
DECLARE v_parent_author_id uuid;
BEGIN
    -- Skip Anon
    IF NEW.post_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT user_id INTO v_post_owner_id FROM public.posts WHERE id = NEW.post_id;
    
    -- 1. Notify Post Owner (Standard)
    -- "User X replied to your roll"
    -- Constraint: Don't notify if I am replying to my own roll
    IF v_post_owner_id IS NOT NULL AND NEW.user_id != v_post_owner_id THEN
        INSERT INTO public.notifications (user_id, actor_id, type, resource_id, content)
        VALUES (v_post_owner_id, NEW.user_id, 'reply', NEW.post_id, 'replied to your roll');
    END IF;

    -- 2. Notify Parent Comment Author (Nested Reply)
    -- "User X replied to your rollback"
    IF NEW.parent_id IS NOT NULL THEN
        SELECT user_id INTO v_parent_author_id FROM public.comments WHERE id = NEW.parent_id;
        
        -- Avoid double notification if Post Owner IS Parent Author
        -- If they are different, send the specific "Rollback" notification to the parent author.
        IF v_parent_author_id IS NOT NULL 
           AND v_parent_author_id != NEW.user_id 
           AND v_parent_author_id != v_post_owner_id THEN
            
            INSERT INTO public.notifications (user_id, actor_id, type, resource_id, content)
            VALUES (
                v_parent_author_id, 
                NEW.user_id, 
                'reply', 
                NEW.post_id, 
                'replied to your rollback' -- UPDATED TEXT
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
NOTIFY pgrst, 'reload config';
