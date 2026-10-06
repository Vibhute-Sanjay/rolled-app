-- 🔧 FIX HOST_ID to ORGANIZER_ID 🔧
-- The previous trigger used 'host_id' but the table column is 'organizer_id'.
-- This script updates the functions to use the correct column name.

BEGIN;

-- 1. Notify Followers when I post a new Activity
CREATE OR REPLACE FUNCTION public.handle_new_activity_post() RETURNS TRIGGER AS $$
BEGIN
  -- Insert notification for all followers
  INSERT INTO public.notifications (user_id, actor_id, type, resource_id, content)
  SELECT 
    f.follower_id, 
    NEW.organizer_id,  -- WAS host_id
    'new_activity',    -- Matches frontend 'new_activity' type
    NEW.id,
    'posted a new event: ' || LEFT(NEW.title, 30)
  FROM public.follows f
  WHERE f.following_id = NEW.organizer_id -- WAS host_id
  AND f.status = 'accepted';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Notify Host when someone requests to join
CREATE OR REPLACE FUNCTION public.notify_activity_request() RETURNS TRIGGER AS $$
DECLARE
    v_activity_title TEXT;
    v_organizer_id UUID;
BEGIN
    SELECT title, organizer_id INTO v_activity_title, v_organizer_id 
    FROM public.activities WHERE id = NEW.activity_id;
    
    INSERT INTO public.notifications (user_id, actor_id, type, resource_id, content)
    VALUES (
        v_organizer_id, -- WAS host_id
        NEW.user_id, 
        'activity_request', 
        NEW.activity_id, 
        'requested to join your event: ' || LEFT(v_activity_title, 20)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
