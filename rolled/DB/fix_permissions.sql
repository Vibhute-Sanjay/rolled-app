-- Ensure public access to anon_posts (if it's not already)
ALTER TABLE public.anon_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON public.anon_posts
FOR SELECT USING (true);

-- Ensure public access to messaging related tables (if policy missing)
-- (Assuming standard Authenticated policy exists, but adding explicit fallback if needed)

-- Fix potential permission issues
GRANT SELECT ON public.anon_posts TO authenticated;
GRANT SELECT ON public.anon_posts TO anon;

GRANT SELECT ON public.posts TO authenticated;
GRANT SELECT ON public.activities TO authenticated;

-- Verify columns exist (Run this to be sure)
-- DO NOT RUN 'ADD COLUMN' again if they exist, it might error. Check first.
