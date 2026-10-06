-- 1. Create Unified Reports Table
CREATE TYPE report_target_type AS ENUM ('user', 'post', 'comment', 'message', 'reply');

CREATE TABLE IF NOT EXISTS public.unified_reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Removed NOT NULL
    target_id TEXT NOT NULL, -- Generic ID (can be UUID or String depending on target)
    target_type report_target_type NOT NULL,
    reason TEXT NOT NULL,
    details TEXT,
    screenshot_url TEXT NOT NULL, -- Mandatory Screenshot
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. RLS Policies
ALTER TABLE public.unified_reports ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to create reports
CREATE POLICY "Users can insert reports" 
ON public.unified_reports FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = reporter_id);

-- Allow users to view their own reports (audit trail)
CREATE POLICY "Users can view own reports" 
ON public.unified_reports FOR SELECT 
TO authenticated 
USING (auth.uid() = reporter_id);

-- 3. Storage Bucket for Evidence
-- Note: You typically create buckets in the dashboard, but we can try SQL:
INSERT INTO storage.buckets (id, name, public)
VALUES ('report-evidence', 'report-evidence', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policy: Authenticated users can upload
CREATE POLICY "Users can upload report evidence"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'report-evidence' AND auth.uid() = owner);

-- Storage Policy: Public Read (or Authenticated Read)
-- We'll make it public read for simplicity of Admin checking
CREATE POLICY "Anyone can read report evidence"
ON storage.objects FOR SELECT
USING (bucket_id = 'report-evidence');
