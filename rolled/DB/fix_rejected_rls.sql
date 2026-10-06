-- Fix RLS policy to hide rejected posts from the author
DROP POLICY IF EXISTS "Anon posts viewable by everyone if approved or if author" ON "public"."anon_posts";

CREATE POLICY "Anon posts viewable by everyone if approved or if author" 
ON "public"."anon_posts" 
FOR SELECT 
USING (
  status = 'approved' 
  OR (
    status = 'pending' AND "identity_id" IN (
      SELECT "anon_identities"."id" 
      FROM "public"."anon_identities" 
      WHERE "anon_identities"."user_id" = auth.uid()
    )
  )
);
