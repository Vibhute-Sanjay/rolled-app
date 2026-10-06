-- AUDIT: Check All Notification Sources
SELECT 
    event_object_table as "Table",
    trigger_name as "Trigger Name"
FROM information_schema.triggers
WHERE event_object_table IN (
    'comments', 
    'likes', 
    'follows', 
    'messages', 
    'activities', 
    'activity_participants'
)
ORDER BY event_object_table;
