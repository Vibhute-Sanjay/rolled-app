-- DISABLE NOTIFICATIONS FOR ANONYMOUS ROLLS (Upvotes, Downvotes, Replies)
-- The user requested to stop getting these notifications for privacy/anonymity.

BEGIN;

-- 1. Drop the triggers responsible for anonymous notifications
DROP TRIGGER IF EXISTS on_new_anon_vote ON public.anon_votes;
DROP TRIGGER IF EXISTS on_new_anon_reply ON public.anon_replies;

-- 2. Drop the functions if they are no longer needed (optional but cleaner)
-- Note: Leaving them doesn't hurt, but dropping the triggers stops the notifications.

-- 3. (Optional) Remove existing anonymous notifications to clean up
DELETE FROM public.notifications 
WHERE post_type = 'anon_post';

COMMIT;

-- Reload configuration if needed
NOTIFY pgrst, 'reload config';
