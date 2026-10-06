-- DIAGNOSTIC: Inspect RLS and Triggers for messages table
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual, 
    with_check
FROM pg_policies
WHERE tablename = 'messages';

-- Inspect triggers on messages
SELECT 
    tgname AS trigger_name,
    proname AS function_name,
    tgenabled AS enabled
FROM pg_trigger
JOIN pg_proc ON pg_proc.oid = pg_trigger.tgfoid
WHERE tgrelid = 'public.messages'::regclass;
