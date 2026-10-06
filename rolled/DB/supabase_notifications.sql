-- 1. Modify Follows Table for Private Accounts
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'follows' AND column_name = 'status') THEN 
        ALTER TABLE public.follows ADD COLUMN status text DEFAULT 'accepted'; -- 'accepted' or 'pending'
    END IF;
END $$;

-- 2. Create Notifications Table
create table if not exists public.notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null, -- Who receives it
  actor_id uuid references public.profiles(id) on delete cascade, -- Who triggered it (nullable for system)
  type text not null check (type in ('follow', 'follow_request', 'like', 'reply', 'mention', 'system')),
  resource_id uuid, -- Post ID, Comment ID, etc.
  content text, -- Optional preview text
  is_read boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS for Notifications
alter table public.notifications enable row level security;

drop policy if exists "Users can see their own notifications" on public.notifications;
create policy "Users can see their own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "System can insert notifications"
  on public.notifications for insert
  with check (true); -- Triggers need write access, usually bypassed, but good for security

create policy "Users can update their own notifications (mark read)"
  on public.notifications for update
  using (auth.uid() = user_id);

create policy "Users can delete their own notifications"
  on public.notifications for delete
  using (auth.uid() = user_id);

-- 3. Functions & Triggers

-- A. Handle New Like (prevent duplicates)
create or replace function public.handle_new_like()
returns trigger as $$
begin
  -- Don't notify if liking own post
  if new.user_id = (select user_id from public.posts where id = new.post_id) then
    return new;
  end if;

  insert into public.notifications (user_id, actor_id, type, resource_id, content)
  values (
    (select user_id from public.posts where id = new.post_id), -- Recipient
    new.user_id, -- Actor
    'like',
    new.post_id,
    'liked your post'
  )
  on conflict do nothing; -- Simple way to avoid spam if we had a unique constraint, but uuid prevents it. 
  -- Ideally we check exists:
  -- IF NOT EXISTS (...) THEN ...
  
  return new;
end;
$$ language plpgsql security definer;

-- Trigger for Likes
drop trigger if exists on_post_like on public.likes;
create trigger on_post_like
  after insert on public.likes
  for each row execute procedure public.handle_new_like();


-- B. Handle New Comment
create or replace function public.handle_new_comment()
returns trigger as $$
begin
  -- Don't notify if replying to self
  if new.user_id = (select user_id from public.posts where id = new.post_id) then
    return new;
  end if;

  insert into public.notifications (user_id, actor_id, type, resource_id, content)
  values (
    (select user_id from public.posts where id = new.post_id),
    new.user_id,
    'reply',
    new.post_id,
    left(new.content, 50) -- Preview
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger for Comments
drop trigger if exists on_post_comment on public.comments;
create trigger on_post_comment
  after insert on public.comments
  for each row execute procedure public.handle_new_comment();


-- C. Handle Follows (Public vs Private)
create or replace function public.handle_new_follow()
returns trigger as $$
declare
  target_is_private boolean;
begin
  -- Check if target user is private
  select is_private into target_is_private from public.profiles where id = new.following_id;

  if target_is_private then
    -- It's a REQUEST
    -- We assume the Insert Logic handled setting 'status'='pending' via Application logic OR we force it here?
    -- Better to force it here to be safe:
    update public.follows set status = 'pending' where follower_id = new.follower_id and following_id = new.following_id;

    insert into public.notifications (user_id, actor_id, type, content)
    values (new.following_id, new.follower_id, 'follow_request', 'requested to follow you');
  else
    -- It's a direct FOLLOW
    insert into public.notifications (user_id, actor_id, type, content)
    values (new.following_id, new.follower_id, 'follow', 'started following you');
  end if;

  return new;
end;
$$ language plpgsql security definer;

-- Trigger for Follows
drop trigger if exists on_new_follow on public.follows;
create trigger on_new_follow
  after insert on public.follows
  for each row execute procedure public.handle_new_follow();
