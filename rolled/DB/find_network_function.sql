-- 🕵️‍♂️ DIAGNOSTIC: FIND THE MISSING FUNCTION 🕵️‍♂️
-- We need to know EXACTLY where 'http_post' is installed.
-- Is it 'net.http_post'? 'public.http_post'? 'extensions.http_post'?

SELECT 
    routine_schema, 
    routine_name,
    external_language
FROM information_schema.routines
WHERE routine_name = 'http_post';
