-- 🗳️ POLL NOTIFICATIONS

-- 1. Ensure 'vote' is a valid notification type
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check 
CHECK (type IN (
    'like', 'comment', 'reply', 'follow', 'system', 'message', 'mention', 
    'activity_request', 'activity_approved', 'activity_rejected', 'activity_updated', 
    'new_activity', 'vote'
));

-- 2. Trigger Function
CREATE OR REPLACE FUNCTION public.handle_new_vote()
RETURNS TRIGGER AS $$
DECLARE
    post_author_id uuid;
BEGIN
    -- Get the author of the poll
    SELECT user_id INTO post_author_id
    FROM public.posts
    WHERE id = NEW.post_id;

    -- Don't notify if voting on own poll
    IF post_author_id = NEW.user_id THEN
        RETURN NEW;
    END IF;

    -- Insert Notification
    INSERT INTO public.notifications (
        type,
        actor_id,
        user_id, -- Recipient (Author)
        resource_id, -- The Post ID
        content
    ) VALUES (
        'vote',
        NEW.user_id,
        post_author_id,
        NEW.post_id,
        'voted on your poll.'
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Trigger
DROP TRIGGER IF EXISTS on_poll_vote ON public.poll_votes;
CREATE TRIGGER on_poll_vote
AFTER INSERT ON public.poll_votes
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_vote();

NOTIFY pgrst, 'reload config';
