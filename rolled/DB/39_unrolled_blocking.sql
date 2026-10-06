-- 1. Create the dedicated unrolled_blocks table
CREATE TABLE IF NOT EXISTS public.unrolled_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blocker_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    blocked_identity_id UUID REFERENCES public.anon_identities(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(blocker_id, blocked_identity_id)
);

ALTER TABLE public.unrolled_blocks ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see and manage their own blocks
CREATE POLICY "Users can manage their own unrolled blocks" 
ON public.unrolled_blocks
FOR ALL 
USING (auth.uid() = blocker_id);

-- 2. Update get_unrolled_feed to filter out blocked identities
CREATE OR REPLACE FUNCTION public.get_unrolled_feed(
  sort_type text default 'new',
  limit_count int default 20,
  offset_count int default 0,
  filter_badge text default 'All'
)
RETURNS TABLE (
  id uuid,
  content text,
  identity_id uuid,
  created_at timestamp with time zone,
  upvotes int,
  downvotes int,
  reply_count int,
  badge text,
  anon_name text,
  avatar_color text,
  fire_score numeric
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.content,
    p.identity_id,
    p.created_at,
    p.upvotes,
    p.downvotes,
    p.reply_count,
    p.badge,
    i.anon_name,
    i.avatar_color,
    (
      (p.upvotes * 2) + 
      (p.reply_count * 3) - 
      (p.downvotes * 1) - 
      (EXTRACT(EPOCH FROM (now() - p.created_at))/3600 * 3)
    )::numeric AS fire_score
  FROM public.anon_posts p
  JOIN public.anon_identities i ON p.identity_id = i.id
  WHERE 
    (CASE WHEN filter_badge = 'All' THEN true ELSE p.badge = filter_badge END)
    AND p.identity_id NOT IN (
        SELECT blocked_identity_id FROM public.unrolled_blocks WHERE blocker_id = auth.uid()
    )
  ORDER BY
    CASE WHEN sort_type = 'fire' THEN
      (
        (p.upvotes * 2) + 
        (p.reply_count * 3) - 
        (p.downvotes * 1) - 
        (EXTRACT(EPOCH FROM (now() - p.created_at))/3600 * 3)
      ) 
    END DESC NULLS LAST,
    p.created_at DESC
  LIMIT limit_count
  OFFSET offset_count;
END;
$$;

-- Secure the function search_path
ALTER FUNCTION public.get_unrolled_feed(TEXT, INT, INT, TEXT) SET search_path = public, extensions;
