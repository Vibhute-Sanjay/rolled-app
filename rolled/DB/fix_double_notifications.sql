-- CLEANUP DUPLICATE ACTIVITY NOTIFICATIONS
-- This drops all redundant triggers to ensure you only get ONE notification

-- 1. Drop old/conflicting triggers on activity_requests
DROP TRIGGER IF EXISTS on_activity_request_update ON public.activity_requests;
DROP TRIGGER IF EXISTS trigger_notify_activity_request ON public.activity_requests;
DROP TRIGGER IF EXISTS on_activity_request ON public.activity_requests;

-- 2. Drop the old functions themselves to be safe
DROP FUNCTION IF EXISTS public.handle_activity_request_update() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_activity_request() CASCADE;
DROP FUNCTION IF EXISTS public.notify_activity_request_update() CASCADE;

-- 3. Install ONE clean consolidated function (from MASTER_REPAIR)
CREATE OR REPLACE FUNCTION public.notify_activity_request_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  activity_title text;
BEGIN
  -- Only trigger if status CHANGED
  IF NEW.status IS DISTINCT FROM OLD.status THEN
      
      -- Get Activity Title for the message
      SELECT title INTO activity_title FROM public.activities WHERE id = NEW.activity_id;

      -- A. If APPROVED -> Notify Guest
      IF NEW.status = 'approved' THEN
          INSERT INTO public.notifications (user_id, actor_id, type, resource_id, content)
          VALUES (
              NEW.user_id, 
              auth.uid(),  -- The organizer
              'activity_approved',
              NEW.activity_id,
              'approved your request to join ' || activity_title
          );
      
      -- B. If REJECTED -> Notify Guest
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

-- 4. Re-enable the single trigger
CREATE TRIGGER trigger_notify_activity_request
AFTER UPDATE ON public.activity_requests
FOR EACH ROW EXECUTE PROCEDURE public.notify_activity_request_update();

-- 5. Handle NEW requests (Organizer notification)
-- This ensures the organizer still gets notified when someone asks to join
CREATE OR REPLACE FUNCTION public.handle_new_activity_request()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.notifications (user_id, actor_id, type, resource_id, content)
    VALUES (
        (SELECT organizer_id FROM public.activities WHERE id = NEW.activity_id), -- Recipient (Organizer)
        NEW.user_id, -- Actor (Requester)
        'activity_request',
        NEW.activity_id,
        'requested to join your activity'
    );
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_activity_request
AFTER INSERT ON public.activity_requests
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_activity_request();

-- 6. Reload!
NOTIFY pgrst, 'reload config';
