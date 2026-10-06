import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useVideoStateStore } from '../../stores/videoStateStore';
import { FlashList } from '@shopify/flash-list';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState, useEffect, useMemo } from 'react';
import { ActivityIndicator, Alert, DeviceEventEmitter, Dimensions, Image, NativeScrollEvent, NativeSyntheticEvent, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { Avatar } from '../../components/Avatar';
import { CustomActionSheet } from '../../components/CustomActionSheet';
import { PostCard, PostProps } from '../../components/PostCard';
import { ReplyCard, ReplyProps } from '../../components/ReplyCard';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { ShareContent, ShareModal } from '../../components/ShareModal';
import { UserBadges } from '../../components/UserBadges'; // [NEW]
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { useUserStore } from '../../stores/userStore';

import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

type TabType = 'posts' | 'rollback' | 'liked' | 'saved' | 'events';
const TABS: TabType[] = ['posts', 'rollback', 'events', 'liked', 'saved'];

const ProfileHeader = ({ profile, stats, router, onLayout, onCreatePress }: any) => (
    <View onLayout={onLayout}>
        <View style={styles.header}>
            <TouchableOpacity onPress={() => router.push('/settings')}>
                <FontAwesome5 name="cog" size={24} color={Colors.dark.text} />
            </TouchableOpacity>
            <View style={{ alignItems: 'center' }}>
                <Text style={styles.headerUsername}>@{profile?.username}</Text>
            </View>
            <TouchableOpacity style={styles.addButton} onPress={onCreatePress}>
                <FontAwesome5 name="plus" size={16} color="#000" />
            </TouchableOpacity>
        </View>

        <View style={styles.heroContainer}>
            <TouchableOpacity style={styles.bannerContainer} onPress={() => router.push('/edit-profile')}>
                {profile?.bg_image_url ? (
                    <Image source={{ uri: profile.bg_image_url }} style={styles.bannerImage} resizeMode="cover" />
                ) : (
                    <View style={[styles.bannerImage, { backgroundColor: '#1A1A1A' }]} />
                )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.avatarContainer} onPress={() => router.push('/edit-profile')}>
                <Avatar
                    uri={profile?.avatar_url}
                    name={profile?.full_name}
                    size={100}
                    style={styles.avatarImage}
                />
            </TouchableOpacity>
        </View>

        <View style={styles.infoContainer}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
                <Text style={styles.name}>{profile?.full_name}</Text>
                <UserBadges user={profile} size={20} />
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
        <TouchableOpacity onPress={() => onTabPress('events')} style={[styles.tabItem, activeTab === 'events' && styles.activeTab]}>
            <MaterialCommunityIcons name="ticket-confirmation-outline" size={24} color={activeTab === 'events' ? Colors.dark.primary : Colors.dark.textSecondary} />
            <Text style={[styles.tabLabel, activeTab === 'events' && { color: Colors.dark.primary }]}>EVENTS</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onTabPress('liked')} style={[styles.tabItem, activeTab === 'liked' && styles.activeTab]}>
            <Ionicons name="heart-outline" size={24} color={activeTab === 'liked' ? Colors.dark.primary : Colors.dark.textSecondary} />
            <Text style={[styles.tabLabel, activeTab === 'liked' && { color: Colors.dark.primary }]}>LIKED</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onTabPress('saved')} style={[styles.tabItem, activeTab === 'saved' && styles.activeTab]}>
            <Ionicons name="bookmark-outline" size={24} color={activeTab === 'saved' ? Colors.dark.primary : Colors.dark.textSecondary} />
            <Text style={[styles.tabLabel, activeTab === 'saved' && { color: Colors.dark.primary }]}>SAVED</Text>
        </TouchableOpacity>
    </View>
);

