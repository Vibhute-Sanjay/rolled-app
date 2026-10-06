-- INSPECT PROFILES SECURITY
-- This script lists all RLS Policies and Triggers on the 'public.profiles' table.

-- 1. Check RLS Policies
SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE tablename = 'profiles';

-- 2. Check Triggers
SELECT event_object_schema, event_object_table, trigger_name, event_manipulation, action_statement, action_timing
FROM information_schema.triggers
WHERE event_object_table = 'profiles';
