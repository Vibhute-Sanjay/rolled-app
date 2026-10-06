-- DIAGNOSTIC SCRIPT: Why is the Title "Rolled"?

-- 1. Get the LATEST Notification
WITH latest_notif AS (
    SELECT * 
    FROM public.notifications 
    ORDER BY created_at DESC 
    LIMIT 1
)
SELECT 
    n.id as notification_id,
    n.type,
    n.content,
    n.actor_id,
    n.resource_id,
    p.username as actor_username,
    p.full_name as actor_fullname
FROM latest_notif n
LEFT JOIN public.profiles p ON n.actor_id = p.id;
