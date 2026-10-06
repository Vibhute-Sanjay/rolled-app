-- 🧐 SCHEMA INSPECTION: COMMENTS & LIKES
-- Does 'comment_likes' exist? Does 'comments' have 'parent_id'?

SELECT 
    table_name, 
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE table_name IN ('comments', 'comment_likes')
ORDER BY table_name, ordinal_position;
