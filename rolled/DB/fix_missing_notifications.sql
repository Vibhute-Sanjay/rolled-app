-- 1. Fix Notifications Type Constraint (Add ALL types and future proofing)
DO $$ 
BEGIN 
    ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
    ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check 
    CHECK (type in ('follow', 'follow_request', 'like', 'reply', 'mention', 'system', 'activity_request', 'activity_approved', 'activity_rejected', 'activity_updated'));
EXCEPTION
    WHEN others THEN null;
END $$;

-- 2. Ensure Profiles has is_private column
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'is_private') THEN 
        ALTER TABLE public.profiles ADD COLUMN is_private boolean DEFAULT false;
    END IF;
END $$;

-- 3. Ensure Follows has status column
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'follows' AND column_name = 'status') THEN 
        ALTER TABLE public.follows ADD COLUMN status text DEFAULT 'accepted';
    END IF;
END $$;

-- 4. Re-create LIKE Trigger
CREATE OR REPLACE FUNCTION public.handle_new_like()
RETURNS TRIGGER AS $$
BEGIN
  -- Don't notify if liking own post
  IF new.user_id = (SELECT user_id FROM public.posts WHERE id = new.post_id) THEN
    RETURN new;
  END IF;

  INSERT INTO public.notifications (user_id, actor_id, type, resource_id, content)
  VALUES (
    (SELECT user_id FROM public.posts WHERE id = new.post_id), -- Recipient
    new.user_id, -- Actor
    'like',
    new.post_id,
    'liked your post'
  )
  ON CONFLICT DO NOTHING;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_post_like ON public.likes;
CREATE TRIGGER on_post_like
  AFTER INSERT ON public.likes
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_like();


-- 5. Re-create COMMENT Trigger
CREATE OR REPLACE FUNCTION public.handle_new_comment()
RETURNS TRIGGER AS $$
BEGIN
  -- Don't notify if replying to self
  IF new.user_id = (SELECT user_id FROM public.posts WHERE id = new.post_id) THEN
    RETURN new;
  END IF;

  INSERT INTO public.notifications (user_id, actor_id, type, resource_id, content)
  VALUES (
    (SELECT user_id FROM public.posts WHERE id = new.post_id),
    new.user_id,
    'reply',
    new.post_id,
    left(new.content, 50)
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_post_comment ON public.comments;
CREATE TRIGGER on_post_comment
  AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_comment();


-- 6. Re-create FOLLOW Trigger (with Private logic)
CREATE OR REPLACE FUNCTION public.handle_new_follow()
RETURNS TRIGGER AS $$
DECLARE
  target_is_private boolean;
BEGIN
  -- Check if target user is private
  SELECT is_private INTO target_is_private FROM public.profiles WHERE id = new.following_id;

  IF target_is_private THEN
    -- Force status to pending just in case the client didn't set it
    UPDATE public.follows SET status = 'pending' WHERE follower_id = new.follower_id AND following_id = new.following_id;

    INSERT INTO public.notifications (user_id, actor_id, type, content)
    VALUES (new.following_id, new.follower_id, 'follow_request', 'requested to follow you');
  ELSE
    INSERT INTO public.notifications (user_id, actor_id, type, content)
    VALUES (new.following_id, new.follower_id, 'follow', 'started following you');
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_new_follow ON public.follows;
CREATE TRIGGER on_new_follow
  AFTER INSERT ON public.follows
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_follow();
