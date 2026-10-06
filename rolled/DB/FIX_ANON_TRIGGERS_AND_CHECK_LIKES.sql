-- 🩹 FIX AND INSPECT SCRIPT 🩹
-- 1. Fix 'handle_new_comment_fix' (Crash on Anon Reply)
-- 2. Fix 'handle_comment_mentions' (Crash on Anon Reply)
-- 3. Check for triggers on 'comment_likes' (Why Likes fail?)

BEGIN;

-- FIX 1: handle_new_comment_fix
CREATE OR REPLACE FUNCTION public.handle_new_comment_fix() 
RETURNS TRIGGER AS $$
DECLARE v_post_owner_id uuid;
BEGIN
    -- ✅ SAFETY: Skip if this is an Anon Comment (no post_id)
    IF NEW.post_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT user_id INTO v_post_owner_id FROM public.posts WHERE id = NEW.post_id;
    
    -- Safety check for owner existence
    IF v_post_owner_id IS NOT NULL AND NEW.user_id != v_post_owner_id THEN
        INSERT INTO public.notifications (user_id, actor_id, type, resource_id, content)
        VALUES (v_post_owner_id, NEW.user_id, 'reply', NEW.post_id, 'replied to your roll');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- FIX 2: handle_comment_mentions
CREATE OR REPLACE FUNCTION public.handle_comment_mentions() 
RETURNS TRIGGER AS $$
BEGIN
    -- ✅ SAFETY: Skip if this is an Anon Comment (no post_id)
    -- Or we could enable mentions for Anon later, but for now prevent CRASH.
    IF NEW.post_id IS NULL THEN
        RETURN NEW;
    END IF;

    BEGIN
        IF NEW.content IS NOT NULL AND NEW.content != '' THEN
            PERFORM public.notify_inline_mentions(
                NEW.content, 
                NEW.user_id, 
                NEW.post_id, 
                'comment'
            );
        END IF;
    EXCEPTION WHEN OTHERS THEN NULL; END;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;

-- INSPECT LIKES TRIGGERS (Running outside transaction to see output)
SELECT 
    trigger_name, 
    action_statement 
FROM information_schema.triggers 
WHERE event_object_table = 'comment_likes';
