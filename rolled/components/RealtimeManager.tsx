import { useEffect } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { supabase } from '../lib/supabase';
import { useInteractionStore } from '../store/interactionStore';
import { useAuth } from '../context/AuthContext';

export const RealtimeManager = () => {
    // We don't pull state here to avoid re-renders. 
    // We just need the update function, which is stable.
    const updateInteraction = useInteractionStore((state) => state.updateInteraction);
    const { user } = useAuth();

    useEffect(() => {
        if (!user) return;

        const channels: ReturnType<typeof supabase.channel>[] = [];

        // Channel for Likes
        const likesChannel = supabase
            .channel('public:likes')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'likes' },
                (payload: any) => {
                    if (payload.new.user_id === user.id) return;

                    const postId = payload.new.post_id;
                    const currentInteractions = useInteractionStore.getState().interactions;

                    if (currentInteractions[postId]) {
                        updateInteraction(postId, {
                            likes_count: (currentInteractions[postId].likes_count || 0) + 1
                        });
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: 'DELETE', schema: 'public', table: 'likes' },
                (payload: any) => {
                    if (payload.old.user_id && payload.old.user_id === user.id) return;

                    const postId = payload.old.post_id;
                    if (!postId) return;

                    const currentInteractions = useInteractionStore.getState().interactions;
                    if (currentInteractions[postId]) {
                        updateInteraction(postId, {
                            likes_count: Math.max((currentInteractions[postId].likes_count || 0) - 1, 0)
                        });
                    }
                }
            )
            .subscribe();

        channels.push(likesChannel);

        // Channel for Comments
        const commentsChannel = supabase
            .channel('public:comments')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'comments' },
                (payload: any) => {
                    if (payload.new.user_id === user.id) return;

                    // Handle Standard Post
                    if (payload.new.post_id) {
                        const currentInteractions = useInteractionStore.getState().interactions;
                        if (currentInteractions[payload.new.post_id]) {
                            updateInteraction(payload.new.post_id, {
                                comments_count: (currentInteractions[payload.new.post_id].comments_count || 0) + 1
                            });
                        }
                    }

                    // Handle Anon Post (Unrolled)
                    if (payload.new.anon_post_id) {
                        const currentInteractions = useInteractionStore.getState().interactions;
                        // Check if we are tracking this anon post (it might be in the feed)
                        if (currentInteractions[payload.new.anon_post_id]) {
                            updateInteraction(payload.new.anon_post_id, {
                                comments_count: (currentInteractions[payload.new.anon_post_id].comments_count || 0) + 1
                            });
                        }
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: 'DELETE', schema: 'public', table: 'comments' },
                (payload: any) => {
                    if (payload.old.user_id && payload.old.user_id === user.id) return;

                    // Handle Standard Post
                    if (payload.old.post_id) {
                        const currentInteractions = useInteractionStore.getState().interactions;
                        if (currentInteractions[payload.old.post_id]) {
                            updateInteraction(payload.old.post_id, {
                                comments_count: Math.max((currentInteractions[payload.old.post_id].comments_count || 0) - 1, 0)
                            });
                        }
                    }

                    // Handle Anon Post
                    if (payload.old.anon_post_id) {
                        const currentInteractions = useInteractionStore.getState().interactions;
                        if (currentInteractions[payload.old.anon_post_id]) {
                            updateInteraction(payload.old.anon_post_id, {
                                comments_count: Math.max((currentInteractions[payload.old.anon_post_id].comments_count || 0) - 1, 0)
                            });
                        }
                    }
                }
            )
            .subscribe();

        channels.push(commentsChannel);

        // Channel for Messages
        const messagesChannel = supabase
            .channel('public:messages')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'messages' },
                (payload: any) => {
                    if (payload.new.user_id === user.id) return;

                    const newMessage = payload.new;
                    import('../stores/chatStore').then(({ useChatStore }) => {
                        useChatStore.getState().addMessage({
                            id: newMessage.id,
                            room_id: newMessage.room_id,
                            user_id: newMessage.user_id,
                            content: newMessage.content,
                            created_at: newMessage.created_at,
                            is_read: newMessage.is_read,
                            attachments: newMessage.attachments
                        });
                    });
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'messages' },
                (payload: any) => {
                    const updatedMessage = payload.new;

                    // [FIX] Flicker on "Delete for Me"
                    // If the message is hidden for the current user, DO NOT add it back.
                    // Also ensure it is removed if it exists (for multi-device sync or race conditions).
                    if (updatedMessage.deleted_by && updatedMessage.deleted_by.includes(user.id)) {
                        import('../stores/chatStore').then(({ useChatStore }) => {
                            // Directly modify store state to remove it (simulating local delete without RPC)
                            useChatStore.setState(state => ({
                                activeRoomMessages: state.activeRoomMessages.filter(m => m.id !== updatedMessage.id)
                            }));
                        });
                        return;
                    }

                    import('../stores/chatStore').then(({ useChatStore }) => {
                        useChatStore.getState().addMessage({
                            id: updatedMessage.id,
                            room_id: updatedMessage.room_id,
                            user_id: updatedMessage.user_id,
                            content: updatedMessage.content,
                            created_at: updatedMessage.created_at,
                            is_read: updatedMessage.is_read,
                            attachments: updatedMessage.attachments,
                            deleted_by: updatedMessage.deleted_by // Pass this through
                        });
                    });
                }
            )
            .on(
                'postgres_changes',
                { event: 'DELETE', schema: 'public', table: 'messages' },
                (payload: any) => {
                    // Handle "Unsend" (Delete for Everyone)
                    const deletedId = payload.old.id;
                    if (deletedId) {
                        import('../stores/chatStore').then(({ useChatStore }) => {
                            useChatStore.setState(state => ({
                                activeRoomMessages: state.activeRoomMessages.filter(m => m.id !== deletedId)
                            }));
                        });
                    }
                }
            )
            .subscribe();

        channels.push(messagesChannel);

        return () => {
            channels.forEach(channel => supabase.removeChannel(channel));
        };
    }, [updateInteraction, user]);

    // SEPARATE EFFECT FOR POSTS (Insert & Delete)
    useEffect(() => {
        if (!user) return;

        const channel = supabase.channel('public:posts_updates')
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'posts' }, (payload: any) => {
                const deletedId = payload.old.id;
                if (deletedId) {
                    require('react-native').DeviceEventEmitter.emit('post_deleted', deletedId);
                }
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, async (payload: any) => {
                // Ignore our own posts (handled optimistically by create-post)
                if (payload.new.user_id === user.id) return;

                const newPostId = payload.new.id;

                // We need to fetch the FULL post with profile to display it correctly
                // The payload only has the raw table row
                const { data: fullPost, error } = await supabase
                    .from('posts')
                    .select(`
                        *,
                        profile:profiles!posts_user_id_fkey(username, full_name, avatar_url, is_verified, is_admin, is_og),
                        likes_count:likes(count),
                        comments_count:comments(count)
                    `)
                    .eq('id', newPostId)
                    .single();

                if (!error && fullPost) {
                    // Format it to match PostProps
                    const formattedPost = {
                        ...fullPost,
                        likes_count: fullPost.likes_count?.[0]?.count || 0,
                        comments_count: fullPost.comments_count?.[0]?.count || 0,
                        has_liked: false, // New post, so naturally not liked yet
                        has_saved: false
                    };
                    // Emit to FeedList
                    DeviceEventEmitter.emit('new_post_created', formattedPost);
                }
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [user]);

    return null;
};