// New Component for Activity Item - Premium Full Width
const ActivityListItem = ({ item, router }: { item: any, router: any }) => {
    const isOrganizer = item.status === 'organizer';
    const statusColor = isOrganizer ? '#333' : item.status === 'approved' ? '#00C851' : item.status === 'rejected' ? '#FF4444' : '#FFBB33';
    const statusText = isOrganizer ? 'MANAGE' : item.status === 'approved' ? 'JOINED' : item.status === 'rejected' ? 'REJECTED' : 'PENDING';

    return (
        <TouchableOpacity
            activeOpacity={0.7}
            style={styles.activityItemContainer}
            onPress={() => router.push({
                pathname: '/activity/[id]',
                params: {
                    ...item.activity,
                }
            })}
        >
            <View style={styles.activityCoverContainer}>
                <Image
                    source={{ uri: item.activity?.cover_image || 'https://images.unsplash.com/photo-1542385002-31d773419999?q=80&w=3227&auto=format&fit=crop' }}
                    style={styles.activityCover}
                />
                <View style={[styles.statusPill, { backgroundColor: isOrganizer ? 'rgba(0,0,0,0.7)' : statusColor }]}>
                    <Text style={[styles.statusText, { color: '#fff' }]}>{statusText}</Text>
                </View>
            </View>

            <View style={styles.activityContent}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Text style={styles.activityTitle} numberOfLines={1}>{item.activity?.title}</Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <FontAwesome5 name="calendar-alt" size={12} color={Colors.dark.primary} />
                    <Text style={styles.activityDate}>
                        {new Date(item.activity?.start_time).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                    </Text>
                </View>

                <Text style={styles.activityDesc} numberOfLines={2}>{item.activity?.short_description || 'No description available for this event.'}</Text>
            </View>

            <View style={{ justifyContent: 'center', paddingRight: 16 }}>
                <Ionicons name="chevron-forward" size={20} color="#333" />
            </View>
        </TouchableOpacity>
    );
};

export default function ProfileScreen() {
    const { user } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    // CACHE INTEGRATION
    const { profile, stats, setProfile, setStats } = useUserStore();

    // Loading only if we have absolutely nothing in cache to start with
    const [loading, setLoading] = useState(!profile);

    // const [profile, setProfile] = useState<any>(null); // REMOVED
    // const [stats, setStats] = useState({ followers: 0, following: 0 }); // REMOVED

    const [activeTab, setActiveTab] = useState<TabType>('posts');
    const [showCreateMenu, setShowCreateMenu] = useState(false);
    const scrollRef = useRef<any>(null);

    const handleTabChange = (direction: 'left' | 'right') => {
        const currentIndex = TABS.indexOf(activeTab);
        let newIndex = currentIndex;

        if (direction === 'left') {
            newIndex = Math.min(currentIndex + 1, TABS.length - 1);
        } else {
            newIndex = Math.max(currentIndex - 1, 0);
        }

        if (newIndex !== currentIndex) {
            runOnJS(setActiveTab)(TABS[newIndex]);
        }
    };

    const panGesture = Gesture.Pan()
        .activeOffsetX([-20, 20])
        .failOffsetY([-20, 20])
        .onEnd((e) => {
            if (e.translationX < -50) {
                runOnJS(handleTabChange)('left');
            } else if (e.translationX > 50) {
                runOnJS(handleTabChange)('right');
            }
        });

    const [userPosts, setUserPosts] = useState<PostProps[]>([]);
    const [userReplies, setUserReplies] = useState<ReplyProps[]>([]);
    const [likedPosts, setLikedPosts] = useState<PostProps[]>([]);
    const [savedPosts, setSavedPosts] = useState<PostProps[]>([]);
    const [userEvents, setUserEvents] = useState<any[]>([]); // New State
    const [refreshing, setRefreshing] = useState(false);

    // Manual Sticky Header State
    const [headerHeight, setHeaderHeight] = useState(0);
    const [isSticky, setIsSticky] = useState(false);

    // Share State
    const [shareModalVisible, setShareModalVisible] = useState(false);
    const [shareContent, setShareContent] = useState<ShareContent | null>(null);

    // Create Menu State [NEW]
    const [createMenuVisible, setCreateMenuVisible] = useState(false);
    const handleCreatePress = () => {
        setCreateMenuVisible(true);
    };

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

    useFocusEffect(
        useCallback(() => {
            const scrollSub = DeviceEventEmitter.addListener('scrollToTop_profile', () => {
                // @ts-ignore
                scrollRef.current?.scrollToOffset({ offset: 0, animated: true });
            });
            return () => scrollSub.remove();
        }, [])
    );

    const handleShare = (item: any, type: 'post' | 'reply') => {
        if (type === 'reply') {
            setShareContent({
                type: 'post', // Sharing the parent post context for the reply
                id: item.parent_post?.id,
                preview: {
                    title: `Reply by ${item.user.username}`,
                    subtitle: item.content,
                    image: item.user.avatar_url
                }
            });
        } else {
            // For posts
            setShareContent({
                type: 'post',
                id: item.id,
                preview: {
                    title: item.profile?.full_name || item.user?.full_name || 'Post',
                    subtitle: item.content,
                    image: item.image_url || item.profile?.avatar_url
                }
            });
        }
        setShareModalVisible(true);
    };

    useFocusEffect(
        useCallback(() => {
            let sub: any;
            if (user) {
                getProfile();
                if (activeTab === 'posts') fetchUserPosts();
                if (activeTab === 'rollback') fetchUserReplies();
                if (activeTab === 'liked') fetchLikedPosts();
                if (activeTab === 'saved') fetchSavedPosts();
                if (activeTab === 'events') {
                    fetchUserEvents();
                    // Real-time Subscription for Activity Changes
                    sub = supabase
                        .channel('my_activity_requests')
                        .on(
                            'postgres_changes',
                            { event: '*', schema: 'public', table: 'activity_requests', filter: `user_id=eq.${user.id}` },
                            (payload) => {
                                fetchUserEvents();
                            }
                        )
                        .subscribe();
                }
            }

            // [NEW] Listen for global delete events (e.g. from Feed)
            const deleteSub = DeviceEventEmitter.addListener('post_deleted', (postId: string) => {
                setUserPosts(prev => prev.filter(p => p.id !== postId));
                setLikedPosts(prev => prev.filter(p => p.id !== postId));
                setSavedPosts(prev => prev.filter(p => p.id !== postId));
            });

            return () => {
                if (sub) supabase.removeChannel(sub);
                deleteSub.remove();
            };
        }, [user, activeTab])
    );

    const getProfile = async () => {
        try {
            const profileReq = supabase.from('profiles').select('*').eq('id', user?.id).single();
            const followersReq = supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', user?.id);
            const followingReq = supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', user?.id);

            const [profileRes, followersRes, followingRes] = await Promise.all([profileReq, followersReq, followingReq]);

            if (profileRes.data) setProfile(profileRes.data);
            setStats({ followers: followersRes.count || 0, following: followingRes.count || 0 });
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const fetchUserPosts = async () => {
        if (!user) return;
        try {
            const { data, error } = await supabase
                .from('posts')
                .select(`*, profile:profiles!posts_user_id_fkey(username, full_name, avatar_url), likes_count:likes(count), comments_count:comments(count)`)
                .eq('user_id', user?.id)
                .eq('status', 'published')
                .order('is_pinned', { ascending: false })
                .order('created_at', { ascending: false });

            if (error) throw error;
            const formattedPosts = await enrichPosts(data);
            setUserPosts(formattedPosts as any);
        } catch (e) {
            console.error("Error fetching user posts:", e);
        }
    };



    const fetchSavedPosts = async () => {
        if (!user) return;
        try {
            const { data, error } = await supabase
                .from('saved_posts')
                .select(`
                    created_at,
                    is_pinned,
                    post:posts (
                        *,
                        profile:profiles!posts_user_id_fkey(username, full_name, avatar_url),
                        likes_count:likes(count),
                        comments_count:comments(count)
                    )
                `)
                .eq('user_id', user.id)
                .order('is_pinned', { ascending: false })
                .order('created_at', { ascending: false });

            if (error) throw error;

            const rawPosts = data?.map((item: any) => item.post).filter((p: any) => p !== null && p.status === 'published') || [];
            const formattedPosts = await enrichPosts(rawPosts);
            setSavedPosts(formattedPosts as any);
        } catch (e) {
            console.error("Error fetching saved posts:", e);
        }
    };

    const fetchUserEvents = async () => {
        if (!user) return;
        try {
            // 1. Fetch joined/requested events
            const { data: requests, error: reqError } = await supabase
                .from('activity_requests')
                .select(`
                 *,
                 activity:activities(*)
             `)
                .eq('user_id', user.id);

            if (reqError) throw reqError;

            // 2. Fetch organized events
            const { data: organized, error: orgError } = await supabase
                .from('activities')
                .select('*')
                .eq('organizer_id', user.id);

            if (orgError) throw orgError;

            // 3. Normalize and Merge
            const formattedRequests = requests?.map(r => ({ ...r, id: `req-${r.id}` })) || [];
            const formattedOrganized = organized?.map(a => ({
                id: `org-${a.id}`, // Unique ID for list
                created_at: a.created_at,
                status: 'organizer',
                activity: a
            })) || [];

            // Combine and Sort by most recent
            const allEvents = [...formattedOrganized, ...formattedRequests].sort((a, b) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );

            setUserEvents(allEvents);
        } catch (e) {
            console.error("Error fetching events:", e);
        }
    };
    // Helper to enrich posts with has_liked/has_saved status
    const enrichPosts = async (posts: any[]) => {
        if (!posts || posts.length === 0) return [];
        const postIds = posts.map(p => p.id);

        let myLikes: string[] = [];
        let mySaved: string[] = [];

        if (postIds.length > 0 && user) {
            const { data: likesData } = await supabase.from('likes').select('post_id').eq('user_id', user.id).in('post_id', postIds);
            if (likesData) myLikes = likesData.map(l => l.post_id);

            const { data: savedData } = await supabase.from('saved_posts').select('post_id').eq('user_id', user.id).in('post_id', postIds);
            if (savedData) mySaved = savedData.map(s => s.post_id);
        }

        return posts.map(post => {
            const isPinnedInList = post.is_pinned; // Fallback to post level
            return {
                ...post,
                likes_count: post.likes_count?.[0]?.count || 0,
                comments_count: post.comments_count?.[0]?.count || 0,
                has_liked: myLikes.includes(post.id),
                has_saved: mySaved.includes(post.id),
                is_pinned: isPinnedInList
            };
        });
    };

    const fetchUserReplies = async () => {
        try {
            const { data, error } = await supabase
                .from('comments')
                .select(`
                    id, content, created_at,
                    post:posts(id, user:profiles!posts_user_id_fkey(username, full_name, avatar_url)),
                    comment_likes(count)
                `)
                .eq('user_id', user?.id)
                .is('anon_post_id', null) // [FIX] Hide replies to anonymous posts
                .order('created_at', { ascending: false });

            if (error) throw error;

            const commentIds = data?.map((c: any) => c.id) || [];
            let myCommentLikes: string[] = [];
            if (commentIds.length > 0) {
                const { data: clData } = await supabase.from('comment_likes').select('comment_id').eq('user_id', user!.id).in('comment_id', commentIds);
                if (clData) myCommentLikes = clData.map(c => c.comment_id);
            }

            const formattedReplies: ReplyProps[] = data?.map((item: any) => ({
                id: item.id,
                content: item.content,
                created_at: item.created_at,
                user: {
                    id: user?.id || '',
                    username: profile?.username || user?.user_metadata?.username || 'me',
                    full_name: profile?.full_name || 'Me',
                    avatar_url: profile?.avatar_url || '',
                    is_verified: profile?.is_verified,
                    is_admin: profile?.is_admin,
                    is_og: profile?.is_og
                },
                parent_post: item.post ? {
                    id: item.post.id,
                    user: { username: item.post.user?.username || 'unknown' }
                } : undefined,
                likes_count: item.comment_likes?.[0]?.count || 0,
                replies_count: 0,
                has_liked: myCommentLikes.includes(item.id)
            })) || [];

            setUserReplies(formattedReplies);
        } catch (e) {
            console.error("Error fetching replies:", e);
        }
    };

    // Generic updater for all post lists
    const updateAllPostLists = (postId: string, updater: (post: PostProps) => PostProps) => {
        setUserPosts(prev => prev.map(p => p.id === postId ? updater(p) : p));
        setLikedPosts(prev => prev.map(p => p.id === postId ? updater(p) : p));
        setSavedPosts(prev => prev.map(p => p.id === postId ? updater(p) : p));
    };

    const handleLike = async (post: PostProps) => {
        if (!user) return;
        const currentHasLiked = !!post.has_liked;
        // Optimistic update
        updateAllPostLists(post.id, p => ({
            ...p,
            has_liked: !currentHasLiked,
            likes_count: currentHasLiked ? p.likes_count - 1 : p.likes_count + 1
        }));

        try {
            if (currentHasLiked) {
                const { error } = await supabase.from('likes').delete().eq('post_id', post.id).eq('user_id', user.id);
                if (error) throw error;
                // If unliked, maybe remove from likedPosts? keeping it for now to avoid jumpiness
            } else {
                const { error } = await supabase.from('likes').insert({ post_id: post.id, user_id: user.id });
                if (error) throw error;
            }
        } catch (error) {
            console.error("Like failed:", error);
            // Revert on error could be implemented here
        }
    };

    const handleSave = async (post: PostProps) => {
        if (!user) return;
        const currentHasSaved = !!post.has_saved;
        // Optimistic update
        updateAllPostLists(post.id, p => ({ ...p, has_saved: !currentHasSaved }));

        try {
            if (currentHasSaved) {
                const { error } = await supabase.from('saved_posts').delete().eq('post_id', post.id).eq('user_id', user.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('saved_posts').insert({ post_id: post.id, user_id: user.id });
                if (error) throw error;
            }
        } catch (error) {
            console.error("Save failed:", error);
        }
    };

    const handlePin = async (post: PostProps) => {
        try {
            const newPinnedState = !post.is_pinned;

            // Determine which table to update
            let table = 'posts';
            let filter: any = { id: post.id };

            if (activeTab === 'liked') {
                table = 'likes';
                filter = { post_id: post.id, user_id: user?.id };
            } else if (activeTab === 'saved') {
                table = 'saved_posts';
                filter = { post_id: post.id, user_id: user?.id };
            } else if (post.user_id !== user?.id) {
                // If in search or something else, only owner can pin to post table
                Alert.alert("Error", "You can only pin your own posts to the top of your profile.");
                return;
            }

            const { error } = await supabase
                .from(table)
                .update({ is_pinned: newPinnedState })
                .match(filter);

            if (error) throw error;

            // Updated sorting helper
            const sortWithPins = (prev: PostProps[]) => {
                const updated = prev.map(p => p.id === post.id ? { ...p, is_pinned: newPinnedState } : p);
                return updated.sort((a: any, b: any) => {
                    if (a.is_pinned !== b.is_pinned) {
                        return a.is_pinned ? -1 : 1;
                    }
                    const timeA = new Date(a.created_at || a.liked_at || 0).getTime();
                    const timeB = new Date(b.created_at || b.liked_at || 0).getTime();
                    return timeB - timeA;
                });
            };

            if (activeTab === 'posts') setUserPosts(prev => sortWithPins(prev));
            if (activeTab === 'liked') setLikedPosts(prev => sortWithPins(prev as any) as any);
            if (activeTab === 'saved') setSavedPosts(prev => sortWithPins(prev as any) as any);

            Alert.alert("Success", newPinnedState ? "Pinned to top." : "Unpinned.");
        } catch (e: any) {
            console.error("Pin error:", e);
            Alert.alert("Error", "Could not update pin status. Make sure you've applied the SQL migration.");
        }
    };

    const handleDelete = async (postId: string) => {
        Alert.alert("Delete Post", "Are you sure?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete", style: "destructive", onPress: async () => {
                    try {
                        const { error } = await supabase.from('posts').delete().eq('id', postId);
                        if (error) throw error;

                        DeviceEventEmitter.emit('post_deleted', postId);
                        setUserPosts(prev => prev.filter(p => p.id !== postId));
                        setLikedPosts(prev => prev.filter(p => p.id !== postId));
                        setSavedPosts(prev => prev.filter(p => p.id !== postId));

                    } catch (e) {
                        console.error("Delete error:", e);
                        Alert.alert("Error", "Could not delete post.");
                    }
                }
            }
        ]);
    };

    const handleDeleteReply = async (replyId: string) => {
        Alert.alert("Delete Rollback", "Are you sure? This cannot be undone.", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete", style: "destructive", onPress: async () => {
                    try {
                        const { error } = await supabase.from('comments').delete().eq('id', replyId);
                        if (error) throw error;

                        setUserReplies(prev => prev.filter(r => r.id !== replyId));
                        Alert.alert("Success", "Rollback deleted.");
                    } catch (e) {
                        console.error("Delete reply error:", e);
                        Alert.alert("Error", "Could not delete rollback.");
                    }
                }
            }
        ]);
    };

    const handleRemoveFromSaved = async (postId: string) => {
        try {
            const { error } = await supabase.from('saved_posts').delete().eq('post_id', postId).eq('user_id', user?.id);
            if (error) throw error;
            setSavedPosts(prev => prev.filter(p => p.id !== postId));
            Alert.alert("Success", "Removed from saved.");
        } catch (e) {
            console.error("Remove from saved error:", e);
            Alert.alert("Error", "Could not remove from saved.");
        }
    };

    // Action Sheet State
    const [actionSheetVisible, setActionSheetVisible] = useState(false);
    const [selectedPost, setSelectedPost] = useState<any>(null);

    const showOptions = (item: any) => {
        setSelectedPost(item);
        setActionSheetVisible(true);
    };

    const onRefresh = async () => {
        setRefreshing(true);
        const promises = [getProfile()];
        if (activeTab === 'posts') promises.push(fetchUserPosts());
        if (activeTab === 'rollback') promises.push(fetchUserReplies());
        if (activeTab === 'liked') promises.push(fetchLikedPosts());
        if (activeTab === 'saved') promises.push(fetchSavedPosts());
        if (activeTab === 'events') promises.push(fetchUserEvents());
        await Promise.all(promises);
        setRefreshing(false);
    };

    const fetchLikedPosts = async () => {
        if (!user) return;
        try {
            // 1. Fetch Liked Posts
            const { data: postsData, error: postsError } = await supabase
                .from('likes')
                .select(`
                    created_at,
                    is_pinned,
                    post:posts (
                        *,
                        profile:profiles!posts_user_id_fkey(username, full_name, avatar_url),
                        likes_count:likes(count),
                        comments_count:comments(count)
                    )
                `)
                .eq('user_id', user.id)
                .order('is_pinned', { ascending: false })
                .order('created_at', { ascending: false });

            if (postsError) throw postsError;

            // 2. Fetch Liked Activities [NEW]
            const { data: activitiesData, error: actError } = await supabase
                .from('activity_likes')
                .select(`
                    created_at,
                    activity:activities(*)
                `)
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (actError) throw actError;

            // 3. Process Posts
            const rawPosts = postsData?.map((item: any) => ({ ...item.post, is_pinned: item.is_pinned })).filter((p: any) => p.id !== undefined && p.status === 'published') || [];
            const formattedPosts = await enrichPosts(rawPosts);
            const postsWithMeta = formattedPosts.map((p: any) => ({ ...p, type: 'post', liked_at: postsData?.find((l: any) => l.post?.id === p.id)?.created_at }));

            // 4. Process Activities
            const formattedActivities = activitiesData?.map((item: any) => ({
                id: `actlike-${item.activity.id}`, // Unique ID
                type: 'activity',
                activity: item.activity,
                status: 'liked', // Cosmetic
                created_at: item.created_at // Like time
            })) || [];

            // 5. Merge & Sort
            const allLiked = [...postsWithMeta, ...formattedActivities].sort((a: any, b: any) =>
                new Date(b.created_at || b.liked_at).getTime() - new Date(a.created_at || a.liked_at).getTime()
            );

            setLikedPosts(allLiked as any);
        } catch (e) {
            console.error("Error fetching liked content:", e);
        }
    };

    const handleTabPress = useCallback((tab: TabType) => {
        setActiveTab(tab);
    }, [setActiveTab]);

    const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const y = event.nativeEvent.contentOffset.y;
        if (y >= headerHeight && !isSticky) {
            setIsSticky(true);
        } else if (y < headerHeight && isSticky) {
            setIsSticky(false);
        }
    };

    const getData = () => {
        if (activeTab === 'posts') return userPosts;
        if (activeTab === 'rollback') return userReplies;
        if (activeTab === 'liked') return likedPosts;
        if (activeTab === 'saved') return savedPosts;
        if (activeTab === 'events') return userEvents;
        return [];
    };

    const activeData = getData();

    const listData = [
        { id: 'profile-header', type: 'header' },
        { id: 'tabs-header', type: 'tabs' },
        ...activeData
    ];

    if (activeData.length === 0 && !loading) {
        listData.push({ id: 'empty-state', type: 'empty' });
    }

    const firstPostIndex = useMemo(() => listData.findIndex(d => d.type === 'post'), [listData]);

    const renderItem = useCallback(({ item, index }: any) => {
        if (item.type === 'header') {
            return (
                <ProfileHeader
                    profile={profile}
                    stats={stats}
                    showCreateMenu={showCreateMenu}
                    setShowCreateMenu={setShowCreateMenu}
                    router={router}
                    onLayout={(e: any) => setHeaderHeight(e.nativeEvent.layout.height)}
                    onCreatePress={handleCreatePress} // Pass the handler
                />
            );
        }
        if (item.type === 'tabs') {
            return <ProfileTabs activeTab={activeTab} onTabPress={handleTabPress} />;
        }
        if (item.type === 'empty') {
            return (
                <View style={{ alignItems: 'center', marginTop: 60, paddingHorizontal: 20 }}>
                    <Text style={[styles.emptyText, { textAlign: 'center' }]}>
                        {activeTab === 'posts' ? "you have no posts" :
                            activeTab === 'rollback' ? "you haven't rollback to any post" :
                                activeTab === 'events' ? "you have no upcoming events" :
                                    activeTab === 'liked' ? "you haven't liked any post" :
                                        "you haven't saved any post"}
                    </Text>
                </View>
            );
        }

        if (activeTab === 'rollback' && item.type !== 'tabs') {
            return <ReplyCard
                reply={item}
                onLike={() => { /* Implement comment like if needed later */ }}
                // @ts-ignore
                onReply={() => router.push(`/post/${item.parent_post?.id}`)}
                onShare={() => handleShare(item, 'reply')}
                onShowOptions={() => showOptions(item)}
            />;
        }

        // Handle Activities (Events Tab OR Liked Activites)
        if (item.type === 'activity' || (activeTab === 'events' && item.type !== 'tabs')) {
            return <ActivityListItem item={item} router={router} />;
        }

        return (
            <PostCard
                post={item}
                isFirstPost={index === firstPostIndex}
                onShowOptions={() => showOptions(item)}
                onLike={() => handleLike(item)}
                onSave={() => handleSave(item)}
                onShare={() => handleShare(item, 'post')}
                isScreenFocused={isFocused}
                showViewCount={activeTab === 'posts'}
            />
        );
    }, [profile, stats, showCreateMenu, setShowCreateMenu, router, activeTab, handleTabPress, showOptions, userPosts, likedPosts, savedPosts, userReplies, userEvents, headerHeight, isSticky, isFocused]);

    if (loading) return <ScreenWrapper style={{ justifyContent: 'center' }}><ActivityIndicator color={Colors.dark.primary} /></ScreenWrapper>;

    return (
        <ScreenWrapper style={{ paddingHorizontal: 0 }}>
            {isSticky && (
                <View style={{ position: 'absolute', top: insets.top, left: 0, right: 0, zIndex: 1000, elevation: 10 }}>
                    <ProfileTabs activeTab={activeTab} onTabPress={handleTabPress} />
                </View>
            )}






            <CustomActionSheet
                visible={createMenuVisible}
                onClose={() => setCreateMenuVisible(false)}
                title="Create"
                options={[
                    {
                        label: "Post",
                        icon: "pencil",
                        onPress: () => router.push('/create-post')
                    },
                    {
                        label: "Poll",
                        icon: "poll",
                        onPress: () => router.push('/create-poll')
                    },
                    {
                        label: "Cancel",
                        icon: "close",
                        onPress: () => { }
                    }
                ]}
            />

            {/* Custom Action Sheet - Context Aware */}
            <CustomActionSheet
                visible={actionSheetVisible}
                onClose={() => {
                    setActionSheetVisible(false);
                    setSelectedPost(null);
                }}
                options={(() => {
                    if (!selectedPost) return [];

                    if (activeTab === 'rollback') {
                        return [
                            {
                                label: "Delete Rollback",
                                icon: "trash-can-outline",
                                isDestructive: true,
                                onPress: () => handleDeleteReply(selectedPost.id)
                            }
                        ];
                    }

                    if (activeTab === 'saved') {
                        return [
                            {
                                label: "Remove from Saved",
                                icon: "bookmark-remove-outline",
                                isDestructive: true,
                                onPress: () => handleRemoveFromSaved(selectedPost.id)
                            }
                        ];
                    }

                    const isOwnPost = selectedPost.user_id === user?.id;

                    const opts: any[] = [
                        {
                            label: selectedPost.is_pinned ? "Unpin from Top" : "Pin to Top",
                            icon: "pin-outline",
                            onPress: () => handlePin(selectedPost)
                        }
                    ];

                    if (isOwnPost) {
                        opts.push({
                            label: "Delete this Roll",
                            icon: "trash-can-outline",
                            isDestructive: true,
                            onPress: () => handleDelete(selectedPost.id)
                        });
                    }

                    return opts;
                })()}
            />

            <GestureDetector gesture={panGesture}>
                <FlashList
                    ref={scrollRef}
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
                        if (activeTab === 'rollback') return 'reply';
                        if (activeTab === 'events') return 'activity';
                        return 'post';
                    }}
                    extraData={activeTab}
                    onScroll={handleScroll}
                    scrollEventThrottle={16}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.dark.primary} />}
                    contentContainerStyle={{ paddingBottom: 50, minHeight: Dimensions.get('window').height + 300 }}
                />
            </GestureDetector>

            <ShareModal
                visible={shareModalVisible}
                onClose={() => setShareModalVisible(false)}
                content={shareContent}
            />
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 10,
        backgroundColor: Colors.dark.background,
    },
    headerName: { display: 'none' }, // Hidden as requested
    headerUsername: { color: Colors.dark.primary, fontSize: 16, fontWeight: 'bold' }, // Prominent username
    addButton: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: Colors.dark.primary, // Neon blue
        justifyContent: 'center', alignItems: 'center',
    },

    heroContainer: {
        alignItems: 'center',
        marginBottom: 60, // Space for avatar overlap
    },
    bannerContainer: {
        width: '100%',
        height: 200, // Fixed height increased
    },
    bannerImage: { width: width, height: 200 },
    avatarContainer: {
        position: 'absolute',
        bottom: -50, // Half of height to overlap
        width: 110, height: 110,
        borderRadius: 55,
        borderWidth: 4, borderColor: Colors.dark.background,
        backgroundColor: Colors.dark.background,
        justifyContent: 'center', alignItems: 'center',
    },
    avatarImage: { width: 102, height: 102, borderRadius: 51 },
    // editBadge removed

    infoContainer: { alignItems: 'center', paddingHorizontal: 20 },
    name: { fontSize: 24, fontWeight: 'bold', color: Colors.dark.text, marginBottom: 4 },
    // roleRow removed
    bio: { color: Colors.dark.text, fontSize: 16, textAlign: 'center', lineHeight: 22, marginTop: 4 },

    statsContainer: {
        flexDirection: 'row',
        backgroundColor: '#111',
        marginHorizontal: 20,
        marginTop: 24,
        marginBottom: 20, // Add bottom margin here to separate from tabs
        borderRadius: 20,
        paddingVertical: 16,
        borderWidth: 1, borderColor: '#222'
    },
    statBox: { flex: 1, alignItems: 'center' },
    statNumber: { fontSize: 20, fontWeight: 'bold', color: Colors.dark.text },
    statLabel: { fontSize: 10, color: Colors.dark.textSecondary, marginTop: 4, letterSpacing: 1 },
    statDivider: { width: 1, backgroundColor: '#333' },

    tabsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        backgroundColor: Colors.dark.background,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    tabItem: { alignItems: 'center', gap: 4, opacity: 0.8 },
    activeTab: { opacity: 1 },
    tabLabel: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.5,
        color: Colors.dark.textSecondary,
        marginTop: 2
    },

    emptyText: { color: '#666', fontSize: 16, fontStyle: 'italic' },

    activityItemContainer: {
        flexDirection: 'row',
        backgroundColor: '#0a0a0a', // Almost black
        borderBottomWidth: 1,
        borderBottomColor: '#222',
        height: 110,
        width: '100%',
    },
    activityCoverContainer: {
        width: 110,
        height: 110,
    },
    activityCover: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover'
    },
    activityContent: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 16,
        justifyContent: 'center',
    },
    activityTitle: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '700',
        letterSpacing: 0.3,
        marginBottom: 2
    },
    activityDesc: {
        color: '#888',
        fontSize: 13,
        marginTop: 6,
        lineHeight: 18
    },
    activityDate: {
        color: Colors.dark.primary,
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 0.5
    },
    statusPill: {
        position: 'absolute',
        top: 8,
        left: 8,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        overflow: 'hidden'
    },
    statusText: {
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 0.5,
        textTransform: 'uppercase'
    }
});
