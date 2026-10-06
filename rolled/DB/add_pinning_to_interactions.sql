-- Add pinning support to interactions (Likes and Saved Posts)
-- This allows users to pin ANY post to the top of their Liked/Saved lists, even if they don't own the post.

ALTER TABLE public.likes ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;
ALTER TABLE public.saved_posts ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;
