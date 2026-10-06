-- 1. Create Request Status Enum
create type public.request_status as enum ('pending', 'approved', 'rejected');

-- 2. Create Activity Requests Table
create table if not exists public.activity_requests (
    id uuid not null default gen_random_uuid(),
    activity_id uuid references public.activities(id) on delete cascade not null,
    user_id uuid references public.profiles(id) on delete cascade not null,
    status public.request_status default 'pending',
    created_at timestamptz default now(),
    
    primary key (id),
    unique(activity_id, user_id) -- One request per user per activity
);

-- 3. RLS Policies
alter table public.activity_requests enable row level security;

-- Authenticated users can create requests
create policy "Authenticated users can create requests"
on public.activity_requests for insert
to authenticated
with check ( auth.uid() = user_id );

-- Users can view their own requests
create policy "Users can view own requests"
on public.activity_requests for select
using ( auth.uid() = user_id );

-- Activity Organizers can view requests for their activities
create policy "Organizers can view requests for their activities"
on public.activity_requests for select
using (
    exists (
        select 1 from public.activities
        where activities.id = activity_requests.activity_id
        and activities.organizer_id = auth.uid()
    )
);

-- Activity Organizers can update requests (Approve/Reject)
create policy "Organizers can update requests"
on public.activity_requests for update
using (
    exists (
        select 1 from public.activities
        where activities.id = activity_requests.activity_id
        and activities.organizer_id = auth.uid()
    )
);


-- 4. Notification Logic

-- Add 'activity_request' to the check constraint of notifications if possible, or just ignore since Postgres Constraints are hard to alter for enums without dropping.
-- Note: The `notifications` table has a text check constraint: check (type in ('follow', 'follow_request', 'like', 'reply', 'mention', 'system'))
-- We need to update this constraint to include 'activity_request' && 'activity_approved'.

-- Drop old constraint
alter table public.notifications drop constraint if exists notifications_type_check;

-- Add new constraint
alter table public.notifications add constraint notifications_type_check 
check (type in ('follow', 'follow_request', 'like', 'reply', 'mention', 'system', 'activity_request', 'activity_approved', 'activity_rejected'));


-- Trigger Function: Notify Organizer on New Request
create or replace function public.handle_new_activity_request()
returns trigger as $$
begin
    insert into public.notifications (user_id, actor_id, type, resource_id, content)
    values (
        (select organizer_id from public.activities where id = new.activity_id), -- Recipient (Organizer)
        new.user_id, -- Actor (Requester)
        'activity_request',
        new.activity_id,
        'requested to join your activity'
    );
    return new;
end;
$$ language plpgsql security definer;

-- Create Trigger
drop trigger if exists on_activity_request on public.activity_requests;
create trigger on_activity_request
after insert on public.activity_requests
for each row execute procedure public.handle_new_activity_request();


-- Trigger Function: Notify User on Request Status Change (Approved/Rejected)
create or replace function public.handle_activity_request_update()
returns trigger as $$
begin
    if old.status = 'pending' and new.status != 'pending' then
        insert into public.notifications (user_id, actor_id, type, resource_id, content)
        values (
            new.user_id, -- Recipient (Requester)
            (select organizer_id from public.activities where id = new.activity_id), -- Actor (Organizer)
            case when new.status = 'approved' then 'activity_approved' else 'activity_rejected' end,
            new.activity_id,
            case when new.status = 'approved' then 'approved your request to join' else 'rejected your request to join' end
        );
    end if;
    return new;
end;
$$ language plpgsql security definer;

-- Create Trigger
drop trigger if exists on_activity_request_update on public.activity_requests;
create trigger on_activity_request_update
after update on public.activity_requests
for each row execute procedure public.handle_activity_request_update();
