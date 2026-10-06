-- CHECK RLS POLICIES FOR PROFILES
-- We need to see if there is a policy allowing UPDATE for authenticated users.

SELECT * 
FROM pg_policies 
WHERE tablename = 'profiles';
