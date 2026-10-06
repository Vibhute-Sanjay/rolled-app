

import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, Dimensions, Image, FlatList, Animated } from 'react-native';
import { PinchGestureHandler, PanGestureHandler, State } from 'react-native-gesture-handler';
import { CommentItem, CommentProps } from '../../components/CommentItem';
import { BlurView } from 'expo-blur';
import { CustomActionSheet } from '../../components/CustomActionSheet';
import { CustomToast } from '../../components/CustomToast';
import { PostCard } from '../../components/PostCard';
import { ReportModal } from '../../components/ReportModal';
import { ShareModal, ShareContent } from '../../components/ShareModal';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { formatTimeAgo } from '../../utils/date';
import { Avatar } from '../../components/Avatar';
import { ParsedContent } from '../../components/ParsedContent';
import { useRef } from 'react';

const { width, height } = Dimensions.get('window');
import { MentionSuggestions } from '../../components/MentionSuggestions';
import { FloatingHeart, LIKE_COLOR } from '../../components/FloatingHeart';
import { useInteractionStore } from '../../store/interactionStore';
import { useChatStore } from '../../stores/chatStore';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useVideoStateStore } from '../../stores/videoStateStore';

// Utility to nest comments (Same as Unrolled)
function treeifyComments(comments: CommentProps[]) {
    const map: Record<string, CommentProps & { replies: CommentProps[] }> = {};
    const roots: (CommentProps & { replies: CommentProps[] })[] = [];

    comments.forEach(c => {
        map[c.id] = { ...c, replies: [] };
    });

    comments.forEach(c => {
        if (c.parent_id && map[c.parent_id]) {
            map[c.parent_id].replies.push(map[c.id]);
        } else {
            roots.push(map[c.id]);
        }
    });

    return roots;
}

function flattenTree(nodes: any[], level = 0): any[] {
    let result: any[] = [];
    nodes.forEach(node => {
        result.push({ ...node, level });
        if (node.replies && node.replies.length > 0) {
            result = result.concat(flattenTree(node.replies, level + 1));
        }
    });
    return result;
}

// Custom Zoomable Image Component
const ZoomableImage = ({ uri, style, onZoom }: { uri: string, style: any, onZoom?: (zooming: boolean) => void }) => {
    const scale = useRef(new Animated.Value(1)).current;
    const translateX = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(0)).current;

    const pinchRef = useRef(null);
    const panRef = useRef(null);

    const onPinchEvent = Animated.event(
        [{ nativeEvent: { scale } }],
        { useNativeDriver: true }
    );

    const onPanEvent = Animated.event(
        [{ nativeEvent: { translationX: translateX, translationY: translateY } }],
        { useNativeDriver: true }
    );

    const resetAnimation = () => {
        Animated.parallel([
            Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
            Animated.spring(translateX, { toValue: 0, useNativeDriver: true }),
            Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
        ]).start(() => {
            onZoom?.(false);
        });
    };

    const onPinchStateChange = (event: any) => {
        if (event.nativeEvent.state === State.ACTIVE) {
            onZoom?.(true);
        }
        if (event.nativeEvent.oldState === State.ACTIVE) {
            resetAnimation();
        }
    };

    const onPanStateChange = (event: any) => {
        if (event.nativeEvent.state === State.ACTIVE) {
            onZoom?.(true);
        }
        if (event.nativeEvent.oldState === State.ACTIVE) {
            resetAnimation();
        }
    };

    return (
        <PanGestureHandler
            ref={panRef}
            onGestureEvent={onPanEvent}
            onHandlerStateChange={onPanStateChange}
            simultaneousHandlers={[pinchRef]}
            minPointers={2}
            maxPointers={2}
        >
            <Animated.View style={{ flex: 1, width: width, height: '100%', justifyContent: 'center', alignItems: 'center' }}>
                <PinchGestureHandler
                    ref={pinchRef}
                    simultaneousHandlers={[panRef]}
                    onGestureEvent={onPinchEvent}
                    onHandlerStateChange={onPinchStateChange}
                >
                    <Animated.Image
                        source={{ uri }}
                        style={[style, { transform: [{ translateX }, { translateY }, { scale }] }]}
                        resizeMode="contain"
                    />
                </PinchGestureHandler>
            </Animated.View>
        </PanGestureHandler>
    );
};

