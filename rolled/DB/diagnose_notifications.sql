-- ULTIMATE NOTIFICATION TEST
-- Run this in Supabase SQL Editor

-- Step 1: Check if YOU (or any user) have a Push Token
-- (If this returns empty, notifications CANNOT work)
SELECT id, push_token 
FROM public.profiles 
WHERE push_token IS NOT NULL 
LIMIT 1;

-- Step 2: Send a TEST Notification to that user
-- We use the ID found in Step 1
DO $$
DECLARE
  target_user_id uuid;
BEGIN
  SELECT id INTO target_user_id FROM public.profiles WHERE push_token IS NOT NULL LIMIT 1;
  
  IF target_user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, content, actor_id)
    VALUES (target_user_id, 'system', 'FINAL PRE-BUILD TEST 🚀', target_user_id);
  ELSE
    RAISE NOTICE 'No user with push token found!';
  END IF;
END $$;

-- Step 3: Wait 2 seconds (simulated by just running next query) & Check Result
-- We want to see '200' in status, and NO error message
-- Step 3: Check pg_net Queue (The Outbox)
SELECT * 
FROM net.http_request_queue 
ORDER BY id DESC 
LIMIT 3;
