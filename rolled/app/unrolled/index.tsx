import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View, Platform, TextInput } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    useAnimatedScrollHandler,
    withTiming,
    interpolate,
    Extrapolation,
    withRepeat,
    withSequence,
    withDelay,
    runOnJS,
    Layout,
    FadeIn,
    FadeOut
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFeedScroll } from '../../context/FeedScrollContext';
import { AnonPostCard, AnonPostProps } from '../../components/AnonPostCard';

const AnimatedFlashList = Animated.createAnimatedComponent(FlashList);
import { ActionSheetOption, CustomActionSheet } from '../../components/CustomActionSheet';
import { CustomToast } from '../../components/CustomToast';
import { ReportModal } from '../../components/ReportModal';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { ShareContent, ShareModal } from '../../components/ShareModal';
import { Colors } from '../../constants/Colors';
import { supabase } from '../../lib/supabase';
import { useUnrolledStore } from '../../stores/unrolledStore';

export default function UnrolledFeed() {
    const [showGhost, setShowGhost] = useState(true);
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { isScrollEnabled, tabBarTranslateY } = useFeedScroll();

    // Approximate combined height: header(~60) + input(~105) + filters(~75) = ~240
    const HEADER_HEIGHT = 240;
    const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 88 : 60;

    const translationY = useSharedValue(0);

    const scrollHandler = useAnimatedScrollHandler({
        onScroll: (event, ctx: any) => {
            'worklet';
            const currentY = event.contentOffset.y;
            const prevY = ctx.prevY ?? currentY;
            const diff = currentY - prevY;

            if (currentY < 5) {
                translationY.value = withTiming(0, { duration: 100 });
                tabBarTranslateY.value = withTiming(0, { duration: 100 });
            } else {
                let newVal = translationY.value + diff;
                if (newVal < 0) newVal = 0;
                if (newVal > HEADER_HEIGHT) newVal = HEADER_HEIGHT;
                translationY.value = newVal;

                let tabVal = tabBarTranslateY.value + diff;
                if (tabVal < 0) tabVal = 0;
                if (tabVal > TAB_BAR_HEIGHT) tabVal = TAB_BAR_HEIGHT;
                tabBarTranslateY.value = tabVal;
            }
            ctx.prevY = currentY;
        },
        onBeginDrag: (event, ctx: any) => {
            'worklet';
            ctx.prevY = event.contentOffset.y;
        }
    });

    const headerAnimatedStyle = useAnimatedStyle(() => {
        return {
            transform: [
                {
                    translateY: interpolate(
                        translationY.value,
                        [0, HEADER_HEIGHT],
                        [0, -HEADER_HEIGHT],
                        Extrapolation.CLAMP
                    )
                }
            ],
        };
    });

    const [posts, setPosts] = useState<AnonPostProps[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [identity, setIdentity] = useState<any>(null);
    const blockedIdentityIds = useUnrolledStore(state => state.blockedIdentityIds);
    const [activeFilter, setActiveFilter] = useState('All');
    const [sortBy, setSortBy] = useState<'new' | 'fire'>('new'); // Default to Newest for freshness

const UNROLLED_PLACEHOLDERS = ['Ask your campus', 'Start your conversation', 'Whats on your mind', 'Share your experience', 'Ask rolled'];

    const [placeholderIndex, setPlaceholderIndex] = useState(0);
    const placeholderOpacity = useSharedValue(1);

    const [isPosting, setIsPosting] = useState(false);
    const [postContent, setPostContent] = useState('');
    const [selectedPostBadge, setSelectedPostBadge] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        let isMounted = true;
        const updatePlaceholder = () => {
            setPlaceholderIndex(prev => (prev + 1) % UNROLLED_PLACEHOLDERS.length);
        };

        const interval = setInterval(() => {
            if (!isMounted) return;
            placeholderOpacity.value = withTiming(0, { duration: 400 }, (finished) => {
                if (finished) {
                    runOnJS(updatePlaceholder)();
                    placeholderOpacity.value = withTiming(1, { duration: 400 });
                }
            });
        }, 5000);
        
        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, []);

    const placeholderAnimatedStyle = useAnimatedStyle(() => {
        return {
            opacity: placeholderOpacity.value
        };
    });

    // Menu & Report State
    const [actionSheetVisible, setActionSheetVisible] = useState(false);
    const [selectedPost, setSelectedPost] = useState<AnonPostProps | null>(null);
    const [reportModalVisible, setReportModalVisible] = useState(false);
    const [toastMessage, setToastMessage] = useState('');

    // Share Modal
    const [shareVisible, setShareVisible] = useState(false);
    const [sharedContent, setSharedContent] = useState<ShareContent | null>(null);

    const handleCreatePost = async () => {
        if (!postContent.trim()) return;
        setIsSubmitting(true);
        try {
            const { error } = await supabase.rpc('create_anon_post', {
                content_text: postContent,
                badge_text: selectedPostBadge
            });
            if (error) throw error;
            setIsPosting(false);
            setPostContent('');
            setSelectedPostBadge(null);
            fetchPosts(); // refresh feed
            setToastMessage('Post created!');
        } catch (e) {
            console.error("Post error:", e);
            setToastMessage('Failed to create post');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleShare = (post: AnonPostProps) => {
        setSharedContent({
            type: 'unrolled',
            id: post.id,
            preview: {
                title: post.content,
                subtitle: `~ ${post.anon_name || 'Anonymous'}`
            },
            data: post
        });
        setShareVisible(true);
    };

    // Initial Identity Check
    useEffect(() => {
        checkIdentity();
    }, [activeFilter, sortBy]);

    // Realtime Listener for New Posts
    useEffect(() => {
        if (!identity?.id) return;

        console.log("🔔 UnrolledFeed: Subscribing to public:anon_posts");

        const channel = supabase
            .channel('public:anon_posts')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'anon_posts' },
                async (payload) => {
                    console.log("🔔 UnrolledFeed: New Post Event Received", payload.new.id);

                    // 1. Filter by Badge if active
                    if (activeFilter !== 'All' && payload.new.badge !== activeFilter) return;

                    // 2. Fetch full details (author info)
                    const { data: postData } = await supabase
                        .from('anon_posts')
                        .select(`*, identity:anon_identities!anon_posts_identity_id_fkey(anon_name, avatar_color)`)
                        .eq('id', payload.new.id)
                        .single();

                    if (postData) {
                        const newPost: AnonPostProps = {
                            id: postData.id,
                            content: postData.content,
                            identity_id: postData.identity_id,
                            anon_name: postData.identity?.anon_name || 'Anonymous',
                            avatar_color: postData.identity?.avatar_color || '#333',
                            created_at: postData.created_at,
                            upvotes: 0,
                            downvotes: 0,
                            reply_count: 0,
                            badge: postData.badge,
                            vote_type: 0
                        };

                        setPosts(prev => {
                            if (prev.some(p => p.id === newPost.id)) return prev;
                            return [newPost, ...prev];
                        });
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [identity, activeFilter]);

    const checkIdentity = async () => {
        const { data, error } = await supabase.rpc('get_my_anon_identity');
        if (data?.found) {
            setIdentity(data);
            useUnrolledStore.getState().fetchBlockedIdentities();
            fetchPosts();
        } else {
            router.replace('/unrolled/onboarding');
        }
    };

    const fetchPosts = async () => {
        try {
            setLoading(true);

            // Use RPC for sophisticated sorting (Fire Score)
            // Ensure you ran supabase_fire_sort.sql!
            const { data: postsData, error } = await supabase.rpc('get_unrolled_feed', {
                sort_type: sortBy,
                filter_badge: activeFilter,
                limit_count: 50,
                offset_count: 0
            });

            if (error) throw error;

            if (postsData) {
                const { data: votesData } = await supabase
                    .from('anon_votes')
                    .select('post_id, vote_type');

                const myVotes = new Map();
                votesData?.forEach((v: any) => myVotes.set(v.post_id, v.vote_type));

                const formatted: AnonPostProps[] = postsData.map((p: any) => ({
                    id: p.id,
                    content: p.content,
                    identity_id: p.identity_id,
                    anon_name: p.anon_name || 'Anonymous', // Simplified from RPC
                    avatar_color: p.avatar_color || '#333', // Simplified from RPC
                    created_at: p.created_at,
                    upvotes: p.upvotes,
                    downvotes: p.downvotes,
                    reply_count: p.reply_count,
                    badge: p.badge,
                    vote_type: myVotes.get(p.id) || 0
                }));
                setPosts(formatted);
            }
        } catch (e) {
            console.error("Fetch error:", e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleVote = async (post: AnonPostProps, type: 1 | -1) => {
        setPosts(prev => prev.map(p => {
            // ... (Optimistic update logic remains same)
            if (p.id !== post.id) return p;
            const currentVote = p.vote_type || 0;
            let newVote = 0;
            let upChange = 0;
            let downChange = 0;

            if (currentVote === type) {
                newVote = 0;
                if (type === 1) upChange = -1;
                else downChange = -1;
            } else {
                newVote = type;
                if (type === 1) {
                    upChange = 1;
                    if (currentVote === -1) downChange = -1;
                } else {
                    downChange = 1;
                    if (currentVote === 1) upChange = -1;
                }
            }

            return {
                ...p,
                vote_type: newVote as any,
                upvotes: p.upvotes + upChange,
                downvotes: p.downvotes + downChange
            };
        }));

        try {
            // ... (RPC call remains same)
            const { error } = await supabase.rpc('vote_on_anon_post', { p_id: post.id, v_type: type });
            if (error) throw error;
        } catch (e) {
            console.error("Vote failed", e);
        }
    };

    // --- Menu Handling ---

    const openMenu = (post: AnonPostProps) => {
        setSelectedPost(post);
        setActionSheetVisible(true);
    };

    const handleDelete = async () => {
        if (!selectedPost) return;

        // Optimistic Remove
        setPosts(prev => prev.filter(p => p.id !== selectedPost.id));
        setToastMessage('Post deleted');

        try {
            const { error } = await supabase.from('anon_posts').delete().eq('id', selectedPost.id);
            if (error) throw error;
        } catch (error) {
            console.error('Delete failed:', error);
            fetchPosts(); // Revert
            setToastMessage('Failed to delete');
        }
    };

    const handleReportSubmit = async (reason: string, details: string) => {
        if (!selectedPost) return;

        try {
            // Use updated RPC function name in next step if generic insert fails, 
            // but for now let's try direct insert or the RPC we made 'create_anon_report'
            const { error } = await supabase.rpc('create_anon_report', {
                target_post_id: selectedPost.id,
                reason_text: reason,
                details_text: details
            });

            if (error) throw error;
            // Success handled by ReportModal internal step
        } catch (error) {
            console.error('Report failed:', error);
            // Optional: keep error toast or use Alert? keeping toast for error is fine
            setToastMessage('Failed to submit report');
        }
    };

    const handleBlockAnonUser = async () => {
        if (!selectedPost) return;
        const identityId = selectedPost.identity_id;
        
        // Block them in the store (optimistic)
        await useUnrolledStore.getState().blockIdentity(identityId);
        setToastMessage('User blocked. You will no longer see their posts.');
        setActionSheetVisible(false);
    };

    const getActionOptions = (): ActionSheetOption[] => {
        if (!selectedPost || !identity) return [];

        if (selectedPost.identity_id === identity.id) {
            return [
                {
                    label: 'Delete Post',
                    icon: 'trash-can-outline',
                    isDestructive: true,
                    onPress: handleDelete
                }
            ];
        } else {
            return [
                {
                    label: 'Report Post',
                    icon: 'flag-variant-outline',
                    isDestructive: true,
                    onPress: () => setReportModalVisible(true)
                },
                {
                    label: 'Block User',
                    icon: 'block-helper',
                    isDestructive: true,
                    onPress: handleBlockAnonUser
                }
            ];
        }
    };
    const renderItem = ({ item }: { item: any }) => (
        <AnonPostCard
            post={item as AnonPostProps}
            onUpvote={() => handleVote(item, 1)}
            onDownvote={() => handleVote(item, -1)}
            onReply={() => router.push({
                pathname: `/unrolled/${item.id}`,
                params: { initialData: JSON.stringify(item) }
            } as any)}
            onReport={() => openMenu(item)}
            onShare={() => handleShare(item)}
        />
    );

    return (
        <ScreenWrapper style={styles.container}>
            {showGhost && <GhostAnimationOverlay onComplete={() => setShowGhost(false)} />}
            <View style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: insets.top,
                backgroundColor: '#000',
                zIndex: 2000,
            }} />

            <Animated.View style={[
                styles.absoluteHeader,
                { top: insets.top },
                headerAnimatedStyle
            ]}>
                {/* Header */}
                <View style={[styles.header, { position: 'relative' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', zIndex: 10 }}>
                        <Text style={styles.headerTitle}>Unrolled<Text style={{ color: Colors.dark.primary }}>.</Text></Text>
                    </View>

                    {/* Right-aligned Sort Toggles */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', zIndex: 10 }}>
                        <View style={[styles.sortToggleContainer, { padding: 4 }]}>
                            <TouchableOpacity
                                onPress={() => setSortBy('fire')}
                                style={[styles.sortBtn, sortBy === 'fire' && styles.sortBtnActive]}
                            >
                                <MaterialCommunityIcons name="fire" size={14} color={sortBy === 'fire' ? '#FF4500' : '#666'} />
                                {sortBy === 'fire' && <Text style={[styles.sortBtnText, { color: '#FFF' }]}>Fire</Text>}
                            </TouchableOpacity>

                            <View style={{ width: 1, height: 16, backgroundColor: '#333', marginHorizontal: 4 }} />

                            <TouchableOpacity
                                onPress={() => setSortBy('new')}
                                style={[styles.sortBtn, sortBy === 'new' && styles.sortBtnActive]}
                            >
                                <MaterialCommunityIcons name="clock-outline" size={14} color={sortBy === 'new' ? '#FFF' : '#666'} />
                                {sortBy === 'new' && <Text style={[styles.sortBtnText, { color: '#FFF' }]}>New</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                {/* Input Trigger / Posting Area */}
                <Animated.View layout={Layout.duration(300)} style={{ width: '100%', paddingHorizontal: 16, paddingBottom: 10 }}>
                    {!isPosting ? (
                        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)}>
                            <TouchableOpacity style={styles.inputTrigger} onPress={() => setIsPosting(true)}>
                                <View style={styles.questionIcon}>
                                    <MaterialCommunityIcons name="ghost" size={22} color={Colors.dark.primary} />
                                </View>
                                <Animated.Text style={[styles.placeholderText, placeholderAnimatedStyle]}>{UNROLLED_PLACEHOLDERS[placeholderIndex]}</Animated.Text>
                            </TouchableOpacity>
                        </Animated.View>
                    ) : (
                        <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(200)} style={styles.expandedPostBox}>
                            <View style={styles.expandedHeader}>
                                <TouchableOpacity onPress={() => setIsPosting(false)} style={{ padding: 8 }}>
                                    <Text style={styles.cancelText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    style={[styles.postButton, (!postContent.trim() || isSubmitting) && { opacity: 0.5 }]} 
                                    onPress={handleCreatePost}
                                    disabled={!postContent.trim() || isSubmitting}
                                >
                                    {isSubmitting ? <ActivityIndicator size="small" color="#000" /> : <Text style={styles.postText}>Post</Text>}
                                </TouchableOpacity>
                            </View>
                            <TextInput
                                style={styles.expandedInput}
                                placeholder="Share your stories..."
                                placeholderTextColor="#666"
                                multiline
                                autoFocus
                                value={postContent}
                                onChangeText={setPostContent}
                            />
                            <Text style={styles.badgeLabel}>ADD A BADGE (OPTIONAL)</Text>
                            <View style={styles.badgeRow}>
                                {['Chill', 'Stories', 'Opinions', 'Confession', 'Rant'].map(badge => (
                                    <TouchableOpacity
                                        key={badge}
                                        style={[
                                            styles.badgeItem,
                                            selectedPostBadge === badge && styles.badgeActive,
                                            selectedPostBadge === badge && { borderColor: getBadgeColor(badge) }
                                        ]}
                                        onPress={() => setSelectedPostBadge(selectedPostBadge === badge ? null : badge)}
                                    >
                                        <Text style={[
                                            styles.badgeText,
                                            selectedPostBadge === badge && { color: getBadgeColor(badge) }
                                        ]}>
                                            {getDisplayBadge(badge).toUpperCase()}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </Animated.View>
                    )}
                </Animated.View>

                {/* Filter Chips */}
                <View>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.filterContainer}
                    >
                        {['All', 'Chill', 'Stories', 'Opinions', 'Confession', 'Rant'].map((filter) => (
                            <TouchableOpacity
                                key={filter}
                                style={[
                                    styles.filterChip,
                                    filter === activeFilter && styles.activeChip,
                                    filter === activeFilter && { borderColor: getBadgeColor(filter) },
                                    filter === activeFilter && { backgroundColor: getBadgeColor(filter) + '20' } // 20% opacity
                                ]}
                                onPress={() => { setActiveFilter(filter); }}
                            >
                                <Text style={[
                                    styles.filterText,
                                    filter === activeFilter && { color: getBadgeColor(filter) }
                                ]}>
                                    {getDisplayBadge(filter).toUpperCase()}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            </Animated.View>

            {loading && !refreshing ? (
                <ActivityIndicator color={Colors.dark.primary} style={{ marginTop: HEADER_HEIGHT + insets.top + 50 }} />
            ) : (
                <AnimatedFlashList
                    data={posts.filter(p => !blockedIdentityIds.includes(p.identity_id))}
                    renderItem={renderItem}
                    // @ts-ignore
                    estimatedItemSize={150}
                    // @ts-ignore
                    onScroll={scrollHandler}
                    scrollEventThrottle={16}
                    contentContainerStyle={{ paddingTop: HEADER_HEIGHT + insets.top + 10, paddingBottom: 50 }}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => { setRefreshing(true); fetchPosts(); }}
                            tintColor={Colors.dark.primary}
                        />
                    }
                    ListFooterComponent={
                        posts.length > 0 ? (
                            <View style={styles.footerBrand}>
                                <MaterialCommunityIcons name="check-circle" size={24} color={Colors.dark.primary} />
                                <Text style={styles.footerBrandText}>You've rolled it all today</Text>
                            </View>
                        ) : null
                    }
                />
            )}

            <CustomActionSheet
                visible={actionSheetVisible}
                onClose={() => setActionSheetVisible(false)}
                options={getActionOptions()}
                title="Post Options"
            />

            <ReportModal
                visible={reportModalVisible}
                onClose={() => setReportModalVisible(false)}
                onSubmit={handleReportSubmit}
            />

            <ShareModal
                visible={shareVisible}
                onClose={() => setShareVisible(false)}
                content={sharedContent}
            />

            {toastMessage ? <CustomToast visible={!!toastMessage} message={toastMessage} onHide={() => setToastMessage('')} /> : null}

        </ScreenWrapper>
    );
}



const GhostAnimationOverlay = ({ onComplete }: { onComplete: () => void }) => {
    const scale = useSharedValue(0.5);
    const cyanOpacity = useSharedValue(1);
    const redOpacity = useSharedValue(0);
    const textOpacity = useSharedValue(0);
    const containerOpacity = useSharedValue(1);
    const zoomScale = useSharedValue(1);

    useEffect(() => {
        // Pop in
        scale.value = withTiming(1.2, { duration: 400 });

        // Turn red and show text
        setTimeout(() => {
            cyanOpacity.value = withTiming(0, { duration: 400 });
            redOpacity.value = withTiming(1, { duration: 400 });
            textOpacity.value = withTiming(1, { duration: 400 });
            scale.value = withTiming(1, { duration: 400 }); // Settle
        }, 600);

        // Zoom into screen and fade out
        setTimeout(() => {
            zoomScale.value = withTiming(8, { duration: 500 }); // Smoothly zoom into the user's face
            containerOpacity.value = withTiming(0, { duration: 400 }, (isFinished) => {
                if (isFinished) {
                    runOnJS(onComplete)();
                }
            });
        }, 1500);
    }, []);

    const cyanStyle = useAnimatedStyle(() => ({ opacity: cyanOpacity.value, position: 'absolute' }));
    const redStyle = useAnimatedStyle(() => ({ opacity: redOpacity.value, position: 'absolute' }));
    const containerAnimatedStyle = useAnimatedStyle(() => ({
        opacity: containerOpacity.value,
        transform: [{ scale: zoomScale.value }]
    }));
    const wrapperStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
    const textAnimatedStyle = useAnimatedStyle(() => ({ opacity: textOpacity.value }));

    return (
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', zIndex: 10000, justifyContent: 'center', alignItems: 'center' }, containerAnimatedStyle]}>
            <Animated.View style={[{ width: 100, height: 100, justifyContent: 'center', alignItems: 'center' }, wrapperStyle]}>
                <Animated.View style={cyanStyle}>
                    <MaterialCommunityIcons name="ghost" size={100} color="#00FFFF" />
                </Animated.View>
                <Animated.View style={redStyle}>
                    <MaterialCommunityIcons name="ghost" size={100} color="#FF0033" />
                </Animated.View>
            </Animated.View>
            <Animated.Text style={[{ color: '#fff', fontSize: 26, fontWeight: '900', fontStyle: 'italic', marginTop: 20 }, textAnimatedStyle]}>
                unroll everything.
            </Animated.Text>
        </Animated.View>
    );
};

const getDisplayBadge = (filter: string) => {
    const lower = filter.toLowerCase();
    if (lower === 'rant') return 'Vent';
    if (lower === 'confession') return 'Spill';
    if (lower === 'chill') return 'Discussion';
    return filter;
};

const getBadgeColor = (filter: string) => {
    switch (filter.toLowerCase()) {
        case 'rant':
        case 'vent': return '#FF4444';
        case 'confession':
        case 'spill': return '#D070FB';
        case 'stories': return '#FF8C00';
        case 'opinions': return '#1E90FF';
        case 'chill':
        case 'discussion': return '#00C851';
        default: return Colors.dark.primary;
    }
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#000',
        paddingHorizontal: 0,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    absoluteHeader: {
        position: 'absolute',
        left: 0,
        right: 0,
        zIndex: 1000,
        backgroundColor: '#000',
        paddingBottom: 4,
        borderBottomWidth: 1,
        borderBottomColor: '#222',
    },
    headerTitle: {
        fontSize: 22, // Shrunk to avoid overlapping with sort toggle
        fontWeight: '900',
        color: '#fff',
        fontStyle: 'italic',
        marginLeft: 6
    },
    activeUsersBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#111',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#333',
        gap: 6
    },
    activeDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#00FFFF', // Cyan for active
        shadowColor: '#00FFFF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 4,
        elevation: 4,
    },
    activeUsersText: {
        color: '#888',
        fontSize: 12,
        fontWeight: 'bold',
    },
    inputContainer: {
        padding: 16,
        paddingBottom: 10
    },
    inputTrigger: {
        backgroundColor: '#111',
        borderWidth: 1,
        borderColor: '#333',
        borderRadius: 20,
        paddingVertical: 24, // Increased vertically
        paddingHorizontal: 20, // Increased horizontally
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16 // Increased gap slightly
    },
    questionIcon: {
        width: 40, height: 40, borderRadius: 20, // Increased from 32
        backgroundColor: '#0a2a2a', // Dark teal
        borderWidth: 1, borderColor: Colors.dark.primary,
        justifyContent: 'center', alignItems: 'center'
    },
    qMark: {
        color: Colors.dark.primary,
        fontWeight: 'bold',
        fontSize: 16,
    },
    placeholderText: {
        color: '#666',
        fontSize: 18, // Increased from 16
    },
    expandedPostBox: {
        backgroundColor: '#111',
        borderWidth: 1,
        borderColor: '#333',
        borderRadius: 20,
        padding: 16,
    },
    expandedHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    cancelText: {
        color: '#fff',
        fontSize: 16,
    },
    postButton: {
        backgroundColor: Colors.dark.primary,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    postText: {
        color: '#000',
        fontWeight: 'bold',
    },
    expandedInput: {
        fontSize: 18,
        color: '#fff',
        minHeight: 100,
        textAlignVertical: 'top',
        marginBottom: 20,
    },
    badgeLabel: {
        color: '#666',
        fontSize: 12,
        fontWeight: 'bold',
        marginBottom: 12,
        letterSpacing: 1,
    },
    badgeRow: {
        flexDirection: 'row',
        gap: 8,
        flexWrap: 'wrap',
    },
    badgeItem: {
        borderWidth: 1,
        borderColor: '#333',
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: '#000',
    },
    badgeActive: {
        backgroundColor: '#222',
    },
    badgeText: {
        color: '#888',
        fontSize: 12,
        fontWeight: 'bold',
    },
    filterContainer: {
        paddingHorizontal: 16,
        paddingTop: 16, // Added padding above chips
        paddingBottom: 24, // Increased padding below chips
        gap: 8,
    },
    filterChip: {
        paddingHorizontal: 16,
        paddingVertical: 8, // Slightly bigger chips
        borderRadius: 20,
        backgroundColor: '#111',
        borderWidth: 1,
        borderColor: '#333',
    },
    activeChip: {
        // Border color handled inline dynamically
    },
    filterText: {
        color: '#888',
        fontSize: 12,
        fontWeight: 'bold',
    },
    sortToggleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#111',
        borderRadius: 16,
        padding: 2,
        borderWidth: 1,
        borderColor: '#333',
        // remove marginLeft: 12 because it's now absolutely centered
    },
    sortBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 14,
    },
    sortBtnActive: {
        backgroundColor: '#333',
    },
    sortBtnText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#666',
    },
    footerBrand: {
        paddingVertical: 40,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    footerBrandText: {
        color: '#666',
        fontSize: 14,
        fontWeight: '600',
    }
});
