-- 🕵️‍♂️ DIAGNOSTIC: CHECK NETWORK REQUEST LOGS (SAFER) 🕵️‍♂️
-- The previous error meant the column names were slightly different in your version of Supabase.
-- This version grabs *everything* so we can see what columns exist and what the data is.

SELECT *
FROM net.http_request_queue
WHERE url LIKE '%functions/v1/push%'
ORDER BY id DESC
LIMIT 10;
