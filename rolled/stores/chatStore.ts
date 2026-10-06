import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ChatRoom = {
    id: string;
    updated_at: string;
    other_user?: {
        id: string;
        username: string;
        full_name: string;
        avatar_url: string;
        last_seen?: (string | null);
        is_verified?: boolean;
        is_admin?: boolean;
    };
    last_message?: {
        content: string;
        created_at: string;
        is_read: boolean;
        user_id: string;
    };
};

export type Message = {
    id: string;
    room_id: string;
    user_id: string;
    content: string;
    created_at: string;
    is_read: boolean;
    attachments?: {
        url: string;
        type: 'image' | 'video';
        width?: number;
        height?: number;
    }[];
    deleted_by?: string[]; // Arrays of user IDs who hid the message
};

interface ChatState {
    rooms: ChatRoom[];
    activeRoomMessages: Message[];
    isLoading: boolean;

    fetchRooms: () => Promise<void>;
    fetchMessages: (roomId: string) => Promise<void>;
    sendMessage: (roomId: string, content: string, userId: string) => Promise<void>;
    startNewChat: (otherUserId: string) => Promise<string>;

    // Media & Enhancements
    sendImageMessage: (roomId: string, uri: string, userId: string) => Promise<void>;
    markMessagesAsRead: (roomId: string, userId: string) => Promise<void>;
    reportContent: (targetId: string, targetType: 'message' | 'user', reason: string, details: string) => Promise<void>;
    blockedUserIds: string[];
    fetchBlocks: () => Promise<void>;
    blockUser: (userId: string) => Promise<void>;
    sendTyping: (roomId: string, userId: string) => Promise<void>;

    // Blocking
    // Blocking
    usersIBlocked: string[];
    unblockUser: (userId: string) => Promise<void>;
    isBlocked: (userId: string) => boolean;
    isBlockedByMe: (userId: string) => boolean;

    // Realtime Management (Centralized)
    activeChannel: RealtimeChannel | null;
    typingUsers: Set<string>;
    subscribeToRoom: (roomId: string) => void;
    unsubscribeFromRoom: () => void;

    // Realtime actions
    addMessage: (message: Message) => void;
    updateRoomLastMessage: (roomId: string, message: Message) => void;
    deleteRoom: (roomId: string) => Promise<void>;
    deleteMessage: (messageId: string) => Promise<void>;
    deleteForMe: (messageId: string) => Promise<void>;
    clearChat: () => void;
}