const ImmersiveVideo = ({ uri, postId }: { uri: string, postId: string }) => {
    const { isMuted, toggleMute, handoffPlayer, handoffPostId, clearHandoff } = useVideoStateStore();
    const isHandoff = handoffPlayer && handoffPostId === postId;

    const [retryCount, setRetryCount] = useState(0);
    const [playerStatus, setPlayerStatus] = useState<string>('loading');

    let thumbnailUrl = uri;
    if (uri.includes('manifest/video.m3u8')) {
        thumbnailUrl = uri.replace('manifest/video.m3u8', 'thumbnails/thumbnail.jpg');
    } else if (uri.includes('playlist.m3u8')) {
        thumbnailUrl = uri.replace('playlist.m3u8', 'thumbnail.jpg');
    }

    const newPlayer = useVideoPlayer(uri, p => {
        p.loop = true;
    });

    const player = isHandoff ? handoffPlayer : newPlayer;

    useEffect(() => {
        let retryTimeout: NodeJS.Timeout;

        const checkRetry = () => {
            setPlayerStatus(player.status);
            if (player.status === 'error' && retryCount < 6) {
                retryTimeout = setTimeout(() => {
                    setRetryCount(c => c + 1);
                    player.replaceAsync(`${uri}?cb=${Date.now()}`);
                }, 3000);
            }
        };

        checkRetry();

        const statusSub = player.addListener('statusChange', () => {
            checkRetry();
        });

        if (isHandoff) {
            player.loop = true;
            if (!player.playing) {
                player.replay();
            }
        } else {
            player.play();
        }

        return () => {
            if (isHandoff) clearHandoff();
            statusSub.remove();
            clearTimeout(retryTimeout);
        };
    }, [isHandoff, player, retryCount, uri]);

    useEffect(() => {
        player.muted = isMuted;
    }, [isMuted, player]);

    const hasFiredView = useRef(false);
    useEffect(() => {
        const interval = setInterval(() => {
            if (hasFiredView.current) {
                clearInterval(interval);
                return;
            }
            if (player.playing) {
                const current = player.currentTime;
                const duration = player.duration;
                if (duration > 0) {
                    if (current >= 10 || (current / duration) >= 0.33) {
                        hasFiredView.current = true;
                        supabase.rpc('record_post_view', { p_post_id: postId }).then().catch(err => console.error("Error recording view details", err));
                        clearInterval(interval);
                    }
                }
            }
        }, 500);
        return () => clearInterval(interval);
    }, [player, postId]);

    return (
        <View style={{ flex: 1, width: width, height: '100%', justifyContent: 'center', alignItems: 'center' }}>
            <VideoView player={player} style={{ width: '100%', height: '100%' }} fullscreenOptions={{ enable: false }} contentFit="contain" nativeControls={true} />
            
            {/* Thumbnail Overlay */}
            {(!player.playing || playerStatus === 'error' || playerStatus === 'loading') && (
                <Image 
                    source={{ uri: thumbnailUrl }} 
                    style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]} 
                    resizeMode="contain" 
                />
            )}

            {/* Spinner Overlay */}
            {(playerStatus === 'error' || playerStatus === 'loading') && (
                <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', zIndex: 5, backgroundColor: 'rgba(0,0,0,0.3)' }]}>
                    <ActivityIndicator size="large" color="#ffffff" />
                    <Text style={{ color: 'white', marginTop: 16, fontWeight: '600', fontSize: 14, letterSpacing: 0.5, textShadowColor: 'black', textShadowRadius: 4 }}>
                        {playerStatus === 'error' ? "Processing video..." : "Loading..."}
                    </Text>
                </View>
            )}

            {/* Custom Global Mute Toggle */}
            <TouchableOpacity 
                style={{ 
                    position: 'absolute', 
                    top: 110, 
                    right: 15, 
                    backgroundColor: 'rgba(0,0,0,0.6)', 
                    padding: 8, 
                    borderRadius: 24,
                    zIndex: 10 
                }} 
                onPress={toggleMute}
            >
                <Ionicons name={isMuted ? "volume-mute" : "volume-high"} size={22} color="white" />
            </TouchableOpacity>
        </View>
    );
};

