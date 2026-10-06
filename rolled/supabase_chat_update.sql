-- Allow users to update messages in rooms they are part of.
-- This is required for the recipient to mark a message as "is_read = true".

create policy "Users can update messages in their rooms"
on public.messages for update
using (
  room_id in (select get_my_room_ids(auth.uid()))
)
with check (
  room_id in (select get_my_room_ids(auth.uid()))
);
