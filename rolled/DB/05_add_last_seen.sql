-- Add last_seen column to profiles if it doesn't exist
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- Allow users to update their own last_seen
-- We need a policy for UPDATE on profiles? or check existing.
-- "Users can update own profile" usually exists. Let's verify or add specific one.

CREATE POLICY "Users can update own last_seen"
ON public.profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Index for performance if needed (optional for now)
-- CREATE INDEX idx_profiles_last_seen ON public.profiles(last_seen);
