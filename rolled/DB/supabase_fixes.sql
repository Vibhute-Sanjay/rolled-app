-- OPTIMIZED RLS POLICIES & PERFORMANCE FIXES
-- fixes 16 "Auth RLS Initialization Plan" warnings + Unindexed Foreign Keys

-- 1. Profiles (2 policies)
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT WITH CHECK ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
CREATE POLICY "Users can update own profile." ON public.profiles FOR UPDATE USING ((select auth.uid()) = id);

-- 2. Posts (3 policies)
DROP POLICY IF EXISTS "Users can insert their own posts." ON public.posts;
CREATE POLICY "Users can insert their own posts." ON public.posts FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own posts." ON public.posts;
CREATE POLICY "Users can update own posts." ON public.posts FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own posts." ON public.posts;
CREATE POLICY "Users can delete own posts." ON public.posts FOR DELETE USING ((select auth.uid()) = user_id);

-- 3. Likes (2 policies)
DROP POLICY IF EXISTS "Auth users can like" ON public.likes;
CREATE POLICY "Auth users can like" ON public.likes FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Auth users can unlike" ON public.likes;
CREATE POLICY "Auth users can unlike" ON public.likes FOR DELETE USING ((select auth.uid()) = user_id);

-- 4. Comments (2 policies)
DROP POLICY IF EXISTS "Auth users can comment" ON public.comments;
CREATE POLICY "Auth users can comment" ON public.comments FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Auth users can delete own comment" ON public.comments;
CREATE POLICY "Auth users can delete own comment" ON public.comments FOR DELETE USING ((select auth.uid()) = user_id);

-- 5. Follows (2 policies)
DROP POLICY IF EXISTS "Auth users can follow" ON public.follows;
CREATE POLICY "Auth users can follow" ON public.follows FOR INSERT WITH CHECK ((select auth.uid()) = follower_id);

DROP POLICY IF EXISTS "Auth users can unfollow" ON public.follows;
CREATE POLICY "Auth users can unfollow" ON public.follows FOR DELETE USING ((select auth.uid()) = follower_id);

-- 6. Saved Posts (3 policies)
DROP POLICY IF EXISTS "Users can see own saved posts" ON public.saved_posts;
CREATE POLICY "Users can see own saved posts" ON public.saved_posts FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can save posts" ON public.saved_posts;
CREATE POLICY "Users can save posts" ON public.saved_posts FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can unsave posts" ON public.saved_posts;
CREATE POLICY "Users can unsave posts" ON public.saved_posts FOR DELETE USING ((select auth.uid()) = user_id);

-- 7. Comment Likes (2 policies)
DROP POLICY IF EXISTS "Auth users can like comments" ON public.comment_likes;
CREATE POLICY "Auth users can like comments" ON public.comment_likes FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Auth users can unlike comments" ON public.comment_likes;
CREATE POLICY "Auth users can unlike comments" ON public.comment_likes FOR DELETE USING ((select auth.uid()) = user_id);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON public.posts(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON public.comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON public.comments(user_id);
CREATE INDEX IF NOT EXISTS idx_likes_user_id ON public.likes(user_id);
CREATE INDEX IF NOT EXISTS idx_follows_following_id ON public.follows(following_id);
CREATE INDEX IF NOT EXISTS idx_saved_posts_post_id ON public.saved_posts(post_id);
CREATE INDEX IF NOT EXISTS idx_comment_likes_comment_id ON public.comment_likes(comment_id);

-- SECURITY & CONFIGURATION FIXES (UPDATED)

-- 1. Fix "Function Search Path Mutable" for trigger_delete_media
ALTER FUNCTION public.trigger_delete_media() SET search_path = public, net, extensions;

-- 2. Fix "Extension in Public" for pg_net
-- (Using DROP/CREATE because pg_net does not support ALTER SET SCHEMA)
CREATE SCHEMA IF NOT EXISTS extensions;
DROP EXTENSION IF EXISTS pg_net;
CREATE EXTENSION pg_net SCHEMA extensions;

-- 3. Fix "Security Definer" function safety for handle_new_user
ALTER FUNCTION public.handle_new_user() SET search_path = public;
