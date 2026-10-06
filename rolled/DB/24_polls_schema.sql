-- 📊 POLLS SCHEMA

-- 1. Add Poll Flag to Posts
ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS has_poll boolean DEFAULT false;

-- 2. Poll Options Table
CREATE TABLE IF NOT EXISTS public.poll_options (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
    option_text text NOT NULL,
    index integer DEFAULT 0, -- To maintain order (0, 1, 2...)
    created_at timestamptz DEFAULT now()
);

-- 3. Poll Votes Table
CREATE TABLE IF NOT EXISTS public.poll_votes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
    option_id uuid REFERENCES public.poll_options(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    created_at timestamptz DEFAULT now(),
    
    -- Constraint: One User, One Vote per Post
    UNIQUE(user_id, post_id)
);

-- 4. Enable RLS
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

-- 5. Policies

-- Options: Visible to everyone
CREATE POLICY "Poll options are viewable by everyone" 
ON public.poll_options FOR SELECT 
USING (true);

-- Options: Only creator can insert (via creating post) - Simplified: Authenticated users can create
CREATE POLICY "Users can create poll options" 
ON public.poll_options FOR INSERT 
WITH CHECK (auth.uid() = (SELECT user_id FROM public.posts WHERE id = post_id));
-- Note: The above check is tricky because post is inserted same time. 
-- Simpler: "Authenticated users can insert"
DROP POLICY IF EXISTS "Authenticated users create options" ON public.poll_options;
CREATE POLICY "Authenticated users create options" 
ON public.poll_options FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

-- Votes: Visible to everyone (aggregates) or just query
CREATE POLICY "Poll votes are viewable by everyone" 
ON public.poll_votes FOR SELECT 
USING (true);

-- Votes: Users can insert their own vote
CREATE POLICY "Users can vote" 
ON public.poll_votes FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Votes: Users can delete their own vote? (Optional, maybe allow changing vote)
CREATE POLICY "Users can change vote" 
ON public.poll_votes FOR DELETE 
USING (auth.uid() = user_id);

-- 6. Helper View (Optional but useful for counting)
-- Instead of a view, we'll just query directly or use the `.select(*, votes:poll_votes(count))` syntax.

NOTIFY pgrst, 'reload config';
