-- 29_chat_replies_and_events_rollback.sql
-- 1. Remove reply_to_id from messages (Rolling back the feature)
ALTER TABLE public.messages
DROP CONSTRAINT IF EXISTS messages_reply_to_id_fkey;

ALTER TABLE public.messages 
DROP COLUMN IF EXISTS reply_to_id;

-- 2. KEEP the updated handle_new_activity_post trigger copy (User wants this)
CREATE OR REPLACE FUNCTION public.handle_new_activity_post()
RETURNS TRIGGER AS $$
DECLARE
    follower_rec RECORD;
BEGIN
    -- Loop through all accepted followers of the organizer
    FOR follower_rec IN 
        SELECT follower_id FROM public.follows 
        WHERE following_id = NEW.organizer_id AND status = 'accepted'
    LOOP
        INSERT INTO public.notifications (user_id, actor_id, type, resource_id, content)
        VALUES (
            follower_rec.follower_id, -- Notify the follower
            NEW.organizer_id,         -- The organizer (Club)
            'new_activity',
            NEW.id,                   -- The Activity ID
            'rolled out a new upcoming event' -- Updated Copy
        );
    END LOOP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Reload Schema
NOTIFY pgrst, 'reload config';
