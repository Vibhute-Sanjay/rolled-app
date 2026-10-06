-- FIX MESSAGE NOTIFICATIONS V3 (The Safest Way)
-- Strategy: Visibility Filter (Insert -> Push -> Hide)
-- 1. We keep the row in DB so the Push System works 100% guaranteed.
-- 2. We simply HIDE it from your App using a Security Policy.

-- A. REVERT the "Generic Trigger" to its original safe state (No Deleting!)
CREATE OR REPLACE FUNCTION public.trigger_push_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, net
AS $$
DECLARE
  edge_function_url text := 'https://hbkslwngbsvwiudaxltb.supabase.co/functions/v1/push-';
BEGIN
  PERFORM net.http_post(
    url := edge_function_url,
    body := jsonb_build_object('record', row_to_json(NEW))::jsonb,
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  RETURN NEW;
END;
$$;


-- B. ENSURE Message Trigger Inserts (Standard)
CREATE OR REPLACE FUNCTION public.handle_new_message_notification()
RETURNS TRIGGER AS $$
DECLARE
    recipient_id UUID;
BEGIN
    SELECT user_id INTO recipient_id
    FROM public.chat_participants
    WHERE room_id = NEW.room_id AND user_id != NEW.user_id
    LIMIT 1;

    IF recipient_id IS NULL THEN
        RETURN NEW;
    END IF;

    INSERT INTO public.notifications (
        user_id,
        actor_id,
        type,
        resource_id,
        content
    )
    VALUES (
        recipient_id,
        NEW.user_id,
        'message',
        NEW.room_id,
        LEFT(NEW.content, 100)
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- C. HIDE Messages from the Feed (The Magic Trick) 🎩
-- We update the Security Policy so the Frontend effectively "cannot see" message notifications.
-- This removes them from the List AND the Unread Count.

DROP POLICY IF EXISTS "Users can see their own notifications" ON public.notifications;

CREATE POLICY "Users can see their own notifications"
ON public.notifications
FOR SELECT
USING (
  auth.uid() = user_id 
  AND type != 'message'  -- <--- THIS HIDES THEM FROM THE APP
);
