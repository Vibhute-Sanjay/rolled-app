-- 🕵️‍♂️ DIAGNOSTIC: CHECK TRIGGERS WIRING 🕵️‍♂️
-- The Network Log was empty. That means the Function is NEVER running.
-- That means the Trigger is MISSING or BROKEN.

SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'notifications';
