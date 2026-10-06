-- 38_fix_double_follow_notification.sql
-- PURPOSE: Fix the "Double Follow Notification" bug.
-- CAUSE: The 'toggle_follow' RPC was inserting a notification AND the 'on_new_follow' trigger was also inserting one.
-- FIX: Remove the manual INSERT from the RPC. Let the Trigger handle it (Single Source of Truth).

CREATE OR REPLACE FUNCTION public.toggle_follow(target_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  base_user_id UUID := auth.uid();
  existing_status TEXT;
BEGIN
  -- Check existing relationship
  SELECT status INTO existing_status FROM public.follows
  WHERE follower_id = base_user_id AND following_id = target_user_id;

  IF existing_status IS NOT NULL THEN
    -- If exists (accepted or pending), UNFOLLOW
    DELETE FROM public.follows
    WHERE follower_id = base_user_id AND following_id = target_user_id;
    RETURN 'unfollowed';
  ELSE
    -- If not exists, FOLLOW (Always Accepted now per Revert Privacy)
    INSERT INTO public.follows (follower_id, following_id, status)
    VALUES (base_user_id, target_user_id, 'accepted');
    
    -- REMOVED: Redundant Notification Insert
    -- The trigger 'on_new_follow' on public.follows will consistently handle this.
    
    RETURN 'following';
  END IF;
END;
$$;

-- Reload Schema
NOTIFY pgrst, 'reload config';
