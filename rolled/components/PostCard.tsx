import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState, useRef } from 'react';
import { Dimensions, Image, StyleSheet, Text, TouchableOpacity, View, Pressable, ActivityIndicator } from 'react-native'; // Removed FlatList
import { FloatingHeart, LIKE_COLOR } from './FloatingHeart';
import { FlatList } from 'react-native-gesture-handler'; // [NEW] RNGH FlatList
import { BlurView } from 'expo-blur';
import { Colors } from '../constants/Colors';
import { usePostInteraction } from '../hooks/usePostInteraction';
import { supabase } from '../lib/supabase'; // [NEW] Import Supabase
import { formatTimeAgo } from '../utils/date';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useVideoStateStore } from '../stores/videoStateStore';
const { width } = Dimensions.get('window');

import { useAuth } from '../context/AuthContext';
import { useFeedScroll } from '../context/FeedScrollContext';
import { Avatar } from './Avatar';
import { ParsedContent } from './ParsedContent';
import { PollView } from './PollView';
import { UserBadges } from './UserBadges';

const PostVideoView = ({ uri, aspectRatio, postId, isScreenFocused, onReplyPress }: { uri: string, aspectRatio?: number | string, postId: string, isScreenFocused: boolean, onReplyPress?: () => void }) => {
    const parsedRatio = typeof aspectRatio === 'string' ? parseFloat(aspectRatio) : (aspectRatio || 0.8);
    const { activeVideoId, isMuted, toggleMute, setHandoff } = useVideoStateStore();
    const shouldPlay = isScreenFocused && activeVideoId === postId;

    const [viewKey, setViewKey] = useState(0);
    const wasHandoff = useRef(false);

    const handleVideoPress = () => {
        wasHandoff.current = true;
        setHandoff(player, postId);
        onReplyPress?.();
    };

    const [hasEnded, setHasEnded] = useState(false);
    const playCount = useRef(1);
    const [retryCount, setRetryCount] = useState(0);
    const [playerStatus, setPlayerStatus] = useState<string>('loading');

    const player = useVideoPlayer(uri, p => {
        p.loop = false; // Play only twice via manual replay
    });

    useEffect(() => {
        let retryTimeout: NodeJS.Timeout;

        const checkRetry = () => {
            setPlayerStatus(player.status);
            if (player.status === 'error' && retryCount < 6) {
                // Cloudflare HLS manifest takes a few seconds to propagate to edge nodes.
                // If it 404s, we retry a few times instead of showing a blank screen.
                retryTimeout = setTimeout(() => {
                    setRetryCount(c => c + 1);
                    // CRITICAL FIX: AVPlayer/ExoPlayer will ignore replace() if the URI is perfectly identical.
                    // We must append a cache-buster query parameter to force a real network retry!
                    player.replaceAsync(`${uri}?cb=${Date.now()}`);
                }, 3000);
            }
        };

        // Check immediately in case it errored before listener attached
        checkRetry();

        const statusSub = player.addListener('statusChange', () => {
            checkRetry();
        });

        // Enforce loop=false explicitly! This is a critical 1st-principles fix:
        player.loop = false;

        const sub = player.addListener('playToEnd', () => {
            if (playCount.current < 2) {
                playCount.current += 1;
                player.replay();
            } else {
                setHasEnded(true);
            }
        });

        return () => {
            statusSub.remove();
            sub.remove();
            clearTimeout(retryTimeout);
        };
    }, [player, retryCount, uri]);

    const hasFiredView = useRef(false);
    useEffect(() => {
        const interval = setInterval(() => {
            if (hasFiredView.current) {
                clearInterval(interval);
                return;
            }
            if (shouldPlay && player.playing) {
                const current = player.currentTime;
                const duration = player.duration;
                if (duration > 0) {
                    if (current >= 10 || (current / duration) >= 0.33) {
                        hasFiredView.current = true;
                        supabase.rpc('record_post_view', { p_post_id: postId }).then().catch(err => console.error("Error recording view", err));
                        clearInterval(interval);
                    }
                }
            }
        }, 500);
        return () => clearInterval(interval);
    }, [player, shouldPlay, postId]);


    useEffect(() => {
        if (shouldPlay) {
            if (wasHandoff.current) {
                // Remount the VideoView to force the native OS to re-attach the media player layer 
                // after it was stolen by the Details screen
                setViewKey(k => k + 1);
                wasHandoff.current = false;
                
                // Immediately force loop back to false when returning from Details
                player.loop = false;
            }

            setHasEnded(prev => {
                if (prev) {
                    playCount.current = 1;
                    player.replay();
                    return false;
                }
                player.play();
                return false;
            });
        } else {
            if (useVideoStateStore.getState().handoffPostId !== postId) {
                player.pause();
            }
        }
    }, [shouldPlay, player]);

    useEffect(() => {
        player.muted = isMuted;
    }, [isMuted, player]);

    return (
        <View style={[styles.mediaContainer, { aspectRatio: parsedRatio }]}>
            <VideoView key={viewKey} player={player} style={styles.mediaImage} fullscreenOptions={{ enable: false }} nativeControls={false} />
            
            {playerStatus === 'error' && !hasEnded && retryCount < 6 && (
                <BlurView intensity={50} tint="dark" style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', zIndex: 5 }]}>
                    <ActivityIndicator size="large" color={Colors.dark.primary} />
                    <Text style={{ color: 'white', marginTop: 16, fontWeight: '600', fontSize: 14, letterSpacing: 0.5 }}>
                        {retryCount > 0 ? "Preparing stream..." : "Loading..."}
                    </Text>
                </BlurView>
            )}
            
            {hasEnded ? (
                <BlurView intensity={70} tint="dark" style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', zIndex: 10 }]}>
                    <TouchableOpacity 
                        style={{ 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            backgroundColor: 'rgba(255, 255, 255, 0.15)',
                            paddingHorizontal: 35,
                            paddingVertical: 25,
                            borderRadius: 25,
                            borderWidth: 1,
                            borderColor: 'rgba(255, 255, 255, 0.3)',
                        }} 
                        onPress={handleVideoPress}
                    >
                        <MaterialCommunityIcons name="replay" size={40} color="white" />
                        <Text style={{ color: 'white', fontWeight: '700', fontSize: 16, marginTop: 6, letterSpacing: 0.5 }}>Replay</Text>
                    </TouchableOpacity>
                </BlurView>
            ) : (
                <Pressable style={StyleSheet.absoluteFill} onPress={handleVideoPress} />
            )}

            {!hasEnded && (
                <TouchableOpacity 
                    style={{ position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.5)', padding: 6, borderRadius: 20 }} 
                    onPress={toggleMute}
                >
                    <Ionicons name={isMuted ? "volume-mute" : "volume-high"} size={20} color="white" />
                </TouchableOpacity>
            )}
        </View>
    );
};

export interface PostProps {
    id: string;
    user_id: string;
    profile: {
        username: string;
        full_name: string;
        avatar_url: string;
        is_verified?: boolean; // [NEW]
        is_admin?: boolean;    // [NEW]
        is_og?: boolean;       // [NEW]
    };
    content: string;
    media_urls: string[];
    media_type?: string;
    location: string | null;
    tagged_users?: string[];
    has_poll?: boolean; // [NEW] Add has_poll
    created_at: string;
    likes_count: number;
    comments_count: number;
    has_liked?: boolean;
    has_saved?: boolean;
    is_pinned?: boolean;
    aspect_ratio?: number;
    audience?: 'followers' | 'campus' | 'public';
    views_count?: number; // [NEW] View tracking
}

interface PostCardProps {
    post: PostProps;
    onLike?: () => void;
    onSave?: () => void;
    onShare?: () => void;
    onShowOptions?: () => void;
    onReplyPress?: () => void;
    isScreenFocused?: boolean;
    showViewCount?: boolean;
}

export const PostCard = ({ 
    post, 
    isFirstPost,
    onShare, 
    onShowOptions, 
    onReplyPress,
    isScreenFocused = true,
    showViewCount = false 
}: { 
    post: PostProps, 
    isFirstPost?: boolean,
    onShare?: () => void, 
    onShowOptions?: () => void, 
    onReplyPress?: () => void,
    isScreenFocused?: boolean,
    showViewCount?: boolean 
}) => {
    const router = useRouter();
    const { user } = useAuth();
    const setActiveVideoId = useVideoStateStore(s => s.setActiveVideoId);

    // X/Twitter 1st Principles Initial Mount Fix:
    // If this is the absolute top item in the feed, and it's a video,
    // it confidently self-activates to guarantee instant autoplay before FlashList lays out.
    useEffect(() => {
        if (isFirstPost && post.media_type === 'video' && isScreenFocused) {
            // Only claim the slot if no video is currently active, 
            // preventing race conditions with scrolling.
            if (!useVideoStateStore.getState().activeVideoId) {
                setActiveVideoId(post.id);
            }
        }
    }, [isFirstPost, post.id, post.media_type, isScreenFocused]);

    const [currentPage, setCurrentPage] = useState(0);
    const { hasLiked, hasSaved, likesCount, toggleLike, toggleSave } = usePostInteraction(post);
    const { setScrollEnabled } = useFeedScroll();
    const [isExpanded, setIsExpanded] = useState(false);
    const [likeTrigger, setLikeTrigger] = useState(0);

    const timeAgo = formatTimeAgo(post.created_at);

    const handleUserPress = () => {
        if (user && user.id === post.user_id) {
            router.push('/profile');
        } else {
            router.push(`/user/${post.user_id}`);
        }
    };

    // Tagging Logic
    const [taggedProfiles, setTaggedProfiles] = useState<any[]>([]);

    useEffect(() => {
        const fetchTaggedUsers = async () => {
            if (post.tagged_users && post.tagged_users.length > 0) {
                const { data } = await supabase
                    .from('profiles')
                    .select('id, username')
                    .in('id', post.tagged_users);
                if (data) setTaggedProfiles(data);
            } else {
                setTaggedProfiles([]);
            }
        };
        fetchTaggedUsers();
    }, [post.tagged_users]);

    const handleTaggedUserPress = (userId: string) => {
        if (user && user.id === userId) {
            router.push('/profile');
        } else {
            router.push(`/user/${userId}`);
        }
    };
    // ----------------

    const navigateToDetails = () => {
        router.push({
            pathname: `/post/${post.id}` as any,
            params: { initialData: JSON.stringify(post) }
        });
    };

    const navigateToComments = () => {
        router.push({
            pathname: `/post/${post.id}` as any,
            params: { initialData: JSON.stringify(post), scrollToComments: 'true' }
        });
    };

    return (
        <View style={styles.card}>
            {/* Main Clickable Wrapper for Header */}
            <TouchableOpacity
                activeOpacity={0.9}
                onPress={navigateToDetails}
            >
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.userInfo}>
                        <TouchableOpacity onPress={handleUserPress}>
                            <Avatar
                                uri={post.profile?.avatar_url}
                                name={post.profile?.full_name}
                                size={40}
                            />
                        </TouchableOpacity>
                        <View style={{ marginLeft: 10 }}>
                            <TouchableOpacity onPress={handleUserPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <Text style={styles.name}>{post.profile?.full_name || 'User'}</Text>
                                <UserBadges user={post.profile} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleUserPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                {post.is_pinned && (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 4 }}>
                                        <MaterialCommunityIcons name="pin" size={12} color={Colors.dark.primary} />
                                        <Text style={{ color: Colors.dark.primary, fontSize: 12, fontWeight: 'bold' }}>Pinned</Text>
                                        <Text style={styles.dot}>•</Text>
                                    </View>
                                )}
                                <Text style={styles.handle}>@{post.profile?.username}</Text>
                                <Text style={styles.dot}>•</Text>
                                <Text style={styles.time}>{timeAgo}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}>
                        <TouchableOpacity onPress={toggleSave}>
                            <Ionicons
                                name={hasSaved ? "bookmark" : "bookmark-outline"}
                                size={22}
                                color={hasSaved ? "white" : Colors.dark.textSecondary}
                            />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={onShowOptions}>
                            <MaterialCommunityIcons name="dots-horizontal" size={24} color={Colors.dark.textSecondary} />
                        </TouchableOpacity>
                    </View>
                </View>
            </TouchableOpacity>

            {/* Media Carousel / Video */}
            {(() => {
                // Filter out any empty, null, or invalid URLs
                const validMediaUrls = post.media_urls?.filter(url => url && typeof url === 'string' && url.trim().length > 0) || [];

                if (validMediaUrls.length === 0) return null;

                if (post.media_type === 'video') {
                    return <PostVideoView uri={validMediaUrls[0]} aspectRatio={post.aspect_ratio} postId={post.id} isScreenFocused={isScreenFocused} onReplyPress={onReplyPress || (() => router.push({ pathname: `/post/${post.id}`, params: { initialData: JSON.stringify(post) } }))} />;
                }

                const parsedRatio = typeof post.aspect_ratio === 'string' ? parseFloat(post.aspect_ratio) : (post.aspect_ratio || 0.8);

                return (
                    <View
                        style={[styles.mediaContainer, { aspectRatio: parsedRatio }]}
                        onTouchStart={() => setScrollEnabled(false)}
                        onTouchEnd={() => setScrollEnabled(true)}
                        onTouchCancel={() => setScrollEnabled(true)}
                    >
                        <FlatList
                            data={validMediaUrls}
                            keyExtractor={(_, index) => index.toString()}
                            horizontal
                            pagingEnabled={validMediaUrls.length > 1}
                            scrollEnabled={validMediaUrls.length > 1}
                            decelerationRate="fast"
                            snapToInterval={width}
                            snapToAlignment="center"
                            showsHorizontalScrollIndicator={false}
                            onMomentumScrollEnd={(event: any) => {
                                const index = Math.round(event.nativeEvent.contentOffset.x / width);
                                setCurrentPage(index);
                            }}
                            renderItem={({ item }: { item: string }) => (
                                <View style={{ width: width, height: '100%' }}>
                                    <TouchableOpacity activeOpacity={0.9} onPress={navigateToDetails} style={{ flex: 1 }}>
                                        <Image source={{ uri: item }} style={styles.mediaImage} resizeMode="cover" />
                                    </TouchableOpacity>
                                </View>
                            )}
                        />

                        {/* Page Indicator Badge */}
                        {validMediaUrls.length > 1 && (
                            <View style={styles.pageBadge}>
                                <Text style={styles.pageBadgeText}>{currentPage + 1}/{validMediaUrls.length}</Text>
                            </View>
                        )}
                    </View>
                );
            })()}

            {/* Main Clickable Wrapper for Content */}
            <TouchableOpacity
                activeOpacity={0.9}
                onPress={navigateToDetails}
            >
                {/* Content Text (Truncated) */}
                {
                    post.content ? (
                        <View style={{ paddingHorizontal: 15, paddingVertical: 10 }}>
                            {(() => {
                                const isTextOnly = !post.media_urls || post.media_urls.length === 0;
                                const shouldTruncate = !isTextOnly && post.content.length > 100;

                                return (
                                    <>
                                        <ParsedContent
                                            content={post.content}
                                            style={styles.content}
                                            numberOfLines={isExpanded || isTextOnly ? undefined : 2}
                                        />
                                        {shouldTruncate && (
                                            <TouchableOpacity onPress={() => setIsExpanded(!isExpanded)}>
                                                <Text style={{ color: Colors.dark.textSecondary, marginTop: 4 }}>
                                                    {isExpanded ? "show less" : "...more"}
                                                </Text>
                                            </TouchableOpacity>
                                        )}
                                    </>
                                );
                            })()}
                        </View>
                    ) : null
                }
            </TouchableOpacity>

            {/* Poll View (NEW) */}
            {post.has_poll && (
                <View style={{ paddingHorizontal: 15, paddingBottom: 10 }}>
                    <PollView postId={post.id} authorId={post.user_id} />
                </View>
            )}

            {/* TAGGED USERS DISPLAY (NEW) */}
            {taggedProfiles.length > 0 && (
                <View style={styles.taggedContainer}>
                    <Text style={styles.taggedLabel}>Rolled with </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                        {taggedProfiles.map((tp, index) => (
                            <TouchableOpacity key={tp.id} onPress={() => handleTaggedUserPress(tp.id)} hitSlop={5}>
                                <Text style={styles.taggedLink}>@{tp.username}{index < taggedProfiles.length - 1 ? ',' : ''}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            )}

            {/* Footer Actions */}
            <View style={styles.footer}>
                <View style={styles.interactionActions}>
                    <View style={{ position: 'relative' }}>
                        <TouchableOpacity style={styles.actionButton} onPress={() => { toggleLike(); setLikeTrigger(t => t + 1); }}>
                            <MaterialCommunityIcons
                                name={hasLiked ? "heart" : "heart-outline"}
                                size={28}
                                color={hasLiked ? LIKE_COLOR : "white"}
                            />
                            <Text style={styles.actionText}>{likesCount || 0}</Text>
                        </TouchableOpacity>
                        <FloatingHeart trigger={likeTrigger} />
                    </View>

                    <TouchableOpacity style={styles.actionButton} onPress={navigateToComments}>
                        <MaterialCommunityIcons name="comment-outline" size={26} color="white" />
                        <Text style={styles.actionText}>{post.comments_count || 0}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionButton} onPress={onShare}>
                        <MaterialCommunityIcons name="send-outline" size={26} color="white" />
                        <Text style={styles.actionText}>Share</Text>
                    </TouchableOpacity>

                    {showViewCount && user?.id === post.user_id && post.media_type === 'video' && (
                        <View style={styles.actionButton}>
                            <MaterialCommunityIcons name="eye-outline" size={26} color="white" />
                            <Text style={styles.actionText}>{post.views_count || 0}</Text>
                        </View>
                    )}
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: Colors.dark.background,
        borderBottomWidth: 1,
        borderBottomColor: '#1A1A1A',
        paddingBottom: 20,
        marginBottom: 10,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingVertical: 10,
    },
    flareBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#e74c3c',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 12,
        marginLeft: 6,
        gap: 2,
    },
    flareText: {
        color: 'white',
        fontSize: 10,
        fontWeight: 'bold',
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#333',
    },
    name: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 15,
    },
    handle: {
        color: Colors.dark.textSecondary,
        fontSize: 14,
    },
    location: {
        color: Colors.dark.primary,
        fontSize: 12,
        fontWeight: '500',
    },
    time: {
        color: Colors.dark.textSecondary,
        fontSize: 12,
    },
    dot: {
        color: Colors.dark.textSecondary,
        fontSize: 8,
    },
    content: {
        color: 'white',
        fontSize: 15,
        lineHeight: 22,
        fontWeight: '600',
    },
    mediaContainer: {
        position: 'relative',
        borderRadius: 18,
        overflow: 'hidden',
        marginHorizontal: 12,
        width: width - 24,
        alignSelf: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
    },
    pagerView: {
        flex: 1,
    },
    mediaPage: {
        flex: 1,
    },
    mediaImage: {
        width: '100%',
        height: '100%',
    },
    pageBadge: {
        position: 'absolute',
        top: 15,
        right: 15,
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 15,
    },
    pageBadgeText: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingTop: 12,
    },
    interactionActions: {
        flexDirection: 'row',
        gap: 25,
    },
    actionButton: {
        alignItems: 'center',
        gap: 2,
    },
    actionText: {
        color: 'white',
        fontSize: 10,
        fontWeight: '500',
    },
    taggedContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingTop: 10,
        flexWrap: 'wrap'
    },
    taggedLabel: {
        color: Colors.dark.textSecondary,
        fontSize: 13,
    },
    taggedLink: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 13,
    }
});
