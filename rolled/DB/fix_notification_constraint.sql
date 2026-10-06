-- 🔓 WIDEN NOTIFICATION TYPES
-- The current list is too strict. We need to allow 'activity', 'event', and 'post'.

ALTER TABLE public.notifications 
DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications 
ADD CONSTRAINT notifications_type_check 
CHECK (type IN (
    'follow', 
    'follow_request', 
    'like', 
    'reply', 
    'mention', 
    'system', 
    'message',
    'activity', -- New
    'event',    -- New
    'post',     -- New (Just in case)
    'comment'   -- New (Just in case)
));
