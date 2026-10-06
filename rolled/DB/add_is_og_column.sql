-- Add is_og column to profiles table
ALTER TABLE profiles ADD COLUMN is_og BOOLEAN DEFAULT false;

-- Grant access (if needed, usually auto-inherited for authenticated)
GRANT SELECT ON profiles TO authenticated;
GRANT SELECT ON profiles TO anon;
