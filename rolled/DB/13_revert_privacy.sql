-- 1. Drop Privacy Restricted Policies (Explicitly named from error logs)
DROP POLICY IF EXISTS "View posts if public or following" ON public.posts;
DROP POLICY IF EXISTS "View posts based on privacy" ON public.posts; -- Added based on error
DROP POLICY IF EXISTS "View comments if public or following" ON public.posts; 
DROP POLICY IF EXISTS "View comments based on post privacy" ON public.comments; -- Added based on error
DROP POLICY IF EXISTS "Comments visibility" ON public.comments;

-- 2. Restore Open Public Access
-- Allow everyone to read all posts
DROP POLICY IF EXISTS "Public posts view" ON public.posts; 
DROP POLICY IF EXISTS "Everyone can read posts" ON public.posts; -- Cleanup potential dupe
CREATE POLICY "Everyone can read posts" ON public.posts FOR SELECT USING (true);

-- Allow everyone to read all comments
DROP POLICY IF EXISTS "Public comments view" ON public.comments; 
DROP POLICY IF EXISTS "Everyone can read comments" ON public.comments; -- Cleanup potential dupe
CREATE POLICY "Everyone can read comments" ON public.comments FOR SELECT USING (true);

-- 3. Remove Privacy Column (With CASCADE to force dependency removal)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS is_private CASCADE;

-- 4. Simplify Toggle Follow RPC (Always 'accepted', never 'pending')
DROP FUNCTION IF EXISTS public.toggle_follow(UUID); -- FORCE DROP to ensure replacement
CREATE OR REPLACE FUNCTION public.toggle_follow(target_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  base_user_id UUID := auth.uid();
  existing_status TEXT;
BEGIN
  -- Check existing relationship
  SELECT status INTO existing_status FROM public.follows
  WHERE follower_id = base_user_id AND following_id = target_user_id;

  IF existing_status IS NOT NULL THEN
    -- If exists (accepted or pending), UNFOLLOW
    DELETE FROM public.follows
    WHERE follower_id = base_user_id AND following_id = target_user_id;
    RETURN 'unfollowed';
  ELSE
    -- If not exists, FOLLOW (Always Accepted now)
    INSERT INTO public.follows (follower_id, following_id, status)
    VALUES (base_user_id, target_user_id, 'accepted');
    
    -- Notification Logic (Optional: keep if you want notifications on follow)
    INSERT INTO public.notifications (user_id, actor_id, type, content)
    VALUES (target_user_id, base_user_id, 'follow', 'started following you.');

    RETURN 'following';
  END IF;
END;
$$;
