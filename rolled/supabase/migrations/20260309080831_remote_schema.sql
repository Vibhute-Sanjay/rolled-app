


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."report_target_type" AS ENUM (
    'user',
    'post',
    'comment',
    'message',
    'reply',
    'activity'
);


ALTER TYPE "public"."report_target_type" OWNER TO "postgres";


CREATE TYPE "public"."request_status" AS ENUM (
    'pending',
    'approved',
    'rejected'
);


ALTER TYPE "public"."request_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_anon_identity"("desired_name" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
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


ALTER FUNCTION "public"."create_anon_identity"("desired_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_anon_post"("content_text" "text", "badge_text" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
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


ALTER FUNCTION "public"."create_anon_post"("content_text" "text", "badge_text" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_anon_reply"("target_post_id" "uuid", "content_text" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."create_anon_reply"("target_post_id" "uuid", "content_text" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_anon_report"("target_post_id" "uuid", "reason_text" "text", "details_text" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  my_identity_id uuid;
begin
  select id into my_identity_id from public.anon_identities where user_id = auth.uid();
  
  if my_identity_id is null then
    return json_build_object('error', 'No anonymous identity found');
  end if;

  insert into public.anon_reports (post_id, reporter_identity_id, reason, details)
  values (target_post_id, my_identity_id, reason_text, details_text);

  return json_build_object('success', true);
end;
$$;


ALTER FUNCTION "public"."create_anon_report"("target_post_id" "uuid", "reason_text" "text", "details_text" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_own_account"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. Delete Storage Objects
  -- (We do this first because once the user is gone, 'owner' metadata works but RLS might get tricky if we relied on profile)
  -- Deleting from storage.objects removes the actual file in Supabase Storage
  DELETE FROM storage.objects
  WHERE owner = current_user_id;

  -- 2. Delete the User (Trigger Cascade)
  -- This will cascade to public.profiles -> public.posts, public.likes, public.anon_identities, etc.
  DELETE FROM auth.users
  WHERE id = current_user_id;

END;
$$;


ALTER FUNCTION "public"."delete_own_account"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_room_if_empty"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
BEGIN
    -- Check if any participants remain in the room
    IF NOT EXISTS (SELECT 1 FROM public.chat_participants WHERE room_id = OLD.room_id) THEN
        DELETE FROM public.chat_rooms WHERE id = OLD.room_id;
    END IF;
    RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."delete_room_if_empty"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_active_flare_users"() RETURNS TABLE("user_id" "uuid", "username" "text", "avatar_url" "text", "latest_flare_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (p.user_id)
    p.user_id,
    pr.username,
    pr.avatar_url,
    p.created_at as latest_flare_at
  FROM public.posts p
  JOIN public.profiles pr ON p.user_id = pr.id
  WHERE 
    p.is_flare = true 
    AND (p.expires_at IS NULL OR p.expires_at > timezone('utc'::text, now()))
  ORDER BY p.user_id, p.created_at DESC;
END;
$$;


ALTER FUNCTION "public"."get_active_flare_users"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_anon_identity"() RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
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


ALTER FUNCTION "public"."get_my_anon_identity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_or_create_dm_room"("other_user_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
    found_room_id UUID;
BEGIN
    -- 1. Try to find an existing room with exactly these two users
    SELECT cp1.room_id
    INTO found_room_id
    FROM public.chat_participants cp1
    JOIN public.chat_participants cp2 ON cp1.room_id = cp2.room_id
    WHERE cp1.user_id = auth.uid()
      AND cp2.user_id = other_user_id
    LIMIT 1;

    -- 2. If found, return it
    IF found_room_id IS NOT NULL THEN
        RETURN found_room_id;
    END IF;

    -- 3. If not found, create a new room
    INSERT INTO public.chat_rooms (updated_at) VALUES (now()) RETURNING id INTO found_room_id;

    -- 4. Add both participants
    INSERT INTO public.chat_participants (room_id, user_id) VALUES (found_room_id, auth.uid());
    INSERT INTO public.chat_participants (room_id, user_id) VALUES (found_room_id, other_user_id);

    RETURN found_room_id;
END;
$$;


ALTER FUNCTION "public"."get_or_create_dm_room"("other_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_trending_unrolled"("limit_count" integer DEFAULT 5) RETURNS TABLE("id" "uuid", "content" "text", "identity_id" "uuid", "created_at" timestamp with time zone, "upvotes" integer, "downvotes" integer, "reply_count" integer, "badge" "text", "anon_name" "text", "avatar_color" "text", "chaos_score" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
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


ALTER FUNCTION "public"."get_trending_unrolled"("limit_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_unrolled_feed"("sort_type" "text" DEFAULT 'new'::"text", "limit_count" integer DEFAULT 20, "offset_count" integer DEFAULT 0, "filter_badge" "text" DEFAULT 'All'::"text") RETURNS TABLE("id" "uuid", "content" "text", "identity_id" "uuid", "created_at" timestamp with time zone, "upvotes" integer, "downvotes" integer, "reply_count" integer, "badge" "text", "anon_name" "text", "avatar_color" "text", "fire_score" numeric)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions'
    AS $$
begin
  return query
  select 
    p.id, p.content, p.identity_id, p.created_at,
    p.upvotes, p.downvotes, p.reply_count, p.badge,
    i.anon_name, i.avatar_color,
    ((p.upvotes * 2) + (p.reply_count * 3) - (p.downvotes * 1) - (EXTRACT(EPOCH FROM (now() - p.created_at))/3600 * 3))::numeric as fire_score
  from public.anon_posts p
  join public.anon_identities i on p.identity_id = i.id
  where case when filter_badge = 'All' then true else p.badge = filter_badge end
  order by
    case when sort_type = 'fire' then
      ((p.upvotes * 2) + (p.reply_count * 3) - (p.downvotes * 1) - (EXTRACT(EPOCH FROM (now() - p.created_at))/3600 * 3))
    end desc nulls last,
    p.created_at desc
  limit limit_count offset offset_count;
end;
$$;


ALTER FUNCTION "public"."get_unrolled_feed"("sort_type" "text", "limit_count" integer, "offset_count" integer, "filter_badge" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_stats"("target_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
    DECLARE
    post_count INTEGER;
    follower_count INTEGER;
    following_count INTEGER;
    BEGIN
    -- Count Posts
    SELECT COUNT(*) INTO post_count
    FROM public.posts
    WHERE user_id = target_user_id;

    -- Count Followers
    SELECT COUNT(*) INTO follower_count
    FROM public.follows
    WHERE following_id = target_user_id AND status = 'accepted';

    -- Count Following
    SELECT COUNT(*) INTO following_count
    FROM public.follows
    WHERE follower_id = target_user_id AND status = 'accepted';

    RETURN jsonb_build_object(
        'posts_count', post_count,
        'followers_count', follower_count,
        'following_count', following_count
    );
    END;
    $$;


ALTER FUNCTION "public"."get_user_stats"("target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_weekly_top_normal"("sort_category" "text", "limit_count" integer DEFAULT 5) RETURNS TABLE("id" "uuid", "content" "text", "media_urls" "text"[], "user_id" "uuid", "username" "text", "avatar_url" "text", "likes_count" bigint, "comments_count" bigint, "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."get_weekly_top_normal"("sort_category" "text", "limit_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_weekly_top_unrolled"("sort_category" "text", "limit_count" integer DEFAULT 5) RETURNS TABLE("id" "uuid", "content" "text", "identity_id" "uuid", "created_at" timestamp with time zone, "upvotes" integer, "downvotes" integer, "reply_count" integer, "badge" "text", "anon_name" "text", "avatar_color" "text", "score" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."get_weekly_top_unrolled"("sort_category" "text", "limit_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_block_creation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Remove follow relationship FROM blocker TO blocked
    DELETE FROM public.follows 
    WHERE follower_id = NEW.blocker_id AND following_id = NEW.blocked_id;

    -- Remove follow relationship FROM blocked TO blocker
    DELETE FROM public.follows 
    WHERE follower_id = NEW.blocked_id AND following_id = NEW.blocker_id;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_block_creation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_comment_like_notification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE v_comment_author_id uuid;
DECLARE v_post_id uuid;
BEGIN
    -- Get the author of the comment and the post_id
    SELECT user_id, post_id INTO v_comment_author_id, v_post_id
    FROM public.comments 
    WHERE id = NEW.comment_id;

    -- Safety: If comment doesn't exist or it's your own comment, do nothing.
    IF v_comment_author_id IS NULL OR v_comment_author_id = NEW.user_id THEN
        RETURN NEW;
    END IF;

    -- Insert Notification
    INSERT INTO public.notifications (user_id, actor_id, type, resource_id, content)
    VALUES (
        v_comment_author_id, -- Notify the Comment Author
        NEW.user_id,         -- By the Liker
        'like',              -- Type
        v_post_id,           -- Link to the Post
        'liked your reply'   -- Message
    );

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_comment_like_notification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_comment_mentions"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- ✅ SAFETY: Skip for now if no post_id, to prevent crash.
    IF NEW.post_id IS NULL THEN
        RETURN NEW;
    END IF;

    BEGIN
        IF NEW.content IS NOT NULL AND NEW.content != '' THEN
            PERFORM public.notify_inline_mentions(
                NEW.content, 
                NEW.user_id, 
                NEW.post_id, 
                'comment'
            );
        END IF;
    EXCEPTION WHEN OTHERS THEN NULL; END;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_comment_mentions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_follow_request"("requester_id" "uuid", "action" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
BEGIN
    IF action = 'accept' THEN
        UPDATE public.follows
        SET status = 'accepted'
        WHERE follower_id = requester_id AND following_id = auth.uid();
        
        -- Send 'follow' notification to the requester? (Optional: "X accepted your request")
        -- For now, we just update status.
    ELSIF action = 'reject' THEN
        DELETE FROM public.follows
        WHERE follower_id = requester_id AND following_id = auth.uid();
    END IF;
END;
$$;


ALTER FUNCTION "public"."handle_follow_request"("requester_id" "uuid", "action" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_activity_post"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Insert notification for all followers
  INSERT INTO public.notifications (user_id, actor_id, type, resource_id, content)
  SELECT 
    f.follower_id, 
    NEW.organizer_id,
    'new_activity', 
    NEW.id,
    'posted a new event: ' || LEFT(NEW.title, 30)
  FROM public.follows f
  WHERE f.following_id = NEW.organizer_id
  AND f.status = 'accepted';

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_activity_post"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_activity_request"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    INSERT INTO public.notifications (user_id, actor_id, type, resource_id, content)
    VALUES (
        (SELECT organizer_id FROM public.activities WHERE id = NEW.activity_id), -- Recipient (Organizer)
        NEW.user_id, -- Actor (Requester)
        'activity_request',
        NEW.activity_id,
        'requested to join your activity'
    );
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_activity_request"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_anon_vote"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  post_identity_id uuid;
  vote_action text;
BEGIN
    -- Get the post's identity
    SELECT identity_id INTO post_identity_id 
    FROM public.anon_posts WHERE id = NEW.post_id;
    
    -- Only notify if it's not the voter's own post
    IF post_identity_id != NEW.identity_id AND post_identity_id IS NOT NULL THEN
        -- Determine vote action text
        vote_action := CASE 
            WHEN NEW.vote_type = 1 THEN 'upvoted'
            WHEN NEW.vote_type = -1 THEN 'downvoted'
            ELSE 'voted on'
        END;
        
        -- Get the user_id of the post author from anon_identities and insert notification
        INSERT INTO public.notifications (user_id, actor_id, type, resource_id, content, post_type)
        SELECT 
            ai.user_id,                          -- Post author (real user)
            voter_ai.user_id,                    -- Voter (real user)
            'like',                              -- Using 'like' type for consistency
            NEW.post_id,                         -- The anon post ID
            vote_action || ' your roll.',
            'anon_post'
        FROM public.anon_identities ai
        LEFT JOIN public.anon_identities voter_ai ON voter_ai.id = NEW.identity_id
        WHERE ai.id = post_identity_id AND voter_ai.user_id IS NOT NULL;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_anon_vote"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_comment"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
    post_author_id uuid;
BEGIN
    SELECT user_id INTO post_author_id FROM public.posts WHERE id = NEW.post_id;
    
    -- Don't notify self-replies
    IF post_author_id != NEW.user_id THEN
        INSERT INTO public.notifications (user_id, actor_id, type, resource_id, content)
        VALUES (
            post_author_id,
            NEW.user_id,
            'reply',
            NEW.post_id,
            'replied to your roll: ' || substring(NEW.content from 1 for 20) || '...'
        );
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_comment"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_comment_fix"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE 
    v_post_owner_id uuid;
    v_parent_author_id uuid;
BEGIN
    -- Get the post owner
    SELECT user_id INTO v_post_owner_id FROM public.posts WHERE id = NEW.post_id;
    
    -- 1. Notify Post Owner (if not replying to own post)
    IF v_post_owner_id IS NOT NULL AND NEW.user_id != v_post_owner_id THEN
        INSERT INTO public.notifications (user_id, actor_id, type, resource_id, content)
        VALUES (
            v_post_owner_id, 
            NEW.user_id, 
            'reply', 
            NEW.post_id, 
            'replied to your roll: ' || left(NEW.content, 20) || (CASE WHEN length(NEW.content) > 20 THEN '...' ELSE '' END)
        );
    END IF;

    -- 2. Notify Parent Comment Author (if this is a reply to a reply)
    IF NEW.parent_id IS NOT NULL THEN
        SELECT user_id INTO v_parent_author_id FROM public.comments WHERE id = NEW.parent_id;
        
        -- Only notify if:
        -- - Parent comment author exists
        -- - Not replying to own comment
        -- - Parent author is NOT the post owner (to avoid double notification)
        IF v_parent_author_id IS NOT NULL 
           AND v_parent_author_id != NEW.user_id 
           AND v_parent_author_id != v_post_owner_id THEN
            
            INSERT INTO public.notifications (user_id, actor_id, type, resource_id, content)
            VALUES (
                v_parent_author_id, 
                NEW.user_id, 
                'reply', 
                NEW.post_id, 
                'replied to your rollback: ' || left(NEW.content, 20) || (CASE WHEN length(NEW.content) > 20 THEN '...' ELSE '' END)
            );
        END IF;
    END IF;

    -- Also handle inline mentions (existing logic)
    PERFORM public.notify_inline_mentions(NEW.content, NEW.user_id, NEW.post_id, 'comment');
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_comment_fix"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_comment_unified"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    post_owner_id uuid;
BEGIN
    -- 1. Notify Inline Mentions (If helper exists)
    -- This sends 'mention' type notifications to mentioned users.
    BEGIN
        IF NEW.content IS NOT NULL THEN
            PERFORM public.notify_inline_mentions(NEW.content, NEW.user_id, NEW.post_id, 'comment');
        END IF;
    EXCEPTION WHEN OTHERS THEN NULL; END;

    -- 2. Notify Post Owner (General Comment)
    SELECT user_id INTO post_owner_id FROM public.posts WHERE id = NEW.post_id;
    
    -- Owner gets a notification if they are not the commenter.
    -- We allow valid duplicates here (e.g. 2 separate comments = 2 notifications),
    -- because we removed the UNIQUE constraint for 'comment' type above.
    IF post_owner_id IS NOT NULL AND post_owner_id != NEW.user_id THEN
        INSERT INTO public.notifications (user_id, actor_id, type, resource_id, content)
        VALUES (post_owner_id, NEW.user_id, 'comment', NEW.post_id, 'commented on your roll.');
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_comment_unified"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_follow"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.notifications (user_id, actor_id, type, content)
  VALUES (NEW.following_id, NEW.follower_id, 'follow', 'started following you.');
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_follow"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_like"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  post_author_id uuid;
BEGIN
    SELECT user_id INTO post_author_id FROM public.posts WHERE id = NEW.post_id;
    
    IF post_author_id != NEW.user_id THEN
        INSERT INTO public.notifications (user_id, actor_id, type, resource_id, content, post_type)
        VALUES (post_author_id, NEW.user_id, 'like', NEW.post_id, 'liked your roll.', 'post');
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_like"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_message_notification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE recipient_id UUID;
BEGIN
    SELECT user_id INTO recipient_id FROM public.chat_participants
    WHERE room_id = NEW.room_id AND user_id != NEW.user_id LIMIT 1;
    IF recipient_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, actor_id, type, resource_id, content)
        VALUES (recipient_id, NEW.user_id, 'message', NEW.room_id, LEFT(NEW.content, 100));
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_message_notification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.profiles (id, username, role)
  values (new.id, new.raw_user_meta_data->>'username', new.raw_user_meta_data->>'role');
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_verified_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'username',
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE(NEW.raw_user_meta_data->>'role', 'student') -- FIXED: 'student' is a valid role
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_verified_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_vote"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE post_author_id uuid;
BEGIN
    SELECT user_id INTO post_author_id FROM public.posts WHERE id = NEW.post_id;
    IF post_author_id != NEW.user_id THEN
        INSERT INTO public.notifications (type, actor_id, user_id, resource_id, content) 
        VALUES ('vote', NEW.user_id, post_author_id, NEW.post_id, 'voted on your poll.');
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_vote"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_post_mentions"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE tagged_user_id uuid;
BEGIN
    IF NEW.tagged_users IS NOT NULL AND array_length(NEW.tagged_users, 1) > 0 THEN
        FOREACH tagged_user_id IN ARRAY NEW.tagged_users
        LOOP
            IF tagged_user_id != NEW.user_id THEN
                INSERT INTO public.notifications (user_id, actor_id, type, resource_id, content)
                VALUES (tagged_user_id, NEW.user_id, 'mention', NEW.id, 'tagged you in a roll.');
            END IF;
        END LOOP;
    END IF;
    PERFORM public.notify_inline_mentions(NEW.content, NEW.user_id, NEW.id, 'post', NEW.tagged_users);
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_post_mentions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_unfollow"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Delete the 'follow' or 'follow_request' notification linking these two users
  DELETE FROM public.notifications 
  WHERE type IN ('follow', 'follow_request')
    AND actor_id = OLD.follower_id 
    AND user_id = OLD.following_id;
    
  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."handle_unfollow"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_unlike"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Delete the 'like' notification for this specific post/user combo
  DELETE FROM public.notifications 
  WHERE type = 'like'
    AND actor_id = OLD.user_id 
    AND resource_id = OLD.post_id; -- resource_id stores post_id for likes
    
  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."handle_unlike"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hide_message"("target_message_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
BEGIN
  UPDATE public.messages
  SET deleted_by = array_append(deleted_by, auth.uid())
  WHERE id = target_message_id
  AND NOT (deleted_by @> ARRAY[auth.uid()]); -- Only if not already hidden
END;
$$;


ALTER FUNCTION "public"."hide_message"("target_message_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_room_participant"("_room_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.chat_participants
    WHERE room_id = _room_id AND user_id = auth.uid()
  );
END;
$$;


ALTER FUNCTION "public"."is_room_participant"("_room_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_activity_request"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_activity_title TEXT;
    v_organizer_id UUID;
BEGIN
    SELECT title, organizer_id INTO v_activity_title, v_organizer_id 
    FROM public.activities WHERE id = NEW.activity_id;
    
    INSERT INTO public.notifications (user_id, actor_id, type, resource_id, content)
    VALUES (
        v_organizer_id,
        NEW.user_id, 
        'activity_request', 
        NEW.activity_id, 
        'requested to join your event: ' || LEFT(v_activity_title, 20)
    );
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_activity_request"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_activity_request_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  activity_title text;
BEGIN
  -- Only trigger if status CHANGED
  IF NEW.status IS DISTINCT FROM OLD.status THEN
      
      -- Get Activity Title for the message
      SELECT title INTO activity_title FROM public.activities WHERE id = NEW.activity_id;

      -- A. If APPROVED -> Notify Guest
      IF NEW.status = 'approved' THEN
          INSERT INTO public.notifications (user_id, actor_id, type, resource_id, content)
          VALUES (
              NEW.user_id, 
              auth.uid(),  -- The organizer
              'activity_approved',
              NEW.activity_id,
              'approved your request to join ' || activity_title
          );
      
      -- B. If REJECTED -> Notify Guest
      ELSIF NEW.status = 'rejected' THEN
          INSERT INTO public.notifications (user_id, actor_id, type, resource_id, content)
          VALUES (
              NEW.user_id,
              auth.uid(),
              'activity_rejected',
              NEW.activity_id,
              'declined your request to join ' || activity_title
          );
      END IF;

  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_activity_request_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_activity_update"("p_activity_id" "uuid", "p_message" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
    v_guest record;
begin
    -- 1. Update Requests to require reconfirmation
    update public.activity_requests
    set reconfirm_needed = true
    where activity_id = p_activity_id and status = 'approved';

    -- 2. Loop through approved guests and insert notifications
    for v_guest in 
        select user_id from public.activity_requests 
        where activity_id = p_activity_id and status = 'approved'
    loop
        insert into public.notifications (user_id, actor_id, type, resource_id, content)
        values (
            v_guest.user_id, 
            auth.uid(),      
            'activity_updated',
            p_activity_id,
            p_message
        );
    end loop;
end;
$$;


ALTER FUNCTION "public"."notify_activity_update"("p_activity_id" "uuid", "p_message" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_inline_mentions"("p_content" "text", "p_actor_id" "uuid", "p_resource_id" "uuid", "p_target_type" "text", "p_ignore_ids" "uuid"[] DEFAULT '{}'::"uuid"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_username text;
    v_recipient_id uuid;
BEGIN
    FOR v_username IN 
        SELECT DISTINCT (regexp_matches(p_content, '(?:^|\s)@(\w+)', 'g'))[1]
    LOOP
        SELECT id INTO v_recipient_id FROM public.profiles WHERE username = v_username;
        IF v_recipient_id IS NOT NULL 
           AND v_recipient_id != p_actor_id 
           AND NOT (v_recipient_id = ANY(p_ignore_ids)) 
        THEN
            INSERT INTO public.notifications (user_id, actor_id, type, resource_id, content)
            VALUES (v_recipient_id, p_actor_id, 'mention', p_resource_id, 
                CASE WHEN p_target_type = 'post' THEN 'mentioned you in a post.' ELSE 'mentioned you in a reply.' END
            );
        END IF;
    END LOOP;
END;
$$;


ALTER FUNCTION "public"."notify_inline_mentions"("p_content" "text", "p_actor_id" "uuid", "p_resource_id" "uuid", "p_target_type" "text", "p_ignore_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."test_push_urls"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'net', 'extensions'
    AS $$
    DECLARE
        req_id bigint;
    BEGIN
        -- Test 1: Standard URL (.../push)
        PERFORM net.http_post(
            url := 'https://hbkslwngbsvwiudaxltb.supabase.co/functions/v1/push',
            body := '{"test": true}'::jsonb,
            headers := '{"Content-Type": "application/json"}'::jsonb
        );
        INSERT INTO public.push_diagnostics (url_attempted, status) VALUES ('.../push', 'Request Sent');

        -- Test 2: Hyphen URL (.../push-)
        PERFORM net.http_post(
            url := 'https://hbkslwngbsvwiudaxltb.supabase.co/functions/v1/push-',
            body := '{"test": true}'::jsonb,
            headers := '{"Content-Type": "application/json"}'::jsonb
        );
        INSERT INTO public.push_diagnostics (url_attempted, status) VALUES ('.../push-', 'Request Sent');

    END;
    $$;


ALTER FUNCTION "public"."test_push_urls"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."toggle_follow"("target_user_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    current_status text;
BEGIN
    SELECT status INTO current_status FROM public.follows
    WHERE follower_id = auth.uid() AND following_id = target_user_id;

    IF current_status IS NOT NULL THEN
        DELETE FROM public.follows WHERE follower_id = auth.uid() AND following_id = target_user_id;
        RETURN 'unfollowed';
    ELSE
        INSERT INTO public.follows (follower_id, following_id, status)
        VALUES (auth.uid(), target_user_id, 'accepted');
        RETURN 'following';
    END IF;
END;
$$;


ALTER FUNCTION "public"."toggle_follow"("target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_delete_media"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'net', 'extensions'
    AS $$
declare
  service_role_key text := 'YOUR_SERVICE_ROLE_KEY'; -- You can also hardcode this if safe, or store in a table (but secrets are better managed in Edge Functions)
  -- Actually, for real security, we should just send the event and let the Edge Function verify the signature.
  -- But calling from Postgres requires an Authorization header usually.
  
  -- SIMPLER APPROACH: Use the Native Webhook feature in the Dashboard.
  -- BUT since we need SQL, here is the net.http_post approach.
  
  url text := 'https://hbkslwngbsvwiudaxltb.supabase.co/functions/v1/delete-post-media';
begin
  -- Make an async HTTP POST request
  -- We send the OLD record as the payload
  perform net.http_post(
    url,
    jsonb_build_object(
        'old_record', row_to_json(OLD), 
        'type', 'DELETE',
        'table', 'posts', 
        'schema', 'public'
    ),
    jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
    )
  );
  return OLD;
end;
$$;


ALTER FUNCTION "public"."trigger_delete_media"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_media_cleanup"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'net'
    AS $$
DECLARE
  service_role_key text := 'YOUR_SERVICE_ROLE_KEY'; -- REPLACE WITH YOUR ACTUAL KEY
  url text := 'https://hbkslwngbsvwiudaxltb.supabase.co/functions/v1/delete-cloudinary-asset';
  media_urls_to_delete text[];
BEGIN
  -- Extract URLs based on table
  IF TG_TABLE_NAME = 'posts' THEN
    media_urls_to_delete := OLD.media_urls;
  ELSIF TG_TABLE_NAME = 'activities' THEN
    media_urls_to_delete := array_append(COALESCE(OLD.additional_images, '{}'), OLD.cover_image);
  END IF;

  -- Filter out nulls
  SELECT array_agg(u) INTO media_urls_to_delete FROM unnest(media_urls_to_delete) u WHERE u IS NOT NULL AND u != '';

  IF media_urls_to_delete IS NOT NULL AND array_length(media_urls_to_delete, 1) > 0 THEN
    -- FIXED: Changed to 'net.http_post' and used named arguments for safety
    PERFORM net.http_post(
      url := url,
      body := jsonb_build_object('urls', to_jsonb(media_urls_to_delete)),
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || service_role_key)
    );
  END IF;
  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."trigger_media_cleanup"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_push_notification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'net', 'extensions'
    AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://hbkslwngbsvwiudaxltb.supabase.co/functions/v1/push',
    body := jsonb_build_object('record', row_to_json(NEW))::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhia3Nsd25nYnN2d2l1ZGF4bHRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxMjg1MzUsImV4cCI6MjA4MjcwNDUzNX0.7ZfT_oTDbdVGqK3dXGE_T3F6qvkEqdInrFzrgK7XLV0'
    )
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_push_notification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_anon_post_reply_count"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE v_anon_post_id uuid;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        v_anon_post_id := OLD.anon_post_id;
    ELSE
        v_anon_post_id := NEW.anon_post_id;
    END IF;

    -- Safety check
    IF v_anon_post_id IS NOT NULL THEN
        UPDATE public.anon_posts
        SET reply_count = (
            SELECT count(*) 
            FROM public.comments 
            WHERE anon_post_id = v_anon_post_id
        )
        WHERE id = v_anon_post_id;
    END IF;

    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_anon_post_reply_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_my_push_token"("token" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    UPDATE public.profiles
    SET push_token = token
    WHERE id = auth.uid();
END;
$$;


ALTER FUNCTION "public"."update_my_push_token"("token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_karma"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
  target_user_id uuid;
  new_karma int;
BEGIN
  -- Trigger is ON anon_posts (UPDATE of votes)
  -- NEW.identity_id is the author of the post
  
  -- Find real user ID from the identity
  SELECT user_id INTO target_user_id 
  FROM public.anon_identities 
  WHERE id = NEW.identity_id;
  
  IF target_user_id IS NOT NULL THEN
      -- Calculate Total Karma for this user across ALL their anonymous posts
      -- Formula: (Upvotes * 2) - (Downvotes * 3)
      SELECT COALESCE(SUM((upvotes * 2) - (downvotes * 3)), 0)
      INTO new_karma
      FROM public.anon_posts
      WHERE identity_id = NEW.identity_id;
      
      -- Update Profile
      UPDATE public.profiles
      SET karma = new_karma
      WHERE id = target_user_id;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_user_karma"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."vote_on_anon_post"("p_id" "uuid", "v_type" integer) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
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


ALTER FUNCTION "public"."vote_on_anon_post"("p_id" "uuid", "v_type" integer) OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."activities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "organizer_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "short_description" "text",
    "full_details" "text",
    "category" "text" NOT NULL,
    "location" "text",
    "cover_image" "text",
    "additional_images" "text"[],
    "start_time" timestamp with time zone NOT NULL,
    "end_time" timestamp with time zone,
    "ticket_type" "text" DEFAULT 'Free'::"text",
    "price" numeric DEFAULT 0,
    "capacity" integer,
    "external_link" "text",
    "attendees_count" integer DEFAULT 0,
    "is_updated" boolean DEFAULT false,
    CONSTRAINT "activities_ticket_type_check" CHECK (("ticket_type" = ANY (ARRAY['Free'::"text", 'Paid'::"text"])))
);


ALTER TABLE "public"."activities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activity_likes" (
    "user_id" "uuid" NOT NULL,
    "activity_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."activity_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activity_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "activity_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "status" "public"."request_status" DEFAULT 'pending'::"public"."request_status",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "reconfirm_needed" boolean DEFAULT false
);


ALTER TABLE "public"."activity_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."anon_identities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "anon_name" "text" NOT NULL,
    "avatar_color" "text" DEFAULT '#00F0FF'::"text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "anon_name_length" CHECK ((("char_length"("anon_name") >= 3) AND ("char_length"("anon_name") <= 25)))
);


ALTER TABLE "public"."anon_identities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."anon_posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "identity_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "badge" "text",
    "upvotes" integer DEFAULT 0,
    "downvotes" integer DEFAULT 0,
    "reply_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."anon_posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."anon_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "reporter_identity_id" "uuid",
    "reason" "text" NOT NULL,
    "details" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."anon_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."anon_votes" (
    "post_id" "uuid" NOT NULL,
    "identity_id" "uuid" NOT NULL,
    "vote_type" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "anon_votes_vote_type_check" CHECK (("vote_type" = ANY (ARRAY[1, '-1'::integer])))
);


ALTER TABLE "public"."anon_votes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."blocks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "blocker_id" "uuid" NOT NULL,
    "blocked_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."blocks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_participants" (
    "room_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."chat_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_rooms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."chat_rooms" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comment_likes" (
    "user_id" "uuid" NOT NULL,
    "comment_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."comment_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid",
    "user_id" "uuid",
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "parent_id" "uuid",
    "anon_post_id" "uuid",
    "anon_identity_id" "uuid",
    CONSTRAINT "comments_target_check" CHECK (((("post_id" IS NOT NULL) AND ("anon_post_id" IS NULL)) OR (("post_id" IS NULL) AND ("anon_post_id" IS NOT NULL))))
);


ALTER TABLE "public"."comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "type" "text" DEFAULT 'feedback'::"text",
    "message" "text" NOT NULL,
    "device_info" "jsonb",
    "status" "text" DEFAULT 'open'::"text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "feedback_type_check" CHECK (("type" = ANY (ARRAY['feedback'::"text", 'bug'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."feedback" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."follows" (
    "follower_id" "uuid" NOT NULL,
    "following_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "status" "text" DEFAULT 'accepted'::"text"
);


ALTER TABLE "public"."follows" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."likes" (
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "is_pinned" boolean DEFAULT false
);


ALTER TABLE "public"."likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."message_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "text" NOT NULL,
    "reporter_id" "uuid",
    "reason" "text" NOT NULL,
    "details" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."message_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "is_read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "attachments" "jsonb"[],
    "post_id" "uuid",
    "activity_id" "uuid",
    "anon_post_id" "uuid",
    "deleted_by" "uuid"[] DEFAULT '{}'::"uuid"[]
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "actor_id" "uuid",
    "type" "text" NOT NULL,
    "resource_id" "uuid",
    "content" "text",
    "is_read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "post_type" "text",
    CONSTRAINT "notifications_post_type_check" CHECK (("post_type" = ANY (ARRAY['post'::"text", 'anon_post'::"text", NULL::"text"])))
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."poll_options" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid",
    "option_text" "text" NOT NULL,
    "index" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."poll_options" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."poll_votes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid",
    "option_id" "uuid",
    "user_id" "uuid"
);


ALTER TABLE "public"."poll_votes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "content" "text",
    "media_urls" "text"[],
    "location" "text",
    "tagged_users" "uuid"[],
    "audience" "text" DEFAULT 'public'::"text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "aspect_ratio" numeric DEFAULT 1.0,
    "is_pinned" boolean DEFAULT false,
    "has_poll" boolean DEFAULT false
);


ALTER TABLE "public"."posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "updated_at" timestamp with time zone,
    "username" "text",
    "full_name" "text",
    "bio" "text",
    "dob" "date",
    "major" "text",
    "year" "text",
    "avatar_url" "text",
    "bg_image_url" "text",
    "role" "text",
    "push_token" "text",
    "last_seen" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "karma" integer DEFAULT 0,
    "is_verified" boolean DEFAULT false,
    "is_admin" boolean DEFAULT false,
    "is_og" boolean DEFAULT false,
    "is_onboarded" boolean DEFAULT false,
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['student'::"text", 'club'::"text", 'organization'::"text", 'admin'::"text"]))),
    CONSTRAINT "username_length" CHECK (("char_length"("username") >= 3))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_diagnostics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "url_attempted" "text",
    "status" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."push_diagnostics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "reporter_id" "uuid" NOT NULL,
    "reason" "text" NOT NULL,
    "details" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."saved_posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "post_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "is_pinned" boolean DEFAULT false
);


ALTER TABLE "public"."saved_posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."unified_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reporter_id" "uuid",
    "target_id" "text" NOT NULL,
    "target_type" "public"."report_target_type" NOT NULL,
    "reason" "text" NOT NULL,
    "details" "text",
    "screenshot_url" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "unified_reports_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'resolved'::"text", 'dismissed'::"text"])))
);


ALTER TABLE "public"."unified_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "target_user_id" "uuid" NOT NULL,
    "reporter_id" "uuid" NOT NULL,
    "reason" "text" NOT NULL,
    "details" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."user_reports" OWNER TO "postgres";


ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."activity_likes"
    ADD CONSTRAINT "activity_likes_pkey" PRIMARY KEY ("user_id", "activity_id");



ALTER TABLE ONLY "public"."activity_requests"
    ADD CONSTRAINT "activity_requests_activity_id_user_id_key" UNIQUE ("activity_id", "user_id");



ALTER TABLE ONLY "public"."activity_requests"
    ADD CONSTRAINT "activity_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."anon_identities"
    ADD CONSTRAINT "anon_identities_anon_name_key" UNIQUE ("anon_name");



ALTER TABLE ONLY "public"."anon_identities"
    ADD CONSTRAINT "anon_identities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."anon_identities"
    ADD CONSTRAINT "anon_identities_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."anon_posts"
    ADD CONSTRAINT "anon_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."anon_reports"
    ADD CONSTRAINT "anon_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."anon_votes"
    ADD CONSTRAINT "anon_votes_pkey" PRIMARY KEY ("post_id", "identity_id");



ALTER TABLE ONLY "public"."blocks"
    ADD CONSTRAINT "blocks_blocker_id_blocked_id_key" UNIQUE ("blocker_id", "blocked_id");



ALTER TABLE ONLY "public"."blocks"
    ADD CONSTRAINT "blocks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_participants"
    ADD CONSTRAINT "chat_participants_pkey" PRIMARY KEY ("room_id", "user_id");



ALTER TABLE ONLY "public"."chat_rooms"
    ADD CONSTRAINT "chat_rooms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comment_likes"
    ADD CONSTRAINT "comment_likes_pkey" PRIMARY KEY ("user_id", "comment_id");



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feedback"
    ADD CONSTRAINT "feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_pkey" PRIMARY KEY ("follower_id", "following_id");



ALTER TABLE ONLY "public"."likes"
    ADD CONSTRAINT "likes_pkey" PRIMARY KEY ("post_id", "user_id");



ALTER TABLE ONLY "public"."message_reports"
    ADD CONSTRAINT "message_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."poll_options"
    ADD CONSTRAINT "poll_options_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."poll_votes"
    ADD CONSTRAINT "poll_votes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."poll_votes"
    ADD CONSTRAINT "poll_votes_user_id_post_id_key" UNIQUE ("user_id", "post_id");



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_username_key" UNIQUE ("username");



ALTER TABLE ONLY "public"."push_diagnostics"
    ADD CONSTRAINT "push_diagnostics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."saved_posts"
    ADD CONSTRAINT "saved_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."saved_posts"
    ADD CONSTRAINT "saved_posts_user_id_post_id_key" UNIQUE ("user_id", "post_id");



ALTER TABLE ONLY "public"."unified_reports"
    ADD CONSTRAINT "unified_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_reports"
    ADD CONSTRAINT "user_reports_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_activities_organizer" ON "public"."activities" USING "btree" ("organizer_id");



CREATE INDEX "idx_chat_rooms_created" ON "public"."chat_rooms" USING "btree" ("created_at");



CREATE INDEX "idx_comment_likes_comment_id" ON "public"."comment_likes" USING "btree" ("comment_id");



CREATE INDEX "idx_comments_post" ON "public"."comments" USING "btree" ("post_id");



CREATE INDEX "idx_comments_post_id" ON "public"."comments" USING "btree" ("post_id");



CREATE INDEX "idx_comments_user_id" ON "public"."comments" USING "btree" ("user_id");



CREATE INDEX "idx_follows_following_id" ON "public"."follows" USING "btree" ("following_id");



CREATE INDEX "idx_likes_post" ON "public"."likes" USING "btree" ("post_id");



CREATE INDEX "idx_likes_user_id" ON "public"."likes" USING "btree" ("user_id");



CREATE INDEX "idx_messages_activity_id" ON "public"."messages" USING "btree" ("activity_id");



CREATE INDEX "idx_messages_anon_post_id" ON "public"."messages" USING "btree" ("anon_post_id");



CREATE INDEX "idx_messages_created_at" ON "public"."messages" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_messages_post_id" ON "public"."messages" USING "btree" ("post_id");



CREATE INDEX "idx_messages_room_id" ON "public"."messages" USING "btree" ("room_id");



CREATE INDEX "idx_messages_user_id" ON "public"."messages" USING "btree" ("user_id");



CREATE INDEX "idx_notifications_user" ON "public"."notifications" USING "btree" ("user_id");



CREATE INDEX "idx_participants_room_id" ON "public"."chat_participants" USING "btree" ("room_id");



CREATE INDEX "idx_participants_user_id" ON "public"."chat_participants" USING "btree" ("user_id");



CREATE INDEX "idx_posts_user_id" ON "public"."posts" USING "btree" ("user_id");



CREATE INDEX "idx_profiles_onboarded" ON "public"."profiles" USING "btree" ("is_onboarded");



CREATE INDEX "idx_requests_activity" ON "public"."activity_requests" USING "btree" ("activity_id");



CREATE INDEX "idx_requests_status" ON "public"."activity_requests" USING "btree" ("status");



CREATE INDEX "idx_requests_user" ON "public"."activity_requests" USING "btree" ("user_id");



CREATE INDEX "idx_saved_posts_post_id" ON "public"."saved_posts" USING "btree" ("post_id");



CREATE OR REPLACE TRIGGER "notify-everything" AFTER INSERT ON "public"."notifications" FOR EACH ROW EXECUTE FUNCTION "supabase_functions"."http_request"('https://hbkslwngbsvwiudaxltb.supabase.co/functions/v1/push', 'POST', '{"Content-type":"application/json"}', '{}', '5000');



CREATE OR REPLACE TRIGGER "notify-followers" AFTER INSERT ON "public"."posts" FOR EACH ROW EXECUTE FUNCTION "supabase_functions"."http_request"('https://hbkslwngbsvwiudaxltb.supabase.co/functions/v1/new-post-notification', 'POST', '{"Content-type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhia3Nsd25nYnN2d2l1ZGF4bHRiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzEyODUzNSwiZXhwIjoyMDgyNzA0NTM1fQ.LKRcCy7VMM0QDcn5KnOFuBKa-LOJp3QXmSYhni4zvrw"}', '{}', '5000');



CREATE OR REPLACE TRIGGER "on_activity_delete_media" AFTER DELETE ON "public"."activities" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_media_cleanup"();



CREATE OR REPLACE TRIGGER "on_activity_request" AFTER INSERT ON "public"."activity_requests" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_activity_request"();



CREATE OR REPLACE TRIGGER "on_block_created" AFTER INSERT ON "public"."blocks" FOR EACH ROW EXECUTE FUNCTION "public"."handle_block_creation"();



CREATE OR REPLACE TRIGGER "on_comment_created_mentions" AFTER INSERT ON "public"."comments" FOR EACH ROW EXECUTE FUNCTION "public"."handle_comment_mentions"();



CREATE OR REPLACE TRIGGER "on_comment_like_notify" AFTER INSERT ON "public"."comment_likes" FOR EACH ROW EXECUTE FUNCTION "public"."handle_comment_like_notification"();



CREATE OR REPLACE TRIGGER "on_new_activity_post" AFTER INSERT ON "public"."activities" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_activity_post"();



CREATE OR REPLACE TRIGGER "on_new_anon_vote" AFTER INSERT ON "public"."anon_votes" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_anon_vote"();



CREATE OR REPLACE TRIGGER "on_new_comment" AFTER INSERT ON "public"."comments" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_comment_fix"();



CREATE OR REPLACE TRIGGER "on_new_follow" AFTER INSERT ON "public"."follows" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_follow"();



CREATE OR REPLACE TRIGGER "on_new_like" AFTER INSERT ON "public"."likes" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_like"();



CREATE OR REPLACE TRIGGER "on_new_message_notification" AFTER INSERT ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_message_notification"();



CREATE OR REPLACE TRIGGER "on_notification_created" AFTER INSERT ON "public"."notifications" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_push_notification"();



CREATE OR REPLACE TRIGGER "on_poll_vote" AFTER INSERT ON "public"."poll_votes" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_vote"();



CREATE OR REPLACE TRIGGER "on_post_created_mentions" AFTER INSERT ON "public"."posts" FOR EACH ROW EXECUTE FUNCTION "public"."handle_post_mentions"();



CREATE OR REPLACE TRIGGER "on_post_delete_media" AFTER DELETE ON "public"."posts" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_media_cleanup"();



CREATE OR REPLACE TRIGGER "on_unfollow" AFTER DELETE ON "public"."follows" FOR EACH ROW EXECUTE FUNCTION "public"."handle_unfollow"();



CREATE OR REPLACE TRIGGER "on_unlike" AFTER DELETE ON "public"."likes" FOR EACH ROW EXECUTE FUNCTION "public"."handle_unlike"();



CREATE OR REPLACE TRIGGER "trg_delete_room_if_empty" AFTER DELETE ON "public"."chat_participants" FOR EACH ROW EXECUTE FUNCTION "public"."delete_room_if_empty"();



CREATE OR REPLACE TRIGGER "trg_update_anon_reply_count" AFTER INSERT OR DELETE ON "public"."comments" FOR EACH ROW EXECUTE FUNCTION "public"."update_anon_post_reply_count"();



CREATE OR REPLACE TRIGGER "trigger_notify_activity_request" AFTER UPDATE ON "public"."activity_requests" FOR EACH ROW EXECUTE FUNCTION "public"."notify_activity_request_update"();



CREATE OR REPLACE TRIGGER "trigger_update_karma" AFTER UPDATE OF "upvotes", "downvotes" ON "public"."anon_posts" FOR EACH ROW EXECUTE FUNCTION "public"."update_user_karma"();



ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_likes"
    ADD CONSTRAINT "activity_likes_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_likes"
    ADD CONSTRAINT "activity_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."activity_requests"
    ADD CONSTRAINT "activity_requests_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_requests"
    ADD CONSTRAINT "activity_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."anon_identities"
    ADD CONSTRAINT "anon_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."anon_posts"
    ADD CONSTRAINT "anon_posts_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "public"."anon_identities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."anon_reports"
    ADD CONSTRAINT "anon_reports_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."anon_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."anon_reports"
    ADD CONSTRAINT "anon_reports_reporter_identity_id_fkey" FOREIGN KEY ("reporter_identity_id") REFERENCES "public"."anon_identities"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."anon_votes"
    ADD CONSTRAINT "anon_votes_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "public"."anon_identities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."anon_votes"
    ADD CONSTRAINT "anon_votes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."anon_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."blocks"
    ADD CONSTRAINT "blocks_blocked_id_fkey" FOREIGN KEY ("blocked_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."blocks"
    ADD CONSTRAINT "blocks_blocker_id_fkey" FOREIGN KEY ("blocker_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_participants"
    ADD CONSTRAINT "chat_participants_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."chat_rooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_participants"
    ADD CONSTRAINT "chat_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comment_likes"
    ADD CONSTRAINT "comment_likes_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comment_likes"
    ADD CONSTRAINT "comment_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_anon_identity_id_fkey" FOREIGN KEY ("anon_identity_id") REFERENCES "public"."anon_identities"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_anon_post_id_fkey" FOREIGN KEY ("anon_post_id") REFERENCES "public"."anon_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feedback"
    ADD CONSTRAINT "feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_following_id_fkey" FOREIGN KEY ("following_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."likes"
    ADD CONSTRAINT "likes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."likes"
    ADD CONSTRAINT "likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."message_reports"
    ADD CONSTRAINT "message_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_anon_post_id_fkey" FOREIGN KEY ("anon_post_id") REFERENCES "public"."anon_posts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."chat_rooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."poll_options"
    ADD CONSTRAINT "poll_options_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."poll_votes"
    ADD CONSTRAINT "poll_votes_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "public"."poll_options"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."poll_votes"
    ADD CONSTRAINT "poll_votes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."poll_votes"
    ADD CONSTRAINT "poll_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."saved_posts"
    ADD CONSTRAINT "saved_posts_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."saved_posts"
    ADD CONSTRAINT "saved_posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."unified_reports"
    ADD CONSTRAINT "unified_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_reports"
    ADD CONSTRAINT "user_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_reports"
    ADD CONSTRAINT "user_reports_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



CREATE POLICY "Activities are viewable by everyone" ON "public"."activities" FOR SELECT USING (true);



CREATE POLICY "Admins can view feedback" ON "public"."feedback" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Anon posts are viewable by everyone" ON "public"."anon_posts" FOR SELECT USING (true);



CREATE POLICY "Auth Create Options" ON "public"."poll_options" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Auth Vote" ON "public"."poll_votes" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Auth users can comment" ON "public"."comments" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Auth users can delete own comment" ON "public"."comments" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Auth users can follow" ON "public"."follows" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "follower_id"));



CREATE POLICY "Auth users can like" ON "public"."likes" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Auth users can like comments" ON "public"."comment_likes" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Auth users can unfollow" ON "public"."follows" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "follower_id"));



CREATE POLICY "Auth users can unlike" ON "public"."likes" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Auth users can unlike comments" ON "public"."comment_likes" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Authenticated users can create requests" ON "public"."activity_requests" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Clubs can create activities" ON "public"."activities" FOR INSERT WITH CHECK ((("auth"."uid"() = "organizer_id") AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND (("profiles"."role" = 'club'::"text") OR ("profiles"."role" = 'organization'::"text") OR ("profiles"."role" = 'admin'::"text")))))));



CREATE POLICY "Enable insert for users based on user_id" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Enable read access for all users" ON "public"."anon_posts" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "Enable update for users based on user_id" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Everyone can read comments" ON "public"."comments" FOR SELECT USING (true);



CREATE POLICY "Everyone can read posts" ON "public"."posts" FOR SELECT USING (true);



CREATE POLICY "Everyone can view activities" ON "public"."activities" FOR SELECT USING (true);



CREATE POLICY "Organizers can delete own activities" ON "public"."activities" FOR DELETE USING (("auth"."uid"() = "organizer_id"));



CREATE POLICY "Organizers can delete their activities" ON "public"."activities" FOR DELETE USING (("auth"."uid"() = "organizer_id"));



CREATE POLICY "Organizers can read requests for their events" ON "public"."activity_requests" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."activities"
  WHERE (("activities"."id" = "activity_requests"."activity_id") AND ("activities"."organizer_id" = "auth"."uid"())))));



CREATE POLICY "Organizers can update own activities" ON "public"."activities" FOR UPDATE USING (("auth"."uid"() = "organizer_id"));



CREATE POLICY "Organizers can update requests" ON "public"."activity_requests" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."activities"
  WHERE (("activities"."id" = "activity_requests"."activity_id") AND ("activities"."organizer_id" = "auth"."uid"())))));



