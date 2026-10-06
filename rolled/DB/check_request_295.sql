-- 🎯 TARGETED CHECK: REQUEST 295 🎯
-- We found the ID: 295.
-- Now we look at THAT specific row to see why it failed (or if it succeeded).

SELECT *
FROM net.http_request_queue
WHERE id = 295;
