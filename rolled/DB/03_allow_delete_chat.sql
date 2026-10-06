-- Allow users to delete their own participant row (leave/delete chat)
-- Without this, the "Delete Chat" feature will fail on the database side.

DROP POLICY IF EXISTS "Users can delete own participant rows" ON public.chat_participants;

CREATE POLICY "Users can delete own participant rows"
ON public.chat_participants FOR DELETE
USING (auth.uid() = user_id);
