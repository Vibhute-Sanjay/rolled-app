-- CHECK FOR ORPHANED USERS
-- Detects users who exist in Auth but NOT in Profiles.
-- If you appear here, the app cannot save your token (because there is no row to update).

SELECT 
    au.id, 
    au.email, 
    au.created_at
FROM auth.users au
LEFT JOIN public.profiles pp ON au.id = pp.id
WHERE pp.id IS NULL;
