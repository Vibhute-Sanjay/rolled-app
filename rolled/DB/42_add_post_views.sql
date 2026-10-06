-- 1. Add views_count to posts if it doesn't exist
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS views_count INTEGER DEFAULT 0;

-- 2. Create the post_views table to track cooldowns
CREATE TABLE IF NOT EXISTS public.post_views (
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    last_viewed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    PRIMARY KEY (post_id, user_id)
);

-- 3. Enable RLS on post_views (optional but good practice)
ALTER TABLE public.post_views ENABLE ROW LEVEL SECURITY;

-- 4. Create the RPC for tracking views natively in Postgres
CREATE OR REPLACE FUNCTION record_post_view(p_post_id UUID)
RETURNS void AS $$
DECLARE
    v_author_id UUID;
    v_user_id UUID;
    v_last_viewed TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Get current user
    v_user_id := auth.uid();
    
    -- If not authenticated, do nothing (or we could track anonymous views via IP later)
    IF v_user_id IS NULL THEN
        RETURN;
    END IF;

    -- Get the author of the post
    SELECT user_id INTO v_author_id FROM public.posts WHERE id = p_post_id;

    -- If the current user is the author, abort (self-views don't count)
    IF v_author_id = v_user_id THEN
        RETURN;
    END IF;

    -- Check if a view record already exists
    SELECT last_viewed_at INTO v_last_viewed FROM public.post_views 
    WHERE post_id = p_post_id AND user_id = v_user_id;

    IF FOUND THEN
        -- If it exists, check if it was more than 12 hours ago
        IF (now() - v_last_viewed) > interval '12 hours' THEN
            -- Update the timestamp
            UPDATE public.post_views 
            SET last_viewed_at = now() 
            WHERE post_id = p_post_id AND user_id = v_user_id;

            -- Increment the post view count
            UPDATE public.posts SET views_count = COALESCE(views_count, 0) + 1 WHERE id = p_post_id;
        END IF;
    ELSE
        -- First time viewing, insert the record
        INSERT INTO public.post_views (post_id, user_id, last_viewed_at)
        VALUES (p_post_id, v_user_id, now());

        -- Increment the post view count
        UPDATE public.posts SET views_count = COALESCE(views_count, 0) + 1 WHERE id = p_post_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
