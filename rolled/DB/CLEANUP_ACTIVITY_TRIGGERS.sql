-- 🧹 CLEANUP ACTIVITY TRIGGERS 🧹
-- Fixes duplicate notifications by removing all old/conflicting triggers
-- before re-applying the correct logic.

BEGIN;

-- 1. DROP EXISTING TRIGGERS (Likely culprits)
DROP TRIGGER IF EXISTS on_new_activity_post ON public.activities;
DROP TRIGGER IF EXISTS on_activity_request ON public.activity_requests;  -- Check common names
DROP TRIGGER IF EXISTS on_new_request ON public.activity_requests;       -- Check common names
DROP TRIGGER IF EXISTS notify_host_on_request ON public.activity_requests; 

-- 2. DROP FUNCTIONS (to be safely re-created)
DROP FUNCTION IF EXISTS public.handle_new_activity_post() CASCADE;
DROP FUNCTION IF EXISTS public.notify_activity_request() CASCADE;

-- 3. RE-CREATE CORRECT FUNCTION (From FIX_HOST_ID script)
CREATE OR REPLACE FUNCTION public.handle_new_activity_post() RETURNS TRIGGER AS $$
BEGIN
  -- Insert notification for all followers
  INSERT INTO public.notifications (user_id, actor_id, type, resource_id, content)
  SELECT 
    f.follower_id, 
    NEW.organizer_id,
    'new_activity', 
    NEW.id,
    'posted a new event: ' || LEFT(NEW.title, 30)
  FROM public.follows f
  WHERE f.following_id = NEW.organizer_id
  AND f.status = 'accepted';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.notify_activity_request() RETURNS TRIGGER AS $$
DECLARE
    v_activity_title TEXT;
    v_organizer_id UUID;
BEGIN
    SELECT title, organizer_id INTO v_activity_title, v_organizer_id 
    FROM public.activities WHERE id = NEW.activity_id;
    
    INSERT INTO public.notifications (user_id, actor_id, type, resource_id, content)
    VALUES (
        v_organizer_id,
        NEW.user_id, 
        'activity_request', 
        NEW.activity_id, 
        'requested to join your event: ' || LEFT(v_activity_title, 20)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. RE-ATTACH TRIGGERS
CREATE TRIGGER on_new_activity_post
AFTER INSERT ON public.activities
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_activity_post();

CREATE TRIGGER on_activity_request
AFTER INSERT ON public.activity_requests
FOR EACH ROW EXECUTE PROCEDURE public.notify_activity_request();

COMMIT;
