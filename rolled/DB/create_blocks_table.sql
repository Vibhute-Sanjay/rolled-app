-- Create Blocks Table
CREATE TABLE IF NOT EXISTS blocks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    blocker_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    blocked_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(blocker_id, blocked_id)
);

-- Enable RLS
ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;

-- Safely Drop Existing Policies (to allow updates)
DROP POLICY IF EXISTS "Users can manage their own blocks" ON blocks;
DROP POLICY IF EXISTS "Users can view blocks they are involved in" ON blocks;
DROP POLICY IF EXISTS "Users can see their own blocks" ON blocks;
DROP POLICY IF EXISTS "Users can block others" ON blocks;
DROP POLICY IF EXISTS "Users can unblock" ON blocks;

-- Create Updated Policies
-- 1. Manager: Blocker can insert/delete
CREATE POLICY "Users can manage their own blocks" 
ON blocks 
FOR ALL 
USING (auth.uid() = blocker_id);

-- 2. Viewer: Both blocker and blocked can SEE the row. 
-- This allows the UI to show "You are blocked" or "User blocked".
CREATE POLICY "Users can view blocks they are involved in" 
ON blocks 
FOR SELECT 
USING (auth.uid() = blocker_id OR auth.uid() = blocked_id);
