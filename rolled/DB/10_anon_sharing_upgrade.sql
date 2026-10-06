-- Add column to support sharing Anonymous Rolls
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS anon_post_id UUID REFERENCES public.anon_posts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_messages_anon_post_id ON public.messages(anon_post_id);
