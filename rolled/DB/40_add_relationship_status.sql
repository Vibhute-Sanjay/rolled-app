-- Add relationship_status to profiles table
ALTER TABLE public.profiles ADD COLUMN relationship_status TEXT;

-- We won't add a check constraint yet to ensure it doesn't break any existing inserts/updates
-- that don't pass this field, though it shouldn't matter since the default is NULL.
