-- 🕵️ INSPECT TRIGGER FUNCTIONS
-- We need to see what these functions actully DO to see if they are crashing.

SELECT proname, prosrc 
FROM pg_proc 
WHERE proname IN ('handle_new_comment_fix', 'handle_comment_mentions');
