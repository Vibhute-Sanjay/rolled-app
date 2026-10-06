-- 🚨 FINAL FIX FORWARD: ROBUST UX & NOTIFICATIONS 🚨
-- This script keeps the good "Follow Banner" UX and fixes the broken Notifications.

BEGIN;

-- ==========================================
-- 1. FIX EXTENSION PERMISSIONS (The Root Cause)
-- ==========================================
-- We ensure 'pg_net' works regardless of where it is installed (public vs extensions).
DO $$
BEGIN
    -- Try granting on extensions schema (Standard)
    EXECUTE 'GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role';
    EXECUTE 'GRANT ALL ON ALL TABLES IN SCHEMA extensions TO postgres, anon, authenticated, service_role';
    
    -- Try granting on public schema (If someone moved it)
    EXECUTE 'GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role';
    EXECUTE 'GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role';
EXCEPTION WHEN OTHERS THEN
    NULL; -- Ignore if schema doesn't exist, just try both.
END $$;

-- ==========================================
-- 2. GLOBAL PUSH TRIGGER (Correct URL)
-- ==========================================
CREATE OR REPLACE FUNCTION public.trigger_push_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
-- We add BOTH schemas to search_path to be safe
SET search_path = public, extensions, net
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
CREATE TRIGGER on_notification_created 
AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE PROCEDURE public.trigger_push_notification();

-- ==========================================
-- 3. MESSAGING RLS (Simple & Robus)
-- ==========================================
-- Helper
CREATE OR REPLACE FUNCTION public.is_room_participant(_room_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.chat_participants
    WHERE room_id = _room_id AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Clean Policies
DROP POLICY IF EXISTS "select_messages" ON public.messages;
DROP POLICY IF EXISTS "insert_messages" ON public.messages;
DROP POLICY IF EXISTS "insert_messages_fallback" ON public.messages; -- Remove emergency fallback
DROP POLICY IF EXISTS "update_messages" ON public.messages;
DROP POLICY IF EXISTS "delete_messages" ON public.messages;
DROP POLICY IF EXISTS "Users can view messages in their rooms" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages to their rooms" ON public.messages;

-- Apply Authoritative Policies
CREATE POLICY "select_messages" ON public.messages FOR SELECT USING ( public.is_room_participant(room_id) );
CREATE POLICY "insert_messages" ON public.messages FOR INSERT WITH CHECK ( auth.uid() = user_id AND public.is_room_participant(room_id) );
CREATE POLICY "update_messages" ON public.messages FOR UPDATE USING ( public.is_room_participant(room_id) );
CREATE POLICY "delete_messages" ON public.messages FOR DELETE USING ( auth.uid() = user_id );

-- Permissions
GRANT ALL ON public.messages TO authenticated;
GRANT ALL ON public.chat_participants TO authenticated;
GRANT ALL ON public.chat_rooms TO authenticated;

-- ==========================================
-- 4. TOGGLE FOLLOW RPC (Restoring for Robust UX)
-- ==========================================
CREATE OR REPLACE FUNCTION public.toggle_follow(target_user_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    current_status text;
BEGIN
    SELECT status INTO current_status FROM public.follows
    WHERE follower_id = auth.uid() AND following_id = target_user_id;

    IF current_status IS NOT NULL THEN
        DELETE FROM public.follows WHERE follower_id = auth.uid() AND following_id = target_user_id;
        RETURN 'unfollowed';
    ELSE
        INSERT INTO public.follows (follower_id, following_id, status)
        VALUES (auth.uid(), target_user_id, 'accepted');
        RETURN 'following';
    END IF;
END;
$$;

-- ==========================================
-- 5. SOCIAL TRIGGERS (Restoring "Replied to your roll")
-- ==========================================

-- Reply Trigger
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_post_comment_final ON public.comments;
DROP TRIGGER IF EXISTS on_new_comment ON public.comments;
CREATE TRIGGER on_new_comment AFTER INSERT ON public.comments
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_comment_fix();

-- Message Notification Trigger
CREATE OR REPLACE FUNCTION public.handle_new_message_notification() RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_new_message_notification ON public.messages;
CREATE TRIGGER on_new_message_notification AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_message_notification();

COMMIT;
NOTIFY pgrst, 'reload config';
