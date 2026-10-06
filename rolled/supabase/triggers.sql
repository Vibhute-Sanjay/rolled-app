-- Enable the pg_net extension to make HTTP requests
create extension if not exists pg_net;

-- Create a generic function to call the Edge Function
-- Ensure 'net' schema permissions
GRANT USAGE ON SCHEMA net TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA net TO postgres, anon, authenticated, service_role;

-- Create a generic function to call the consolidated Edge Function
create or replace function public.trigger_media_cleanup()
returns trigger as $$
declare
  service_role_key text := 'YOUR_SERVICE_ROLE_KEY'; 
  url text := 'https://hbkslwngbsvwiudaxltb.supabase.co/functions/v1/delete-cloudinary-asset';
  media_urls_to_delete text[];
begin
  -- Extract URLs based on table structure
  if TG_TABLE_NAME = 'posts' then
    media_urls_to_delete := OLD.media_urls;
  elsif TG_TABLE_NAME = 'activities' then
    -- Combine cover image and gallery images
    media_urls_to_delete := array_append(COALESCE(OLD.additional_images, '{}'), OLD.cover_image);
  end if;

  -- Filter out nulls/empty entries
  select array_agg(u) into media_urls_to_delete 
  from unnest(media_urls_to_delete) u 
  where u is not null and u != '';

  if media_urls_to_delete is not null and array_length(media_urls_to_delete, 1) > 0 then
    -- Correct Call: net.http_post with named arguments
    perform net.http_post(
      url := url,
      body := jsonb_build_object('urls', to_jsonb(media_urls_to_delete)),
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || service_role_key)
    );
  end if;
  return OLD;
end;
$$ language plpgsql security definer set search_path = public, net;

-- Create the trigger for Posts
drop trigger if exists on_post_delete_media on public.posts;
create trigger on_post_delete_media
  after delete on public.posts
  for each row
  execute procedure public.trigger_media_cleanup();

-- Create the trigger for Activities
drop trigger if exists on_activity_delete_media on public.activities;
create trigger on_activity_delete_media
  after delete on public.activities
  for each row
  execute procedure public.trigger_media_cleanup();
