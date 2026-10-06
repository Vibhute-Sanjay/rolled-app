-- UPGRADE CHAT DELETION (Dual Mode)

-- 1. Add 'deleted_by' array to track "Delete for Me"
-- Default is empty array
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS deleted_by UUID[] DEFAULT '{}';

-- 2. Secure Function for "Delete for Me"
-- This allows a user to "update" the message (hide it) without needing full UPDATE permission on the table.
-- It appends their ID to the array.
CREATE OR REPLACE FUNCTION public.hide_message(target_message_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.messages
  SET deleted_by = array_append(deleted_by, auth.uid())
  WHERE id = target_message_id
  AND NOT (deleted_by @> ARRAY[auth.uid()]); -- Only if not already hidden
END;
$$;

-- 3. Enable "Delete for Everyone" (Sender Only)
-- This physically removes the row if you are the sender.
DROP POLICY IF EXISTS "Users can delete own messages" ON public.messages;
CREATE POLICY "Users can delete own messages"
ON public.messages FOR DELETE
USING (auth.uid() = user_id);

-- 4. Note on Fetching
-- The frontend must now filter: WHERE NOT (deleted_by @> ARRAY[auth.uid()])
-- But simpler to do this in the query or client-side. Client-side is easier for Realtime consistency.
