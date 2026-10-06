-- FINAL WARNINGS FIX (The Last 6 Issues)
-- Run this in Supabase SQL Editor

DO $$
BEGIN

    -- 1. Secure "get_active_flare_users"
    BEGIN ALTER FUNCTION public.get_active_flare_users(UUID) SET search_path = public, extensions; EXCEPTION WHEN undefined_function THEN NULL; END;
    -- (Also try without arguments just in case)
    BEGIN ALTER FUNCTION public.get_active_flare_users() SET search_path = public, extensions; EXCEPTION WHEN undefined_function THEN NULL; END;

    -- 2. Secure "get_unrolled_feed" (User reported this one specifically)
    -- It has two arguments (limit, offset) based on file "supabase_fire_sort.sql"
    BEGIN ALTER FUNCTION public.get_unrolled_feed(INT, INT) SET search_path = public, extensions; EXCEPTION WHEN undefined_function THEN NULL; END;

    -- 3. Secure "handle_follow_request"
    -- Arguments: requester_id uuid, action text
    BEGIN ALTER FUNCTION public.handle_follow_request(uuid, text) SET search_path = public, extensions; EXCEPTION WHEN undefined_function THEN NULL; END;

    -- 4. Secure "delete_room_if_empty"
    -- No arguments (Trigger function)
    BEGIN ALTER FUNCTION public.delete_room_if_empty() SET search_path = public, extensions; EXCEPTION WHEN undefined_function THEN NULL; END;

    -- 5. Secure "hide_message"
    -- Argument: target_message_id UUID
    BEGIN ALTER FUNCTION public.hide_message(UUID) SET search_path = public, extensions; EXCEPTION WHEN undefined_function THEN NULL; END;

END $$;

-- 6. FIX "RLS Policy Always True" for Notifications
-- The warning implies a policy like "USING (true)" exists.
-- We will DROP it and create a proper one.

BEGIN;
    -- Drop any overly permissive policies on notifications
    DROP POLICY IF EXISTS "Public view" ON public.notifications;
    DROP POLICY IF EXISTS "Everyone can view" ON public.notifications;
    DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
    DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

    -- Re-create STRICT policy
    -- Only the owner can see their notifications
    CREATE POLICY "Users can view own notifications" 
    ON public.notifications FOR SELECT USING (auth.uid() = user_id);

    -- Allow system/triggers (Security Definer functions) to Insert
    -- (No policy needed for Superuser/Trigger, but if inserted by user client, they own it)
    CREATE POLICY "Users can insert own notifications"
    ON public.notifications FOR INSERT WITH CHECK (auth.uid() = user_id);

    -- Enable RLS to be sure
    ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
COMMIT;
