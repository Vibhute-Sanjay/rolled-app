-- Update RLS for Activities to only allow Clubs/Organizations to create
DROP POLICY IF EXISTS "Users can create activities" ON public.activities;

CREATE POLICY "Clubs can create activities"
ON public.activities
FOR INSERT
WITH CHECK (
  auth.uid() = organizer_id AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND (role = 'club' OR role = 'organization' OR role = 'admin')
  )
);
