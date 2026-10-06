-- FINAL SECURITY FIX FOR ALL FUNCTIONS (Fixes 9 Remaining Warnings)
-- Run this in Supabase SQL Editor

DO $$
BEGIN

    -- 1. Activity Booking System Functions (Likely the missing ones!)
    BEGIN ALTER FUNCTION public.handle_new_activity_request() SET search_path = public, extensions; EXCEPTION WHEN undefined_function THEN NULL; END;
    BEGIN ALTER FUNCTION public.handle_activity_request_update() SET search_path = public, extensions; EXCEPTION WHEN undefined_function THEN NULL; END;
    BEGIN ALTER FUNCTION public.notify_activity_update(UUID, TEXT) SET search_path = public, extensions; EXCEPTION WHEN undefined_function THEN NULL; END;

    -- 2. Push Notifications
    BEGIN ALTER FUNCTION public.trigger_push_notification() SET search_path = public, extensions; EXCEPTION WHEN undefined_function THEN NULL; END;

    -- 3. Social & Feed Functions (Re-applying to be safe)
    BEGIN ALTER FUNCTION public.get_user_stats(UUID) SET search_path = public, extensions; EXCEPTION WHEN undefined_function THEN NULL; END;
    BEGIN ALTER FUNCTION public.toggle_follow(UUID) SET search_path = public, extensions; EXCEPTION WHEN undefined_function THEN NULL; END;
    BEGIN ALTER FUNCTION public.handle_new_follow() SET search_path = public, extensions; EXCEPTION WHEN undefined_function THEN NULL; END;
    BEGIN ALTER FUNCTION public.handle_new_like() SET search_path = public, extensions; EXCEPTION WHEN undefined_function THEN NULL; END;
    BEGIN ALTER FUNCTION public.handle_new_comment() SET search_path = public, extensions; EXCEPTION WHEN undefined_function THEN NULL; END;
    BEGIN ALTER FUNCTION public.handle_new_activity_post() SET search_path = public, extensions; EXCEPTION WHEN undefined_function THEN NULL; END;
    BEGIN ALTER FUNCTION public.calculate_flare_expiration() SET search_path = public, extensions; EXCEPTION WHEN undefined_function THEN NULL; END;
    BEGIN ALTER FUNCTION public.notify_activity_request_update() SET search_path = public, extensions; EXCEPTION WHEN undefined_function THEN NULL; END;

    -- 4. Anon & Misc
    BEGIN ALTER FUNCTION public.create_anon_identity(TEXT) SET search_path = public, extensions; EXCEPTION WHEN undefined_function THEN NULL; END;
    BEGIN ALTER FUNCTION public.get_my_anon_identity() SET search_path = public, extensions; EXCEPTION WHEN undefined_function THEN NULL; END;
    BEGIN ALTER FUNCTION public.create_anon_post(TEXT, TEXT) SET search_path = public, extensions; EXCEPTION WHEN undefined_function THEN NULL; END;
    
    -- 5. Chat Functions (Just in case)
    BEGIN ALTER FUNCTION public.get_or_create_dm_room(UUID) SET search_path = public, extensions; EXCEPTION WHEN undefined_function THEN NULL; END;
    BEGIN ALTER FUNCTION public.is_room_participant(UUID) SET search_path = public, extensions; EXCEPTION WHEN undefined_function THEN NULL; END;

    -- 6. Helper Functions
    BEGIN ALTER FUNCTION public.delete_own_account() SET search_path = public, extensions; EXCEPTION WHEN undefined_function THEN NULL; END;
    BEGIN ALTER FUNCTION public.handle_new_verified_user() SET search_path = public, extensions; EXCEPTION WHEN undefined_function THEN NULL; END;
    BEGIN ALTER FUNCTION public.handle_user_verification() SET search_path = public, extensions; EXCEPTION WHEN undefined_function THEN NULL; END;

END $$;