export default function PostDetailsScreen() {
    const params = useLocalSearchParams();
    const id = params.id;
    const router = useRouter();
    const { user } = useAuth();
    const updateInteraction = useInteractionStore((state) => state.updateInteraction);

    const [post, setPost] = useState<any>(() => {
        if (params.initialData) {
            try {
                return JSON.parse(params.initialData as string);
            } catch (e) {
                return null;
            }
        }
        return null;
    });

    // Add ScrollView Ref for scrolling to comments
    const scrollViewRef = useRef<ScrollView>(null);
    const commentsSectionRef = useRef<View>(null);
    const [commentsSectionY, setCommentsSectionY] = useState(0);

    const [comments, setComments] = useState<any[]>([]); // Flat threaded list
    const [rawCommentsCount, setRawCommentsCount] = useState(0); // Total count
    const [loading, setLoading] = useState(!post);
    const [commentLoading, setCommentLoading] = useState(true);
    const [commentText, setCommentText] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [replyingTo, setReplyingTo] = useState<CommentProps | null>(null);
    const [likeTrigger, setLikeTrigger] = useState(0);

    // Text Expand Animation State
    const [isTextExpanded, setIsTextExpanded] = useState(false);
    const expandAnim = useRef(new Animated.Value(0)).current;
    const [isZooming, setIsZooming] = useState(false);

    const toggleTextExpand = () => {
        const toValue = isTextExpanded ? 0 : 1;
        Animated.spring(expandAnim, {
            toValue,
            useNativeDriver: false, // Need false for height/padding/background color animations if we use them, but we use transform mostly here. We'll use false to be flexible.
        }).start();
        setIsTextExpanded(!isTextExpanded);
    };

    // Two-state architecture: 'media' vs 'comments'
    const [activeView, setActiveView] = useState<'media' | 'comments'>(
        params.scrollToComments === 'true' ? 'comments' : 'media'
    );

    // Dismiss Gesture (Swipe Down)
    const dismissPanY = useRef(new Animated.Value(0)).current;

    const onDismissPanEvent = Animated.event(
        [{ nativeEvent: { translationY: dismissPanY } }],
        { useNativeDriver: true }
    );

    const onDismissPanStateChange = (event: any) => {
        if (event.nativeEvent.oldState === State.ACTIVE) {
            if (event.nativeEvent.translationY > 100) {
                // Swipe down threshold met, animate out and close
                Animated.timing(dismissPanY, {
                    toValue: height,
                    duration: 200,
                    useNativeDriver: true,
                }).start(() => {
                    handleBack();
                });
            } else {
                // Bounce back
                Animated.spring(dismissPanY, {
                    toValue: 0,
                    useNativeDriver: true,
                }).start();
            }
        }
    };

    const handleBack = () => {
        if (activeView === 'comments' && params.scrollToComments !== 'true') {
            setActiveView('media');
        } else {
            router.back();
        }
    };

    // Mentions Logic
    const [mentionQuery, setMentionQuery] = useState<string | null>(null);
    const [selection, setSelection] = useState({ start: 0, end: 0 });

    // Action Sheet & Modal State
    const [actionSheetVisible, setActionSheetVisible] = useState(false);
    const [postOptionsVisible, setPostOptionsVisible] = useState(false);
    const [reportModalVisible, setReportModalVisible] = useState(false);
    const [reportTargetType, setReportTargetType] = useState<'post' | 'comment' | 'user'>('post');
    const [selectedComment, setSelectedComment] = useState<CommentProps | null>(null);
    const [shareModalVisible, setShareModalVisible] = useState(false);
    const [shareContent, setShareContent] = useState<ShareContent | null>(null);

    const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'error' | 'info' }>({
        visible: false, message: '', type: 'info'
    });

    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
        setToast({ visible: true, message, type });
    };

    const handleDeletePost = async () => {
        try {
            const { error } = await supabase.from('posts').delete().eq('id', post?.id);
            if (error) throw error;
            showToast("Roll deleted.", "success");
            setTimeout(() => router.back(), 1000);
        } catch (e: any) {
            showToast(e.message, "error");
        }
    };

    const handleHidePost = () => {
        showToast("Post hidden.", "success");
        setTimeout(() => router.back(), 500);
    };

    const isPostOwner = user?.id === post?.user_id || user?.id === post?.user?.id;
    const postActionSheetOptions = isPostOwner ? [
        { label: "Delete this Roll", icon: "trash-can-outline", isDestructive: true, onPress: handleDeletePost },
        { label: "Cancel", icon: "close", onPress: () => {} }
    ] : [
        { label: "Hide Post", icon: "eye-off-outline", onPress: handleHidePost },
        { label: "Report User", icon: "account-alert-outline", isDestructive: true, onPress: () => { setReportTargetType("user"); setReportModalVisible(true); } },
        { label: "Report Post", icon: "flag-outline", isDestructive: true, onPress: () => { setReportTargetType("post"); setReportModalVisible(true); } },
        { label: "Cancel", icon: "close", onPress: () => {} } // Cancel can be a no-op since ActionSheet closes automatically when tapped
    ];

    useEffect(() => {
        fetchPostAndComments();
    }, [id]);

    const fetchPostAndComments = async () => {
        try {
            const blockedIds = useChatStore.getState().blockedUserIds;

            // PARALLEL FETCHING: Fetch post, comments, and comment likes simultaneously
            const [postResult, commentsResult, commentLikesResult] = await Promise.all([
                // 1. Fetch Post
                supabase
                    .from('posts')
                    .select(`
                        *,
                        user:profiles!posts_user_id_fkey(id, username, full_name, avatar_url, is_verified, is_admin, is_og),
                        likes(user_id),
                        saved_posts(user_id)
                    `)
                    .eq('id', id)
                    .single(),

                // 2. Fetch Comments
                supabase
                    .from('comments')
                    .select(`
                        *,
                        user:profiles!comments_user_id_fkey(id, username, full_name, avatar_url, is_verified, is_admin, is_og)
                    `)
                    .eq('post_id', id)
                    .order('created_at', { ascending: true }),

                // 3. Fetch Comment Likes
                user ? supabase
                    .from('comment_likes')
                    .select('comment_id')
                    .eq('user_id', user.id)
                    : Promise.resolve({ data: null, error: null })
            ]);

            // Handle errors
            if (postResult.error) throw postResult.error;
            if (commentsResult.error) throw commentsResult.error;

            const postData = postResult.data;
            const commentsData = commentsResult.data;
            const myLikes = commentLikesResult.data;

            const likedCommentIds = new Set(myLikes?.map(l => l.comment_id));

            // Process Post Data
            const likesCount = postData.likes?.length || 0;
            const hasLiked = postData.likes?.some((l: any) => l.user_id === user?.id);
            const isSaved = postData.saved_posts?.some((s: any) => s.user_id === user?.id);

            // Process Comments (Tree + Filter)
            const visibleComments = (commentsData || []).filter(c => !blockedIds.includes(c.user_id));
            setRawCommentsCount(visibleComments.length);

            const processedComments = visibleComments.map((c: any) => ({
                id: c.id,
                content: c.content,
                created_at: c.created_at,
                parent_id: c.parent_id,
                user: c.user,
                replies_count: 0, // Visual only
                has_liked: likedCommentIds.has(c.id)
            }));

            const tree = treeifyComments(processedComments);
            const flatTree = flattenTree(tree);

            setPost({
                ...postData,
                likes_count: likesCount,
                has_liked: hasLiked,
                is_saved: isSaved,
                comments_count: visibleComments.length,
            });

            setComments(flatTree);

            // SYNC STORE
            updateInteraction(postData.id, {
                likes_count: likesCount,
                has_liked: hasLiked,
                has_saved: isSaved,
                comments_count: visibleComments.length
            });

        } catch (error: any) {
            if (error.code === 'PGRST116' || error.message?.includes('0 rows')) {
                // Determine what to show: Post Deleted
                setPost(null);
            } else {
                console.error("Fetch error:", error);
                showToast("Failed to load post.", 'error');
            }
        } finally {
            setLoading(false);
            setCommentLoading(false);
        }
    };

    const handleTextChange = (text: string) => {
        setCommentText(text);

        // Simple mention detection logic
        const cursorPosition = selection.start;
        const textBeforeCursor = text.slice(0, cursorPosition);
        const words = textBeforeCursor.split(/\s/);
        const lastWord = words[words.length - 1];

        if (lastWord.startsWith('@') && lastWord.length > 1) {
            setMentionQuery(lastWord.slice(1));
        } else {
            setMentionQuery(null);
        }
    };

    const handleSelectMention = (username: string) => {
        const cursorPosition = selection.start;
        const textBeforeCursor = commentText.slice(0, cursorPosition);
        const textAfterCursor = commentText.slice(cursorPosition);

        const words = textBeforeCursor.split(/\s/);
        words[words.length - 1] = `@${username} `;

        const newTextBefore = words.join(' ');
        setCommentText(newTextBefore + textAfterCursor);
        setMentionQuery(null);
    };

    const handleSendComment = async () => {
        if (!commentText.trim() || !user) return;

        // Create optimistic comment
        const optimisticComment: CommentProps & { replies: CommentProps[] } = {
            id: `temp-${Date.now()}`, // Temporary ID
            content: commentText,
            created_at: new Date().toISOString(),
            parent_id: replyingTo?.id || null,
            user: {
                id: user.id,
                username: user.user_metadata?.username || 'You',
                full_name: user.user_metadata?.full_name || 'You',
                avatar_url: user.user_metadata?.avatar_url || '',
                is_verified: user.user_metadata?.is_verified,
                is_admin: user.user_metadata?.is_admin,
                is_og: user.user_metadata?.is_og,
            },
            replies_count: 0,
            has_liked: false,
            replies: []
        };

        // OPTIMISTIC UPDATE: Add comment to UI immediately
        if (replyingTo) {
            // Nested reply - add to parent's replies
            setComments(prev => prev.map(c =>
                c.id === replyingTo.id
                    ? { ...c, replies: [...(c.replies || []), optimisticComment] }
                    : c
            ));
        } else {
            // Top-level comment - add to flat tree
            setComments(prev => [...prev, { ...optimisticComment, level: 0 }]);
        }

        // Clear input and state immediately for snappy UX
        const sentCommentText = commentText;
        const sentReplyingTo = replyingTo;
        setCommentText('');
        setReplyingTo(null);
        Keyboard.dismiss();

        setSubmitting(true);
        try {
            const { data, error } = await supabase
                .from('comments')
                .insert({
                    post_id: id,
                    user_id: user.id,
                    content: sentCommentText,
                    parent_id: sentReplyingTo?.id || null
                })
                .select(`
                    *,
                    user:profiles!comments_user_id_fkey(id, username, full_name, avatar_url, is_verified, is_admin, is_og)
                `)
                .single();

            if (error) throw error;

            console.log("✅ Comment Sent:", data);

            // Replace optimistic comment with real one
            await fetchPostAndComments();

        } catch (error: any) {
            console.error("❌ Send Error:", error);
            showToast(error.message || "Failed to send reply.", 'error');

            // REVERT: Remove optimistic comment on error
            setComments(prev => prev.filter(c => c.id !== optimisticComment.id));

            // Restore the comment text so user can retry
            setCommentText(sentCommentText);
            setReplyingTo(sentReplyingTo);
        } finally {
            setSubmitting(false);
        }
    };

    const handleLikeComment = async (comment: any) => {
        try {
            // Optimistic Update
            setComments(prev => prev.map(c =>
                c.id === comment.id ? { ...c, has_liked: !c.has_liked } : c
            ));

            if (comment.has_liked) {
                // Unlike
                await supabase.from('comment_likes').delete().eq('comment_id', comment.id).eq('user_id', user?.id);
            } else {
                // Like
                await supabase.from('comment_likes').insert({ comment_id: comment.id, user_id: user?.id });
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleShowOptions = (comment: CommentProps) => {
        setSelectedComment(comment);
        setReportTargetType('comment');
        setActionSheetVisible(true);
    };

    const handleDeleteComment = async () => {
        if (!selectedComment) return;
        try {
            const { error } = await supabase.from('comments').delete().eq('id', selectedComment.id);
            if (error) throw error;

            showToast("Reply deleted.", 'success');
            await fetchPostAndComments(); // Refresh tree
        } catch (error: any) {
            showToast(error.message, 'error');
        } finally {
            setActionSheetVisible(false);
            setSelectedComment(null);
        }
    };

    // ... Report Logic same ...
    const isOwner = selectedComment?.user.id === user?.id;
    const actionSheetOptions = isOwner ? [
        { label: "Delete Reply", icon: "trash-can-outline", isDestructive: true, onPress: handleDeleteComment },
        { label: "Cancel", icon: "close", onPress: () => {} }
    ] : [
        { label: "Report Reply", icon: "flag-outline", isDestructive: true, onPress: () => { setReportTargetType("comment"); setReportModalVisible(true); } },
        { label: "Cancel", icon: "close", onPress: () => {} }
    ];

    if (loading) {
        return (
            <ScreenWrapper>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={Colors.dark.primary} />
                </View>
            </ScreenWrapper>
        );
    }

    if (!post) {
        return (
            <ScreenWrapper>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 20 }}>
                    <MaterialCommunityIcons name="alert-circle-outline" size={60} color={Colors.dark.textSecondary} />
                    <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>This roll has been deleted.</Text>
                    <TouchableOpacity onPress={() => router.back()} style={{ backgroundColor: '#333', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 }}>
                        <Text style={{ color: 'white' }}>Go Back</Text>
                    </TouchableOpacity>
                </View>
            </ScreenWrapper>
        );
    }

    return (
        <ScreenWrapper style={{ paddingHorizontal: 0 }}>
            <CustomToast
                visible={toast.visible}
                message={toast.message}
                type={toast.type}
                onHide={() => setToast(prev => ({ ...prev, visible: false }))}
            />

            {/* Custom Floating Header */}
            {!isZooming && (
                <View style={[styles.floatingHeader, { zIndex: 100 }]}>
                    <TouchableOpacity onPress={handleBack} style={styles.iconCircle}>
                        <FontAwesome5 name="chevron-left" size={16} color="white" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.userPill}
                        onPress={() => {
                            const targetId = post.profile?.id || post.user?.id;
                            if (user && user.id === targetId) {
                                router.push('/profile');
                            } else {
                                router.push(`/user/${targetId}`);
                            }
                        }}
                    >
                        <Avatar
                            uri={post.profile?.avatar_url || post.user?.avatar_url}
                            size={32}
                        />
                        <View style={styles.userPillTextContainer}>
                            <Text style={styles.userPillName} numberOfLines={1}>
                                {post.profile?.full_name || post.user?.full_name || 'User'}
                            </Text>
                            <Text style={styles.userPillHandle} numberOfLines={1}>
                                @{post.profile?.username || post.user?.username}
                            </Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => { setPostOptionsVisible(true); }} style={styles.iconCircle}>
                        <MaterialCommunityIcons name="dots-horizontal" size={24} color="white" />
                    </TouchableOpacity>
                </View>
            )}

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
                {activeView === 'media' ? (
                    /* ----- MEDIA VIEW ----- */
                    <PanGestureHandler
                        onGestureEvent={onDismissPanEvent}
                        onHandlerStateChange={onDismissPanStateChange}
                        activeOffsetY={[-20, 20]}
                        failOffsetX={[-20, 20]}
                    >
                        <Animated.View style={[styles.mediaViewContainer, { transform: [{ translateY: dismissPanY }] }]}>
                            {/* Immersive Post Content (No ScrollView, allow free zoom) */}
                            <View style={styles.immersiveContentContainer} pointerEvents="box-none">

                                {/* Edge-to-Edge Media */}
                                {post.media_urls && post.media_urls.length > 0 ? (
                                    <>
                                        <Animated.View style={[styles.mediaWrapper, { flex: 1 }]}>
                                            <FlatList
                                                data={post.media_urls.filter((url: string) => url && typeof url === 'string' && url.trim().length > 0)}
                                                keyExtractor={(_, index) => index.toString()}
                                                horizontal
                                                pagingEnabled
                                                showsHorizontalScrollIndicator={false}
                                                scrollEnabled={!isZooming}
                                                renderItem={({ item }: { item: string }) => (
                                                    post.media_type === 'video' ? (
                                                        <ImmersiveVideo uri={item} postId={post.id} />
                                                    ) : (
                                                        <View style={{ width: width, height: '100%', zIndex: isZooming ? 999 : 1 }}>
                                                            <ZoomableImage
                                                                uri={item}
                                                                style={styles.immersiveImage}
                                                                onZoom={setIsZooming}
                                                            />
                                                        </View>
                                                    )
                                                )}
                                            />
                                        </Animated.View>

                                        {/* Post Text & Timestamp below Media */}
                                        {!isZooming && post.content ? (
                                            (() => {
                                                const isLongText = post.content.length > 80;
                                                return (
                                                    <View style={[styles.textDetailsContainer, isTextExpanded && styles.textDetailsExpanded, { zIndex: 10 }]} pointerEvents="box-none">
                                                        <ScrollView
                                                            style={{ maxHeight: isTextExpanded ? height * 0.35 : undefined }}
                                                            scrollEnabled={isTextExpanded}
                                                            showsVerticalScrollIndicator={false}
                                                        >
                                                            <ParsedContent
                                                                content={post.content}
                                                                style={styles.immersiveText}
                                                                numberOfLines={isTextExpanded ? undefined : 2}
                                                            />
                                                        </ScrollView>

                                                        {isLongText && (
                                                            <TouchableOpacity onPress={toggleTextExpand} style={{ marginTop: 8 }}>
                                                                <Text style={{ color: Colors.dark.textSecondary, fontWeight: 'bold' }}>
                                                                    {isTextExpanded ? "Show Less" : "Read More"}
                                                                </Text>
                                                            </TouchableOpacity>
                                                        )}

                                                        {!isTextExpanded && (
                                                            <Text style={styles.immersiveTimestamp}>
                                                                {formatTimeAgo(post.created_at).toUpperCase()}
                                                            </Text>
                                                        )}
                                                    </View>
                                                );
                                            })()
                                        ) : null}
                                    </>
                                ) : (
                                    <View style={[styles.textDetailsContainer, { flex: 1, justifyContent: 'center' }]}>
                                        <ScrollView showsVerticalScrollIndicator={false}>
                                            <ParsedContent
                                                content={post.content}
                                                style={[styles.immersiveText, { fontSize: 24, lineHeight: 32 }]}
                                            />
                                            <Text style={[styles.immersiveTimestamp, { marginTop: 20 }]}>
                                                {formatTimeAgo(post.created_at).toUpperCase()}
                                            </Text>
                                        </ScrollView>
                                    </View>
                                )}
                            </View>

                            {/* Floating Action Pill (Pinned at bottom) */}
                            {!isZooming && (
                                <View style={[styles.floatingActionPillContainer, { zIndex: 10 }]} pointerEvents="box-none">
                                    <View style={styles.actionPill}>
                                        <View style={{ position: 'relative' }}>
                                            <TouchableOpacity
                                                style={styles.pillAction}
                                                onPress={async () => {
                                                    const newHasLiked = !post.has_liked;
                                                    const newLikesCount = post.has_liked ? post.likes_count - 1 : post.likes_count + 1;

                                                    setPost({ ...post, has_liked: newHasLiked, likes_count: newLikesCount });
                                                    updateInteraction(post.id, { has_liked: newHasLiked, likes_count: newLikesCount });
                                                    if (newHasLiked) setLikeTrigger(t => t + 1);

                                                    try {
                                                        if (newHasLiked) {
                                                            await supabase.from('likes').insert({ post_id: post.id, user_id: user?.id });
                                                        } else {
                                                            await supabase.from('likes').delete().eq('post_id', post.id).eq('user_id', user?.id);
                                                        }
                                                    } catch (e) {
                                                        console.error(e);
                                                        setPost({ ...post, has_liked: !newHasLiked, likes_count: post.likes_count });
                                                    }
                                                }}
                                            >
                                                <MaterialCommunityIcons
                                                    name={post.has_liked ? "heart" : "heart-outline"}
                                                    size={26}
                                                    color={post.has_liked ? LIKE_COLOR : "white"}
                                                />
                                                <Text style={[styles.pillActionText, post.has_liked && { color: LIKE_COLOR }]}>
                                                    {post.likes_count || 0}
                                                </Text>
                                            </TouchableOpacity>
                                            <FloatingHeart trigger={likeTrigger} />
                                        </View>

                                        <TouchableOpacity
                                            style={styles.pillAction}
                                            onPress={() => setActiveView('comments')}
                                        >
                                            <MaterialCommunityIcons name="comment-outline" size={24} color="white" />
                                            <Text style={styles.pillActionText}>{rawCommentsCount}</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity style={styles.pillAction} onPress={() => {
                                            setShareContent({
                                                type: 'post',
                                                id: post.id,
                                                preview: {
                                                    title: post.content || 'A Roll',
                                                    image: post.media_urls?.[0]
                                                }
                                            });
                                            setShareModalVisible(true);
                                        }}>
                                            <MaterialCommunityIcons name="share-outline" size={26} color="white" />
                                            <Text style={styles.pillActionText}>Share</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}
                        </Animated.View>
                    </PanGestureHandler>

                ) : (
                    /* ----- COMMENTS VIEW ----- */
                    <View style={styles.commentsViewContainer}>
                        <ScrollView
                            ref={scrollViewRef}
                            contentContainerStyle={{ paddingTop: Platform.OS === 'ios' ? 95 : 75, paddingBottom: 20 }}
                            showsVerticalScrollIndicator={false}
                        >
                            <View style={styles.commentsSection}>
                                <Text style={styles.sectionTitle}>Replies ({rawCommentsCount})</Text>
                                {comments.map(comment => (
                                    <View key={comment.id} style={{ marginLeft: (comment.level || 0) * 20 }}>
                                        <CommentItem
                                            comment={comment}
                                            onReply={(c) => {
                                                setReplyingTo(c);
                                            }}
                                            onLike={handleLikeComment}
                                            onShowOptions={handleShowOptions}
                                            currentUserId={user?.id}
                                        />
                                    </View>
                                ))}
                            </View>
                        </ScrollView>

                        {/* Input Bar */}
                        <View style={styles.inputBar}>
                            {replyingTo && (
                                <View style={styles.replyingBanner}>
                                    <Text style={styles.replyingText}>Replying to @{replyingTo.user.username}</Text>
                                    <TouchableOpacity onPress={() => setReplyingTo(null)}>
                                        <Ionicons name="close-circle" size={20} color="#999" />
                                    </TouchableOpacity>
                                </View>
                            )}

                            {mentionQuery !== null && (
                                <MentionSuggestions
                                    query={mentionQuery}
                                    onSelect={handleSelectMention}
                                />
                            )}
                            <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
                                <TextInput
                                    style={styles.input}
                                    placeholder={replyingTo ? "Write a reply..." : "Write a reply..."}
                                    placeholderTextColor="#666"
                                    value={commentText}
                                    onChangeText={handleTextChange}
                                    onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
                                    multiline
                                />
                                <TouchableOpacity
                                    style={[styles.sendButton, !commentText.trim() && styles.disabledSend]}
                                    onPress={handleSendComment}
                                    disabled={submitting || !commentText.trim()}
                                >
                                    {submitting ? <ActivityIndicator size="small" color="white" /> : <Ionicons name="send" size={20} color="white" />}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                )
                }
            </KeyboardAvoidingView >

            <CustomActionSheet
                visible={actionSheetVisible}
                onClose={() => setActionSheetVisible(false)}
                options={actionSheetOptions}
            />

            <CustomActionSheet
                visible={postOptionsVisible}
                onClose={() => setPostOptionsVisible(false)}
                options={postActionSheetOptions}
            />

            <ReportModal
                visible={reportModalVisible}
                onClose={() => setReportModalVisible(false)}
                targetType={reportTargetType}
                targetId={reportTargetType === 'post' ? post?.id : (reportTargetType === 'user' ? (post?.user?.id || post?.user_id) : selectedComment?.id)}
            />

            <ShareModal
                visible={shareModalVisible}
                onClose={() => setShareModalVisible(false)}
                content={shareContent}
            />
        </ScreenWrapper >
    );
}

