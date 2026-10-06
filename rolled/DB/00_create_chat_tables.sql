-- 1. drop existing tables if they exist (clean slate to ensure no conflicts)
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.chat_participants CASCADE;
DROP TABLE IF EXISTS public.chat_rooms CASCADE;

-- 2. Create Chat Rooms
CREATE TABLE public.chat_rooms (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create Participants (Junction table for 1:1 or Group chats)
CREATE TABLE public.chat_participants (
    room_id UUID REFERENCES public.chat_rooms(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (room_id, user_id)
);

-- 4. Create Messages
CREATE TABLE public.messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    room_id UUID REFERENCES public.chat_rooms(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Enable RLS
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies

-- Participants: Users can see rows where they are the user
CREATE POLICY "Users can view own participant rows" 
ON public.chat_participants FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert themselves"
ON public.chat_participants FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Rooms: Users can view rooms they are participating in
CREATE POLICY "Users can view rooms they are in"
ON public.chat_rooms FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.chat_participants cp 
        WHERE cp.room_id = id AND cp.user_id = auth.uid()
    )
);

-- Messages: Users can view messages in rooms they belong to
CREATE POLICY "Users can view messages in their rooms"
ON public.messages FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.chat_participants cp 
        WHERE cp.room_id = room_id AND cp.user_id = auth.uid()
    )
);

-- Messages: Users can insert messages into rooms they belong to
CREATE POLICY "Users can send messages to their rooms"
ON public.messages FOR INSERT
WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
        SELECT 1 FROM public.chat_participants cp 
        WHERE cp.room_id = room_id AND cp.user_id = auth.uid()
    )
);

-- Messages: Users can update 'is_read' for messages in their rooms (technically any msg, but usually incoming)
CREATE POLICY "Users can update messages (read status)"
ON public.messages FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.chat_participants cp
        WHERE cp.room_id = room_id AND cp.user_id = auth.uid()
    )
);


-- 7. Helper Function: Get or Create 1:1 Room
CREATE OR REPLACE FUNCTION public.get_or_create_dm_room(other_user_id UUID)
RETURNS UUID AS $$
DECLARE
    found_room_id UUID;
BEGIN
    -- 1. Try to find an existing room with exactly these two users
    SELECT cp1.room_id
    INTO found_room_id
    FROM public.chat_participants cp1
    JOIN public.chat_participants cp2 ON cp1.room_id = cp2.room_id
    WHERE cp1.user_id = auth.uid()
      AND cp2.user_id = other_user_id
    LIMIT 1;

    -- 2. If found, return it
    IF found_room_id IS NOT NULL THEN
        RETURN found_room_id;
    END IF;

    -- 3. If not found, create a new room
    INSERT INTO public.chat_rooms (updated_at) VALUES (now()) RETURNING id INTO found_room_id;

    -- 4. Add both participants
    INSERT INTO public.chat_participants (room_id, user_id) VALUES (found_room_id, auth.uid());
    INSERT INTO public.chat_participants (room_id, user_id) VALUES (found_room_id, other_user_id);

    RETURN found_room_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 8. Indexes for performance
CREATE INDEX idx_participants_user_id ON public.chat_participants(user_id);
CREATE INDEX idx_participants_room_id ON public.chat_participants(room_id);
CREATE INDEX idx_messages_room_id ON public.messages(room_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at DESC);
