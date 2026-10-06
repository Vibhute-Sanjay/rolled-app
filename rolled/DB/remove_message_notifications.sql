-- DECOUPLE MESSAGES FROM NOTIFICATION FEED
-- Goal: Send Push Notification for messages but DO NOT store them in the 'notifications' table.

-- 1. Helper Function: Send Push Directly (Mocking the Trigger Payload)
CREATE OR REPLACE FUNCTION public.send_message_push(
    recipient_id UUID,
    sender_id UUID,
    room_id UUID,
    message_content TEXT
)
RETURNS VOID AS $$
DECLARE
    edge_function_url TEXT := 'https://hbkslwngbsvwiudaxltb.supabase.co/functions/v1/push-';
    mock_record JSONB;
BEGIN
    -- Construct a JSON object that mimics a 'notifications' table row
    -- so the Edge Function doesn't know the difference.
    mock_record := jsonb_build_object(
        'id', gen_random_uuid(), -- Fake ID (doesn't exist in DB)
        'user_id', recipient_id,
        'actor_id', sender_id,
        'type', 'message',
        'resource_id', room_id,
        'content', LEFT(message_content, 100), -- Preview
        'is_read', false,
        'created_at', now()
    );

    -- Send to Edge Function
    PERFORM net.http_post(
        url := edge_function_url,
        body := jsonb_build_object('record', mock_record),
        headers := '{"Content-Type": "application/json"}'::jsonb
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Update the Message Trigger Function
CREATE OR REPLACE FUNCTION public.handle_new_message_notification()
RETURNS TRIGGER AS $$
DECLARE
    recipient_id UUID;
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

    -- OLD LOGIC: Insert into public.notifications
    -- INSERT INTO public.notifications (...) VALUES (...);
    
    -- NEW LOGIC: Call Push Helper directly (No DB Insert)
    -- This keeps the feed clean but still alerts the user.
    PERFORM public.send_message_push(
        recipient_id,
        NEW.user_id,
        NEW.room_id,
        NEW.content
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
