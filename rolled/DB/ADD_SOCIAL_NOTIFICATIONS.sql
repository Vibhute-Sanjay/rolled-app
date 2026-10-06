-- 🔔 ADD SOCIAL NOTIFICATIONS (Likes & Nested Replies) 🔔
-- This script adds the "Social" layer on top of the working threading system.
-- It tells the database: "When X happens, Alert User Y."

BEGIN;

-- 1. NOTIFICATION FOR "LIKING A REPLY"
-- We need a function that runs when you 'Insert' into 'comment_likes'.
CREATE OR REPLACE FUNCTION public.handle_comment_like_notification() 
RETURNS TRIGGER AS $$
DECLARE v_comment_author_id uuid;
DECLARE v_post_id uuid;
BEGIN
    -- Get the author of the comment and the post_id
    SELECT user_id, post_id INTO v_comment_author_id, v_post_id
    FROM public.comments 
    WHERE id = NEW.comment_id;

    -- Safety: If comment doesn't exist or it's your own comment, do nothing.
    IF v_comment_author_id IS NULL OR v_comment_author_id = NEW.user_id THEN
        RETURN NEW;
    END IF;

    -- Insert Notification
    INSERT INTO public.notifications (user_id, actor_id, type, resource_id, content)
    VALUES (
        v_comment_author_id, -- Notify the Comment Author
        NEW.user_id,         -- By the Liker
        'like',              -- Type
        v_post_id,           -- Link to the Post
        'liked your reply'   -- Message
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach the trigger
DROP TRIGGER IF EXISTS on_comment_like_notify ON public.comment_likes;
CREATE TRIGGER on_comment_like_notify
AFTER INSERT ON public.comment_likes
FOR EACH ROW EXECUTE FUNCTION public.handle_comment_like_notification();


-- 2. NOTIFICATION FOR "REPLYING TO A REPLY" (Nested)
-- We update the EXISTING function 'handle_new_comment_fix' to handle this new case.
CREATE OR REPLACE FUNCTION public.handle_new_comment_fix() 
RETURNS TRIGGER AS $$
DECLARE v_post_owner_id uuid;
DECLARE v_parent_author_id uuid;
BEGIN
    -- Case A: Anon Reply (No Post ID) -> Validation Only
    IF NEW.post_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Case B: Standard Reply logic
    SELECT user_id INTO v_post_owner_id FROM public.posts WHERE id = NEW.post_id;
    
    -- 1. Notify Post Owner (Standard)
    -- "User X replied to your roll"
    IF v_post_owner_id IS NOT NULL AND NEW.user_id != v_post_owner_id THEN
        INSERT INTO public.notifications (user_id, actor_id, type, resource_id, content)
        VALUES (v_post_owner_id, NEW.user_id, 'reply', NEW.post_id, 'replied to your roll');
    END IF;

    -- 2. Notify Parent Comment Author (Nested Reply) [NEW LOGIC]
    -- "User X replied to your comment"
    IF NEW.parent_id IS NOT NULL THEN
        SELECT user_id INTO v_parent_author_id FROM public.comments WHERE id = NEW.parent_id;
        
        -- Avoid double notification if Post Owner IS Parent Author
        IF v_parent_author_id IS NOT NULL 
           AND v_parent_author_id != NEW.user_id 
           AND v_parent_author_id != v_post_owner_id THEN
            
            INSERT INTO public.notifications (user_id, actor_id, type, resource_id, content)
            VALUES (
                v_parent_author_id, 
                NEW.user_id, 
                'reply', 
                NEW.post_id, 
                'replied to your comment'
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;

NOTIFY pgrst, 'reload config';
