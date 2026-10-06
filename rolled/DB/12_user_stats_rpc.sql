    -- RPC to get user stats securely (bypassing RLS for counts)
    CREATE OR REPLACE FUNCTION public.get_user_stats(target_user_id UUID)
    RETURNS JSONB
    LANGUAGE plpgsql
    SECURITY DEFINER
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
