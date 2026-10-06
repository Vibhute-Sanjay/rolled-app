-- 🏷️ TAGGING SYSTEM BACKEND
-- 1. Add Column to store tagged IDs
ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS tagged_users uuid[] DEFAULT '{}';

-- 2. Trigger Function: Notify Tagged Users
CREATE OR REPLACE FUNCTION public.handle_post_mentions()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    tagged_user_id uuid;
BEGIN
    -- Check if there are any tags
    IF NEW.tagged_users IS NOT NULL AND array_length(NEW.tagged_users, 1) > 0 THEN
        
        -- Loop through each ID in the array
        FOREACH tagged_user_id IN ARRAY NEW.tagged_users
        LOOP
            -- Prevent self-notification (unlikely but safe)
            IF tagged_user_id != NEW.user_id THEN
                INSERT INTO public.notifications (user_id, actor_id, type, resource_id, content)
                VALUES (
                    tagged_user_id,   -- The Tagged User
                    NEW.user_id,      -- The Poster
                    'mention',        -- Type
                    NEW.id,           -- Link to Post
                    'tagged you in a roll.' -- Message
                );
            END IF;
        END LOOP;

    END IF;
    
    RETURN NEW;
END;
$$;

-- 3. Create Trigger
DROP TRIGGER IF EXISTS on_post_created_mentions ON public.posts;
CREATE TRIGGER on_post_created_mentions
AFTER INSERT ON public.posts
FOR EACH ROW
EXECUTE FUNCTION public.handle_post_mentions();

-- 4. Reload Schema (just in case)
NOTIFY pgrst, 'reload config';
