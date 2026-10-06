-- ROBUST PRODUCTION FIX: Infinite Recursion & Security
-- The previous policy caused recursion because checking "am I in this room?" required querying the table that was checking "am I in this room?".
-- Solution: Use a SECURITY DEFINER function to bypass RLS for the membership check.

-- 1. Create a helper function: checks if auth.uid() is in a room.
-- SECURITY DEFINER means it runs with the privileges of the creator (admin), bypassing RLS on the internal query.
DROP FUNCTION IF EXISTS public.is_room_participant(UUID) CASCADE; -- Added CASCADE to drop dependent policies automatically
CREATE OR REPLACE FUNCTION public.is_room_participant(_room_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.chat_participants
    WHERE room_id = _room_id
    AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Clean up old/broken policies to start fresh on these tables
DROP POLICY IF EXISTS "Users can view own participant rows" ON public.chat_participants;
DROP POLICY IF EXISTS "Users can view participants of their rooms" ON public.chat_participants;
DROP POLICY IF EXISTS "Users can view rooms they are in" ON public.chat_rooms;
DROP POLICY IF EXISTS "Users can view messages in their rooms" ON public.messages;
DROP POLICY IF EXISTS "view_participants_in_my_rooms" ON public.chat_participants; -- Cleanup potential duplicates
DROP POLICY IF EXISTS "view_messages_in_my_rooms" ON public.messages;

-- 3. Apply the New Robust Policies

-- chat_participants: You can see ALL participants for a room IF you are also a participant in that room.
CREATE POLICY "view_participants_in_my_rooms"
ON public.chat_participants FOR SELECT
USING (
  public.is_room_participant(room_id)
);

-- chat_rooms: You can see the room meta-data if you are a participant.
CREATE POLICY "view_my_rooms"
ON public.chat_rooms FOR SELECT
USING (
  public.is_room_participant(id)
);

-- messages: You can see messages if you are a participant in the room.
CREATE POLICY "view_messages_in_my_rooms"
ON public.messages FOR SELECT
USING (
  public.is_room_participant(room_id)
);

-- 4. INSERT Policies (Safe)
DROP POLICY IF EXISTS "Users can insert themselves" ON public.chat_participants;
CREATE POLICY "insert_self_only"
ON public.chat_participants FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can send messages to their rooms" ON public.messages;
CREATE POLICY "insert_messages_in_my_rooms"
ON public.messages FOR INSERT
WITH CHECK (
    auth.uid() = user_id AND
    public.is_room_participant(room_id)
);
