-- 1. Update Notifications Table Constraint to allow 'message'
-- We have to drop and recreate the check constraint
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications 
ADD CONSTRAINT notifications_type_check 
CHECK (type IN ('follow', 'follow_request', 'like', 'reply', 'mention', 'system', 'message'));

-- 2. Create Trigger Function for New Messages
CREATE OR REPLACE FUNCTION public.handle_new_message_notification()
RETURNS TRIGGER AS $$
DECLARE
    recipient_id UUID;
    sender_name TEXT;
BEGIN
    -- Find the *other* participant in the room
    SELECT user_id INTO recipient_id
    FROM public.chat_participants
    WHERE room_id = NEW.room_id AND user_id != NEW.user_id
    LIMIT 1;

    -- If no recipient found (e.g. they left), do nothing
    IF recipient_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Fetch sender name for preview (Optional, but good for debugging DB logic)
    -- Actually, we'll let the Edge Function fetch the name for the Title. 
    -- Here we just put the raw content.

    INSERT INTO public.notifications (
        user_id, 
        actor_id, 
        type, 
        resource_id, 
        content
    )
    VALUES (
        recipient_id,       -- The other person
        NEW.user_id,        -- The sender
        'message',          -- New Type
        NEW.room_id,        -- Resource is the Room ID (Deep link will use this)
        LEFT(NEW.content, 100) -- Preview (First 100 chars)
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create Trigger on Messages Table
DROP TRIGGER IF EXISTS on_new_message_notification ON public.messages;
CREATE TRIGGER on_new_message_notification
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE PROCEDURE public.handle_new_message_notification();
