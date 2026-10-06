-- CREATE TOKEN UPDATE RPC
-- A "Sledgehammer" function to update the push token.
-- Uses SECURITY DEFINER to bypass RLS policies on the profiles table.

CREATE OR REPLACE FUNCTION update_my_push_token(token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.profiles
    SET push_token = token
    WHERE id = auth.uid();
END;
$$;
