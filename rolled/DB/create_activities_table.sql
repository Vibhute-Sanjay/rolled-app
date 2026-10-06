-- Create Activities Table
create table if not exists public.activities (
    id uuid not null default gen_random_uuid(),
    created_at timestamptz default now(),
    organizer_id uuid references public.profiles(id) on delete cascade not null,
    
    -- Content
    title text not null,
    short_description text,
    full_details text,
    category text not null,
    location text,
    
    -- Media
    cover_image text,
    additional_images text[], -- Array of image URLs
    
    -- Logisticsr
    start_time timestamptz not null,
    end_time timestamptz, -- Optional, for future use
    
    -- Ticketing
    ticket_type text check (ticket_type in ('Free', 'Paid')) default 'Free',
    price numeric default 0,
    capacity int, -- NULL means unlimited
    external_link text,
    
    -- Metrics (can be updated via triggers later)
    attendees_count int default 0,
    
    primary key (id)
);

-- Enable RLS
alter table public.activities enable row level security;

-- Policies
create policy "Activities are viewable by everyone"
on public.activities for select
using (true);

create policy "Users can create activities"
on public.activities for insert
with check (auth.uid() = organizer_id);

create policy "Organizers can update own activities"
on public.activities for update
using (auth.uid() = organizer_id);

create policy "Organizers can delete own activities"
on public.activities for delete
using (auth.uid() = organizer_id);


-- Create Storage Bucket for Activity Images
insert into storage.buckets (id, name, public)
values ('activity-images', 'activity-images', true)
on conflict (id) do nothing;

-- Storage Policies
create policy "Activity images are viewable by everyone"
on storage.objects for select
using ( bucket_id = 'activity-images' );

create policy "Users can upload activity images"
on storage.objects for insert
with check (
    bucket_id = 'activity-images' 
    and auth.role() = 'authenticated'
);

create policy "Users can update their own activity images"
on storage.objects for update
using (
    bucket_id = 'activity-images' 
    and auth.uid() = owner
);

create policy "Users can delete their own activity images"
on storage.objects for delete
using (
    bucket_id = 'activity-images' 
    and auth.uid() = owner
);
