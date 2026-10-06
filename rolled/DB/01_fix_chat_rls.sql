-- Fix RLS policy for chat_participants to allow seeing other users in your rooms

-- 1. Drop the restrictive policy
DROP POLICY IF EXISTS "Users can view own participant rows" ON public.chat_participants;

-- 2. Create a new, more permissive policy
-- Allows a user to view ANY row in chat_participants IF that row belongs to a room that the user is ALSO in.
CREATE POLICY "Users can view participants of their rooms"
ON public.chat_participants FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.chat_participants cp 
        WHERE cp.room_id = room_id AND cp.user_id = auth.uid()
    )
);
