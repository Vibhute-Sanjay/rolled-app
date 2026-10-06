-- DIAGNOSTIC: Check for Duplicates

-- 1. Check last 10 notifications (Are there 2 identical ones?)
SELECT id, type, content, created_at 
FROM public.notifications 
ORDER BY created_at DESC 
LIMIT 10;

-- 2. Check Triggers on COMMENTS (Is there more than one?)
SELECT 
    trigger_name,
    event_manipulation
FROM information_schema.triggers
WHERE event_object_table = 'comments';

-- 3. Check Triggers on LIKES
SELECT 
    trigger_name,
    event_manipulation
FROM information_schema.triggers
WHERE event_object_table = 'likes';
