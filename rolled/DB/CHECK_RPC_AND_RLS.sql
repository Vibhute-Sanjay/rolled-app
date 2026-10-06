-- 🕵️ INSPECT RPC & RLS FOR COMMENTS/LIKES
-- Why are replies/likes failing?
-- 1. Does 'create_anon_reply' accept parent_id?
-- 2. Are there RLS policies blocking INSERT on comments or comment_likes?

-- A. Get Function Definition
SELECT prosrc AS function_source
FROM pg_proc 
WHERE proname = 'create_anon_reply';

-- B. Check RLS Policies on 'comments'
SELECT * FROM pg_policies WHERE tablename = 'comments';

-- C. Check RLS Policies on 'comment_likes'
SELECT * FROM pg_policies WHERE tablename = 'comment_likes';
