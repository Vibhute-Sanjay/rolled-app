-- Inspect the "Source Code" of the notification triggers
SELECT routine_name, routine_definition 
FROM information_schema.routines 
WHERE routine_name IN (
    'handle_new_like', 
    'handle_new_comment', 
    'handle_new_follow', 
    'handle_new_message_notification',
    'handle_new_activity' -- This one is likely the culprit
);
