-- 1. "Trending Now" (Last 48 Hours) - For Horizontal Scroll
-- Metric: "Chaos Score" = (Upvotes + Downvotes) + (Replies * 2)

create or replace function public.get_trending_unrolled(
  limit_count int default 5
)
returns table (
  id uuid,
  content text,
  identity_id uuid,
  created_at timestamp with time zone,
  upvotes int,
  downvotes int,
  reply_count int,
  badge text,
  anon_name text,
  avatar_color text,
  chaos_score int
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select 
    p.id,
    p.content,
    p.identity_id,
    p.created_at,
    p.upvotes,
    p.downvotes,
    p.reply_count,
    p.badge,
    i.anon_name,
    i.avatar_color,
    (
      (p.upvotes + p.downvotes) + (p.reply_count * 2)
    )::int as chaos_score
  from public.anon_posts p
  join public.anon_identities i on p.identity_id = i.id
  where 
    p.created_at > (now() - interval '48 hours') -- Strict 48h freshness
  order by
    (p.upvotes + p.downvotes + (p.reply_count * 2)) desc
  limit limit_count;
end;
$$;


-- 2. "Weekly Top Unrolled" (Last 7 Days)
-- Supports: 'controversial', 'upvoted'

create or replace function public.get_weekly_top_unrolled(
  sort_category text, -- 'controversial', 'upvoted'
  limit_count int default 5
)
returns table (
  id uuid,
  content text,
  identity_id uuid,
  created_at timestamp with time zone,
  upvotes int,
  downvotes int,
  reply_count int,
  badge text,
  anon_name text,
  avatar_color text,
  score int
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select 
    p.id,
    p.content,
    p.identity_id,
    p.created_at,
    p.upvotes,
    p.downvotes,
    p.reply_count,
    p.badge,
    i.anon_name,
    i.avatar_color,
    case 
      when sort_category = 'controversial' then (p.upvotes + p.downvotes) -- High total activity, mixed votes
      else p.upvotes -- Default 'upvoted'
    end::int as score
  from public.anon_posts p
  join public.anon_identities i on p.identity_id = i.id
  where 
    p.created_at > (now() - interval '7 days') 
  order by
    score desc
  limit limit_count;
end;
$$;


-- 3. "Weekly Top Normal" (Last 7 Days)
-- Supports: 'replied', 'liked'

create or replace function public.get_weekly_top_normal(
  sort_category text, -- 'replied', 'liked'
  limit_count int default 5
)
returns table (
  id uuid,
  content text,
  media_urls text[],
  user_id uuid,
  username text,
  avatar_url text, -- We need author info for UI
  likes_count bigint,
  comments_count bigint,
  created_at timestamp with time zone
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select 
    p.id,
    p.content,
    p.media_urls,
    p.user_id,
    pr.username,
    pr.avatar_url,
    count(distinct l.user_id)::bigint as likes_count, -- Count distinct likes
    count(distinct c.id)::bigint as comments_count, -- Count distinct comments
    p.created_at
  from public.posts p
  join public.profiles pr on p.user_id = pr.id
  left join public.likes l on p.id = l.post_id
  left join public.comments c on p.id = c.post_id
  where 
    p.created_at > (now() - interval '7 days')
  group by 
    p.id, p.content, p.media_urls, p.user_id, pr.username, pr.avatar_url, p.created_at
  order by
    case 
      when sort_category = 'replied' then count(distinct c.id)
      else count(distinct l.user_id) -- Default 'liked'
    end desc
  limit limit_count;
end;
$$;
