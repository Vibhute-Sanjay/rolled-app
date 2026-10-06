-- 🏥 FIX: Update Comment Notification Text
-- This script ensures that any new reply results in a "replied to your roll" notification
-- instead of a generic "commented" or "post" notification.

-- 1. DROP ALL potential legacy triggers on the comments table to avoid confusion
DROP TRIGGER IF EXISTS on_post_comment ON public.comments;
DROP TRIGGER IF EXISTS on_comment_created ON public.comments;
DROP TRIGGER IF EXISTS handle_new_comment ON public.comments;
DROP TRIGGER IF EXISTS comment_notification ON public.comments;
DROP TRIGGER IF EXISTS handle_new_comment_unified ON public.comments;

-- 2. Define the CLEANified Function
CREATE OR REPLACE FUNCTION public.handle_new_comment_fix()
RETURNS TRIGGER AS $$
DECLARE
    v_post_owner_id uuid;
BEGIN
    -- Get the owner of the post
    SELECT user_id INTO v_post_owner_id FROM public.posts WHERE id = NEW.post_id;

    -- Only notify if the commenter is NOT the post owner
    IF NEW.user_id != v_post_owner_id THEN
        INSERT INTO public.notifications (user_id, actor_id, type, resource_id, content)
        VALUES (
            v_post_owner_id,
            NEW.user_id,
            'reply',
            NEW.post_id,
            'replied to your roll: ' || left(NEW.content, 20) || (CASE WHEN length(NEW.content) > 20 THEN '...' ELSE '' END)
        );
    END IF;

    -- Handle inline mentions if the function exists
    BEGIN
        PERFORM public.notify_inline_mentions(
            NEW.content, 
            NEW.user_id, 
            NEW.post_id, 
            'comment'
        );
    EXCEPTION WHEN OTHERS THEN
        NULL; -- Ignore if mention function is missing
    END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Attach the NEW authoritative trigger
CREATE TRIGGER on_post_comment_final
AFTER INSERT ON public.comments
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_comment_fix();
