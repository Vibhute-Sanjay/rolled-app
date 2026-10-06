-- 30_refine_blocking_trigger.sql
-- 1. Create a function to handle automatic unfollowing when a block is created
CREATE OR REPLACE FUNCTION public.handle_block_creation()
RETURNS TRIGGER AS $$
BEGIN
    -- Remove follow relationship FROM blocker TO blocked
    DELETE FROM public.follows 
    WHERE follower_id = NEW.blocker_id AND following_id = NEW.blocked_id;

    -- Remove follow relationship FROM blocked TO blocker
    DELETE FROM public.follows 
    WHERE follower_id = NEW.blocked_id AND following_id = NEW.blocker_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create the trigger
DROP TRIGGER IF EXISTS on_block_created ON public.blocks;
CREATE TRIGGER on_block_created
AFTER INSERT ON public.blocks
FOR EACH ROW
EXECUTE FUNCTION public.handle_block_creation();

-- 3. Cleanup existing follow relationships for existing blocks (Optional, but good for consistency)
DELETE FROM public.follows f
USING public.blocks b
WHERE (f.follower_id = b.blocker_id AND f.following_id = b.blocked_id)
   OR (f.follower_id = b.blocked_id AND f.following_id = b.blocker_id);

-- 4. Reload Schema
NOTIFY pgrst, 'reload config';
