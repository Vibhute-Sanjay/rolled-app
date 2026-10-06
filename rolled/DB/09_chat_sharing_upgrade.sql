-- Add columns to support sharing Rolls (Posts) and Activities (Events) in Chat
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS post_id UUID REFERENCES public.posts(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS activity_id UUID REFERENCES public.activities(id) ON DELETE SET NULL;

-- Index for performance when querying shared content
CREATE INDEX IF NOT EXISTS idx_messages_post_id ON public.messages(post_id);
CREATE INDEX IF NOT EXISTS idx_messages_activity_id ON public.messages(activity_id);
