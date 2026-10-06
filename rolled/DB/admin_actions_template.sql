-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
-- !!! DO NOT RUN THIS ENTIRE FILE AT ONCE !!!
-- !!! THIS IS A "CHEATSHEET" OR "TEMPLATE" FILE only. !!!
-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

-- INSTRUCTIONS:
-- 1. Copy only the specific command you need (e.g., the INSERT command below).
-- 2. Paste it into the Supabase SQL Editor.
-- 3. REPLACE 'TARGET_USER_ID_HERE' with a REAL User ID (e.g., 'a0eebc99-9c0b...').
-- 4. Run the selected command.

-- =======================================================================
-- 1. SEND A WARNING NOTIFICATION (To the Offender)
-- =======================================================================
-- Replace 'TARGET_USER_ID_HERE' with the real User ID (e.g., 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11').
INSERT INTO notifications (user_id, type, content, actor_id, resource_id)
VALUES (
    'TARGET_USER_ID_HERE', 
    'system', 
    'Warning: Your recent content has been flagged for violating our community guidelines. Further violations may result in a ban.',
    NULL, 
    NULL
);

-- =======================================================================
-- 1b. NOTIFY REPORTER (Thank You Message)
-- =======================================================================
-- Replace 'REPORTER_USER_ID_HERE' with the ID of the person who submitted the report.
INSERT INTO notifications (user_id, type, content, actor_id, resource_id)
VALUES (
    'REPORTER_USER_ID_HERE', 
    'system', 
    'Update: We have reviewed your report and taken appropriate action. Thank you for helping keep Rolled safe.',
    NULL, 
    NULL
);

-- =======================================================================
-- 1c. CHECK OFFENSE COUNT (For Ban Decisions)
-- =======================================================================
-- This counts how many times a specific user has been DIRECTLY reported.
-- Replace 'SUSPICIOUS_USER_ID_HERE'
SELECT count(*) as report_count 
FROM unified_reports 
WHERE target_type = 'user' 
AND target_id = 'SUSPICIOUS_USER_ID_HERE';

-- 2. RESOLVE A REPORT (Mark as dismissed or resolved)
-- Replace 'REPORT_ID'
UPDATE unified_reports
SET status = 'resolved', -- or 'dismissed'
    notes = 'Warned user via notification' -- Optional admin note
WHERE id = 'REPORT_ID_HERE';


-- 3. BAN A USER (If extreme)
-- Insert into blocks or a separate bans table if you have one, or just effectively "ban" by blocking from system account if applicable. 
-- Ideally, you'd have a 'banned' flag on profiles.
-- Example: 
-- UPDATE profiles SET is_banned = true WHERE id = 'TARGET_USER_ID';


-- 4. DELETE OFFENDING CONTENT (Post)
-- DELETE FROM posts WHERE id = 'POST_ID_HERE';

-- 5. DELETE OFFENDING CONTENT (Comment)
-- DELETE FROM comments WHERE id = 'COMMENT_ID_HERE';

-- 6. DELETE OFFENDING CONTENT (Message)
-- DELETE FROM messages WHERE id = 'MESSAGE_ID_HERE';

-- 7. DELETE OFFENDING CONTENT (Activity)
-- DELETE FROM activities WHERE id = 'ACTIVITY_ID_HERE';
