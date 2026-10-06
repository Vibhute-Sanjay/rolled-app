-- Create storage buckets for Activities
insert into storage.buckets (id, name, public)
values 
  ('activity-covers', 'activity-covers', true),
  ('activity-gallery', 'activity-gallery', true)
on conflict (id) do nothing;

-- Policy to allow authenticated uploads to activity-covers
create policy "Authenticated users can upload activity covers"
on storage.objects for insert
to authenticated
with check ( bucket_id = 'activity-covers' );

-- Policy to allow public viewing of activity covers
create policy "Public can view activity covers"
on storage.objects for select
to public
using ( bucket_id = 'activity-covers' );


-- Policy to allow authenticated uploads to activity-gallery
create policy "Authenticated users can upload activity gallery"
on storage.objects for insert
to authenticated
with check ( bucket_id = 'activity-gallery' );

-- Policy to allow public viewing of activity gallery
create policy "Public can view activity gallery"
on storage.objects for select
to public
using ( bucket_id = 'activity-gallery' );
