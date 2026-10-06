-- 🧹 CLEANUP & OPTIMIZATION SCRIPT 🧹
-- This script removes debug logging and restores the notification system to a clean, production-ready state.

-- 1. Redefine trigger function WITHOUT debug logging (Clean Version)
CREATE OR REPLACE FUNCTION public.trigger_push_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net, extensions
AS $$
DECLARE
  edge_function_url text := 'https://hbkslwngbsvwiudaxltb.supabase.co/functions/v1/push-';
  -- Ideally, manage secrets via Vault, but for now we keep the working hardcoded key structure
  service_role_key text := 'YOUR_SUPABASE_SERVICE_ROLE_KEY_HERE'; -- ⬅️ REPLACE THIS IF NEEDED
  req_id bigint;
BEGIN
  -- Attempt Network Request safely
  BEGIN
      SELECT net.http_post(
        url := edge_function_url,
        body := jsonb_build_object('record', row_to_json(NEW))::jsonb,
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || service_role_key
        )
      ) INTO req_id;

  EXCEPTION WHEN OTHERS THEN
      -- In production, we just swallow the error so the user's action (like sending a message) doesn't fail.
      -- No logging to avoid cluttering DB or failing if log table is missing.
      NULL;
  END;
  
  RETURN NEW;
END;
$$;

-- 2. Drop the debug logging table
DROP TABLE IF EXISTS public.debug_logs;


-- 3. Cleanup other temporary diagnostic functions if they exist
DROP FUNCTION IF EXISTS public.manual_push_test();
-- (Add others if you created specific temporary functions, but most were just scripts)
