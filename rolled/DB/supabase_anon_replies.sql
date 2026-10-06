-- MODIFICATION TO COMMENTS TABLE FOR ANONYMOUS REPLIES

-- 1. Make post_id nullable (since anon replies won't have a public.posts id)
--    Also make user_id nullable (so we don't link real user to anon comment)
alter table public.comments 
  alter column post_id drop not null,
  alter column user_id drop not null;

-- 2. Add columns for Anonymous context
alter table public.comments
  add column anon_post_id uuid references public.anon_posts(id) on delete cascade,
  add column anon_identity_id uuid references public.anon_identities(id) on delete set null;

-- 3. Validation: Ensure a comment belongs to EITHER a normal post OR an anon post
alter table public.comments
  add constraint comments_target_check 
  check (
    (post_id is not null and anon_post_id is null) or 
    (post_id is null and anon_post_id is not null)
  );

-- 4. RLS Policy: Allow users to delete their own ANONYMOUS comments
--    (Standard policy likely checks user_id = auth.uid(), which is NULL here)
create policy "Users can delete own anon comments" 
  on public.comments for delete 
  using (
    anon_identity_id in (
      select id from public.anon_identities where user_id = auth.uid()
    )
  );

-- 5. Secure Function to Create Anonymous Reply
--    This ensures the user uses their own Identity ID and sets user_id to NULL
create or replace function create_anon_reply(target_post_id uuid, content_text text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  my_identity_id uuid;
  new_comment_id uuid;
begin
  -- Get Anonymous Identity ID
  select id into my_identity_id from public.anon_identities where user_id = auth.uid();
  
  if my_identity_id is null then
    return json_build_object('error', 'No anonymous identity found');
  end if;

  -- Insert the comment with NULL user_id
  insert into public.comments (user_id, anon_post_id, anon_identity_id, content)
  values (NULL, target_post_id, my_identity_id, content_text)
  returning id into new_comment_id;

  -- Increment reply count on anon_posts
  update public.anon_posts set reply_count = reply_count + 1 where id = target_post_id;

  return json_build_object('success', true, 'id', new_comment_id);
end;
$$;
