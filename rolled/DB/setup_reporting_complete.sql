-- COMPLETE SETUP FOR UNIFIED REPORTING
-- Run this ONCE to set up the entire system correctly.

-- 1. Create Enum Type (including 'activity')
DO $$ BEGIN
    CREATE TYPE report_target_type AS ENUM ('user', 'post', 'comment', 'message', 'reply', 'activity');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Create Table
CREATE TABLE IF NOT EXISTS public.unified_reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Removed NOT NULL
    target_id TEXT NOT NULL, -- Generic ID
    target_type report_target_type NOT NULL,
    reason TEXT NOT NULL,
    details TEXT,
    screenshot_url TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
    notes TEXT, -- Admin notes
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Enable RLS
ALTER TABLE public.unified_reports ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
DROP POLICY IF EXISTS "Users can insert reports" ON public.unified_reports;
CREATE POLICY "Users can insert reports" 
ON public.unified_reports FOR INSERT 
WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "Users can view own reports" ON public.unified_reports;
CREATE POLICY "Users can view own reports" 
ON public.unified_reports FOR SELECT 
TO authenticated 
USING (auth.uid() = reporter_id);

-- Admins (service_role) have full access by default, but if you want to use the dashboard as a specific user, 
-- you might need an admin policy. Usually Dashboard uses postgres role which bypasses RLS.

-- 5. Storage Bucket (Idempotent)
INSERT INTO storage.buckets (id, name, public)
VALUES ('report-evidence', 'report-evidence', true)
ON CONFLICT (id) DO NOTHING;

-- 6. Storage Policies
DROP POLICY IF EXISTS "Users can upload report evidence" ON storage.objects;
CREATE POLICY "Users can upload report evidence"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'report-evidence' AND auth.uid() = owner);

DROP POLICY IF EXISTS "Anyone can read report evidence" ON storage.objects;
CREATE POLICY "Anyone can read report evidence"
ON storage.objects FOR SELECT
USING (bucket_id = 'report-evidence');
