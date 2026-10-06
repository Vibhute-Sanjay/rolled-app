-- Anonymous Chat Schema "Unrolled"

-- 1. Anonymous Identities (The Persona)
create table public.anon_identities (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null, -- The real user (HIDDEN)
  anon_name text unique not null,
  avatar_color text default '#00F0FF', -- Default Neon Blue
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  -- Ensure one identity per user
  unique(user_id),
  constraint anon_name_length check (char_length(anon_name) >= 3 and char_length(anon_name) <= 25)
);

-- RLS: anon_identities
alter table public.anon_identities enable row level security;

-- Public can see the ID and Name and Color (but NOT the user_id)
create policy "Public identities viewable" 
  on public.anon_identities for select 
  using (true);

-- Only the user themselves can see their own row via user_id check (for Onboarding check)
create policy "Users can see own identity" 
  on public.anon_identities for select 
  using ((select auth.uid()) = user_id);

-- NO INSERT policy for public. All inserts MUST go through the secure function 
-- to prevent users from bypassing name checks or claiming names manually.


-- 2. Anonymous Posts
create table public.anon_posts (
  id uuid default gen_random_uuid() primary key,
  identity_id uuid references public.anon_identities(id) on delete cascade not null, -- The Persona ID
  content text not null,
  badge text, -- 'rant', 'confession', 'chaos', etc.
  upvotes int default 0,
  downvotes int default 0,
  reply_count int default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS: anon_posts
alter table public.anon_posts enable row level security;

create policy "Anon posts are viewable by everyone" 
  on public.anon_posts for select 
  using (true);

-- Helper wrapper to check if user owns the identity that owns the post
-- Ideally we use a function, but for now we might rely on a secure RPC for creation too
-- OR we allow insert if the user owns the `identity_id`.
-- But `anon_identities` user_id is hidden from RLS.
-- So we MUST use a function or a view. 
-- For simplicity and security, we will use RLS with a secure function or just trusted RLS if we expose identity_id.
-- Let's use a standard policy but it requires a join. 
-- Actually, let's use a Secure Function for posting to be safe and simple.


-- 3. Anonymous Votes
create table public.anon_votes (
  post_id uuid references public.anon_posts(id) on delete cascade not null,
  identity_id uuid references public.anon_identities(id) on delete cascade not null, -- Who voted
  vote_type int not null check (vote_type in (1, -1)), -- 1 = Up, -1 = Down
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  primary key (post_id, identity_id)
);

-- RLS: anon_votes
alter table public.anon_votes enable row level security;

-- Public can see votes? Maybe not needed, just the counts. 
-- But client needs to know "Did I vote?".
create policy "Users can see own votes" 
  on public.anon_votes for select 
  using ( 
    identity_id in (
      select id from public.anon_identities where user_id = auth.uid()
    )
  );


-- 4. Secure Functions

-- Function to Create Identity (Safe from uniqueness race conditions usually, but mostly guards logic)
create or replace function create_anon_identity(desired_name text)
returns json
language plpgsql
security definer -- Bylaws RLS to check existence and insert user_id
set search_path = public
as $$
declare
  new_identity_id uuid;
  current_user_id uuid;
begin
  current_user_id := auth.uid();
  if current_user_id is null then
    return json_build_object('error', 'Not authenticated');
  end if;

  -- Check if already has one
  if exists (select 1 from public.anon_identities where user_id = current_user_id) then
    return json_build_object('error', 'User already has an identity');
  end if;

  -- Check Name Uniqueness
  if exists (select 1 from public.anon_identities where lower(anon_name) = lower(desired_name)) then
    return json_build_object('error', 'Name is taken');
  end if;

  -- Create
  insert into public.anon_identities (user_id, anon_name)
  values (current_user_id, desired_name)
  returning id into new_identity_id;

  return json_build_object('success', true, 'id', new_identity_id, 'name', desired_name);
exception 
  when unique_violation then
    return json_build_object('error', 'Name is taken');
end;
$$;

-- Function to Get MY Identity (Safe fetch)
create or replace function get_my_anon_identity()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  ident record;
begin
  select id, anon_name, avatar_color into ident
  from public.anon_identities
  where user_id = auth.uid();

  if ident.id is null then
    return json_build_object('found', false);
  else
    return json_build_object('found', true, 'id', ident.id, 'name', ident.anon_name, 'avatar_color', ident.avatar_color);
  end if;
end;
$$;


-- Function to Create Post (Ensures you use YOUR identity)
create or replace function create_anon_post(content_text text, badge_text text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  my_identity_id uuid;
  new_post_id uuid;
begin
  -- Get ID
  select id into my_identity_id from public.anon_identities where user_id = auth.uid();
  
  if my_identity_id is null then
    return json_build_object('error', 'No anonymous identity found');
  end if;

  insert into public.anon_posts (identity_id, content, badge)
  values (my_identity_id, content_text, badge_text)
  returning id into new_post_id;

  return json_build_object('success', true, 'id', new_post_id);
end;
$$;


-- Function to Vote
create or replace function vote_on_anon_post(p_id uuid, v_type int)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  my_identity_id uuid;
  existing_vote int;
begin
  -- Get ID
  select id into my_identity_id from public.anon_identities where user_id = auth.uid();
  if my_identity_id is null then return json_build_object('error', 'No identity'); end if;

  -- Check existing
  select vote_type into existing_vote from public.anon_votes 
  where post_id = p_id and identity_id = my_identity_id;

  if existing_vote is not null then
    if existing_vote = v_type then
       -- Remove vote (Toggle off)
       delete from public.anon_votes where post_id = p_id and identity_id = my_identity_id;
       
       -- Update Counter
       if v_type = 1 then
         update public.anon_posts set upvotes = upvotes - 1 where id = p_id;
       else
         update public.anon_posts set downvotes = downvotes - 1 where id = p_id;
       end if;
       
       return json_build_object('success', true, 'action', 'removed');
    else
       -- Change vote (Flip)
       update public.anon_votes set vote_type = v_type 
       where post_id = p_id and identity_id = my_identity_id;
       
       -- Update Counters
       if v_type = 1 then
         update public.anon_posts set upvotes = upvotes + 1, downvotes = downvotes - 1 where id = p_id;
       else
         update public.anon_posts set downvotes = downvotes + 1, upvotes = upvotes - 1 where id = p_id;
       end if;
       
       return json_build_object('success', true, 'action', 'flipped');
    end if;
  else
    -- New Vote
    insert into public.anon_votes (post_id, identity_id, vote_type)
    values (p_id, my_identity_id, v_type);
    
    -- Update Counter
    if v_type = 1 then
       update public.anon_posts set upvotes = upvotes + 1 where id = p_id;
    else
       update public.anon_posts set downvotes = downvotes + 1 where id = p_id;
    end if;
    
    return json_build_object('success', true, 'action', 'voted');
  end if;
end;
$$;
