-- 🔗 FIX ACTIVITY DEEP LINKING 🔗
-- Ensures that 'Activity Post' and 'Activity Request' notifications 
-- have the correct TYPE and RESOURCE_ID so the app can navigate to the right screen.

BEGIN;

-- 1. Notify Followers when I post a new Activity (Deep Link -> /activity/[id])
CREATE OR REPLACE FUNCTION public.handle_new_activity_post() RETURNS TRIGGER AS $$
BEGIN
  -- Insert notification for all followers
  INSERT INTO public.notifications (user_id, actor_id, type, resource_id, content)
  SELECT 
    f.follower_id, 
    NEW.host_id, 
    'activity_post',   -- <--- CRITICAL: Matches frontend 'type'
    NEW.id,            -- <--- CRITICAL: Matches frontend 'resourceId'
    'posted a new rollout: ' || LEFT(NEW.title, 30)
  FROM public.follows f
  WHERE f.following_id = NEW.host_id
  AND f.status = 'accepted';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Re-attach Trigger (Safety)
DROP TRIGGER IF EXISTS on_new_activity_post ON public.activities;
CREATE TRIGGER on_new_activity_post
AFTER INSERT ON public.activities
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_activity_post();


-- 2. Notify Host when someone requests to join (Deep Link -> /notifications)
-- (Frontend already routes 'activity_request' to /notifications, so this just confirms data is clean)
CREATE OR REPLACE FUNCTION public.notify_activity_request() RETURNS TRIGGER AS $$
DECLARE
    activity_title TEXT;
    host_id UUID;
BEGIN
    SELECT title, host_id INTO activity_title, host_id FROM public.activities WHERE id = NEW.activity_id;
    
    INSERT INTO public.notifications (user_id, actor_id, type, resource_id, content)
    VALUES (
        host_id, 
        NEW.user_id, 
        'activity_request', 
        NEW.activity_id, -- Keep ID just in case we want to route to specific screen later
        'requested to join ' || LEFT(activity_title, 20)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMIT;
NOTIFY pgrst, 'reload config';
