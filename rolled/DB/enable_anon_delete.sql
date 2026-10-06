-- Enable deletion for anon_posts (User must own the identity linked to the post)
CREATE POLICY "Users can delete own anon posts"
ON public.anon_posts
FOR DELETE
USING (
  identity_id IN (
    SELECT id FROM public.anon_identities WHERE user_id = auth.uid()
  )
);
