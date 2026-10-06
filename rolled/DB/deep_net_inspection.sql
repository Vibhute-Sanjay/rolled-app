-- 🕵️‍♂️ DEEP DIVE: WHERE DID THE REQUEST GO? 🕵️‍♂️
-- Request 295 is in the logs, but gone from the queue.
-- Did it get deleted? Moved? Or is the table name different?

-- 1. List ALL tables in 'net' schema
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'net';

-- 2. Check for ANY content in http_request_queue
SELECT * 
FROM net.http_request_queue 
ORDER BY id DESC 
LIMIT 10;

-- 3. Check ID 288 (The Manual One) - Is it still there?
SELECT *
FROM net.http_request_queue 
WHERE id = 288;
