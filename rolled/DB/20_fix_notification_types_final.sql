-- 🛡️ FINAL NOTIFICATION CONSTRAINT FIX
-- Goal: Allow ALL activity-related types to prevent "Constraint Violation" errors.

-- 1. Drop the strict constraint
ALTER TABLE public.notifications 
DROP CONSTRAINT IF EXISTS notifications_type_check;

-- 2. Add the comprehensive constraint
ALTER TABLE public.notifications 
ADD CONSTRAINT notifications_type_check 
CHECK (type IN (
    -- Standard Social
    'follow', 
    'follow_request', 
    'like', 
    'reply', 
    'mention', 
    'system', 
    'message',
    
    -- Generic
    'post',
    'comment',

    -- Activities / Events (The culprits)
    'activity',
    'event',
    'activity_request',   -- Found in code
    'activity_approved',  -- Found in code
    'activity_rejected',  -- Found in code
    'activity_updated'    -- Found in code
));
