
-- Create a table for public profiles
create table profiles (
  id uuid references auth.users on delete cascade not null primary key,
  updated_at timestamp with time zone,
  username text unique,
  full_name text,
  bio text,
  dob date,
  major text,
  year text, -- '1st Year', '2nd Year', etc.
  avatar_url text,
  bg_image_url text, -- For the profile background
  role text check (role in ('student', 'club')),
  
  constraint username_length check (char_length(username) >= 3)
);

-- Set up Row Level Security (RLS)
-- See https://supabase.com/docs/guides/auth/row-level-security for more details.
alter table profiles enable row level security;

create policy "Public profiles are viewable by everyone." on profiles
  for select using (true);

create policy "Users can insert their own profile." on profiles
  for insert with check ((select auth.uid()) = id);

create policy "Users can update own profile." on profiles
  for update using ((select auth.uid()) = id);

-- Function to handle new user signup (optional, if you want auto-profile creation, 
-- but our flow handles it manually on Page 8, so we might not need a trigger, 
-- but it's good practice to have a basic trigger just in case).
-- For this specific '8-step' flow where we insert data at the end, 
-- we can either rely on the client to INSERT the row on Step 8,
-- OR we can have a trigger create an empty row on SignUp and then UPDATE it on Step 8.
-- Given the requirement "User will setup profile... on page 8", 
-- a TRIGGER is safer to ensure the row exists immediately after Sign Up (Step 6/7).

create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, role)
  values (new.id, new.raw_user_meta_data->>'username', new.raw_user_meta_data->>'role');
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Posts Table
create table public.posts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  content text,
  media_urls text[],
  location text,
  tagged_users uuid[], -- Array of profile_ids
  is_flare boolean default false,
  flare_duration text, -- '12h', '24h', '48h'
  audience text default 'public', -- 'campus', 'followers'
  is_pinned boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS for Posts
alter table public.posts enable row level security;

create policy "Public posts are viewable by everyone."
  on public.posts for select
  using ( true );

create policy "Users can insert their own posts."
  on public.posts for insert
  with check ( (select auth.uid()) = user_id );

create policy "Users can update own posts."
  on public.posts for update
  using ( (select auth.uid()) = user_id );

create policy "Users can delete own posts."
  on public.posts for delete
  using ( (select auth.uid()) = user_id );

-- Likes Table
create table public.likes (
  post_id uuid references public.posts(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (post_id, user_id)
);

-- Comments Table
create table public.comments (
  id uuid default gen_random_uuid() primary key,
  post_id uuid references public.posts(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS for Interactions
alter table public.likes enable row level security;
alter table public.comments enable row level security;

create policy "Public interactions viewable (likes)" on public.likes for select using (true);
create policy "Public interactions viewable (comments)" on public.comments for select using (true);

create policy "Auth users can like" on public.likes for insert with check ((select auth.uid()) = user_id);
create policy "Auth users can unlike" on public.likes for delete using ((select auth.uid()) = user_id);

create policy "Auth users can comment" on public.comments for insert with check ((select auth.uid()) = user_id);
create policy "Auth users can delete own comment" on public.comments for delete using ((select auth.uid()) = user_id);

-- Follows Table
create table public.follows (
  follower_id uuid references public.profiles(id) on delete cascade not null,
  following_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (follower_id, following_id)
);

-- RLS for Follows
alter table public.follows enable row level security;

create policy "Public follows viewable" on public.follows for select using (true);
create policy "Auth users can follow" on public.follows for insert with check ((select auth.uid()) = follower_id);
create policy "Auth users can unfollow" on public.follows for delete using ((select auth.uid()) = follower_id);

-- Saved Posts Table
create table public.saved_posts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  post_id uuid references public.posts(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, post_id)
);

-- RLS for Saved Posts
alter table public.saved_posts enable row level security;

create policy "Users can see own saved posts" on public.saved_posts for select using ((select auth.uid()) = user_id);
create policy "Users can save posts" on public.saved_posts for insert with check ((select auth.uid()) = user_id);
create policy "Users can unsave posts" on public.saved_posts for delete using ((select auth.uid()) = user_id);

-- Comment Likes Table
create table public.comment_likes (
  user_id uuid references public.profiles(id) on delete cascade not null,
  comment_id uuid references public.comments(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (user_id, comment_id)
);

-- RLS for Comment Likes
alter table public.comment_likes enable row level security;

create policy "Public comment likes viewable" on public.comment_likes for select using (true);
create policy "Auth users can like comments" on public.comment_likes for insert with check ((select auth.uid()) = user_id);
create policy "Auth users can unlike comments" on public.comment_likes for delete using ((select auth.uid()) = user_id);

-- PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON public.posts(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON public.comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON public.comments(user_id);
CREATE INDEX IF NOT EXISTS idx_likes_user_id ON public.likes(user_id);
CREATE INDEX IF NOT EXISTS idx_follows_following_id ON public.follows(following_id);
CREATE INDEX IF NOT EXISTS idx_saved_posts_post_id ON public.saved_posts(post_id);
CREATE INDEX IF NOT EXISTS idx_comment_likes_comment_id ON public.comment_likes(comment_id);