export const useChatStore = create<ChatState>()(
    persist(
        (set, get) => ({
            rooms: [],
            activeRoomMessages: [],
            blockedUserIds: [], // IDs of users who BLOCKED ME or I BLOCKED (General "No Contact" list)
            usersIBlocked: [], // IDs of users I explicitly blocked
            isLoading: false,

            activeChannel: null,
            typingUsers: new Set(),

            subscribeToRoom: (roomId: string) => {
                const { activeChannel } = get();
                if (activeChannel) {
                    activeChannel.unsubscribe();
                }

                const channel = supabase.channel(`room:${roomId}`);

                channel
                    .on('broadcast', { event: 'typing' }, (payload) => {
                        const userId = payload.payload.userId;
                        // Update typing users
                        set(state => {
                            const newSet = new Set(state.typingUsers);
                            newSet.add(userId);
                            return { typingUsers: newSet };
                        });

                        // Clear after 3 seconds
                        setTimeout(() => {
                            set(state => {
                                const newSet = new Set(state.typingUsers);
                                newSet.delete(userId);
                                return { typingUsers: newSet };
                            });
                        }, 3000);
                    })
                    .subscribe();

                set({ activeChannel: channel });
            },

            unsubscribeFromRoom: () => {
                const { activeChannel } = get();
                if (activeChannel) {
                    activeChannel.unsubscribe();
                    set({ activeChannel: null, typingUsers: new Set() });
                }
            },

            sendTyping: async (roomId: string, userId: string) => {
                const { activeChannel } = get();

                // Use the ACTIVE channel if available to ensure we are subscribed
                if (activeChannel) {
                    await activeChannel.send({
                        type: 'broadcast',
                        event: 'typing',
                        payload: { userId, roomId }
                    });
                }
            },

            deleteRoom: async (roomId: string) => {
                set(state => ({
                    rooms: state.rooms.filter(r => r.id !== roomId)
                }));

                const { error } = await supabase
                    .from('chat_participants')
                    .delete()
                    .eq('room_id', roomId)
                    .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

                if (error) {
                    console.error('Error deleting room:', error);
                    get().fetchRooms();
                }
            },

            deleteForMe: async (messageId: string) => {
                // Optimistic UI hide
                set(state => ({
                    activeRoomMessages: state.activeRoomMessages.filter(m => m.id !== messageId)
                }));

                const { error } = await supabase.rpc('hide_message', { target_message_id: messageId });

                if (error) {
                    console.error('Error hiding message:', error);
                }
            },

            deleteMessage: async (messageId: string) => {
                // "Delete For Everyone" - Unsend
                set(state => ({
                    activeRoomMessages: state.activeRoomMessages.filter(m => m.id !== messageId)
                }));

                const { error } = await supabase
                    .from('messages')
                    .delete()
                    .eq('id', messageId);

                if (error) console.error('Error deleting message (Unsend):', error);
            },


            reportContent: async (targetId, targetType, reason, details) => {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                let table = 'reports'; // Default (unlikely used here based on logic, but for safety)
                let payload: any = {
                    reporter_id: user.id,
                    reason,
                    details
                };

                if (targetType === 'message') {
                    table = 'message_reports';
                    payload.message_id = targetId;
                } else if (targetType === 'user') {
                    table = 'user_reports';
                    payload.target_user_id = targetId;
                } else {
                    // Fallback for 'post' if ever used here
                    table = 'reports';
                    payload.post_id = targetId;
                }

                const { error } = await supabase
                    .from(table)
                    .insert(payload);

                if (error) console.error(`Error reporting ${targetType}:`, error);
            },

            markMessagesAsRead: async (roomId, userId) => {
                // Optimistic
                set(state => ({
                    activeRoomMessages: state.activeRoomMessages.map(m =>
                        m.room_id === roomId && !m.is_read ? { ...m, is_read: true } : m
                    ),
                    rooms: state.rooms.map(r => {
                        if (r.id === roomId && r.last_message) {
                            return { ...r, last_message: { ...r.last_message, is_read: true } };
                        }
                        return r;
                    })
                }));

                // DB Update
                const { error } = await supabase
                    .from('messages')
                    .update({ is_read: true })
                    .eq('room_id', roomId)
                    .neq('user_id', userId)
                    .eq('is_read', false);

                if (error) console.error('Error marking messages read:', error);
            },

            sendImageMessage: async (roomId, uri, userId) => {
                try {
                    const ext = uri.substring(uri.lastIndexOf('.') + 1);
                    const fileName = `${Date.now()}.${ext}`;
                    const filePath = `${roomId}/${fileName}`;

                    const response = await fetch(uri);
                    const arrayBuffer = await response.arrayBuffer();

                    const { error: uploadError } = await supabase.storage
                        .from('chat-media')
                        .upload(filePath, arrayBuffer, {
                            contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
                        });

                    if (uploadError) throw uploadError;

                    const { data: { publicUrl } } = supabase.storage.from('chat-media').getPublicUrl(filePath);

                    const content = '📷 Image';
                    const attachments = [{ url: publicUrl, type: 'image' as const }];

                    const newMessage: Message = {
                        id: Date.now().toString(),
                        room_id: roomId,
                        user_id: userId,
                        content: content,
                        created_at: new Date().toISOString(),
                        is_read: false,
                        attachments
                    };

                    set(state => ({
                        activeRoomMessages: [newMessage, ...state.activeRoomMessages]
                    }));
                    get().updateRoomLastMessage(roomId, newMessage);

                    const { data, error } = await supabase
                        .from('messages')
                        .insert({
                            room_id: roomId,
                            user_id: userId,
                            content: content,
                            attachments
                        })
                        .select()
                        .single();

                    if (data) {
                        set(state => ({
                            activeRoomMessages: state.activeRoomMessages.map(m =>
                                m.id === newMessage.id ? data : m
                            )
                        }));
                        get().updateRoomLastMessage(roomId, data);
                    }
                } catch (error) {
                    console.error('Error sending image:', error);
                }
            },

            fetchRooms: async () => {
                set({ isLoading: true });
                try {
                    const { data: { user } } = await supabase.auth.getUser();
                    if (!user) return;

                    const { data: myRooms, error } = await supabase
                        .from('chat_participants')
                        .select('room_id')
                        .eq('user_id', user.id);

                    if (error || !myRooms) throw error;
                    const roomIds = myRooms.map(r => r.room_id);
                    if (roomIds.length === 0) {
                        set({ rooms: [], isLoading: false });
                        return;
                    }

                    const blockedIds = get().blockedUserIds;

                    const roomsData: ChatRoom[] = [];
                    for (const roomId of roomIds) {
                        const { data: otherPart } = await supabase
                            .from('chat_participants')
                            .select('profiles!chat_participants_user_id_fkey(id, username, full_name, avatar_url, last_seen, is_verified, is_admin)')
                            .eq('room_id', roomId)
                            .neq('user_id', user.id)
                            .maybeSingle();

                        const { data: lastMsg } = await supabase
                            .from('messages')
                            .select('*')
                            .eq('room_id', roomId)
                            .order('created_at', { ascending: false })
                            .limit(1)
                            .maybeSingle();

                        if (otherPart && otherPart.profiles) {
                            const otherUser = otherPart.profiles as any;
                            // FILTER OUT BLOCKED USERS
                            if (blockedIds.includes(otherUser.id)) continue;

                            roomsData.push({
                                id: roomId,
                                updated_at: lastMsg?.created_at || new Date().toISOString(),
                                other_user: otherUser,
                                last_message: lastMsg || undefined
                            });
                        }
                    }
                    roomsData.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
                    set({ rooms: roomsData });
                } catch (error) {
                    console.error('Error fetching rooms:', error);
                } finally {
                    set({ isLoading: false });
                }
            },

            fetchMessages: async (roomId: string) => {
                const { data: { user } } = await supabase.auth.getUser();
                const { data, error } = await supabase
                    .from('messages')
                    .select(`
                        *,
                        post:posts (
                            id, content, media_urls, created_at,
                            profile:profiles!posts_user_id_fkey (username, full_name, avatar_url)
                        ),
                        anon_post:anon_posts (
                            id, content, created_at, badge,
                            identity:anon_identities!anon_posts_identity_id_fkey (anon_name, avatar_color)
                        ),
                        activity:activities (*)
                    `)
                    .eq('room_id', roomId)
                    .order('created_at', { ascending: false });

                if (!error && data) {
                    const visibleMessages = data.filter(m =>
                        !m.deleted_by || !m.deleted_by.includes(user?.id)
                    );
                    set({ activeRoomMessages: visibleMessages });
                } else if (error) {
                    console.error('Error fetching messages:', error);
                }
            },

            sendMessage: async (roomId: string, content: string, userId: string) => {
                const newMessage: Message = {
                    id: Date.now().toString(),
                    room_id: roomId,
                    user_id: userId,
                    content: content,
                    created_at: new Date().toISOString(),
                    is_read: false
                };

                const { activeRoomMessages } = get();
                set({ activeRoomMessages: [newMessage, ...activeRoomMessages] });
                get().updateRoomLastMessage(roomId, newMessage);

                const { data, error } = await supabase
                    .from('messages')
                    .insert({
                        room_id: roomId,
                        user_id: userId,
                        content: content
                    })
                    .select()
                    .single();

                if (error) {
                    console.error('Error sending message:', error);
                    set(state => ({
                        activeRoomMessages: state.activeRoomMessages.filter(m => m.id !== newMessage.id)
                    }));
                    // alert('Failed to send message.');
                } else if (data) {
                    set(state => ({
                        activeRoomMessages: state.activeRoomMessages.map(m =>
                            m.id === newMessage.id ? data : m
                        )
                    }));
                    get().updateRoomLastMessage(roomId, data);
                }
            },

            startNewChat: async (otherUserId: string) => {
                const { data, error } = await supabase
                    .rpc('get_or_create_dm_room', { other_user_id: otherUserId });

                if (error) throw error;
                return data;
            },

            addMessage: (message: Message) => {
                set(state => {
                    // Check if hidden for me (Fix for flicker issue)
                    // We need user ID... we can get it from supabase.auth.getUser() but that's async.
                    // Instead, rely on the fact that if 'deleted_by' exists, we should check against 'user'.
                    // But 'user' isn't readily available in this synchronous block efficiently without caching it in store.
                    // However, we can trust the caller or check 'usersIBlocked' context? No.

                    // BETTER APPROACH:
                    // If message.deleted_by includes the CURRENT USER ID, we must REMOVE it.
                    // Since we can't easily get current user ID synchronously here efficiently if not stored,
                    // we will assume the caller (RealtimeManager) handles this OR we temporarily store userId in store?
                    // Actually, 'addMessage' is getting 'message' which SHOULD have 'deleted_by'.
                    // Let's modify RealtimeManager to FILTER it before calling addMessage? 
                    // No, keeping logic in Store is better. 
                    // Let's check against Supabase User asynchronously? No, state update must be synchronous or use get().

                    // QUICK FIX: Since we don't have currentUserId easily accessible synchronously in Zustand vanilla (unless we stored it),
                    // let's pass it or... wait. 'RealtimeManager' has 'user'.
                    // RealtimeManager should check this before calling addMessage.

                    // Actually, let's keep addMessage simple as "Add/Update this valid message".
                    // And filter in RealtimeManager.

                    // REVERTING THIS PLAN. modification will be in RealtimeManager.

                    if (state.activeRoomMessages.some(m => m.id === message.id)) {
                        return {
                            activeRoomMessages: state.activeRoomMessages.map(m =>
                                m.id === message.id ? message : m
                            )
                        };
                    }

                    // Optimistic Deduplication
                    if (message.user_id) {
                        const optimisticMatchIndex = state.activeRoomMessages.findIndex(m =>
                            m.room_id === message.room_id &&
                            m.user_id === message.user_id &&
                            m.content === message.content && (
                                m.id.length < 20 || m.id.startsWith('temp-')
                            )
                        );

                        if (optimisticMatchIndex !== -1) {
                            const newMessages = [...state.activeRoomMessages];
                            newMessages[optimisticMatchIndex] = message;
                            return { activeRoomMessages: newMessages };
                        }
                    }

                    return {
                        activeRoomMessages: [message, ...state.activeRoomMessages]
                    };
                });
                get().updateRoomLastMessage(message.room_id, message);
            },

            updateRoomLastMessage: (roomId: string, message: Message) => {
                set(state => ({
                    rooms: state.rooms.map(r => {
                        if (r.id === roomId) {
                            return { ...r, last_message: message, updated_at: message.created_at };
                        }
                        return r;
                    }).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
                }));
            },

            // --- Blocking Logic ---
            fetchBlocks: async () => {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                // get who I blocked OR who blocked me
                const { data, error } = await supabase
                    .from('blocks')
                    .select('blocker_id, blocked_id')
                    .or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`);

                if (data) {
                    const allBlocked = new Set<string>();
                    const myBlocked = new Set<string>();

                    data.forEach(b => {
                        // General list (hide content from both)
                        if (b.blocker_id === user.id) {
                            allBlocked.add(b.blocked_id);
                            myBlocked.add(b.blocked_id);
                        }
                        if (b.blocked_id === user.id) {
                            allBlocked.add(b.blocker_id);
                        }
                    });
                    set({ blockedUserIds: Array.from(allBlocked), usersIBlocked: Array.from(myBlocked) });
                }
            },

            blockUser: async (userId: string) => {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                // Optimistic
                set(state => ({
                    blockedUserIds: [...state.blockedUserIds, userId],
                    usersIBlocked: [...state.usersIBlocked, userId]
                }));

                const { error } = await supabase.from('blocks').insert({
                    blocker_id: user.id,
                    blocked_id: userId
                });

                if (error) {
                    console.error("Block error", error);
                    // Revert
                    set(state => ({
                        blockedUserIds: state.blockedUserIds.filter(id => id !== userId),
                        usersIBlocked: state.usersIBlocked.filter(id => id !== userId)
                    }));
                }
            },

            unblockUser: async (userId: string) => {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                // Optimistic
                set(state => ({
                    blockedUserIds: state.blockedUserIds.filter(id => id !== userId),
                    usersIBlocked: state.usersIBlocked.filter(id => id !== userId)
                }));

                const { error } = await supabase
                    .from('blocks')
                    .delete()
                    .eq('blocker_id', user.id)
                    .eq('blocked_id', userId);

                if (error) {
                    console.error("Unblock error", error);
                    // Revert
                    set(state => ({
                        blockedUserIds: [...state.blockedUserIds, userId],
                        usersIBlocked: [...state.usersIBlocked, userId]
                    }));
                }
            },

            isBlocked: (userId: string) => {
                return get().blockedUserIds.includes(userId);
            },

            isBlockedByMe: (userId: string) => {
                return get().usersIBlocked.includes(userId);
            },

            clearChat: () => {
                set({
                    rooms: [],
                    activeRoomMessages: [],
                    blockedUserIds: [],
                    usersIBlocked: [],
                    activeChannel: null,
                    typingUsers: new Set(),
                    isLoading: false
                });
            }
        }),
        {
            name: 'chat-storage',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({ rooms: state.rooms }),
        }
    )
);
