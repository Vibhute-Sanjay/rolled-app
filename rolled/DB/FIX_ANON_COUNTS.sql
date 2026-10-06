-- 🔢 FIX ANON REPLY COUNTS 🔢
-- Standard counting only counts "Top Level" comments if not careful.
-- This script ensures 'reply_count' in 'anon_posts' reflects TOTAL replies (nested included).

-- Actually, we can just create a trigger to update 'anon_posts.reply_count'
-- whenever a comment is added/deleted where 'anon_post_id' is matched.

BEGIN;

CREATE OR REPLACE FUNCTION public.update_anon_post_reply_count()
RETURNS TRIGGER AS $$
DECLARE v_anon_post_id uuid;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        v_anon_post_id := OLD.anon_post_id;
    ELSE
        v_anon_post_id := NEW.anon_post_id;
    END IF;

    -- Safety check
    IF v_anon_post_id IS NOT NULL THEN
        UPDATE public.anon_posts
        SET reply_count = (
            SELECT count(*) 
            FROM public.comments 
            WHERE anon_post_id = v_anon_post_id
        )
        WHERE id = v_anon_post_id;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger
DROP TRIGGER IF EXISTS trg_update_anon_reply_count ON public.comments;
CREATE TRIGGER trg_update_anon_reply_count
AFTER INSERT OR DELETE ON public.comments
FOR EACH ROW
EXECUTE FUNCTION public.update_anon_post_reply_count();

COMMIT;
NOTIFY pgrst, 'reload config';
