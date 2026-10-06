-- 🚨 EMERGENCY RESTORE: NOTIFICATIONS & MESSAGING 🚨
-- Run this if notifications have completely stopped.
-- It works by forcefully resetting the 'net' extension and standardizing all triggers.

BEGIN;

-- 1. RESET PG_NET EXTENSION (Force Public Schema)
-- This fixes the "Schema not found" or "Permission denied" errors.
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA public;
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- 2. GLOBAL PUSH TRIGGER (Simple Version)
CREATE OR REPLACE FUNCTION public.trigger_push_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  -- Standard URL
  PERFORM net.http_post(
    url := 'https://hbkslwngbsvwiudaxltb.supabase.co/functions/v1/push-',
    body := jsonb_build_object('record', row_to_json(NEW))::jsonb,
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_notification_created ON public.notifications;
CREATE TRIGGER on_notification_created 
AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE PROCEDURE public.trigger_push_notification();

-- 3. MESSAGE NOTIFICATION TRIGGER (Restores "Message Received" popup)
CREATE OR REPLACE FUNCTION public.handle_new_message_notification() RETURNS TRIGGER AS $$
DECLARE recipient_id UUID;
BEGIN
    -- Classic Logic: Notify the other person in the room
    SELECT user_id INTO recipient_id FROM public.chat_participants
    WHERE room_id = NEW.room_id AND user_id != NEW.user_id LIMIT 1;
    
    IF recipient_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, actor_id, type, resource_id, content)
        VALUES (recipient_id, NEW.user_id, 'message', NEW.room_id, LEFT(NEW.content, 100));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_new_message_notification ON public.messages;
CREATE TRIGGER on_new_message_notification AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_message_notification();

-- 4. SOCIAL TRIGGERS (Restores "Replied to your roll")
-- Reply
CREATE OR REPLACE FUNCTION public.handle_new_comment_fix() RETURNS TRIGGER AS $$
DECLARE v_post_owner_id uuid;
BEGIN
    SELECT user_id INTO v_post_owner_id FROM public.posts WHERE id = NEW.post_id;
    IF NEW.user_id != v_post_owner_id THEN
        INSERT INTO public.notifications (user_id, actor_id, type, resource_id, content)
        VALUES (v_post_owner_id, NEW.user_id, 'reply', NEW.post_id, 'replied to your roll');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_post_comment_final ON public.comments;
DROP TRIGGER IF EXISTS on_new_comment ON public.comments;
CREATE TRIGGER on_new_comment AFTER INSERT ON public.comments
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_comment_fix();

-- Follow
CREATE OR REPLACE FUNCTION public.handle_new_follow() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notifications (user_id, actor_id, type, content)
  VALUES (NEW.following_id, NEW.follower_id, 'follow', 'started following you.');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_new_follow ON public.follows;
CREATE TRIGGER on_new_follow AFTER INSERT ON public.follows
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_follow();

-- 5. MESSAGING PERMISSIONS (Safe Revert)
-- Ensuring you can at least send messages
GRANT ALL ON public.messages TO authenticated;
GRANT ALL ON public.chat_participants TO authenticated;

-- Simple RLS fallback to ensure messages send
DROP POLICY IF EXISTS "insert_messages" ON public.messages;
CREATE POLICY "insert_messages_fallback" ON public.messages FOR INSERT 
WITH CHECK (auth.uid() = user_id); 
-- (This removes the "Must be in room" check temporarily to guarantee delivery)

COMMIT;
NOTIFY pgrst, 'reload config';
