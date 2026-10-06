-- 🏥 NOTIFICATION SURGERY: FINAL FIX 🏥
-- Goal: Remove ALL duplicate/legacy triggers and enforce ONE trigger per table.

-- ==========================================
-- 1. COMMENTS CLEANUP (The Source of Duplicate Replies)
-- ==========================================
DROP TRIGGER IF EXISTS on_post_comment ON public.comments;
DROP TRIGGER IF EXISTS on_comment_created ON public.comments;
DROP TRIGGER IF EXISTS handle_new_comment ON public.comments;
DROP TRIGGER IF EXISTS comment_notification ON public.comments;

-- Re-Attach ONLY the Correct One
CREATE TRIGGER on_post_comment
AFTER INSERT ON public.comments
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_comment();


-- ==========================================
-- 2. LIKES CLEANUP
-- ==========================================
DROP TRIGGER IF EXISTS on_post_like ON public.likes;
DROP TRIGGER IF EXISTS on_like_created ON public.likes;
DROP TRIGGER IF EXISTS handle_new_like ON public.likes;
DROP TRIGGER IF EXISTS like_notification ON public.likes;

-- Re-Attach ONLY the Correct One
CREATE TRIGGER on_post_like
AFTER INSERT ON public.likes
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_like();


-- ==========================================
-- 3. FOLLOWS CLEANUP
-- ==========================================
DROP TRIGGER IF EXISTS on_new_follow ON public.follows;
DROP TRIGGER IF EXISTS on_follow_created ON public.follows;
DROP TRIGGER IF EXISTS handle_new_follow ON public.follows;

-- Re-Attach ONLY the Correct One
CREATE TRIGGER on_new_follow
AFTER INSERT ON public.follows
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_follow();


-- ==========================================
-- 4. MESSAGES CLEANUP (Chat)
-- ==========================================
DROP TRIGGER IF EXISTS on_new_message_notification ON public.messages;
DROP TRIGGER IF EXISTS on_message_created ON public.messages;
DROP TRIGGER IF EXISTS message_notification ON public.messages;

-- Re-Attach ONLY the Correct One
CREATE TRIGGER on_new_message_notification
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_message_notification();


-- ==========================================
-- 5. VERIFICATION
-- ==========================================
-- Verify only 1 trigger exists per table
SELECT event_object_table, trigger_name 
FROM information_schema.triggers 
WHERE event_object_table IN ('comments', 'likes', 'follows', 'messages')
ORDER BY event_object_table;
