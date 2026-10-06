import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Text, View, StyleSheet, Image, ActivityIndicator, TouchableOpacity, Dimensions, NativeSyntheticEvent, NativeScrollEvent, Alert, RefreshControl, Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import { PostCard, PostProps } from '../../components/PostCard';
import { ReplyCard, ReplyProps } from '../../components/ReplyCard';
import { CustomActionSheet, ActionSheetOption } from '../../components/CustomActionSheet';
import { ReportModal } from '../../components/ReportModal';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useChatStore } from '../../stores/chatStore';
import { useVideoStateStore } from '../../stores/videoStateStore';
import { Avatar } from '../../components/Avatar';

import { UserBadges } from '../../components/UserBadges';

const { width } = Dimensions.get('window');

type TabType = 'posts' | 'rollback';
const TABS: TabType[] = ['posts', 'rollback'];

import { FullScreenImageViewer } from '../../components/FullScreenImageViewer';

const PublicProfileHeader = ({ profile, stats, isFollowing, isPending, onToggleFollow, router, onLayout, currentUser, onShowMenu, onMessagePress, onImagePress }: any) => (
    <View onLayout={onLayout}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()}>
                <FontAwesome5 name="arrow-left" size={20} color={Colors.dark.text} />
            </TouchableOpacity>

            <View style={{ alignItems: 'center', flex: 1 }}>
                <Text style={styles.headerUsername}>@{profile?.username}</Text>
            </View>

            <TouchableOpacity style={{ width: 24 }} onPress={onShowMenu}>
                <MaterialCommunityIcons name="dots-horizontal" size={24} color={Colors.dark.text} />
            </TouchableOpacity>
        </View>

        <View style={styles.heroContainer}>
            <TouchableOpacity style={styles.bannerContainer} onPress={() => profile?.bg_image_url && onImagePress(profile.bg_image_url)}>
                {profile?.bg_image_url ? (
                    <Image source={{ uri: profile.bg_image_url }} style={styles.bannerImage} resizeMode="cover" />
                ) : (
                    <View style={[styles.bannerImage, { backgroundColor: '#1A1A1A' }]} />
                )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.avatarContainer} onPress={() => profile?.avatar_url && onImagePress(profile.avatar_url)}>
                <Avatar
                    uri={profile?.avatar_url}
                    name={profile?.full_name || profile?.username}
                    size={102}
                    style={styles.avatarImage}
                />
            </TouchableOpacity>
        </View>

        <View style={styles.infoContainer}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Text style={styles.name}>{profile?.full_name}</Text>
                <UserBadges user={profile} size={18} />
            </View>

            {/* Major & Year */}
            {(profile?.major || profile?.year) && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <FontAwesome5 name="graduation-cap" size={12} color={Colors.dark.primary} />
                    <Text style={{ color: Colors.dark.textSecondary, fontSize: 14, fontWeight: '500' }}>
                        {[profile.major, profile.year].filter(Boolean).join(' • ')}
                    </Text>
                </View>
            )}

            {profile?.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

            {profile?.relationship_status && profile.relationship_status !== 'Hidden' && (
                <Text style={{ fontSize: 13, marginTop: 8 }}>
                    <Text style={{ color: '#6A7A8C', fontWeight: '600' }}>Status: </Text>
                    <Text style={{ color: '#8A9BAE', fontWeight: '500' }}>{profile.relationship_status}</Text>
                </Text>
            )}

            {/* Follow & Message Buttons */}
            {currentUser?.id !== profile?.id && (
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 15 }}>
                    <TouchableOpacity
                        style={[styles.followButton, (isFollowing || isPending) && styles.followingButton]}
                        onPress={onToggleFollow}
                    >
                        <Text style={[styles.followButtonText, (isFollowing || isPending) && styles.followingButtonText]}>
                            {isFollowing ? "Following" : (isPending ? "On Roll" : "Follow")}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.messageButton]}
                        onPress={onMessagePress}
                    >
                        <MaterialCommunityIcons name="message-outline" size={20} color="#FFF" />
                    </TouchableOpacity>
                </View>
            )}
        </View>

        <View style={styles.statsContainer}>
            <TouchableOpacity style={styles.statBox} onPress={() => router.push({ pathname: '/user-list', params: { userId: profile?.id, type: 'followers' } })}>
                <Text style={styles.statNumber}>{stats.followers}</Text>
                <Text style={styles.statLabel}>FOLLOWERS</Text>
            </TouchableOpacity>
            <View style={styles.statDivider} />
            <TouchableOpacity style={styles.statBox} onPress={() => router.push({ pathname: '/user-list', params: { userId: profile?.id, type: 'following' } })}>
                <Text style={styles.statNumber}>{stats.following}</Text>
                <Text style={styles.statLabel}>FOLLOWING</Text>
            </TouchableOpacity>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
                <Text style={styles.statNumber}>{profile?.karma || 0}</Text>
                <Text style={styles.statLabel}>KARMA</Text>
            </View>
        </View>
    </View>
);

