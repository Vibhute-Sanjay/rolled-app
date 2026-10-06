-- 1. Add attachments column to messages
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS attachments jsonb[] DEFAULT NULL;

-- 2. Create reports table
CREATE TABLE IF NOT EXISTS reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  target_id uuid NOT NULL,
  target_type text CHECK (target_type IN ('message', 'user', 'post', 'comment')),
  reason text NOT NULL,
  details text,
  created_at timestamptz DEFAULT now()
);

-- 3. Enable RLS on reports
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policy for reports (Insert only)
DROP POLICY IF EXISTS "Users can create reports" ON reports;

CREATE POLICY "Users can create reports" 
ON reports FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = reporter_id);

-- 5. Storage for Chat Media
-- Create 'chat-media' bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-media', 'chat-media', true)
ON CONFLICT (id) DO NOTHING;

-- 6. Storage Policies for chat-media
DROP POLICY IF EXISTS "Authenticated users can upload chat media" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view chat media" ON storage.objects;

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload chat media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat-media');

-- Allow anyone to view (public bucket)
CREATE POLICY "Anyone can view chat media"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'chat-media');
