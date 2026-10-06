-- FIX MESSAGE NOTIFICATIONS V2 (CLEAN & ROBUST)
-- Strategy: Ephemeral Records (Insert -> Push -> Delete)
-- This ensures the Push System sees a "real" valid record, but it doesn't clutter storage.

-- 1. CLEANUP from previous attempt
DROP FUNCTION IF EXISTS public.send_message_push(UUID, UUID, UUID, TEXT);


-- 2. Restore the ORIGINAL Insert Logic
-- We need the row to physically exist for the Push Trigger to fire reliably.
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

    -- Insert into public.notifications (Standard Flow)
    -- This guarantees authentication, constraints, and triggers work perfectly.
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


-- 3. Update Push Trigger to Auto-Delete Messages
-- This acts as a "Self-Destruct" mechanism for message notifications.
CREATE OR REPLACE FUNCTION public.trigger_push_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, net
AS $$
DECLARE
  edge_function_url text := 'https://hbkslwngbsvwiudaxltb.supabase.co/functions/v1/push-';
BEGIN
  -- A. Send the Push Notification
  -- 'row_to_json(NEW)' captures the inserted data perfectly.
  PERFORM net.http_post(
    url := edge_function_url,
    body := jsonb_build_object('record', row_to_json(NEW))::jsonb,
    headers := '{"Content-Type": "application/json"}'::jsonb
  );

  -- B. Self-Clean: If it's a message, delete it immediately.
  -- The user gets the push, but the DB row vanishes.
  IF NEW.type = 'message' THEN
      DELETE FROM public.notifications WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;
