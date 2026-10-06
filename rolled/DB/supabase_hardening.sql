-- SECURING THE DATABASE (Fixes the 10 Security Issues)
-- Run this in Supabase SQL Editor

BEGIN;

-- 1. Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 2. Profiles Policies
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" 
ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" 
ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 3. Activities Policies
DROP POLICY IF EXISTS "Activities are viewable by everyone" ON public.activities;
CREATE POLICY "Activities are viewable by everyone" 
ON public.activities FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create activities" ON public.activities;
CREATE POLICY "Users can create activities" 
ON public.activities FOR INSERT WITH CHECK (auth.uid() = organizer_id);

DROP POLICY IF EXISTS "Organizers can update their activities" ON public.activities;
CREATE POLICY "Organizers can update their activities" 
ON public.activities FOR UPDATE USING (auth.uid() = organizer_id);

DROP POLICY IF EXISTS "Organizers can delete their activities" ON public.activities;
CREATE POLICY "Organizers can delete their activities" 
ON public.activities FOR DELETE USING (auth.uid() = organizer_id);

-- 4. Activity Requests Policies (CRITICAL FOR YOUR BUG)
-- Allow users to see their OWN requests (so the button shows 'Pending'/'Joined')
DROP POLICY IF EXISTS "Users can read own requests" ON public.activity_requests;
CREATE POLICY "Users can read own requests" 
ON public.activity_requests FOR SELECT USING (auth.uid() = user_id);

-- Allow Organizers to see requests for THEIR activities
DROP POLICY IF EXISTS "Organizers can read requests for their events" ON public.activity_requests;
CREATE POLICY "Organizers can read requests for their events" 
ON public.activity_requests FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.activities 
    WHERE activities.id = activity_requests.activity_id 
    AND activities.organizer_id = auth.uid()
  )
);

-- Users can create requests 
DROP POLICY IF EXISTS "Users can create requests" ON public.activity_requests;
CREATE POLICY "Users can create requests" 
ON public.activity_requests FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can delete (cancel) their own requests
DROP POLICY IF EXISTS "Users can cancel own requests" ON public.activity_requests;
CREATE POLICY "Users can cancel own requests" 
ON public.activity_requests FOR DELETE USING (auth.uid() = user_id);

-- Organizers can update status (approve/reject)
DROP POLICY IF EXISTS "Organizers can update requests" ON public.activity_requests;
CREATE POLICY "Organizers can update requests" 
ON public.activity_requests FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.activities 
    WHERE activities.id = activity_requests.activity_id 
    AND activities.organizer_id = auth.uid()
  )
);

-- PERFORMANCE IMPROVEMENTS (Fixes the 90 Performance Issues)
-- Add indexes on foreign keys to speed up joins and filters

CREATE INDEX IF NOT EXISTS idx_activities_organizer ON public.activities(organizer_id);
CREATE INDEX IF NOT EXISTS idx_requests_user ON public.activity_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_requests_activity ON public.activity_requests(activity_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON public.activity_requests(status);
CREATE INDEX IF NOT EXISTS idx_comments_post ON public.comments(post_id);
CREATE INDEX IF NOT EXISTS idx_likes_post ON public.likes(post_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);

COMMIT;
