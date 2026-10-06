
-- 19_activity_notifications.sql
-- Triggers notifications when Activity Requests are Approved/Rejected

-- 1. Function to Notify on Request Update
CREATE OR REPLACE FUNCTION notify_activity_request_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  activity_title text;
BEGIN
  -- Only trigger if status CHANGED
  IF NEW.status IS DISTINCT FROM OLD.status THEN
      
      -- Get Activity Title for the message
      SELECT title INTO activity_title FROM public.activities WHERE id = NEW.activity_id;

      -- If APPROVED
      IF NEW.status = 'approved' THEN
          INSERT INTO public.notifications (user_id, actor_id, type, resource_id, content)
          VALUES (
              NEW.user_id, -- The guest receiving the notification
              auth.uid(),  -- The organizer (who performed the update)
              'activity_approved',
              NEW.activity_id,
              'approved your request to join ' || activity_title
          );
      
      -- If REJECTED (Optional, but good UX)
      ELSIF NEW.status = 'rejected' THEN
          INSERT INTO public.notifications (user_id, actor_id, type, resource_id, content)
          VALUES (
              NEW.user_id,
              auth.uid(),
              'activity_rejected',
              NEW.activity_id,
              'declined your request to join ' || activity_title
          );
      END IF;

  END IF;
  
  RETURN NEW;
END;
$$;

-- 2. Create Trigger
DROP TRIGGER IF EXISTS trigger_notify_activity_request ON public.activity_requests;

CREATE TRIGGER trigger_notify_activity_request
AFTER UPDATE ON public.activity_requests
FOR EACH ROW
EXECUTE FUNCTION notify_activity_request_update();
