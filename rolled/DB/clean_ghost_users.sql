-- 1. Identify and delete chat_participants where the user no longer exists
DELETE FROM public.chat_participants
WHERE user_id NOT IN (SELECT id FROM public.profiles);

-- 2. Identify and delete messages where the sender no longer exists (Optional, if you want to wipe their messages)
-- DELETE FROM public.messages
-- WHERE sender_id NOT IN (SELECT id FROM public.profiles);

-- 3. (Optional) Cleanup empty rooms (rooms with 0 or 1 participant left)
-- This is trickier as 1-person rooms might be valid for some apps (saved messages), but for DM usually 2.
-- For now, let's just clean the broken participants.

-- 4. Fix get_or_create_dm_room to handle cases where one user is missing? 
-- Actually, cleaning participants should fix the "Ghost User" appearing in the list if the list query joins on participants.

-- RUN THIS IN SQL EDITOR
SELECT count(*) as deleted_participants FROM public.chat_participants WHERE user_id NOT IN (SELECT id FROM public.profiles);
