-- FINAL CORRECT FIX FOR "get_unrolled_feed"
-- Run this in Supabase SQL Editor

-- The previous fix failed because the function signature has 4 arguments, not 2!
-- Signature: get_unrolled_feed(sort_type text, limit_count int, offset_count int, filter_badge text)

DO $$
BEGIN
    ALTER FUNCTION public.get_unrolled_feed(TEXT, INT, INT, TEXT) SET search_path = public, extensions;
EXCEPTION 
    WHEN undefined_function THEN RAISE NOTICE 'Function still not found? Check basic creation.';
END $$;
