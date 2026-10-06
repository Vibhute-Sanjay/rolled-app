-- 🕵️‍♂️ DIAGNOSTIC: DATA FLOW CHECK 🕵️‍♂️
-- Goal: Trace where the chain is breaking.
-- Data Chain: Message Inserted -> Notification Inserted -> Network Request

-- 1. Latest Message (Was it even saved?)
SELECT 'Latest Message' as source_table, id::text, content, created_at 
FROM public.messages 
ORDER BY created_at DESC 
LIMIT 1;

-- 2. Latest Notification (Did it trigger?)
SELECT 'Latest Notification' as source_table, id::text, type, content, created_at 
FROM public.notifications 
ORDER BY created_at DESC 
LIMIT 1;
