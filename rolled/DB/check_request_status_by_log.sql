-- 🕵️‍♂️ TRACE REQUEST STATUS (SAFER) 🕵️‍♂️
-- Column names are tricky. let's just grab the whole row.

SELECT *
FROM net.http_request_queue 
WHERE id = (
  -- Extract the ID from the logs
  SELECT (details->>'request_id')::bigint 
  FROM public.debug_logs 
  WHERE message = 'HTTP Request Sent'
  ORDER BY created_at DESC 
  LIMIT 1
);
