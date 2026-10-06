-- Activity Likes Table
CREATE TABLE IF NOT EXISTS public.activity_likes (
    user_id uuid REFERENCES public.profiles(id) NOT NULL,
    activity_id uuid REFERENCES public.activities(id) ON DELETE CASCADE NOT NULL,
    created_at timestamptz DEFAULT now(),
    PRIMARY KEY (user_id, activity_id)
);

-- RLS
ALTER TABLE public.activity_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public view likes" 
ON public.activity_likes FOR SELECT 
USING (true);

CREATE POLICY "Users can like activities" 
ON public.activity_likes FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike activities" 
ON public.activity_likes FOR DELETE 
USING (auth.uid() = user_id);

-- Optional: Count View or column could be added later for performance, 
-- but simpler count queries work for now.
