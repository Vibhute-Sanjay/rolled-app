-- 🚨 MASTER NOTIFICATION & PUSH SYSTEM RESTORE (v1) 🚨
-- This script reconstructs the entire notification chain from scratch.
-- It fixes: Pop-up notifications, Wording ("replied to your roll"), Mentions, and RLS Errors.

BEGIN;

-- ==========================================
-- 0. MESSAGING RLS REPAIR (Fixes 42501)
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

-- B. Clean up old/stale policies on messages
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
-- 1. NOTIFICATION TYPES & PERMISSIONS
-- ==========================================

-- A. Relax constraint to allow all types (safe)
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- B. Fix Push Permissions (CRITICAL for pop-ups)
GRANT USAGE ON SCHEMA net TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA net TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA net TO postgres, anon, authenticated, service_role;
GRANT ALL ON public.notifications TO authenticated, service_role;

-- ==========================================
-- 2. GLOBAL PUSH TRIGGER (THE POP-UP SENDER)
-- ==========================================

CREATE OR REPLACE FUNCTION public.trigger_push_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, net, extensions
AS $$
BEGIN
  -- URL must have the trailing dash as per 'fix_push_url_final.sql'
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
-- 3. HELPER: INLINE MENTIONS (@username)
-- ==========================================

CREATE OR REPLACE FUNCTION public.notify_inline_mentions(
    p_content text, 
    p_actor_id uuid, 
    p_resource_id uuid, 
    p_target_type text, 
    p_ignore_ids uuid[] DEFAULT '{}'
)
RETURNS void AS $$
DECLARE
    v_username text;
    v_recipient_id uuid;
BEGIN
    FOR v_username IN 
        SELECT DISTINCT (regexp_matches(p_content, '(?:^|\s)@(\w+)', 'g'))[1]
    LOOP
        SELECT id INTO v_recipient_id FROM public.profiles WHERE username = v_username;
        IF v_recipient_id IS NOT NULL 
           AND v_recipient_id != p_actor_id 
           AND NOT (v_recipient_id = ANY(p_ignore_ids)) 
        THEN
            INSERT INTO public.notifications (user_id, actor_id, type, resource_id, content)
            VALUES (v_recipient_id, p_actor_id, 'mention', p_resource_id, 
                CASE WHEN p_target_type = 'post' THEN 'mentioned you in a post.' ELSE 'mentioned you in a reply.' END
            );
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ==========================================
-- 4. SOCIAL TRIGGERS (Follows, Likes, Replies)
-- ==========================================

-- A. Follows
CREATE OR REPLACE FUNCTION public.handle_new_follow() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notifications (user_id, actor_id, type, content)
  VALUES (NEW.following_id, NEW.follower_id, 'follow', 'started following you.');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_new_follow ON public.follows;
CREATE TRIGGER on_new_follow AFTER INSERT ON public.follows
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_follow();

-- B. Likes
CREATE OR REPLACE FUNCTION public.handle_new_like() RETURNS TRIGGER AS $$
DECLARE post_author_id uuid;
BEGIN
    SELECT user_id INTO post_author_id FROM public.posts WHERE id = NEW.post_id;
    IF post_author_id != NEW.user_id THEN
        INSERT INTO public.notifications (user_id, actor_id, type, resource_id, content)
        VALUES (post_author_id, NEW.user_id, 'like', NEW.post_id, 'liked your roll.');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_new_like ON public.likes;
CREATE TRIGGER on_new_like AFTER INSERT ON public.likes
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_like();

