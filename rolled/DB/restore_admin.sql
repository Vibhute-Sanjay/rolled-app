-- EMERGENCY ADMIN RESTORE SCRIPT
-- If you accidentally delete your Admin account:
-- 1. Sign up again in the app with the SAME email.
-- 2. Run this script in the Supabase SQL Editor.

-- Replace 'your_email@gmail.com' with your actual email
update public.profiles
set role = 'admin'
from auth.users
where profiles.id = auth.users.id
and auth.users.email = 'sanja...Vertices@gmail.com'; -- <--- PUT YOUR EMAIL HERE

-- Verify it worked:
select email, role 
from auth.users 
join public.profiles on auth.users.id = profiles.id
where role = 'admin';
