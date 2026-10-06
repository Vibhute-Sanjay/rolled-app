import { MaterialCommunityIcons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ActivityIndicator, Alert, DeviceEventEmitter, Image, RefreshControl, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Colors } from '../constants/Colors';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { ActionSheetOption, CustomActionSheet } from './CustomActionSheet';
import { CustomToast } from './CustomToast';
import { PostCard, PostProps } from './PostCard';
import { ReportModal } from './ReportModal';
import { ShareContent, ShareModal } from './ShareModal';
import { SkeletonFeed } from './SkeletonFeed';

interface FeedListProps {
    audience: 'campus' | 'following';
    isActiveTab?: boolean; // PagerView active tab state
    onScroll?: (event: any) => void;
    headerHeight?: number;
}

import { useInteractionStore } from '../store/interactionStore';
import { useChatStore } from '../stores/chatStore';

import { useFeedStore } from '../stores/feedStore';
import { useVideoStateStore } from '../stores/videoStateStore';
import { useIsFocused } from '@react-navigation/native';

// Defined OUTSIDE to prevent flickering/re-creation on every render
const AnimatedFlashList = Animated.createAnimatedComponent(FlashList);

export const FeedList = forwardRef(({ audience, isActiveTab = true, onScroll, headerHeight = 0 }: FeedListProps, ref) => {
    const { user } = useAuth();

    // Cache Strategy: Instant Load for Campus Feed
    // Use reactive hook to get cached posts and hydration state
    const cachedPosts = useFeedStore((state) => state.posts);
    const hasHydrated = useFeedStore((state) => state.hasHydrated);
    const setCachedPosts = useFeedStore((state) => state.setPosts);

    // Initialize with cached data for campus feed
    const [posts, setPosts] = useState<PostProps[]>(audience === 'campus' ? cachedPosts : []);
    const [loading, setLoading] = useState(!hasHydrated); // Don't show loading if already hydrated
    const [loadingMore, setLoadingMore] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [page, setPage] = useState(0);
    const PAGE_SIZE = 10;

    // New posts banner (Instagram-style)
    const [pendingNewPosts, setPendingNewPosts] = useState<PostProps[]>([]);
    const [showNewPostsBanner, setShowNewPostsBanner] = useState(false);

    // Ref for FlashList - MUST be declared early for event listeners
    const listRef = useRef<any>(null);

    // Share Modal State
    const [shareModalVisible, setShareModalVisible] = useState(false);
    const [sharedContent, setSharedContent] = useState<ShareContent | null>(null);

    // Sync Cache Effect (The React Way)
    useEffect(() => {
        if (audience === 'campus' && posts.length > 0) {
            setCachedPosts(posts.slice(0, 20));
        }
    }, [posts, audience]);

    // Options Modal State
    const [optionsModalVisible, setOptionsModalVisible] = useState(false);
    const [optionsPost, setOptionsPost] = useState<PostProps | null>(null);
    const [actionSheetOptions, setActionSheetOptions] = useState<ActionSheetOption[]>([]);
    const [sheetTitle, setSheetTitle] = useState("");

    // Report Logic
    const [reportModalVisible, setReportModalVisible] = useState(false);
    const [reportTarget, setReportTarget] = useState<'post' | 'user'>('post');
    const [toastMessage, setToastMessage] = useState('');

    // Video Auto-Play Logic
    const setActiveVideoId = useVideoStateStore(s => s.setActiveVideoId);

    const viewabilityConfigCallbackPairs = useRef([
        {
            viewabilityConfig: {
                itemVisiblePercentThreshold: 40,
                minimumViewTime: 100,
            },
            onViewableItemsChanged: ({ viewableItems }: any) => {
                // FIRST PRINCIPLES FIX: Do NOT evaluate viewability if this feed is currently hidden in PagerView!
                if (!isActiveTabRef.current) return;

                if (viewableItems && viewableItems.length > 0) {
                    const videoItem = viewableItems.find((v: any) => v.item?.media_type === 'video');
                    if (videoItem) {
                        setActiveVideoId(videoItem.item.id);
                    } else {
                        setActiveVideoId(null);
                    }
                }
                // FIRST PRINCIPLES FIX: Do NOT set activeVideoId(null) when viewableItems is empty.
                // FlashList notoriously fires an empty array during its initial 0-height measurement phase.
            }
        }
    ]).current;

    // Track Screen Focus
    // --- Compound Focus State (React Nav + PagerView) ---
    const isNavigationFocused = useIsFocused();
    const isFullyFocused = isNavigationFocused && isActiveTab;

    // We need a ref for viewabilityConfig to avoid stale closures
    const isActiveTabRef = useRef(isActiveTab);
    useEffect(() => {
        isActiveTabRef.current = isActiveTab;
    }, [isActiveTab]);

    // [NEW] 1st Principle: Tab-Switch Lifecycle Auto-Fetch for My Roll
    const hasFetchedForFocusRef = useRef(false);
    useEffect(() => {
        if (audience === 'following') {
            if (isActiveTab) {
                if (!hasFetchedForFocusRef.current) {
                    // User just swiped to "My Roll" — auto-fetch the absolute newest posts silently
                    // Lock is set to true immediately to prevent continuous fetching loops
                    fetchPosts(null, true, true);
                    hasFetchedForFocusRef.current = true;
                }
            } else {
                // User swiped away. Reset the lock so it fetches ONE TIME next time they come back.
                hasFetchedForFocusRef.current = false;
            }
        }
    }, [isActiveTab, audience, fetchPosts]);

    // ============ fetchPosts FUNCTION ============
    // Wrap in useCallback for stable reference in onRefresh
    const fetchPosts = useCallback(async (lastDate: string | null = null, isRefresh: boolean = false, isInitialLoad: boolean = false) => {
        if (!user) return;
        try {
            // Use the list from our store (already contains both directions)
            const blockedIds = useChatStore.getState().blockedUserIds;

            let query = supabase
                .from('posts')
                .select(`
                    *,
                    profile:profiles!posts_user_id_fkey(username, full_name, avatar_url, is_verified, is_admin, is_og),
                    likes_count:likes(count),
                    comments_count:comments(count)
                `)
                .eq('status', 'published')
                .order('created_at', { ascending: false })
                .limit(PAGE_SIZE);

            // Cursor Logic: Fetch OLDER posts
            if (lastDate) {
                query = query.lt('created_at', lastDate);
            }

            if (blockedIds.length > 0) {
                query = query.not('user_id', 'in', `(${blockedIds})`);
            }

            if (audience === 'campus') {
                query = query.or('audience.eq.public,audience.eq.campus');
            } else if (audience === 'following') {
                const { data: followingData, error: followingError } = await supabase
                    .from('follows')
                    .select('following_id')
                    .eq('follower_id', user.id);

                if (followingError) throw followingError;

                const followingIds = followingData?.map(f => f.following_id) || [];

                if (followingIds.length === 0) {
                    setPosts([]);
                    setHasMore(false);
                    setLoading(false);
                    setRefreshing(false);
                    return;
                }
                query = query.in('user_id', followingIds);
            }

            const { data, error } = await query;
            if (error) throw error;

            const postIds = data?.map((p: any) => p.id) || [];
            let myLikes: string[] = [];
            let mySaved: string[] = [];

            if (postIds.length > 0) {
                // Check Likes
                const { data: likesData } = await supabase
                    .from('likes')
                    .select('post_id')
                    .eq('user_id', user.id)
                    .in('post_id', postIds);
                if (likesData) myLikes = likesData.map(l => l.post_id);

                // Check Saved
                const { data: savedData } = await supabase
                    .from('saved_posts')
                    .select('post_id')
                    .eq('user_id', user.id)
                    .in('post_id', postIds);
                if (savedData) mySaved = savedData.map(s => s.post_id);
            }

            const formattedData = data?.map((post: any) => ({
                ...post,
                likes_count: post.likes_count?.[0]?.count || 0,
                comments_count: post.comments_count?.[0]?.count || 0,
                has_liked: myLikes.includes(post.id),
                has_saved: mySaved.includes(post.id)
            }));

            // Filter out Expired Polls (> 24h)
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const filteredData = formattedData?.filter((p: any) => {
                if (p.has_poll) {
                    return new Date(p.created_at) > oneDayAgo;
                }
                return true; // Keep normal posts
            }) || [];

            const newPosts = filteredData;

            const mergeAndSort = (prevList: any[], newList: any[]) => {
                const map = new Map();
                prevList.forEach(p => map.set(p.id, p));
                newList.forEach(p => map.set(p.id, p));
                return Array.from(map.values()).sort((a, b) => {
                    const timeB = new Date(b.created_at).getTime();
                    const timeA = new Date(a.created_at).getTime();
                    return timeB - timeA || a.id.localeCompare(b.id);
                });
            };

            if (isRefresh) {
                // Check if this is a background fetch or user-initiated refresh
                // OR if it's the INITIAL LOAD (silent update)
                if (refreshing || isInitialLoad) {
                    // User pulled OR initial hydration - replace all posts
                    setPosts(newPosts);
                    setPendingNewPosts([]);
                    setShowNewPostsBanner(false);
                    // 1st Principle: Snap to top instantaneously (animated: false) to prevent hiding new posts
                    if (refreshing || isInitialLoad) { 
                        setTimeout(() => {
                            listRef.current?.scrollToOffset({ offset: 0, animated: false });
                        }, 250);
                    }
                } else {
                    // Silent background fetch (e.g. returning from unblock screen)
                    // Seamlessly slide posts into their correct chronological order
                    // Realtime new posts are handled exclusively by RealtimeManager
                    setPosts(prev => mergeAndSort(prev, newPosts));
                }
            } else {
                // Pagination load more (Append)
                setPosts(prev => mergeAndSort(prev, newPosts));
            }

            // Use raw DB count (before client-side poll filter) to decide pagination
            // Otherwise filtering 1 expired poll makes the app think it's the end
            setHasMore((data?.length ?? 0) === PAGE_SIZE);

        } catch (error: any) {
            console.error(error);
            if (error.message === 'Request timeout') {
                Alert.alert('Loading Timeout', 'Check your internet connection and try again');
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
            setLoadingMore(false);
        }
    }, [user, audience, refreshing, posts]); // Added 'posts' to deps for accurate background diff

    // ============ EVENT HANDLERS ============
    // Listen for events
    //onRefresh wrapped in useCallback for stable reference in event listeners
    const onRefresh = useCallback(() => {
        setRefreshing(true);
        // Scroll to top IMMEDIATELY (non-animated for instant feedback)
        listRef.current?.scrollToOffset({ offset: 0, animated: false });
        // Fetch fresh data
        fetchPosts(null, true);
    }, [fetchPosts]);

    // Handler for "See New Rolls" banner
    const showNewPosts = useCallback(() => {
        if (pendingNewPosts.length > 0) {
            // Merge and sort pending new posts chronologically
            setPosts(prev => {
                const map = new Map();
                prev.forEach(p => map.set(p.id, p));
                pendingNewPosts.forEach(p => map.set(p.id, p));
                return Array.from(map.values()).sort((a, b) => {
                    const timeB = new Date(b.created_at).getTime();
                    const timeA = new Date(a.created_at).getTime();
                    return timeB - timeA || a.id.localeCompare(b.id);
                });
            });
            // Clear pending posts
            setPendingNewPosts([]);
            setShowNewPostsBanner(false);

            // Scroll to top AFTER render cycle using robust scrollToIndex
            setTimeout(() => {
                listRef.current?.scrollToIndex({ index: 0, animated: true, viewPosition: 0 });
            }, 100);
        }
    }, [pendingNewPosts]);

    useEffect(() => {
        const newPostSub = DeviceEventEmitter.addListener('new_post_created', (newPost: PostProps) => {
            // Check if this post should be in this feed
            const matchesAudience = audience === 'campus'
                ? (newPost.audience === 'campus' || newPost.audience === 'public')
                : (newPost.audience === 'followers');

            if (matchesAudience) {
                // [FIX] Self-Post: Silently inject into state chronologically
                if (newPost.user_id === user?.id) {
                    setPosts(prev => {
                        const map = new Map();
                        prev.forEach(p => map.set(p.id, p));
                        map.set(newPost.id, newPost);
                        return Array.from(map.values()).sort((a, b) => {
                            const timeB = new Date(b.created_at).getTime();
                            const timeA = new Date(a.created_at).getTime();
                            return timeB - timeA || a.id.localeCompare(b.id);
                        });
                    });
                    
                    // Only auto-scroll for light posts (text/images) to prevent video render layout crashes
                    if (newPost.media_type !== 'video') {
                        setTimeout(() => {
                            listRef.current?.scrollToOffset({ offset: 0, animated: true });
                        }, 100);
                    }
                    return;
                }

                // Others: Show Banner
                setPendingNewPosts(prev => {
                    // Avoid duplicates
                    if (prev.some(p => p.id === newPost.id)) return prev;
                    return [newPost, ...prev];
                });
                setShowNewPostsBanner(true);
            }
        });

        const refreshSub = DeviceEventEmitter.addListener('refresh_feed', () => {
            // If there are pending new posts, show them immediately
            if (pendingNewPosts.length > 0) {
                showNewPosts();
            } else {
                // Otherwise, fetch fresh posts
                onRefresh();
            }
        });

        return () => {
            newPostSub.remove();
            refreshSub.remove();
        };
    }, [audience, onRefresh, showNewPosts, pendingNewPosts]);

    // [NEW] Listener for Deletions from Profile/Details
    useEffect(() => {
        const deleteSub = DeviceEventEmitter.addListener('post_deleted', (postId: string) => {
            setPosts(prev => prev.filter(p => p.id !== postId));
        });
        return () => deleteSub.remove();
    }, []);

    // BLOCKING FILTER (Reactive)
    const blockedUserIds = useChatStore(s => s.blockedUserIds);
    useEffect(() => {
        if (blockedUserIds.length > 0) {
            setPosts(prev => {
                const sanitized = prev.filter(p => !blockedUserIds.includes(p.user_id));
                // Only update state if we actually removed someone, preventing infinite loops
                if (sanitized.length !== prev.length) return sanitized;
                return prev;
            });
        }
    }, [blockedUserIds, posts]);

    // INTERACTION SYNC (Reactive)
    const storeInteractions = useInteractionStore(s => s.interactions);
    useEffect(() => {
        if (Object.keys(storeInteractions).length > 0) {
            setPosts(prev => prev.map(post => {
                const update = storeInteractions[post.id];
                if (update) {
                    return { ...post, ...update };
                }
                return post;
            }));
        }
    }, [storeInteractions]);

    // IMAGE PREFETCHING: Preload images for next few posts
    useEffect(() => {
        if (posts.length > 0) {
            // Prefetch images for the next 5 posts
            const imagesToPrefetch = posts
                .slice(0, 5)
                .flatMap(post => post.media_urls || [])
                .filter(Boolean);

            imagesToPrefetch.forEach(url => {
                Image.prefetch(url).catch(err => {
                    // Silently fail - prefetching isOptimizationOnly
                });
            });
        }
    }, [posts]);

    // [NEW] SYNC CACHE ON HYDRATION
    // If we mount and the store isn't hydrated yet, we need to wait for it.
    // Once hydrated, if posts is still empty, fill it with cached data.
    useEffect(() => {
        if (hasHydrated && audience === 'campus' && posts.length === 0 && cachedPosts.length > 0) {
            setPosts(cachedPosts);
        }
    }, [hasHydrated, cachedPosts, audience]);

    // Passive fetch on mount (if cache exists)
    useEffect(() => {
        if (hasHydrated && audience === 'campus' && cachedPosts.length > 0) {
            // We have cache, but let's silently update it in background
            // Pass 'true' for isInitialLoad to prevent banner
            fetchPosts(null, true, true);
        }
    }, [hasHydrated]); // Run once when hydrated

    useImperativeHandle(ref, () => ({
        refresh: () => {
            onRefresh();
        }
    }));



    const handleShowOptions = (post: PostProps) => {
        setOptionsPost(post);
        setSheetTitle(""); // Reset any custom title
        const isAuthor = user?.id === post.user_id;
        const options: ActionSheetOption[] = [];

        if (isAuthor) {
            options.push(
                {
                    label: 'Delete this Roll',
                    icon: 'trash-can-outline',
                    isDestructive: true,
                    onPress: () => {
                        setOptionsModalVisible(false);

                        setTimeout(() => {
                            setOptionsPost(post);
                            setSheetTitle("Are you sure you want to delete this roll?");
                            setActionSheetOptions([
                                {
                                    label: 'Delete',
                                    icon: 'trash-can-outline', // Optional icon
                                    isDestructive: true,
                                    onPress: () => deletePost(post.id)
                                },
                                {
                                    label: 'Cancel',
                                    icon: 'close',
                                    onPress: () => { }
                                }
                            ]);
                            setOptionsModalVisible(true);
                        }, 300);
                    }
                }
            );
        } else {
            options.push(
                {
                    label: 'Share / Copy Link',
                    icon: 'share-variant-outline',
                    onPress: async () => {
                        try {
                            await Share.share({
                                message: `Check out this post: https://therolledapp.com/post/${post.id}`,
                                url: `https://therolledapp.com/post/${post.id}`, // iOS
                            });
                        } catch (error: any) {
                            Alert.alert("Error", error.message);
                        }
                    }
                },
                {
                    label: 'Hide Post',
                    icon: 'eye-off-outline',
                    onPress: () => {
                        // Optimistic hide
                        setPosts(prev => prev.filter(p => p.id !== post.id));
                        Alert.alert("Hidden", "Post hidden from your feed.");
                    }
                },
                {
                    label: 'Report User',
                    icon: 'account-alert-outline', // Distinct icon
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
                    isDestructive: true, // Make block destructive too? Usually yes or standard. User requested "do it properly".
                    onPress: () => {
                        setOptionsModalVisible(false);

                        setTimeout(() => {
                            setOptionsPost(post);
                            setSheetTitle("The user will no longer be able to see your rolls or interact with you.");
                            setActionSheetOptions([
                                {
                                    label: 'Block',
                                    isDestructive: true,
                                    onPress: () => blockUser(post.user_id)
                                },
                                {
                                    label: 'Cancel',
                                    onPress: () => { }
                                }
                            ]);
                            setOptionsModalVisible(true);
                        }, 300);
                    }
                },
                {
                    label: 'Report Post',
                    icon: 'flag-outline',
                    isDestructive: true,
                    onPress: () => {
                        setTimeout(() => {
                            setReportTarget('post');
                            setReportModalVisible(true);
                        }, 300);
                    }
                }
            );
        }

        setActionSheetOptions(options);
        setOptionsModalVisible(true);
    };

    const deletePost = async (postId: string) => {
        // Optimistic hide
        setPosts(prev => prev.filter(p => p.id !== postId));

        try {
            const { error } = await supabase.from('posts').delete().eq('id', postId);
            if (error) throw error;
            setToastMessage("Post deleted");
            DeviceEventEmitter.emit('post_deleted', postId);
        } catch (error: any) {
            Alert.alert("Error", error.message);
            // Optional: Fetch posts again to revert if failed? 
            // Usually not needed for single delete.
        }
    };

    const blockUserAction = useChatStore(s => s.blockUser);
    const blockUser = async (userId: string) => {
        try {
            await blockUserAction(userId);
            // The useEffect using blockedUserIds will automatically filter the posts!
            setToastMessage("User has been blocked.");
        } catch (error: any) {
            Alert.alert("Error", error.message);
        }
    };

    const handleShare = (post: PostProps) => {
        setSharedContent({
            type: 'post',
            id: post.id,
            preview: {
                title: post.content,
                image: post?.media_urls?.[0], // Fixed optional chaining
                subtitle: `@${post.profile?.username}`
            },
            data: post
        });
        setShareModalVisible(true);
    };

    const loadMore = () => {
        if (!loadingMore && hasMore && posts.length > 0) {
            setLoadingMore(true);
            const lastPost = posts[posts.length - 1];
            fetchPosts(lastPost.created_at, false);
        }
    };

    // Reactive Block List Refresher
    const reactiveBlockedIds = useChatStore(s => s.blockedUserIds);
    useEffect(() => {
        // CACHE-FIRST RENDERING: Don't show loading spinner if we have cached data
        if (audience === 'campus' && cachedPosts.length > 0 && hasHydrated) {
            // Show cached posts immediately
            setLoading(false);
            // Fetch fresh data in background (Previously handled by separate effect, merged logic here)
            // But actually we want a dedicated effect for the "check fresh" logic to avoid loops.
        } else {
            // No cache or not campus feed - show loading
            setLoading(true);
            fetchPosts(null, true, true); // Treat as initial load (silent)
        }
    }, [audience, reactiveBlockedIds, hasHydrated]);

    if (loading && page === 0) {
        return (
            <View style={{ flex: 1, paddingTop: headerHeight }}>
                <SkeletonFeed />
            </View>
        );
    }

    return (
        <View style={{ flex: 1 }}>
            {/* Instagram-style "See New Rolls" Banner */}
            {showNewPostsBanner && (
                <TouchableOpacity
                    style={[styles.newPostsBanner, { top: headerHeight + 20 }]}
                    onPress={showNewPosts}
                    activeOpacity={0.8}
                >
                    <MaterialCommunityIcons name="arrow-up" size={18} color="#000" />
                    <Text style={styles.newPostsBannerText}>
                        {pendingNewPosts.length} new {pendingNewPosts.length === 1 ? 'roll' : 'rolls'}
                    </Text>
                </TouchableOpacity>
            )}

            <AnimatedFlashList
                ref={listRef}
                data={posts}
                extraData={isFullyFocused}
                viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs}
                renderItem={({ item, index }: { item: any, index: number }) => (
                    <PostCard
                        post={item as PostProps}
                        isFirstPost={index === 0}
                        onShare={() => handleShare(item)}
                        onShowOptions={() => handleShowOptions(item)}
                        isScreenFocused={isFullyFocused}
                    />
                )}
                // @ts-ignore
                estimatedItemSize={400}
                keyExtractor={(item: any) => item.id}
                onScroll={onScroll}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={Colors.dark.primary}
                        progressViewOffset={headerHeight}
                    />
                }
                contentContainerStyle={{
                    paddingTop: headerHeight,
                    paddingBottom: 100
                }}
                onEndReached={loadMore}
                onEndReachedThreshold={0.5}
                ListFooterComponent={
                    loadingMore ? (
                        <ActivityIndicator size="small" color={Colors.dark.primary} style={{ marginVertical: 20 }} />
                    ) : !hasMore && posts.length > 0 ? (
                        <View style={styles.footerBrand}>
                            <MaterialCommunityIcons name="check-circle" size={24} color={Colors.dark.primary} />
                            <Text style={styles.footerBrandText}>You've rolled it all today</Text>
                        </View>
                    ) : null
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <ActivityIndicator size="small" color={Colors.dark.textSecondary} style={{ marginBottom: 10 }} />
                        <Text style={styles.emptyText}>Nothing to see here yet.</Text>
                    </View>
                }
            />

            <ShareModal
                visible={shareModalVisible}
                onClose={() => setShareModalVisible(false)}
                content={sharedContent}
            />

            <CustomActionSheet
                visible={optionsModalVisible}
                onClose={() => setOptionsModalVisible(false)}
                options={actionSheetOptions}
                title={sheetTitle || (optionsPost ? (user?.id === optionsPost.user_id ? "Manage Your Post" : "Post Options") : "")}
            />

            <ReportModal
                visible={reportModalVisible}
                onClose={() => setReportModalVisible(false)}
                // onSubmit={handleReportSubmit} // Removed
                targetType={reportTarget}
                targetId={reportTarget === 'user' ? optionsPost?.user_id : optionsPost?.id}
            />

            {toastMessage ? <CustomToast visible={!!toastMessage} message={toastMessage} onHide={() => setToastMessage('')} /> : null}
        </View>
    );
});

const styles = StyleSheet.create({
    emptyContainer: {
        marginTop: 50,
        alignItems: 'center',
    },
    emptyText: {
        color: Colors.dark.textSecondary,
    },
    footerBrand: {
        paddingVertical: 40,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    footerBrandText: {
        color: Colors.dark.textSecondary,
        fontSize: 14,
        fontWeight: '600',
    },
    // Instagram-style banner for new posts
    newPostsBanner: {
        position: 'absolute',
        // 'top' is now set dynamically via inline styles
        alignSelf: 'center',
        backgroundColor: Colors.dark.primary, // Cyan theme
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        zIndex: 1000,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
    },
    newPostsBannerText: {
        color: '#000',
        fontSize: 14,
        fontWeight: '600',
    }
});
