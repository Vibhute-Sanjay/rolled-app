-- ENABLE MESSAGE DELETION (Delete for Everyone)
-- Currently, there is no policy allowing users to delete messages.
-- This script allows a user to delete a message IF they are the sender.
-- This effectively creates a "Delete for Everyone" feature, as the message is removed from the DB.

DROP POLICY IF EXISTS "Users can delete own messages" ON public.messages;

CREATE POLICY "Users can delete own messages"
ON public.messages FOR DELETE
USING (auth.uid() = user_id);