const ProfileTabs = ({ activeTab, onTabPress, style }: { activeTab: TabType, onTabPress: (t: TabType) => void, style?: any }) => (
    <View style={[styles.tabsContainer, style]}>
        <TouchableOpacity onPress={() => onTabPress('posts')} style={[styles.tabItem, activeTab === 'posts' && styles.activeTab]}>
            <MaterialCommunityIcons name="grid" size={24} color={activeTab === 'posts' ? Colors.dark.primary : Colors.dark.textSecondary} />
            <Text style={[styles.tabLabel, activeTab === 'posts' && { color: Colors.dark.primary }]}>POSTS</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onTabPress('rollback')} style={[styles.tabItem, activeTab === 'rollback' && styles.activeTab]}>
            <MaterialCommunityIcons name="history" size={24} color={activeTab === 'rollback' ? Colors.dark.primary : Colors.dark.textSecondary} />
            <Text style={[styles.tabLabel, activeTab === 'rollback' && { color: Colors.dark.primary }]}>ROLLBACK</Text>
        </TouchableOpacity>
    </View>
);



export default function PublicProfileScreen() {
    const { id: idParam } = useLocalSearchParams();
    const id = Array.isArray(idParam) ? idParam[0] : idParam;
    const router = useRouter();
    const { user: currentUser } = useAuth();
    const insets = useSafeAreaInsets();
    const startNewChat = useChatStore((state) => state.startNewChat);

    const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);

    useEffect(() => {
        if (!id) router.back();
        if (currentUser && id === currentUser.id) {
            router.push('/profile');
        }
    }, [id, currentUser]);

    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ followers: 0, following: 0 });
    const [isFollowing, setIsFollowing] = useState(false);
    const [isPending, setIsPending] = useState(false);

    const [activeTab, setActiveTab] = useState<TabType>('posts');
    const [userPosts, setUserPosts] = useState<PostProps[]>([]);
    const [userReplies, setUserReplies] = useState<ReplyProps[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    const [headerHeight, setHeaderHeight] = useState(0);
    const [isSticky, setIsSticky] = useState(false);

    // Menu States
    const [actionSheetVisible, setActionSheetVisible] = useState(false);
    const [actionSheetOptions, setActionSheetOptions] = useState<ActionSheetOption[]>([]);
    const [selectedPost, setSelectedPost] = useState<PostProps | null>(null);
    const [sheetTitle, setSheetTitle] = useState("");

    // Report Logic
    const [reportModalVisible, setReportModalVisible] = useState(false);
    const [reportTarget, setReportTarget] = useState<'post' | 'user' | 'reply'>('post');

    // Video Auto-Play Logic
    const setActiveVideoId = useVideoStateStore(s => s.setActiveVideoId);

    const viewabilityConfigCallbackPairs = useRef([
        {
            viewabilityConfig: {
                itemVisiblePercentThreshold: 40,
                minimumViewTime: 100,
            },
            onViewableItemsChanged: ({ viewableItems }: any) => {
                if (viewableItems && viewableItems.length > 0) {
                    const videoItem = viewableItems.find((v: any) => v.item?.media_type === 'video');
                    if (videoItem) {
                        setActiveVideoId(videoItem.item.id);
                    } else {
                        setActiveVideoId(null);
                    }
                }
            }
        }
    ]).current;

    // Track Screen Focus
    const isFocused = useIsFocused();

    useEffect(() => {
        if (id) {
            fetchData();
        }
    }, [id, currentUser]);

    useEffect(() => {
        if (loading) return; // Wait for profile/status to load
        if (activeTab === 'posts') fetchUserPosts();
        if (activeTab === 'rollback') fetchUserReplies();
    }, [activeTab, id, loading, isFollowing]);

    const fetchData = async () => {
        const fetchedProfile = await fetchProfile();
        if (fetchedProfile) {
            await Promise.all([
                getStats(fetchedProfile.id),
                checkFollowStatus(fetchedProfile.id)
            ]);
        }
        setLoading(false);
    };

    const fetchProfile = async () => {
        try {
            // Check if ID is a valid UUID
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            const isUuid = uuidRegex.test(id);

            let query = supabase.from('profiles').select('*');

            if (isUuid) {
                query = query.eq('id', id);
            } else {
                // If not UUID, it's a username slug
                query = query.eq('username', id);
            }

            const { data, error } = await query.single();

            if (error) {
                console.error("Profile fetch error:", error);
                return null;
            }
            setProfile(data);

            // If we navigated via username, update the local ID to the real UUID 
            // so subsequent post/rollback fetches work correctly.
            if (!isUuid && data?.id) {
                // This will trigger the useEffect dependent on 'id' if we were to change state,
                // but since we fetched data already, we just need to ensure 'id' ref is updated or used.
                // Actually, the useEffect [id] already handles it.
            }
            return data;
        } catch (e) {
            console.error(e);
            return null;
        }
    };

    // [UPDATED] Use RPC or standard count (since we reverted privacy, standard count is fine, but RPC is robust)
    const getStats = async (userId: string) => {
        try {
            const { data, error } = await supabase.rpc('get_user_stats', { target_user_id: userId });
            if (error) throw error;
            if (data) {
                setStats({
                    followers: data.followers_count || 0,
                    following: data.following_count || 0,
                });
            }
        } catch (e) { console.error(e); }
    };

    const checkFollowStatus = async (userId: string) => {
        if (!currentUser) return;
        const { data } = await supabase.from('follows').select('status').eq('follower_id', currentUser.id).eq('following_id', userId).single();
        setIsFollowing(data?.status === 'accepted');
    };

    const handleToggleFollow = async () => {
        if (!currentUser || !profile) return;

        // Optimistic Update
        const previousStatus = isFollowing;
        const previousFollowers = stats.followers;
        const newStatus = !isFollowing;

        // Apply Optimistic State
        setIsFollowing(newStatus);
        setStats(prev => ({
            ...prev,
            followers: newStatus ? prev.followers + 1 : Math.max(0, prev.followers - 1)
        }));

        // [NEW] Update Global Store for Search/Feed Sync
        try {
            const { toggleFollowing } = require('../../stores/userStore').useUserStore.getState();
            toggleFollowing(profile.id);
        } catch (e) { }


        try {
            // Call RPC
            const { data: status, error } = await supabase.rpc('toggle_follow', { target_user_id: profile.id });
            if (error) throw error;

            // Sync with server response
            // If server says 'following', then newStatus should be true.
            const serverSaysFollowing = status === 'following';

            // Only update if mismatch (rare)
            if (serverSaysFollowing !== newStatus) {
                setIsFollowing(serverSaysFollowing);
                // Re-sync global store if mismatch
                try {
                    const { toggleFollowing } = require('../../stores/userStore').useUserStore.getState();
                    toggleFollowing(profile.id);
                } catch (e) { }
            }
        } catch (error) {
            console.error("Follow error:", error);
            Alert.alert("Error", "Could not follow user.");

            // Revert Optimistic Update
            setIsFollowing(previousStatus);
            setStats(prev => ({ ...prev, followers: previousFollowers }));
            // Revert Global Store
            try {
                const { toggleFollowing } = require('../../stores/userStore').useUserStore.getState();
                toggleFollowing(profile.id);
            } catch (e) { }
        }
    };

    const fetchUserPosts = async () => {
        if (!profile) return;
        try {
            const { data, error } = await supabase
                .from('posts')
                .select(`*, profile:profiles!posts_user_id_fkey(username, full_name, avatar_url), likes_count:likes(count), comments_count:comments(count)`)
                .eq('user_id', profile.id)
                .order('is_pinned', { ascending: false })
                .order('created_at', { ascending: false });

            if (error) throw error;
            const formattedPosts = await enrichPosts(data);
            setUserPosts(formattedPosts as any);
        } catch (e) { console.error(e); }
    };

    const handleTabChange = (direction: 'left' | 'right') => {
        const currentIndex = TABS.indexOf(activeTab);
        let newIndex = currentIndex;
        if (direction === 'left') newIndex = Math.min(currentIndex + 1, TABS.length - 1);
        else newIndex = Math.max(currentIndex - 1, 0);
        if (newIndex !== currentIndex) runOnJS(setActiveTab)(TABS[newIndex]);
    };

    const panGesture = Gesture.Pan()
        .activeOffsetX([-20, 20]).failOffsetY([-20, 20])
        .onEnd((e) => {
            if (e.translationX < -50) runOnJS(handleTabChange)('left');
            else if (e.translationX > 50) runOnJS(handleTabChange)('right');
        });

    const fetchUserReplies = async () => {
        if (!profile) return;
        try {
            const { data, error } = await supabase
                .from('comments')
                .select(`id, content, created_at, post:posts(id, user:profiles!posts_user_id_fkey(username, full_name, avatar_url)), comment_likes(count)`)
                .eq('user_id', profile.id)
                .is('anon_post_id', null) // [FIX] Hide replies to anonymous posts
                .order('created_at', { ascending: false });

            if (error) throw error;
            const formattedReplies: ReplyProps[] = data?.map((item: any) => ({
                id: item.id,
                content: item.content,
                created_at: item.created_at,
                user: {
                    id: profile?.id || (id as string),
                    username: profile?.username || 'user',
                    full_name: profile?.full_name || 'User',
                    avatar_url: profile?.avatar_url || '',
                    is_verified: profile?.is_verified,
                    is_admin: profile?.is_admin,
                    is_og: profile?.is_og
                },
                parent_post: item.post ? { id: item.post.id, user: { username: item.post.user?.username || 'unknown' } } : undefined,
                likes_count: item.comment_likes?.[0]?.count || 0,
                replies_count: 0,
                has_liked: false
            })) || [];
            setUserReplies(formattedReplies);
        } catch (e) { console.error(e); }
    };

    const enrichPosts = async (posts: any[]) => {
        if (!posts || posts.length === 0) return [];
        const postIds = posts.map(p => p.id);
        let myLikes: string[] = [];
        let mySaved: string[] = [];

        if (postIds.length > 0 && currentUser) {
            const { data: likesData } = await supabase.from('likes').select('post_id').eq('user_id', currentUser.id).in('post_id', postIds);
            if (likesData) myLikes = likesData.map(l => l.post_id);

            const { data: savedData } = await supabase.from('saved_posts').select('post_id').eq('user_id', currentUser.id).in('post_id', postIds);
            if (savedData) mySaved = savedData.map(s => s.post_id);
        }

        return posts.map(post => ({
            ...post,
            likes_count: post.likes_count?.[0]?.count || 0,
            comments_count: post.comments_count?.[0]?.count || 0,
            has_liked: myLikes.includes(post.id),
            has_saved: mySaved.includes(post.id)
        }));
    };

    const onRefresh = async () => {
        setRefreshing(true);
        const fetchedProfile = await fetchProfile();
        if (fetchedProfile) {
            await Promise.all([
                getStats(fetchedProfile.id),
                checkFollowStatus(fetchedProfile.id),
                activeTab === 'posts' ? fetchUserPosts() : fetchUserReplies()
            ]);
        }
        setRefreshing(false);
    };

    const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const y = event.nativeEvent.contentOffset.y;
        if (y >= headerHeight && !isSticky) setIsSticky(true);
        else if (y < headerHeight && isSticky) setIsSticky(false);
    };

    const activeData = activeTab === 'posts' ? userPosts : userReplies;
    const listData = [
        { id: 'profile-header', type: 'header' },
        { id: 'tabs-header', type: 'tabs' },
        ...activeData
    ];

    if (activeData.length === 0 && !loading) {
        listData.push({ id: 'empty-state', type: 'empty' });
    }

    const firstPostIndex = useMemo(() => listData.findIndex((d: any) => d.id !== 'header' && d.id !== 'tabs' && d.id !== 'empty'), [listData]);

    // --- Action Sheet & Reporting ---

    const handleShowOptions = (item: any = null, type: 'post' | 'reply' | 'header' = 'post') => {
        if (type === 'header') {
            // ... existing header logic (unchanged essentially, just verifying flow)
            handleHeaderOptions();
            return;
        }

        setSelectedPost(item); // We reuse selectedPost state for both query
        setSheetTitle("");

        const options: ActionSheetOption[] = [];

        if (item) {
            options.push(
                {
                    label: 'Share / Copy Link',
                    icon: 'share-variant-outline',
                    onPress: async () => {
                        // Share logic
                        try {
                            // If reply, maybe share parent post? Or deep link to reply?
                            // For now, share profile or parent post if reply
                            const url = type === 'reply'
                                ? `https://therolledapp.com/post/${item.parent_post?.id}`
                                : `https://therolledapp.com/post/${item.id}`;

                            await Share.share({
                                message: `Check out this ${type}: ${url}`,
                                url: url,
                            });
                        } catch (error: any) { Alert.alert("Error", error.message); }
                    }
                },
                {
                    label: 'Report User',
                    icon: 'account-alert-outline',
                    isDestructive: true,
                    onPress: () => {
                        setTimeout(() => {
                            setReportTarget('user');
                            setReportModalVisible(true);
                        }, 300);
                    }
                },
                {
                    label: 'Block User',
                    icon: 'account-cancel-outline',
                    isDestructive: true,
                    onPress: () => confirmBlockUser()
                },
                {
                    label: `Report ${type === 'reply' ? 'Reply' : 'Post'}`,
                    icon: 'flag-outline',
                    isDestructive: true,
                    onPress: () => {
                        setTimeout(() => {
                            setReportTarget(type);
                            setReportModalVisible(true);
                        }, 300);
                    }
                }
            );
        }

        setActionSheetOptions(options);
        setActionSheetVisible(true);
    };

    const handleHeaderOptions = () => {
        const options: ActionSheetOption[] = [
            {
                label: 'Report User',
                icon: 'account-alert-outline',
                isDestructive: true,
                onPress: () => {
                    setTimeout(() => {
                        setReportTarget('user');
                        setReportModalVisible(true);
                    }, 300);
                }
            },
            {
                label: 'Block User',
                icon: 'account-cancel-outline',
                isDestructive: true,
                onPress: () => confirmBlockUser()
            }
        ];
        setActionSheetOptions(options);
        setActionSheetVisible(true);
    };

    // Check if BLOCKED (Using direct selectors for immediate re-render)
    // We use profile?.id here to ensure we check against the UUID, not the slug.
    const isUserBlocked = useChatStore(s => profile?.id ? s.blockedUserIds.includes(profile.id) : false);
    const haveIBlockedThem = useChatStore(s => profile?.id ? s.usersIBlocked.includes(profile.id) : false);

    const blockUser = useChatStore(s => s.blockUser);
    const unblockUser = useChatStore(s => s.unblockUser);

    const onShowMenu = () => {
        const options: ActionSheetOption[] = [
            {
                label: 'Report User',
                icon: 'flag-outline',
                isDestructive: true,
                onPress: () => setReportModalVisible(true)
            },
            {
                label: isUserBlocked ? 'Unblock User' : 'Block User',
                icon: 'block-helper',
                isDestructive: true,
                onPress: handleToggleBlock
            },
            { label: 'Cancel', icon: 'close', onPress: () => { } }
        ];
        // ... (show sheet) implementation depends on ref, but logic is here
        // If CustomActionSheet uses a ref, pass options there.
        // Assuming we update the 'options' state or similar if using a controlled sheet
        // Since CustomActionSheet usually takes props, we might need a state for options.
        // Wait, looking at the file (line 13 import), let's see how it's used.
        setActionSheetOptions(options); // Assume we add this state
        setActionSheetVisible(true);
    };

    const handleToggleBlock = async () => {
        if (!profile?.id) return;
        setActionSheetVisible(false);
        if (isUserBlocked) {
            Alert.alert("Unblock User", "Are you sure you want to unblock this user?", [
                { text: "Cancel", style: "cancel" },
                { text: "Unblock", onPress: () => unblockUser(profile.id) }
            ]);
        } else {
            Alert.alert("Block User", "They won't be able to message you or see your posts. You can unblock them anytime from Settings.", [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Block", style: 'destructive', onPress: () => {
                        blockUser(profile.id);
                    }
                }
            ]);
        }
    };


    // Generic block confirmation from any post/reply trigger
    const confirmBlockUser = () => {
        setActionSheetVisible(false);
        handleToggleBlock();
    };

    const handleReportSubmit = async (reason: string, details: string) => {
        if (!currentUser) return;
        try {
            if (reportTarget === 'user') {
                const { error } = await supabase.from('user_reports').insert({
                    target_user_id: id,
                    reporter_id: currentUser.id,
                    reason,
                    details
                });
                if (error) throw error;
            } else {
                if (selectedPost) {
                    const { error } = await supabase.from('reports').insert({
                        post_id: selectedPost.id,
                        reporter_id: currentUser.id,
                        reason,
                        details
                    });
                    if (error) throw error;
                }
            }
        } catch (error: any) {
            Alert.alert("Error", error.message);
        }
    };

    const handleMessagePress = async () => {
        if (!profile?.id) return;
        try {
            if (!startNewChat) {
                Alert.alert("Error", "Chat service not initialized.");
                return;
            }
            const roomId = await startNewChat(profile.id);
            router.push(`/messages/${roomId}` as any);
        } catch (e: any) {
            Alert.alert("Error", `Could not start chat: ${e.message}`);
        }
    };

    // REPLACE renderItem entirely to be safe
    const renderItem = useCallback(({ item, index }: any) => {
        if (item.type === 'header') {
            return (
                <PublicProfileHeader
                    profile={profile}
                    stats={stats}
                    isFollowing={isFollowing}
                    isPending={false} // Always false
                    onToggleFollow={handleToggleFollow}
                    router={router}
                    currentUser={currentUser}
                    onLayout={(e: any) => setHeaderHeight(e.nativeEvent.layout.height)}
                    onShowMenu={() => handleShowOptions(null, 'header')}
                    onMessagePress={handleMessagePress}
                    onImagePress={setFullScreenImage}
                />
            );
        }
        if (item.type === 'tabs') return <ProfileTabs activeTab={activeTab} onTabPress={setActiveTab} />;

        if (item.type === 'empty') {
            return (
                <View style={{ alignItems: 'center', marginTop: 60, paddingHorizontal: 20 }}>
                    <Text style={[styles.emptyText, { textAlign: 'center' }]}>
                        {activeTab === 'posts' ? "you have no posts" : "you haven't rollback to any post"}
                    </Text>
                </View>
            );
        }

        if (activeTab === 'rollback' && item.type !== 'tabs') {
            return <ReplyCard reply={item} onLike={() => { }} onReply={() => { }} onShare={() => { }} onShowOptions={() => handleShowOptions(item, 'reply')} />;
        }

        return (
            <PostCard
                post={item as PostProps}
                isFirstPost={index === firstPostIndex}
                onShare={() => handleShare(item)}
                onShowOptions={() => handleShowOptions(item)}
                isScreenFocused={isFocused}
            />
        );
    }, [profile, stats, isFollowing, activeTab, userPosts, userReplies, headerHeight, isSticky, isFocused]);

    if (loading) {
        return (
            <ScreenWrapper>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator color={Colors.dark.primary} />
                </View>
            </ScreenWrapper>
        );
    }

    if (!profile) {
        return (
            <ScreenWrapper>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()}>
                        <FontAwesome5 name="arrow-left" size={20} color={Colors.dark.text} />
                    </TouchableOpacity>
                </View>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 }}>
                    <MaterialCommunityIcons name="account-remove-outline" size={64} color="#666" />
                    <Text style={{ color: '#999', fontSize: 16 }}>User Not Found</Text>
                    <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20, backgroundColor: '#222', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 }}>
                        <Text style={{ color: '#fff' }}>Go Back</Text>
                    </TouchableOpacity>
                </View>
            </ScreenWrapper>
        );
    }

    if (isUserBlocked) {
        return (
            <ScreenWrapper>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()}>
                        <FontAwesome5 name="arrow-left" size={20} color={Colors.dark.text} />
                    </TouchableOpacity>
                    <View style={{ alignItems: 'center', flex: 1 }}>
                        <Text style={styles.headerUsername}>User Unavailable</Text>
                    </View>
                    {/* Only show menu if I blocked them (to allow unblocking) */}
                    {haveIBlockedThem && (
                        <TouchableOpacity style={{ width: 24 }} onPress={onShowMenu}>
                            <MaterialCommunityIcons name="dots-horizontal" size={24} color={Colors.dark.text} />
                        </TouchableOpacity>
                    )}
                </View>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 }}>
                    <MaterialCommunityIcons name="block-helper" size={64} color="#666" />
                    <Text style={{ color: '#999', fontSize: 16 }}>
                        {haveIBlockedThem ? "You have blocked this user." : "User is unavailable."}
                    </Text>

                    {haveIBlockedThem ? (
                        <TouchableOpacity style={{ marginTop: 20, paddingHorizontal: 25, paddingVertical: 12, backgroundColor: Colors.dark.primary, borderRadius: 25 }} onPress={handleToggleBlock}>
                            <Text style={{ color: 'black', fontWeight: 'bold' }}>Unblock User</Text>
                        </TouchableOpacity>
                    ) : (
                        <Text style={{ color: '#666', fontSize: 14, textAlign: 'center', paddingHorizontal: 40, marginTop: 10 }}>
                            You cannot view this profile because one of you has blocked the other.
                        </Text>
                    )}
                </View>
                <CustomActionSheet
                    visible={actionSheetVisible}
                    onClose={() => setActionSheetVisible(false)}
                    options={actionSheetOptions}
                />
            </ScreenWrapper>
        );
    }

    return (
        <ScreenWrapper style={{ paddingHorizontal: 0 }}>
            {isSticky && (
                <View style={{ position: 'absolute', top: insets.top, left: 0, right: 0, zIndex: 1000, elevation: 10 }}>
                    <ProfileTabs activeTab={activeTab} onTabPress={setActiveTab} />
                </View>
            )}
            <GestureDetector gesture={panGesture}>
                <FlashList
                    data={listData}
                    extraData={isFocused}
                    viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs}
                    renderItem={renderItem}
                    keyExtractor={(item: any) => item.id}
                    // @ts-ignore
                    estimatedItemSize={200}
                    getItemType={(item: any) => {
                        if (item.type === 'header') return 'header';
                        if (item.type === 'tabs') return 'tabs';
                        if (item.type === 'empty') return 'empty';
                        return 'post';
                    }}
                    onScroll={handleScroll}
                    scrollEventThrottle={16}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.dark.primary} />}
                    contentContainerStyle={{ paddingBottom: 50, minHeight: Dimensions.get('window').height + 300 }}
                />
            </GestureDetector>

            <CustomActionSheet
                visible={actionSheetVisible}
                onClose={() => setActionSheetVisible(false)}
                options={actionSheetOptions}
                title={sheetTitle}
            />

            <ReportModal
                visible={reportModalVisible}
                onClose={() => setReportModalVisible(false)}
                targetType={reportTarget}
                targetId={reportTarget === 'user' ? (Array.isArray(id) ? id[0] : id) : selectedPost?.id}
            />

            {/* FULL SCREEN IMAGE VIEWER */}
            <FullScreenImageViewer
                visible={!!fullScreenImage}
                imageUrl={fullScreenImage || ''}
                onClose={() => setFullScreenImage(null)}
            />
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 10, // Minimal padding for back button
        paddingVertical: 10,
        backgroundColor: Colors.dark.background,
    },
    headerUsername: { color: Colors.dark.primary, fontSize: 16, fontWeight: 'bold' },
    heroContainer: { alignItems: 'center', marginBottom: 60 },
    bannerContainer: { width: '100%', height: 200 },
    bannerImage: { width: width, height: 200 },
    avatarContainer: {
        position: 'absolute', bottom: -50,
        width: 110, height: 110, borderRadius: 55,
        borderWidth: 4, borderColor: Colors.dark.background,
        backgroundColor: Colors.dark.background,
        justifyContent: 'center', alignItems: 'center',
    },
    avatarImage: { width: 102, height: 102, borderRadius: 51 },
    infoContainer: { alignItems: 'center', paddingHorizontal: 0 }, // Full width
    name: { fontSize: 24, fontWeight: 'bold', color: Colors.dark.text, marginBottom: 4 },
    bio: { color: Colors.dark.text, fontSize: 16, textAlign: 'center', lineHeight: 22, marginTop: 4, paddingHorizontal: 10 }, // Bio needs some padding for reading
    emptyText: { color: '#666', fontSize: 16, fontStyle: 'italic' },

    followButton: {
        backgroundColor: Colors.dark.primary,
        paddingHorizontal: 30,
        paddingVertical: 10,
        borderRadius: 25,
        minWidth: 120,
        alignItems: 'center',
    },
    messageButton: {
        backgroundColor: '#333',
        width: 44, // Circle or Pill? Let's go Pill/Icon box
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#444'
    },
    followingButton: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: '#666',
    },
    followButtonText: { color: '#000', fontWeight: 'bold', fontSize: 14 },
    followingButtonText: { color: Colors.dark.text },

    statsContainer: {
        flexDirection: 'row', backgroundColor: '#111',
        marginHorizontal: 0, marginTop: 24, marginBottom: 20, // Full width stats
        borderRadius: 0, paddingVertical: 16, borderWidth: 1, borderColor: '#222', borderLeftWidth: 0, borderRightWidth: 0
    },
    statBox: { flex: 1, alignItems: 'center' },
    statNumber: { fontSize: 20, fontWeight: 'bold', color: Colors.dark.text },
    statLabel: { fontSize: 10, color: Colors.dark.textSecondary, marginTop: 4, letterSpacing: 1 },
    statDivider: { width: 1, backgroundColor: '#333' },

    tabsContainer: {
        flexDirection: 'row', height: 65,
        borderBottomWidth: 1, borderBottomColor: '#222',
        paddingBottom: 10, paddingTop: 10, justifyContent: 'space-around',
        backgroundColor: Colors.dark.background,
    },
    tabItem: { alignItems: 'center', gap: 4, minWidth: 60 },
    activeTab: { borderBottomColor: Colors.dark.primary },
    tabLabel: { fontSize: 10, fontWeight: 'bold', color: Colors.dark.textSecondary },

    // Privacy Lock Overlay
    cameraOverlay: {
        position: 'absolute',
        top: 350, // Default fallback
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'flex-start',
        alignItems: 'center',
        paddingTop: 50,
        zIndex: 10,
    },
    lockContainer: {
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.8)',
        paddingVertical: 20,
        paddingHorizontal: 30,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#333',
    },
    lockTitle: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
        marginTop: 10,
    },
    lockSubtitle: {
        color: Colors.dark.textSecondary,
        fontSize: 14,
        marginTop: 4,
    },
    // STATIC LOCK STYLES
    lockContainerStatic: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 100, // Generous padding to center it visually in empty space
        backgroundColor: Colors.dark.background,
    },
    lockTitleStatic: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
        marginTop: 16,
    },
    lockSubtitleStatic: {
        color: Colors.dark.textSecondary,
        fontSize: 14,
        marginTop: 6,
    }
});
