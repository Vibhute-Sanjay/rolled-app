-- 🧪 MANUAL PUSH SIMULATION 🧪
-- We know 'pg_net' is alive (Google worked).
-- We need to know if OUR Push Command works when run manually.

WITH test_payload AS (
  SELECT 
    '00000000-0000-0000-0000-000000000000'::uuid as id,
    'manual_test' as type,
    'Testing Push Logic' as content
)
SELECT 
  net.http_post(
    url := 'https://hbkslwngbsvwiudaxltb.supabase.co/functions/v1/push-',
    body := jsonb_build_object('record', row_to_json(p))::jsonb,
    headers := '{"Content-Type": "application/json"}'::jsonb
  ) as request_id
FROM test_payload p;

-- 2. Check the Queue immediately
SELECT * 
FROM net.http_request_queue 
ORDER BY id DESC 
LIMIT 5;
