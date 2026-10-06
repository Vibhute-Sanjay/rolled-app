-- 1. Trigger to DELETE room if it becomes empty
CREATE OR REPLACE FUNCTION public.delete_room_if_empty()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if any participants remain in the room
    IF NOT EXISTS (SELECT 1 FROM public.chat_participants WHERE room_id = OLD.room_id) THEN
        DELETE FROM public.chat_rooms WHERE id = OLD.room_id;
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_delete_room_if_empty ON public.chat_participants;
CREATE TRIGGER trg_delete_room_if_empty
AFTER DELETE ON public.chat_participants
FOR EACH ROW
EXECUTE FUNCTION public.delete_room_if_empty();


-- 2. Update Message visibility to respect 'joined_at'
-- This ensures that if a user leaves and rejoins, they do NOT see messages from before they re-joined.
-- Essentially "Clearing Chat History" for them.

DROP POLICY IF EXISTS "view_messages_in_my_rooms" ON public.messages;

CREATE POLICY "view_messages_in_my_rooms_since_join"
ON public.messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.chat_participants cp
    WHERE cp.room_id = messages.room_id 
    AND cp.user_id = auth.uid()
    AND messages.created_at >= cp.joined_at
  )
);
