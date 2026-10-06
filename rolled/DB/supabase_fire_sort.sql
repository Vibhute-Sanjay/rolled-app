-- Function to fetch Unrolled posts with flexible sorting
create or replace function public.get_unrolled_feed(
  sort_type text default 'new', -- 'new' or 'fire'
  limit_count int default 20,
  offset_count int default 0,
  filter_badge text default 'All'
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
  fire_score numeric
)
language plpgsql
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
      (p.upvotes * 2) + 
      (p.reply_count * 3) - 
      (p.downvotes * 1) - 
      (EXTRACT(EPOCH FROM (now() - p.created_at))/3600 * 3)
    )::numeric as fire_score
  from public.anon_posts p
  join public.anon_identities i on p.identity_id = i.id
  where 
    case 
      when filter_badge = 'All' then true
      else p.badge = filter_badge
    end
  order by
    case when sort_type = 'fire' then
      (
        (p.upvotes * 2) + 
        (p.reply_count * 3) - 
        (p.downvotes * 1) - 
        (EXTRACT(EPOCH FROM (now() - p.created_at))/3600 * 3)
      ) 
    end desc nulls last,
    -- Secondary sort for 'fire' or Primary for 'new'
    p.created_at desc
  limit limit_count
  offset offset_count;
end;
$$;
