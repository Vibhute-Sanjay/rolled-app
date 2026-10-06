-- 1. Alter Activities Table
alter table public.activities 
add column if not exists is_updated boolean default false;

-- 2. Alter Activity Requests Table
alter table public.activity_requests 
add column if not exists reconfirm_needed boolean default false;

-- 3. Update Notifications Constraint
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check 
check (type in ('follow', 'follow_request', 'like', 'reply', 'mention', 'system', 'activity_request', 'activity_approved', 'activity_rejected', 'activity_updated'));

-- 4. Function to Notify Guests of Update
create or replace function public.notify_activity_update(
    p_activity_id uuid,
    p_message text
)
returns void as $$
declare
    v_organizer_id uuid;
    v_guest record;
begin
    -- Get Organizer ID (mostly for metadata, though actor is usually current user)
    select organizer_id into v_organizer_id from public.activities where id = p_activity_id;

    -- Update Requests to require reconfirmation
    update public.activity_requests
    set reconfirm_needed = true
    where activity_id = p_activity_id and status = 'approved';

    -- Loop through approved guests and insert notifications
    for v_guest in 
        select user_id from public.activity_requests 
        where activity_id = p_activity_id and status = 'approved'
    loop
        insert into public.notifications (user_id, actor_id, type, resource_id, content)
        values (
            v_guest.user_id, -- Recipient (Guest)
            auth.uid(),      -- Actor (Organizer / Current User)
            'activity_updated',
            p_activity_id,
            p_message
        );
    end loop;
end;
$$ language plpgsql security definer;