-- C. Replies (Comments)
CREATE OR REPLACE FUNCTION public.handle_new_comment_fix() RETURNS TRIGGER AS $$
DECLARE v_post_owner_id uuid;
BEGIN
    SELECT user_id INTO v_post_owner_id FROM public.posts WHERE id = NEW.post_id;
    IF NEW.user_id != v_post_owner_id THEN
        INSERT INTO public.notifications (user_id, actor_id, type, resource_id, content)
        VALUES (v_post_owner_id, NEW.user_id, 'reply', NEW.post_id, 
            'replied to your roll: ' || left(NEW.content, 20) || (CASE WHEN length(NEW.content) > 20 THEN '...' ELSE '' END)
        );
    END IF;
    PERFORM public.notify_inline_mentions(NEW.content, NEW.user_id, NEW.post_id, 'comment');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_post_comment_final ON public.comments;
DROP TRIGGER IF EXISTS on_new_comment ON public.comments;
CREATE TRIGGER on_post_comment_final AFTER INSERT ON public.comments
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_comment_fix();

-- ==========================================
-- 5. CONTENT TRIGGERS (Posts & Mentions)
-- ==========================================

CREATE OR REPLACE FUNCTION public.handle_post_mentions() RETURNS TRIGGER AS $$
DECLARE tagged_user_id uuid;
BEGIN
    IF NEW.tagged_users IS NOT NULL AND array_length(NEW.tagged_users, 1) > 0 THEN
        FOREACH tagged_user_id IN ARRAY NEW.tagged_users
        LOOP
            IF tagged_user_id != NEW.user_id THEN
                INSERT INTO public.notifications (user_id, actor_id, type, resource_id, content)
                VALUES (tagged_user_id, NEW.user_id, 'mention', NEW.id, 'tagged you in a roll.');
            END IF;
        END LOOP;
    END IF;
    PERFORM public.notify_inline_mentions(NEW.content, NEW.user_id, NEW.id, 'post', NEW.tagged_users);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_post_created_mentions ON public.posts;
CREATE TRIGGER on_post_created_mentions AFTER INSERT ON public.posts
FOR EACH ROW EXECUTE PROCEDURE public.handle_post_mentions();

-- ==========================================
-- 6. CHAT & MESSAGE TRIGGERS
-- ==========================================

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

-- ==========================================
-- 7. CLUB & ACTIVITY TRIGGERS
-- ==========================================

-- A. New Activity (Notify Followers)
CREATE OR REPLACE FUNCTION public.handle_new_activity_post() RETURNS TRIGGER AS $$
DECLARE follower_rec RECORD;
BEGIN
    FOR follower_rec IN SELECT follower_id FROM public.follows WHERE following_id = NEW.organizer_id AND status = 'accepted'
    LOOP
        INSERT INTO public.notifications (user_id, actor_id, type, resource_id, content)
        VALUES (follower_rec.follower_id, NEW.organizer_id, 'new_activity', NEW.id, 'posted a new rollout: ' || NEW.title);
    END LOOP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_new_activity_post ON public.activities;
CREATE TRIGGER on_new_activity_post AFTER INSERT ON public.activities
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_activity_post();

-- B. Activity Request Approval/Rejection
CREATE OR REPLACE FUNCTION public.notify_activity_request_update() RETURNS TRIGGER AS $$
DECLARE activity_title text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
      SELECT title INTO activity_title FROM public.activities WHERE id = NEW.activity_id;
      IF NEW.status = 'approved' THEN
          INSERT INTO public.notifications (user_id, actor_id, type, resource_id, content)
          VALUES (NEW.user_id, auth.uid(), 'activity_approved', NEW.activity_id, 'approved your request for ' || activity_title);
      ELSIF NEW.status = 'rejected' THEN
          INSERT INTO public.notifications (user_id, actor_id, type, resource_id, content)
          VALUES (NEW.user_id, auth.uid(), 'activity_rejected', NEW.activity_id, 'declined your request for ' || activity_title);
      END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_notify_activity_request ON public.activity_requests;
CREATE TRIGGER trigger_notify_activity_request AFTER UPDATE ON public.activity_requests
FOR EACH ROW EXECUTE PROCEDURE public.notify_activity_request_update();

COMMIT;
NOTIFY pgrst, 'reload config';
