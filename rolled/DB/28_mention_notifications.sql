-- 📣 INLINE MENTION NOTIFICATIONS
-- This script ensures that users mentioned via @username in posts or comments get notified.

-- 1. Helper Function to Parse Mentions and Notify
CREATE OR REPLACE FUNCTION public.notify_inline_mentions(
    p_content text, 
    p_actor_id uuid, 
    p_resource_id uuid, 
    p_target_type text, -- 'post' or 'comment'
    p_ignore_ids uuid[] DEFAULT '{}' -- IDs already notified (e.g. via tagged_users)
)
RETURNS void AS $$
DECLARE
    v_username text;
    v_recipient_id uuid;
BEGIN
    -- Regex to find all @usernames
    -- Returns a set of usernames
    FOR v_username IN 
        SELECT DISTINCT (regexp_matches(p_content, '(?:^|\s)@(\w+)', 'g'))[1]
    LOOP
        -- Look up the UUID for this username
        SELECT id INTO v_recipient_id FROM public.profiles WHERE username = v_username;

        -- If user exists and is not the actor and not in ignore list
        IF v_recipient_id IS NOT NULL 
           AND v_recipient_id != p_actor_id 
           AND NOT (v_recipient_id = ANY(p_ignore_ids)) 
        THEN
            -- Insert notification
            INSERT INTO public.notifications (user_id, actor_id, type, resource_id, content)
            VALUES (
                v_recipient_id,
                p_actor_id,
                'mention',
                p_resource_id,
                CASE 
                    WHEN p_target_type = 'post' THEN 'mentioned you in a post.'
                    ELSE 'mentioned you in a reply.'
                END
            );
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update Post Trigger to handle BOTH Explicit Tags and Inline Mentions
CREATE OR REPLACE FUNCTION public.handle_post_mentions()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    tagged_user_id uuid;
BEGIN
    -- A. Handle Explicit Tags (UUID Array)
    IF NEW.tagged_users IS NOT NULL AND array_length(NEW.tagged_users, 1) > 0 THEN
        FOREACH tagged_user_id IN ARRAY NEW.tagged_users
        LOOP
            IF tagged_user_id != NEW.user_id THEN
                INSERT INTO public.notifications (user_id, actor_id, type, resource_id, content)
                VALUES (tagged_user_id, NEW.user_id, 'mention', NEW.id, 'tagged you in a roll.');
            END IF;
        END LOOP;
    END IF;

    -- B. Handle Inline Mentions (Text Search)
    IF NEW.content IS NOT NULL AND NEW.content != '' THEN
        PERFORM public.notify_inline_mentions(
            NEW.content, 
            NEW.user_id, 
            NEW.id, 
            'post', 
            NEW.tagged_users -- Don't double notify people already tagged explicitly
        );
    END IF;
    
    RETURN NEW;
END;
$$;

-- 3. Create Trigger for Comments
CREATE OR REPLACE FUNCTION public.handle_comment_mentions()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Notify post owner (Existing handle_new_comment might already do this)
    -- We only care about mentions here.
    
    IF NEW.content IS NOT NULL AND NEW.content != '' THEN
        PERFORM public.notify_inline_mentions(
            NEW.content, 
            NEW.user_id, 
            NEW.post_id, -- Resource is the post they can tap on
            'comment'
        );
    END IF;
    
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_comment_created_mentions ON public.comments;
CREATE TRIGGER on_comment_created_mentions
AFTER INSERT ON public.comments
FOR EACH ROW
EXECUTE FUNCTION public.handle_comment_mentions();

-- 4. Reload Schema
NOTIFY pgrst, 'reload config';
