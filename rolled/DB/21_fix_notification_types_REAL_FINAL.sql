-- 🛡️ REAL FINAL FIX (I found the exact string!)
-- The code uses 'new_activity', which was missing from my list.

-- 1. Drop Constraint
ALTER TABLE public.notifications 
DROP CONSTRAINT IF EXISTS notifications_type_check;

-- 2. Add Constraint with 'new_activity'
ALTER TABLE public.notifications 
ADD CONSTRAINT notifications_type_check 
CHECK (type IN (
    -- Standard
    'follow', 'follow_request', 'like', 'reply', 'mention', 'system', 'message',
    
    -- The Culprit I found in 07_social_features_upgrade.sql
    'new_activity', 

    -- Other variants found in code
    'activity_request', 
    'activity_approved', 
    'activity_rejected', 
    'activity_updated',

    -- Safety Net
    'activity', 'event', 'post', 'comment'
));
