ALTER TABLE public.unified_reports
DROP CONSTRAINT IF EXISTS unified_reports_target_type_check;

ALTER TABLE public.unified_reports
ADD CONSTRAINT unified_reports_target_type_check
CHECK (target_type IN ('user', 'post', 'comment', 'message', 'reply', 'activity'));