CREATE POLICY "Organizers can update their activities" ON "public"."activities" FOR UPDATE USING (("auth"."uid"() = "organizer_id"));



CREATE POLICY "Organizers can view requests for their activities" ON "public"."activity_requests" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."activities"
  WHERE (("activities"."id" = "activity_requests"."activity_id") AND ("activities"."organizer_id" = "auth"."uid"())))));



CREATE POLICY "Public Read Options" ON "public"."poll_options" FOR SELECT USING (true);



CREATE POLICY "Public Read Votes" ON "public"."poll_votes" FOR SELECT USING (true);



CREATE POLICY "Public comment likes viewable" ON "public"."comment_likes" FOR SELECT USING (true);



CREATE POLICY "Public comments viewable" ON "public"."comments" FOR SELECT USING (true);



CREATE POLICY "Public follows viewable" ON "public"."follows" FOR SELECT USING (true);



CREATE POLICY "Public identities viewable" ON "public"."anon_identities" FOR SELECT USING (true);



CREATE POLICY "Public interactions viewable (comments)" ON "public"."comments" FOR SELECT USING (true);



CREATE POLICY "Public interactions viewable (likes)" ON "public"."likes" FOR SELECT USING (true);



CREATE POLICY "Public posts are viewable by everyone." ON "public"."posts" FOR SELECT USING (true);



