-- 🔍 NOTIFICATION SYSTEM HEALTH CHECK
-- Run this to see what is broken

-- 1. Check Triggers on 'notifications' table
SELECT tgname, tgenabled FROM pg_trigger WHERE tgrelid = 'public.notifications'::regclass;

-- 2. Check Triggers on 'messages' table
SELECT tgname, tgenabled FROM pg_trigger WHERE tgrelid = 'public.messages'::regclass;

-- 3. Check Triggers on 'likes'/'comments'
SELECT tgname, tgenabled FROM pg_trigger WHERE tgrelid = 'public.likes'::regclass;
SELECT tgname, tgenabled FROM pg_trigger WHERE tgrelid = 'public.comments'::regclass;

-- 4. Check RLS on notifications
SELECT * FROM pg_policies WHERE tablename = 'notifications';

-- 5. Check net schema permissions
SELECT grantee, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'net';

-- 6. Check if trigger_push_notification is valid
SELECT proname, prosecdef, proconfig 
FROM pg_proc 
WHERE proname = 'trigger_push_notification';
