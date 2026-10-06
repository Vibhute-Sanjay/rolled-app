
-- 18_karma_system_logic.sql
-- Implements Karma System for Unrolled Posts
-- Formula: Karma = (Upvotes * 2) - (Downvotes * 3)

-- 1. Add Karma Column to Profiles (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'karma') THEN
        ALTER TABLE public.profiles ADD COLUMN karma int default 0;
    END IF;
END $$;

-- 2. Function to Calculate and Update Karma for a specific User
CREATE OR REPLACE FUNCTION update_user_karma()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user_id uuid;
  new_karma int;
BEGIN
  -- Trigger is ON anon_posts (UPDATE of votes)
  -- NEW.identity_id is the author of the post
  
  -- Find real user ID from the identity
  SELECT user_id INTO target_user_id 
  FROM public.anon_identities 
  WHERE id = NEW.identity_id;
  
  IF target_user_id IS NOT NULL THEN
      -- Calculate Total Karma for this user across ALL their anonymous posts
      -- Formula: (Upvotes * 2) - (Downvotes * 3)
      SELECT COALESCE(SUM((upvotes * 2) - (downvotes * 3)), 0)
      INTO new_karma
      FROM public.anon_posts
      WHERE identity_id = NEW.identity_id;
      
      -- Update Profile
      UPDATE public.profiles
      SET karma = new_karma
      WHERE id = target_user_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 3. Create Trigger to watch for Upvote/Downvote changes on Anonymous Posts
DROP TRIGGER IF EXISTS trigger_update_karma ON public.anon_posts;

CREATE TRIGGER trigger_update_karma
AFTER UPDATE OF upvotes, downvotes ON public.anon_posts
FOR EACH ROW
EXECUTE FUNCTION update_user_karma();

-- 4. Retroactive Calculation (Fix existing users)
-- Updates every profile that has an anonymous identity with posts
UPDATE public.profiles
SET karma = (
    SELECT COALESCE(SUM((p.upvotes * 2) - (p.downvotes * 3)), 0)
    FROM public.anon_posts p
    JOIN public.anon_identities i ON p.identity_id = i.id
    WHERE i.user_id = public.profiles.id
)
WHERE id IN (
    SELECT DISTINCT user_id FROM public.anon_identities
);
