-- list_follow_triggers.sql
SELECT 
    trigger_name, 
    action_statement 
FROM 
    information_schema.triggers 
WHERE 
    event_object_table = 'follows' 
    AND event_object_schema = 'public';
