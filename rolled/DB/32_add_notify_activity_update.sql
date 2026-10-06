-- SAFE MIGRATION: 32_add_notify_activity_update.sql
-- This script safely checks for missing columns and adds the missing function.
-- It will NOT delete any data.

-- 1. Safely add columns if they don't exist yet (Idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activities' AND column_name = 'is_updated') THEN
        ALTER TABLE public.activities ADD COLUMN is_updated boolean DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activity_requests' AND column_name = 'reconfirm_needed') THEN
        ALTER TABLE public.activity_requests ADD COLUMN reconfirm_needed boolean DEFAULT false;
    END IF;
END $$;

-- 2. Create or Update the Notification Function
CREATE OR REPLACE FUNCTION public.notify_activity_update(
    p_activity_id uuid,
    p_message text
)
RETURNS void AS $$
DECLARE
    v_guest record;
BEGIN
    -- Update Requests to require reconfirmation
    UPDATE public.activity_requests
    SET reconfirm_needed = true
    WHERE activity_id = p_activity_id AND status = 'approved';

    -- Loop through approved guests and insert notifications
    FOR v_guest IN 
        SELECT user_id FROM public.activity_requests 
        WHERE activity_id = p_activity_id AND status = 'approved'
    LOOP
        INSERT INTO public.notifications (user_id, actor_id, type, resource_id, content)
        VALUES (
            v_guest.user_id, -- Recipient (Guest)
            auth.uid(),      -- Actor (Organizer / Current User)
            'activity_updated',
            p_activity_id,
            p_message
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