const styles = StyleSheet.create({
    floatingHeader: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 50 : 30, // Adjust for safe area
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 15,
        zIndex: 10,
    },
    iconCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    userPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        borderRadius: 30,
        padding: 6,
        paddingRight: 15,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)'
    },
    userPillTextContainer: {
        marginLeft: 10,
        justifyContent: 'center',
    },
    userPillName: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14,
        maxWidth: 120,
    },
    userPillHandle: {
        color: '#22d3ee', // Cyan
        fontSize: 12,
        maxWidth: 120,
    },
    mediaViewContainer: {
        flex: 1,
        backgroundColor: 'black',
    },
    commentsViewContainer: {
        flex: 1,
        backgroundColor: Colors.dark.background,
    },
    immersiveContentContainer: {
        flex: 1,
        backgroundColor: 'black',
        paddingTop: Platform.OS === 'ios' ? 100 : 80, // Accounts for absolute header
        paddingBottom: 90, // Accounts for absolute floating pill
    },
    mediaWrapper: {
        width: width,
        backgroundColor: 'black',
    },
    immersiveImage: {
        width: width,
        height: '100%',
    },
    textDetailsContainer: {
        width: '100%',
        paddingHorizontal: 25,
        alignItems: 'center',
        paddingVertical: 10,
    },
    textDetailsExpanded: {
        position: 'absolute',
        width: '100%',
        backgroundColor: 'rgba(0,0,0,0.8)',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        bottom: 80, // Sit just above the action pill
        paddingTop: 20,
        paddingBottom: 20,
    },
    immersiveText: {
        color: 'white',
        fontSize: 18,
        fontWeight: '600',
        lineHeight: 26,
        textAlign: 'center',
        textShadowColor: 'rgba(0,0,0,0.8)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 6,
    },
    immersiveTimestamp: {
        color: '#ddd',
        fontSize: 11,
        marginTop: 10,
        letterSpacing: 1.5,
        textShadowColor: 'rgba(0,0,0,0.6)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
    floatingActionPillContainer: {
        position: 'absolute',
        bottom: Platform.OS === 'ios' ? 30 : 20, // Positioned at the very bottom
        width: '100%',
        alignItems: 'center',
        zIndex: 10,
    },
    actionPill: {
        flexDirection: 'row',
        backgroundColor: 'rgba(20, 20, 20, 0.95)',
        borderRadius: 40,
        paddingVertical: 10,
        paddingHorizontal: 30,
        gap: 25,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
        elevation: 10,
    },
    pillAction: {
        alignItems: 'center',
        gap: 4,
    },
    pillActionText: {
        color: '#888',
        fontSize: 11,
        fontWeight: '600',
    },

    // Legacy styles for input bar and comments
    divider: { height: 1, backgroundColor: '#222', marginVertical: 0 },
    commentsSection: { paddingTop: 15 },
    sectionTitle: { color: 'white', fontWeight: 'bold', marginBottom: 15, paddingHorizontal: 15 },

    inputBar: {
        flexDirection: 'column', padding: 10, borderTopWidth: 1, borderTopColor: '#222', backgroundColor: Colors.dark.background,
        paddingBottom: Platform.OS === 'ios' ? 20 : 10
    },
    replyingBanner: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        backgroundColor: '#222', padding: 8, borderRadius: 8, marginBottom: 8, width: '100%'
    },
    replyingText: { color: '#ccc', fontSize: 12 },
    input: {
        flex: 1, backgroundColor: '#1A1A1A', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 10, color: 'white', maxHeight: 100,
        marginRight: 10
    },
    sendButton: {
        width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.dark.primary, justifyContent: 'center', alignItems: 'center'
    },
    disabledSend: { opacity: 0.5 }
});

