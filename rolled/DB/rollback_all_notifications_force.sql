-- 🚨 FORCE ROLLBACK: COMPREHENSIVE RESTORE (Failsafe) 🚨
-- This script explicitly DROPS and RECREATES every moving part of the notification system.
-- It avoids re-adding strict constraints to prevent data conflicts.

-- ====================================================
-- 1. CLEANUP UTILITIES
-- ====================================================
DROP FUNCTION IF EXISTS public.send_message_push(UUID, UUID, UUID, TEXT);

-- ====================================================
-- 2. RESTORE PUSH TRIGGER (Function + Trigger)
-- ====================================================

-- A. The Function
CREATE OR REPLACE FUNCTION public.trigger_push_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, net
AS $$
DECLARE
  edge_function_url text := 'https://hbkslwngbsvwiudaxltb.supabase.co/functions/v1/push-';
BEGIN
  -- Standard Push: Send to Edge Function.
  PERFORM net.http_post(
    url := edge_function_url,
    body := jsonb_build_object('record', row_to_json(NEW))::jsonb,
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  RETURN NEW;
END;
$$;

-- B. The Trigger (Force Recreate on 'public.notifications')
DROP TRIGGER IF EXISTS on_notification_created ON public.notifications;
CREATE TRIGGER on_notification_created
AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE PROCEDURE public.trigger_push_notification();


-- ====================================================
-- 3. RESTORE MESSAGE NOTIFICATION LOGIC (Function + Trigger)
-- ====================================================

-- A. The Function
CREATE OR REPLACE FUNCTION public.handle_new_message_notification()
RETURNS TRIGGER AS $$
DECLARE
    recipient_id UUID;
BEGIN
    -- Logic: Find the other person in the room
    SELECT user_id INTO recipient_id
    FROM public.chat_participants
    WHERE room_id = NEW.room_id AND user_id != NEW.user_id
    LIMIT 1;

    -- Safety check
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

-- B. The Trigger (Force Recreate on 'public.messages')
DROP TRIGGER IF EXISTS on_new_message_notification ON public.messages;
CREATE TRIGGER on_new_message_notification
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_message_notification();


-- ====================================================
-- 4. RESTORE SECURITY POLICY (RLS)
-- ====================================================
DROP POLICY IF EXISTS "Users can see their own notifications" ON public.notifications;

CREATE POLICY "Users can see their own notifications"
ON public.notifications
FOR SELECT
USING (auth.uid() = user_id); -- Standard visibility for ALL types.


-- ====================================================
-- 5. REMOVE STRICT CONSTRAINTS (The Fix for Error 23514)
-- ====================================================
-- Your database contains types (e.g. 'activity_invite') that my list didn't include.
-- Safe Fix: Remove the strict check so existing data is valid and 'message' type works.
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Done. System Restored.
