-- 🏥 DIAGNOSTIC: NETWORK HEALTH CHECK 🏥
-- We suspect 'pg_net' itself might be broken (not queueing anything).
-- This script tries to ping Google. If this doesn't show up in the logs, the extension is DEAD.

-- 1. Try to send a simple request (Independent of our App logic)
SELECT net.http_get('https://www.google.com');

-- 2. Check if it appeared in the queue
-- We expect to see a row here, specifically for google.com
SELECT * 
FROM net.http_request_queue 
ORDER BY id DESC 
LIMIT 5;
