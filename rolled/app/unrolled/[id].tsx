import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Keyboard, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { AnonPostCard, AnonPostProps } from '../../components/AnonPostCard';
import { CommentItem, CommentProps } from '../../components/CommentItem';
import { CustomActionSheet, ActionSheetOption } from '../../components/CustomActionSheet';
import { CustomToast } from '../../components/CustomToast';
import { ReportModal } from '../../components/ReportModal';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { ShareContent, ShareModal } from '../../components/ShareModal';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { useUnrolledStore } from '../../stores/unrolledStore';

// Utility to nest comments
function treeifyComments(comments: CommentProps[]) {
    const map: Record<string, CommentProps & { replies: CommentProps[] }> = {};
    const roots: (CommentProps & { replies: CommentProps[] })[] = [];

    // Initialize
    comments.forEach(c => {
        map[c.id] = { ...c, replies: [] };
    });

    // Link
    comments.forEach(c => {
        if (c.parent_id && map[c.parent_id]) {
            map[c.parent_id].replies.push(map[c.id]);
        } else {
            roots.push(map[c.id]);
        }
    });

    // Flatten for FlatList (Visual Indentation or just ordered ?)
    // For now, simpler approach: Just returning roots with nested replies array for recursive rendering if needed.
    // However, FlatList prefers a flat array. Let's do a fast flat-with-level approach or just render roots and have CommentItem render sub-replies.
    // Given CommentItem doesn't render children recursively yet, let's keep it simple: 
    // We will render a flat list but sorted by thread.

    // BETTER APPROACH FOR NOW: Just standard chronological list but with "Replying to" visual.
    // The user requested "Branch like system".
    // Let's rely on Indentation in FlatList.
    return roots; // We will render this recursively or just flat indent?
}
// Recursive flatten for FlatList
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

