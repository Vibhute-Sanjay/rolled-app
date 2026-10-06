-- 👻 KILL THE GHOST TRIGGER 👻
-- The screenshot confirmed that 'on_post_like' is the duplicate trigger.
-- Removing it will stop the double notifications.

BEGIN;

-- 1. Drop the specific ghost trigger found in the screenshot
DROP TRIGGER IF EXISTS on_post_like ON public.likes;

-- 2. Ensure the correct one stays
-- (We assume 'on_new_like' is the one we just rebuilt in the previous script)
-- No changes needed to 'on_new_like'

COMMIT;
NOTIFY pgrst, 'reload config';
