-- 📦 ADD MISSING ACTIVITY COLUMNS
-- The client expects these columns to enable "Update Notifications".

-- 1. Add 'is_updated' to Activities
ALTER TABLE public.activities 
ADD COLUMN IF NOT EXISTS is_updated boolean DEFAULT false;

-- 2. Add 'reconfirm_needed' to Requests (for forcing guests to re-approve if essential details change)
ALTER TABLE public.activity_requests 
ADD COLUMN IF NOT EXISTS reconfirm_needed boolean DEFAULT false;

-- 3. Notify PostgREST to reload schema
NOTIFY pgrst, 'reload config';
