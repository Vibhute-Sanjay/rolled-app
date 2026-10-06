-- 🚨 CHAT & NOTIFICATION SYSTEM REPAIR (v2) 🚨
-- This script fixes the 42501 RLS error AND restores missing push notifications.

BEGIN;

-- ==========================================
-- 1. CHAT RLS REPAIR (Fixes 42501)
-- ==========================================

-- A. Robust Helper Function
CREATE OR REPLACE FUNCTION public.is_room_participant(_room_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.chat_participants
    WHERE room_id = _room_id AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- B. Clean up old/stale policies
DROP POLICY IF EXISTS "select_messages" ON public.messages;
DROP POLICY IF EXISTS "insert_messages" ON public.messages;
DROP POLICY IF EXISTS "update_messages" ON public.messages;
DROP POLICY IF EXISTS "delete_messages" ON public.messages;
DROP POLICY IF EXISTS "Users can view messages in their rooms" ON public.messages;
DROP POLICY IF EXISTS "view_messages_in_my_rooms" ON public.messages;
DROP POLICY IF EXISTS "view_messages_in_my_rooms_since_join" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages to their rooms" ON public.messages;
DROP POLICY IF EXISTS "insert_messages_in_my_rooms" ON public.messages;

-- C. Apply Authoritative Policies
CREATE POLICY "select_messages" ON public.messages FOR SELECT USING ( public.is_room_participant(room_id) );
CREATE POLICY "insert_messages" ON public.messages FOR INSERT WITH CHECK ( auth.uid() = user_id AND public.is_room_participant(room_id) );
CREATE POLICY "update_messages" ON public.messages FOR UPDATE USING ( public.is_room_participant(room_id) );
CREATE POLICY "delete_messages" ON public.messages FOR DELETE USING ( auth.uid() = user_id );

-- D. Participants RLS
DROP POLICY IF EXISTS "select_participants" ON public.chat_participants;
DROP POLICY IF EXISTS "insert_participants" ON public.chat_participants;
DROP POLICY IF EXISTS "view_participants_in_my_rooms" ON public.chat_participants;
CREATE POLICY "select_participants" ON public.chat_participants FOR SELECT USING ( public.is_room_participant(room_id) );
CREATE POLICY "insert_participants" ON public.chat_participants FOR INSERT WITH CHECK ( auth.uid() = user_id );

-- ==========================================
-- 2. NOTIFICATION SYSTEM RESTORE
-- ==========================================

-- A. Fix Push Permissions (CRITICAL for pop-ups)
GRANT USAGE ON SCHEMA net TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA net TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA net TO postgres, anon, authenticated, service_role;

-- B. Restore Global Push Trigger (Sends to Edge Function)
CREATE OR REPLACE FUNCTION public.trigger_push_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, net, extensions
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://hbkslwngbsvwiudaxltb.supabase.co/functions/v1/push-',
    body := jsonb_build_object('record', row_to_json(NEW))::jsonb,
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_notification_created ON public.notifications;
CREATE TRIGGER on_notification_created AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE PROCEDURE public.trigger_push_notification();

-- C. Restore Message Notification Trigger
CREATE OR REPLACE FUNCTION public.handle_new_message_notification()
RETURNS TRIGGER AS $$
DECLARE recipient_id UUID;
BEGIN
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

-- ==========================================
-- 3. FINAL GRANTS
-- ==========================================
GRANT ALL ON public.messages TO authenticated;
GRANT ALL ON public.chat_participants TO authenticated;
GRANT ALL ON public.chat_rooms TO authenticated;
GRANT ALL ON public.notifications TO authenticated;

COMMIT;
