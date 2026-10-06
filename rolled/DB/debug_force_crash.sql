-- 💥 DIAGNOSTIC: FORCE CRASH TEST 💥
-- We need to know if the Trigger is PHYSICALLY CONNECTED.
-- We will replace the Push Function with a "Bomb".
-- If the trigger fires, the App will ERROR when you try to send a message.

CREATE OR REPLACE FUNCTION public.trigger_push_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 💣 IF YOU SEE THIS ERROR, THE TRIGGER IS WORKING! 💣
  RAISE EXCEPTION 'BOOM! THE TRIGGER IS ALIVE!';
  RETURN NEW;
END;
$$;