export default function UnrolledPostDetail() {
    const params = useLocalSearchParams();
    const id = params.id;
    const router = useRouter();
    const { user } = useAuth();
    const [post, setPost] = useState<AnonPostProps | null>(() => {
        if (params.initialData) {
            try {
                return JSON.parse(params.initialData as string);
            } catch (e) {
                return null;
            }
        }
        return null;
    });
    const [comments, setComments] = useState<any[]>([]); // Flat threaded list
    const [loading, setLoading] = useState(!post);
    const [fetchingComments, setFetchingComments] = useState(true);
    const [replyText, setReplyText] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [myIdentityId, setMyIdentityId] = useState<string | null>(null);

    // Threading State
    const [replyingTo, setReplyingTo] = useState<CommentProps | null>(null);

    // Menu, Report, & Share State
    const [actionSheetVisible, setActionSheetVisible] = useState(false);
    const [reportModalVisible, setReportModalVisible] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [shareVisible, setShareVisible] = useState(false);
    const [sharedContent, setSharedContent] = useState<ShareContent | null>(null);

    useEffect(() => {
        if (id) fetchPostAndReplies();
    }, [id]);

    const fetchPostAndReplies = async () => {
        try {
            // 1. Fetch Post
            const { data: postData, error: postError } = await supabase
                .from('anon_posts')
                .select(`*, identity:anon_identities!anon_posts_identity_id_fkey(id, anon_name, avatar_color)`)
                .eq('id', id)
                .single();

            if (postError) throw postError;

            // 2. Fetch My Identity & Vote
            const myIdRes = await supabase.rpc('get_my_anon_identity');
            const myId = myIdRes.data?.id;
            setMyIdentityId(myId);

            const { data: voteData } = await supabase
                .from('anon_votes')
                .select('vote_type')
                .eq('post_id', id)
                .eq('identity_id', myId)
                .maybeSingle();

            setPost({
                id: postData.id,
                content: postData.content,
                identity_id: postData.identity_id,
                anon_name: postData.identity?.anon_name || 'Anonymous',
                avatar_color: postData.identity?.avatar_color || '#333',
                created_at: postData.created_at,
                upvotes: postData.upvotes,
                downvotes: postData.downvotes,
                reply_count: postData.reply_count,
                badge: postData.badge,
                vote_type: voteData?.vote_type || 0
            });

            // 3. Fetch Comments + Likes
            const { data: commentsData } = await supabase
                .from('comments')
                .select(`
                    *, 
                    identity:anon_identities!comments_anon_identity_id_fkey(id, anon_name, avatar_color)
                `)
                .eq('anon_post_id', id)
                .order('created_at', { ascending: true });

            // 3.5 Fetch Comment Likes (Separate query for speed/simplicity)
            const { data: myLikes } = await supabase
                .from('comment_likes')
                .select('comment_id')
                .eq('user_id', user?.id);

            const likedCommentIds = new Set(myLikes?.map(l => l.comment_id));

            if (commentsData) {
                const rawComments = commentsData.map((c: any) => ({
                    id: c.id,
                    content: c.content,
                    created_at: c.created_at,
                    parent_id: c.parent_id, // IMPORTANT for threading
                    user: {
                        id: c.identity?.id || 'unknown',
                        username: c.identity?.anon_name || 'Anonymous',
                        full_name: c.identity?.anon_name || 'Anonymous',
                        avatar_url: null,
                    },
                    isAnon: true,
                    anonColor: c.identity?.avatar_color,
                    has_liked: likedCommentIds.has(c.id),
                    // We could simulate reply_count or fetch it, but let's stick to simple visuals first
                }));

                const tree = treeifyComments(rawComments);
                const flatTree = flattenTree(tree);
                setComments(flatTree);
            }

        } catch (e: any) {
            console.error(e);
            if (e.code === 'PGRST116') {
                setPost(null);
            } else {
                Alert.alert("Error", "Could not load post.");
            }
        } finally {
            setLoading(false);
            setFetchingComments(false);
        }
    };

    // Realtime skipped for brevity of this specific fix, standard refresh works.

    const handleSendReply = async () => {
        if (!replyText.trim() || !post) return;
        setSubmitting(true);
        try {
            // If replying to a comment, we need to pass parent_id
            const payload: any = {
                anon_post_id: id,
                content: replyText,
                parent_id: replyingTo ? replyingTo.id : null,
                // We need to resolve anon identity ID manually or let trigger do it? 
                // The existing RPC `create_anon_reply` might not support parent_id yet?
                // Let's check RPC. If likely not, we use direct INSERT since we have the identity.
            };

            // DIRECT INSERT is safer for partial updates like this (adding parent_id support without fixing RPC)
            // But we need the ANON IDENTITY ID first.
            if (!myIdentityId) throw new Error("No identity");

            const { error } = await supabase.from('comments').insert({
                anon_post_id: id,
                content: replyText,
                parent_id: replyingTo ? replyingTo.id : null,
                anon_identity_id: myIdentityId,
                user_id: user?.id, // Important for RLS
                // post_id: id  <-- REMOVE: This references standard posts, not anon posts!
            });

            if (error) {
                console.log("❌ Insert Error:", error);
                throw error;
            }

            console.log("✅ Insert Success!");
            setReplyText('');
            setReplyingTo(null);
            Keyboard.dismiss();
            await fetchPostAndReplies();
        } catch (e: any) {
            console.error("❌ Catch Error:", e);
            Alert.alert("Error", e.message || JSON.stringify(e) || "Could not send reply.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleVote = async (type: 1 | -1) => {
        if (!post) return;
        try {
            await supabase.rpc('vote_on_anon_post', { p_id: post.id, v_type: type });
            fetchPostAndReplies();
        } catch (e) { console.error(e); }
    };

    const handleLikeComment = async (comment: any) => {
        // Toggle Like
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

    const openMenu = () => {
        setActionSheetVisible(true);
    };

    const handleShare = () => {
        if (!post) return;
        setSharedContent({
            type: 'unrolled',
            id: post.id,
            preview: {
                title: post.content,
                subtitle: `~ ${post.anon_name || 'Protected Handle'}`
            },
            data: post
        });
        setShareVisible(true);
    };

    const handleDelete = async () => {
        if (!post) return;
        setActionSheetVisible(false);
        try {
            const { error } = await supabase.from('anon_posts').delete().eq('id', post.id);
            if (error) throw error;
            setToastMessage('Post deleted');
            setTimeout(() => {
                router.back();
            }, 500);
        } catch (error) {
            console.error('Delete failed:', error);
            setToastMessage('Failed to delete');
        }
    };

    const handleReportSubmit = async (reason: string, details: string) => {
        if (!post) return;
        try {
            const { error } = await supabase.rpc('create_anon_report', {
                target_post_id: post.id,
                reason_text: reason,
                details_text: details
            });
            if (error) throw error;
        } catch (error) {
            console.error('Report failed:', error);
            setToastMessage('Failed to submit report');
        }
    };

    const handleBlockUser = async () => {
        if (!post) return;
        const identityId = post.identity_id;
        await useUnrolledStore.getState().blockIdentity(identityId);
        setActionSheetVisible(false);
        setToastMessage('User blocked. You will no longer see their posts.');
        setTimeout(() => {
            router.back();
        }, 600);
    };

    const getActionOptions = (): ActionSheetOption[] => {
        if (!post || !myIdentityId) return [];

        if (post.identity_id === myIdentityId) {
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
                    onPress: () => {
                        setActionSheetVisible(false);
                        setReportModalVisible(true);
                    }
                },
                {
                    label: 'Block User',
                    icon: 'block-helper',
                    isDestructive: true,
                    onPress: handleBlockUser
                }
            ];
        }
    };

    return (
        <ScreenWrapper style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Discussion</Text>
                <View style={{ width: 24 }} />
            </View>

            {loading ? (
                <ActivityIndicator color={Colors.dark.primary} style={{ marginTop: 50 }} />
            ) : !post ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 20 }}>
                    <MaterialCommunityIcons name="ghost" size={60} color={Colors.dark.textSecondary} />
                    <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>This roll has vanished.</Text>
                    <TouchableOpacity onPress={() => router.back()} style={{ backgroundColor: '#222', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 }}>
                        <Text style={{ color: '#fff' }}>Go Back</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
                >
                    <FlatList
                        data={comments}
                        showsVerticalScrollIndicator={false}
                        keyExtractor={(item) => item.id}
                        ListHeaderComponent={
                            <View style={{ marginBottom: 20 }}>
                                <AnonPostCard
                                    post={post}
                                    onUpvote={() => handleVote(1)}
                                    onDownvote={() => handleVote(-1)}
                                    onReply={() => {
                                        // Reply to Main Post
                                        setReplyingTo(null);
                                    }}
                                    onReport={openMenu}
                                    onShare={handleShare}
                                />
                                <View style={styles.divider} />
                                <Text style={styles.replyLabel}>COMMENTS</Text>
                            </View>
                        }
                        renderItem={({ item }) => (
                            <View style={{ marginLeft: (item.level || 0) * 20 }}>
                                <CommentItem
                                    comment={item}
                                    onReply={(c) => setReplyingTo(c)}
                                    onLike={handleLikeComment}
                                    currentUserId={user?.id}
                                />
                            </View>
                        )}
                        contentContainerStyle={{ paddingBottom: 20 }}
                    />

                    {/* Input Area */}
                    <View style={styles.inputWrapper}>
                        {replyingTo && (
                            <View style={styles.replyingBanner}>
                                <Text style={styles.replyingText}>Replying to {replyingTo.user.username}</Text>
                                <TouchableOpacity onPress={() => setReplyingTo(null)}>
                                    <Ionicons name="close-circle" size={20} color="#999" />
                                </TouchableOpacity>
                            </View>
                        )}
                        <View style={styles.inputRow}>
                            <TextInput
                                style={styles.input}
                                placeholder={replyingTo ? "Write a reply..." : "Speak your mind..."}
                                placeholderTextColor="#666"
                                value={replyText}
                                onChangeText={setReplyText}
                                multiline
                            />
                            <TouchableOpacity
                                style={[styles.sendButton, !replyText.trim() && { opacity: 0.5 }]}
                                onPress={handleSendReply}
                                disabled={submitting || !replyText.trim()}
                            >
                                {submitting ? <ActivityIndicator color="#000" size="small" /> : <MaterialCommunityIcons name="arrow-up" size={20} color="#000" />}
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
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

            {toastMessage ? (
                <CustomToast
                    visible={!!toastMessage}
                    message={toastMessage}
                    onHide={() => setToastMessage('')}
                />
            ) : null}
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    container: { backgroundColor: '#000', paddingHorizontal: 0 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#222', backgroundColor: '#000' },
    headerTitle: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    closeButton: { padding: 4 },
    divider: { height: 1, backgroundColor: '#222', marginVertical: 10 },
    replyLabel: { color: '#666', fontSize: 12, fontWeight: 'bold', marginLeft: 16, marginBottom: 10, letterSpacing: 1 },
    inputWrapper: { backgroundColor: '#000', borderTopWidth: 1, borderTopColor: '#222' },
    replyingBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 8, backgroundColor: '#222', marginHorizontal: 12, marginTop: 8, borderRadius: 8 },
    replyingText: { color: '#ccc', fontSize: 12 },
    inputRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
    input: { flex: 1, backgroundColor: '#111', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: '#fff', fontSize: 16, maxHeight: 100 },
    sendButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.dark.primary, justifyContent: 'center', alignItems: 'center' }
});
