-- Find the function for the 'on_new_activity_post' trigger
SELECT 
    tgname as "Trigger Name",
    proname as "Function Name",
    prosrc as "Source Code"
FROM pg_trigger t
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE tgrelid = 'public.activities'::regclass;
