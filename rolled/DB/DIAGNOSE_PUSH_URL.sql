-- 🧪 DIAGNOSE PUSH URL 🧪
-- This script safely attempts to hit BOTH possible URLs and logs the result.

BEGIN;

-- 1. Create a debug log table if not exists
CREATE TABLE IF NOT EXISTS public.push_diagnostics (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    url_attempted text,
    status text,
    created_at timestamptz DEFAULT now()
);

-- 2. Diagnostic Function
CREATE OR REPLACE FUNCTION public.test_push_urls()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, net, extensions
AS $$
DECLARE
    req_id bigint;
BEGIN
    -- Test 1: Standard URL (.../push)
    PERFORM net.http_post(
        url := 'https://hbkslwngbsvwiudaxltb.supabase.co/functions/v1/push',
        body := '{"test": true}'::jsonb,
        headers := '{"Content-Type": "application/json"}'::jsonb
    );
    INSERT INTO public.push_diagnostics (url_attempted, status) VALUES ('.../push', 'Request Sent');

    -- Test 2: Hyphen URL (.../push-)
    PERFORM net.http_post(
        url := 'https://hbkslwngbsvwiudaxltb.supabase.co/functions/v1/push-',
        body := '{"test": true}'::jsonb,
        headers := '{"Content-Type": "application/json"}'::jsonb
    );
    INSERT INTO public.push_diagnostics (url_attempted, status) VALUES ('.../push-', 'Request Sent');

END;
$$;

-- 3. Execute the test immediately
SELECT public.test_push_urls();

COMMIT;

-- 4. View Results (User will see this if they run it in editor)
-- SELECT * FROM public.push_diagnostics;
