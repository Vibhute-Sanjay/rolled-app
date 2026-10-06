-- 🕵️ DEEP INSPECTION: LIKES TRIGGERS
-- Running this will show us EXACTLY why you get double notifications.

SELECT 
    tgname as trigger_name,
    tgenabled as status
FROM pg_trigger
WHERE tgrelid = 'public.likes'::regclass;
