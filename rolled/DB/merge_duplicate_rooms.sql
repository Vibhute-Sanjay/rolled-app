-- MERGE DUPLICATE CHAT ROOMS
-- This script finds users who have multiple 1:1 chat rooms with each other
-- And merges all messages into a single room.

DO $$
DECLARE
    r RECORD;
    keeper_room_id UUID;
    other_room_ids UUID[];
BEGIN
    FOR r IN
        SELECT 
            p1.user_id as u1, 
            p2.user_id as u2,
            array_agg(DISTINCT p1.room_id) as room_list
        FROM public.chat_participants p1
        JOIN public.chat_participants p2 ON p1.room_id = p2.room_id
        WHERE p1.user_id < p2.user_id
        GROUP BY p1.user_id, p2.user_id
        HAVING COUNT(DISTINCT p1.room_id) > 1
    LOOP
        -- Logic: Keep the room with the MOST messages
        SELECT room_id INTO keeper_room_id
        FROM public.messages
        WHERE room_id = ANY(r.room_list)
        GROUP BY room_id
        ORDER BY count(*) DESC
        LIMIT 1;

        -- Fallback: If all are empty, pick the first one
        IF keeper_room_id IS NULL THEN
            keeper_room_id := r.room_list[1];
        END IF;

        RAISE NOTICE 'Merging rooms for users % and %. Keeper: %', r.u1, r.u2, keeper_room_id;

        -- 1. Move messages from other rooms to the Keeper Room
        UPDATE public.messages
        SET room_id = keeper_room_id
        WHERE room_id = ANY(r.room_list) AND room_id != keeper_room_id;

        -- 2. Delete the extra rooms (Cascades to participants)
        DELETE FROM public.chat_rooms
        WHERE id = ANY(r.room_list) AND id != keeper_room_id;
        
    END LOOP;
END $$;