CREATE POLICY "Public view likes" ON "public"."activity_likes" FOR SELECT USING (true);



CREATE POLICY "Users can cancel own requests" ON "public"."activity_requests" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create activities" ON "public"."activities" FOR INSERT WITH CHECK (("auth"."uid"() = "organizer_id"));



CREATE POLICY "Users can create comments" ON "public"."comments" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create message reports" ON "public"."message_reports" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "reporter_id"));



CREATE POLICY "Users can create reports" ON "public"."reports" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "reporter_id"));



CREATE POLICY "Users can create requests" ON "public"."activity_requests" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own posts" ON "public"."posts" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create user reports" ON "public"."user_reports" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "reporter_id"));



CREATE POLICY "Users can delete own anon comments" ON "public"."comments" FOR DELETE USING (("anon_identity_id" IN ( SELECT "anon_identities"."id"
   FROM "public"."anon_identities"
  WHERE ("anon_identities"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can delete own anon posts" ON "public"."anon_posts" FOR DELETE USING (("identity_id" IN ( SELECT "anon_identities"."id"
   FROM "public"."anon_identities"
  WHERE ("anon_identities"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can delete own participant rows" ON "public"."chat_participants" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own posts." ON "public"."posts" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can delete their own comments" ON "public"."comments" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own notifications" ON "public"."notifications" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own posts" ON "public"."posts" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own notifications" ON "public"."notifications" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert reports" ON "public"."unified_reports" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "reporter_id"));



CREATE POLICY "Users can insert their own feedback" ON "public"."feedback" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own posts." ON "public"."posts" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can like activities" ON "public"."activity_likes" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own blocks" ON "public"."blocks" USING (("auth"."uid"() = "blocker_id"));



CREATE POLICY "Users can read own requests" ON "public"."activity_requests" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can save posts" ON "public"."saved_posts" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can see own identity" ON "public"."anon_identities" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can see own saved posts" ON "public"."saved_posts" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can see own votes" ON "public"."anon_votes" FOR SELECT USING (("identity_id" IN ( SELECT "anon_identities"."id"
   FROM "public"."anon_identities"
  WHERE ("anon_identities"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can see their own notifications" ON "public"."notifications" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can unlike activities" ON "public"."activity_likes" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can unsave posts" ON "public"."saved_posts" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update own posts." ON "public"."posts" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update their own notifications (mark read)" ON "public"."notifications" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own posts" ON "public"."posts" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view blocks they are involved in" ON "public"."blocks" FOR SELECT USING ((("auth"."uid"() = "blocker_id") OR ("auth"."uid"() = "blocked_id")));



CREATE POLICY "Users can view own notifications" ON "public"."notifications" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own reports" ON "public"."reports" FOR SELECT USING (("auth"."uid"() = "reporter_id"));



CREATE POLICY "Users can view own reports" ON "public"."unified_reports" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "reporter_id"));



CREATE POLICY "Users can view own requests" ON "public"."activity_requests" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own user reports" ON "public"."user_reports" FOR SELECT USING (("auth"."uid"() = "reporter_id"));



ALTER TABLE "public"."activities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."activity_likes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."activity_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."anon_identities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."anon_posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."anon_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."anon_votes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."blocks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_participants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_rooms" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."comment_likes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."comments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "delete_messages" ON "public"."messages" FOR DELETE USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."feedback" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."follows" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "insert_messages" ON "public"."messages" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") AND "public"."is_room_participant"("room_id")));



CREATE POLICY "insert_participants" ON "public"."chat_participants" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."likes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."message_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."poll_options" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."poll_votes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."saved_posts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "select_messages" ON "public"."messages" FOR SELECT USING ("public"."is_room_participant"("room_id"));



CREATE POLICY "select_participants" ON "public"."chat_participants" FOR SELECT USING ("public"."is_room_participant"("room_id"));



ALTER TABLE "public"."unified_reports" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "update_messages" ON "public"."messages" FOR UPDATE USING ("public"."is_room_participant"("room_id"));



ALTER TABLE "public"."user_reports" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "view_my_rooms" ON "public"."chat_rooms" FOR SELECT USING ("public"."is_room_participant"("id"));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."anon_posts";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."chat_participants";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."chat_rooms";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."comments";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."likes";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."messages";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."notifications";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."create_anon_identity"("desired_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_anon_identity"("desired_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_anon_identity"("desired_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_anon_post"("content_text" "text", "badge_text" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_anon_post"("content_text" "text", "badge_text" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_anon_post"("content_text" "text", "badge_text" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_anon_reply"("target_post_id" "uuid", "content_text" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_anon_reply"("target_post_id" "uuid", "content_text" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_anon_reply"("target_post_id" "uuid", "content_text" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_anon_report"("target_post_id" "uuid", "reason_text" "text", "details_text" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_anon_report"("target_post_id" "uuid", "reason_text" "text", "details_text" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_anon_report"("target_post_id" "uuid", "reason_text" "text", "details_text" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_own_account"() TO "anon";
GRANT ALL ON FUNCTION "public"."delete_own_account"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_own_account"() TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_room_if_empty"() TO "anon";
GRANT ALL ON FUNCTION "public"."delete_room_if_empty"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_room_if_empty"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_active_flare_users"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_active_flare_users"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_active_flare_users"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_anon_identity"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_anon_identity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_anon_identity"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_or_create_dm_room"("other_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_or_create_dm_room"("other_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_or_create_dm_room"("other_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_trending_unrolled"("limit_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_trending_unrolled"("limit_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_trending_unrolled"("limit_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_unrolled_feed"("sort_type" "text", "limit_count" integer, "offset_count" integer, "filter_badge" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_unrolled_feed"("sort_type" "text", "limit_count" integer, "offset_count" integer, "filter_badge" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_unrolled_feed"("sort_type" "text", "limit_count" integer, "offset_count" integer, "filter_badge" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_stats"("target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_stats"("target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_stats"("target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_weekly_top_normal"("sort_category" "text", "limit_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_weekly_top_normal"("sort_category" "text", "limit_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_weekly_top_normal"("sort_category" "text", "limit_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_weekly_top_unrolled"("sort_category" "text", "limit_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_weekly_top_unrolled"("sort_category" "text", "limit_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_weekly_top_unrolled"("sort_category" "text", "limit_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_block_creation"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_block_creation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_block_creation"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_comment_like_notification"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_comment_like_notification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_comment_like_notification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_comment_mentions"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_comment_mentions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_comment_mentions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_follow_request"("requester_id" "uuid", "action" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."handle_follow_request"("requester_id" "uuid", "action" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_follow_request"("requester_id" "uuid", "action" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_activity_post"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_activity_post"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_activity_post"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_activity_request"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_activity_request"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_activity_request"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_anon_vote"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_anon_vote"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_anon_vote"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_comment"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_comment"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_comment"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_comment_fix"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_comment_fix"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_comment_fix"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_comment_unified"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_comment_unified"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_comment_unified"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_follow"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_follow"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_follow"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_like"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_like"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_like"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_message_notification"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_message_notification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_message_notification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_verified_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_verified_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_verified_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_vote"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_vote"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_vote"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_post_mentions"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_post_mentions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_post_mentions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_unfollow"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_unfollow"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_unfollow"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_unlike"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_unlike"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_unlike"() TO "service_role";



GRANT ALL ON FUNCTION "public"."hide_message"("target_message_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."hide_message"("target_message_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hide_message"("target_message_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_room_participant"("_room_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_room_participant"("_room_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_room_participant"("_room_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_activity_request"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_activity_request"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_activity_request"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_activity_request_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_activity_request_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_activity_request_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_activity_update"("p_activity_id" "uuid", "p_message" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."notify_activity_update"("p_activity_id" "uuid", "p_message" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_activity_update"("p_activity_id" "uuid", "p_message" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_inline_mentions"("p_content" "text", "p_actor_id" "uuid", "p_resource_id" "uuid", "p_target_type" "text", "p_ignore_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."notify_inline_mentions"("p_content" "text", "p_actor_id" "uuid", "p_resource_id" "uuid", "p_target_type" "text", "p_ignore_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_inline_mentions"("p_content" "text", "p_actor_id" "uuid", "p_resource_id" "uuid", "p_target_type" "text", "p_ignore_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."test_push_urls"() TO "anon";
GRANT ALL ON FUNCTION "public"."test_push_urls"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."test_push_urls"() TO "service_role";



GRANT ALL ON FUNCTION "public"."toggle_follow"("target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."toggle_follow"("target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."toggle_follow"("target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_delete_media"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_delete_media"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_delete_media"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_media_cleanup"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_media_cleanup"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_media_cleanup"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_push_notification"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_push_notification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_push_notification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_anon_post_reply_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_anon_post_reply_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_anon_post_reply_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_my_push_token"("token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_my_push_token"("token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_my_push_token"("token" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_karma"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_karma"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_karma"() TO "service_role";



GRANT ALL ON FUNCTION "public"."vote_on_anon_post"("p_id" "uuid", "v_type" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."vote_on_anon_post"("p_id" "uuid", "v_type" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vote_on_anon_post"("p_id" "uuid", "v_type" integer) TO "service_role";


















GRANT ALL ON TABLE "public"."activities" TO "anon";
GRANT ALL ON TABLE "public"."activities" TO "authenticated";
GRANT ALL ON TABLE "public"."activities" TO "service_role";



GRANT ALL ON TABLE "public"."activity_likes" TO "anon";
GRANT ALL ON TABLE "public"."activity_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_likes" TO "service_role";



GRANT ALL ON TABLE "public"."activity_requests" TO "anon";
GRANT ALL ON TABLE "public"."activity_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_requests" TO "service_role";



GRANT ALL ON TABLE "public"."anon_identities" TO "anon";
GRANT ALL ON TABLE "public"."anon_identities" TO "authenticated";
GRANT ALL ON TABLE "public"."anon_identities" TO "service_role";



GRANT ALL ON TABLE "public"."anon_posts" TO "anon";
GRANT ALL ON TABLE "public"."anon_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."anon_posts" TO "service_role";



GRANT ALL ON TABLE "public"."anon_reports" TO "anon";
GRANT ALL ON TABLE "public"."anon_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."anon_reports" TO "service_role";



GRANT ALL ON TABLE "public"."anon_votes" TO "anon";
GRANT ALL ON TABLE "public"."anon_votes" TO "authenticated";
GRANT ALL ON TABLE "public"."anon_votes" TO "service_role";



GRANT ALL ON TABLE "public"."blocks" TO "anon";
GRANT ALL ON TABLE "public"."blocks" TO "authenticated";
GRANT ALL ON TABLE "public"."blocks" TO "service_role";



GRANT ALL ON TABLE "public"."chat_participants" TO "anon";
GRANT ALL ON TABLE "public"."chat_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_participants" TO "service_role";



GRANT ALL ON TABLE "public"."chat_rooms" TO "anon";
GRANT ALL ON TABLE "public"."chat_rooms" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_rooms" TO "service_role";



GRANT ALL ON TABLE "public"."comment_likes" TO "anon";
GRANT ALL ON TABLE "public"."comment_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."comment_likes" TO "service_role";



GRANT ALL ON TABLE "public"."comments" TO "anon";
GRANT ALL ON TABLE "public"."comments" TO "authenticated";
GRANT ALL ON TABLE "public"."comments" TO "service_role";



GRANT ALL ON TABLE "public"."feedback" TO "anon";
GRANT ALL ON TABLE "public"."feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."feedback" TO "service_role";



GRANT ALL ON TABLE "public"."follows" TO "anon";
GRANT ALL ON TABLE "public"."follows" TO "authenticated";
GRANT ALL ON TABLE "public"."follows" TO "service_role";



GRANT ALL ON TABLE "public"."likes" TO "anon";
GRANT ALL ON TABLE "public"."likes" TO "authenticated";
GRANT ALL ON TABLE "public"."likes" TO "service_role";



GRANT ALL ON TABLE "public"."message_reports" TO "anon";
GRANT ALL ON TABLE "public"."message_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."message_reports" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."poll_options" TO "anon";
GRANT ALL ON TABLE "public"."poll_options" TO "authenticated";
GRANT ALL ON TABLE "public"."poll_options" TO "service_role";



GRANT ALL ON TABLE "public"."poll_votes" TO "anon";
GRANT ALL ON TABLE "public"."poll_votes" TO "authenticated";
GRANT ALL ON TABLE "public"."poll_votes" TO "service_role";



GRANT ALL ON TABLE "public"."posts" TO "anon";
GRANT ALL ON TABLE "public"."posts" TO "authenticated";
GRANT ALL ON TABLE "public"."posts" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."push_diagnostics" TO "anon";
GRANT ALL ON TABLE "public"."push_diagnostics" TO "authenticated";
GRANT ALL ON TABLE "public"."push_diagnostics" TO "service_role";



GRANT ALL ON TABLE "public"."reports" TO "anon";
GRANT ALL ON TABLE "public"."reports" TO "authenticated";
GRANT ALL ON TABLE "public"."reports" TO "service_role";



GRANT ALL ON TABLE "public"."saved_posts" TO "anon";
GRANT ALL ON TABLE "public"."saved_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."saved_posts" TO "service_role";



GRANT ALL ON TABLE "public"."unified_reports" TO "anon";
GRANT ALL ON TABLE "public"."unified_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."unified_reports" TO "service_role";



GRANT ALL ON TABLE "public"."user_reports" TO "anon";
GRANT ALL ON TABLE "public"."user_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."user_reports" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































