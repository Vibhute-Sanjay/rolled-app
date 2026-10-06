    -- Enable the 'supabase_realtime' publication for the 'messages' table
    -- This is critical for clients to receive 'INSERT' events via the Realtime API.

    BEGIN;

    -- Check if publication exists (it should by default in Supabase)
    -- If not, we can't easily create it here as it requires superuser, 
    -- but on Supabase it's standard 'supabase_realtime'.

    -- Add messages table to the publication
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

    -- Also add chat_participants so we can update room lists in real-time if needed
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_participants;

    COMMIT;
