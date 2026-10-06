-- 🕵️‍♂️ DEEP DIVE: TRIGGER STATUS & EXTENSIONS 🕵️‍♂️

-- 1. Check if the Trigger is PHYSICALLY DISABLED ('D')
-- tgenabled: O = Origin (Enabled), D = Disabled, R = Replica, A = Always
SELECT 
    tgname as trigger_name,
    tgenabled as status, -- 'O' is Good. 'D' is Bad.
    relname as table_name
FROM pg_trigger
JOIN pg_class ON pg_trigger.tgrelid = pg_class.oid
WHERE pg_class.relname = 'notifications';

-- 2. Check where 'pg_net' is installed
-- If it's in 'public' but our function looks in 'extensions', it might fail.
SELECT extname, nspname as schema_name
FROM pg_extension
JOIN pg_namespace ON pg_extension.extnamespace = pg_namespace.oid
WHERE extname = 'pg_net';
