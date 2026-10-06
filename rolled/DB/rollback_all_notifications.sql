-- 🚨 ROLLBACK SCRIPT: RESTORE NOTIFICATIONS TO ORIGINAL STATE 🚨
-- This script UNDOES all changes from v1, v2, and v3.
-- It restores standard behavior:
-- 1. Messages create Notification rows.
-- 2. Push works standardly.
-- 3. Users can SEE message notifications in the feed.

-- 1. CLEANUP: Drop the experimental helper from V1
DROP FUNCTION IF EXISTS public.send_message_push(UUID, UUID, UUID, TEXT);


-- 2. RESTORE: Push Trigger (Standard, No Deleting)
-- Reverting to the logic from 'fix_push_url_final.sql'
CREATE OR REPLACE FUNCTION public.trigger_push_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, net
AS $$
DECLARE
  edge_function_url text := 'https://hbkslwngbsvwiudaxltb.supabase.co/functions/v1/push-';
BEGIN
  -- Standard Push: Just send the data to Edge Function. No side effects.
  PERFORM net.http_post(
    url := edge_function_url,
    body := jsonb_build_object('record', row_to_json(NEW))::jsonb,
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  RETURN NEW;
END;
$$;


-- 3. RESTORE: Message Notification Logic (Standard Insert)
-- Reverting to logic from '17_enhance_notifications.sql'
-- This logic guarantees the row exists so Push works.
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

    -- Standard Insert (Everything is visible)
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


-- 4. RESTORE: Security Policy (Allow Seeing Messages)
-- Reverting the RLS change from V3.
DROP POLICY IF EXISTS "Users can see their own notifications" ON public.notifications;

CREATE POLICY "Users can see their own notifications"
ON public.notifications
FOR SELECT
USING (auth.uid() = user_id); -- Simple standard check. No type filtering.

-- Completed. Notifications are fully restored.
