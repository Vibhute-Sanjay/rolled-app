-- FIX SECURITY WARNINGS - ROBUST VERSION
-- Run this in Supabase SQL Editor

-- This script attempts to secure functions if they exist.
-- If a function doesn't exist (because you haven't used that feature yet), it simply skips it.

DO $$
BEGIN

    -- 1. Secure Common RPCs
    BEGIN ALTER FUNCTION public.get_user_stats(UUID) SET search_path = public, extensions; EXCEPTION WHEN undefined_function THEN NULL; END;
    BEGIN ALTER FUNCTION public.toggle_follow(UUID) SET search_path = public, extensions; EXCEPTION WHEN undefined_function THEN NULL; END;
    BEGIN ALTER FUNCTION public.delete_own_account() SET search_path = public, extensions; EXCEPTION WHEN undefined_function THEN NULL; END;
    BEGIN ALTER FUNCTION public.get_or_create_dm_room(UUID) SET search_path = public, extensions; EXCEPTION WHEN undefined_function THEN NULL; END;
    BEGIN ALTER FUNCTION public.is_room_participant(UUID) SET search_path = public, extensions; EXCEPTION WHEN undefined_function THEN NULL; END;

    -- 2. Secure Triggers
    BEGIN ALTER FUNCTION public.handle_new_follow() SET search_path = public, extensions; EXCEPTION WHEN undefined_function THEN NULL; END;
    BEGIN ALTER FUNCTION public.handle_new_like() SET search_path = public, extensions; EXCEPTION WHEN undefined_function THEN NULL; END;
    BEGIN ALTER FUNCTION public.handle_new_comment() SET search_path = public, extensions; EXCEPTION WHEN undefined_function THEN NULL; END;
    BEGIN ALTER FUNCTION public.handle_new_activity_post() SET search_path = public, extensions; EXCEPTION WHEN undefined_function THEN NULL; END;
    BEGIN ALTER FUNCTION public.calculate_flare_expiration() SET search_path = public, extensions; EXCEPTION WHEN undefined_function THEN NULL; END;
    BEGIN ALTER FUNCTION public.update_user_karma() SET search_path = public, extensions; EXCEPTION WHEN undefined_function THEN NULL; END;
    BEGIN ALTER FUNCTION public.notify_activity_request_update() SET search_path = public, extensions; EXCEPTION WHEN undefined_function THEN NULL; END;

    -- 3. Secure Feed & Trending Logic
    BEGIN ALTER FUNCTION public.get_unrolled_feed(INT, INT) SET search_path = public, extensions; EXCEPTION WHEN undefined_function THEN NULL; END;
    BEGIN ALTER FUNCTION public.get_trending_unrolled(INT) SET search_path = public, extensions; EXCEPTION WHEN undefined_function THEN NULL; END;
    BEGIN ALTER FUNCTION public.get_weekly_top_unrolled(INT) SET search_path = public, extensions; EXCEPTION WHEN undefined_function THEN NULL; END;
    BEGIN ALTER FUNCTION public.get_weekly_top_normal(INT) SET search_path = public, extensions; EXCEPTION WHEN undefined_function THEN NULL; END;

    -- 4. Secure Anon Logic
    BEGIN ALTER FUNCTION public.create_anon_identity(TEXT) SET search_path = public, extensions; EXCEPTION WHEN undefined_function THEN NULL; END;
    BEGIN ALTER FUNCTION public.get_my_anon_identity() SET search_path = public, extensions; EXCEPTION WHEN undefined_function THEN NULL; END;
    BEGIN ALTER FUNCTION public.create_anon_post(TEXT, TEXT) SET search_path = public, extensions; EXCEPTION WHEN undefined_function THEN NULL; END;
    BEGIN ALTER FUNCTION public.vote_on_anon_post(UUID, INT) SET search_path = public, extensions; EXCEPTION WHEN undefined_function THEN NULL; END;

END $$;
