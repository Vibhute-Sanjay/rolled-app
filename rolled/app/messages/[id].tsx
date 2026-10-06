import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Text, FlatList, Alert, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { useChatStore, Message } from '../../stores/chatStore';
import { supabase } from '../../lib/supabase';
import { MessageBubble } from '../../components/Chat/MessageBubble';
import { ChatInput } from '../../components/Chat/ChatInput';
import { Avatar } from '../../components/Avatar';
import { Ionicons } from '@expo/vector-icons';
import { usePresence } from '../../context/PresenceContext';
import { CustomActionSheet, ActionSheetOption } from '../../components/CustomActionSheet';
import { ReportModal } from '../../components/ReportModal';
import { TypingBubble } from '../../components/Chat/TypingBubble';
import { UserBadges } from '../../components/UserBadges';

// Helper for "Last seen X ago"
function formatLastSeen(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
}

export default function ChatRoomScreen() {
    // ... existing hooks
    const { id } = useLocalSearchParams<{ id: string }>();
    const activeRoomMessages = useChatStore(s => s.activeRoomMessages);
    const fetchMessages = useChatStore(s => s.fetchMessages);
    const sendMessage = useChatStore(s => s.sendMessage);
    const markMessagesAsRead = useChatStore(s => s.markMessagesAsRead);
    const sendImageMessage = useChatStore(s => s.sendImageMessage);
    const reportContent = useChatStore(s => s.reportContent);
    const rooms = useChatStore(s => s.rooms);
    const deleteMessage = useChatStore(s => s.deleteMessage);
    const sendTyping = useChatStore(s => s.sendTyping);
    const blockUser = useChatStore(s => s.blockUser);
    const deleteForMe = useChatStore(s => s.deleteForMe);
    // Blocking & Requests
    const isBlocked = useChatStore(s => s.isBlocked);
    const isBlockedByMe = useChatStore(s => s.isBlockedByMe); // [NEW]
    // blockUser already imported above at line 46
    const deleteRoom = useChatStore(s => s.deleteRoom);

    // New Realtime Selectors
    const subscribeToRoom = useChatStore(s => s.subscribeToRoom);
    const unsubscribeFromRoom = useChatStore(s => s.unsubscribeFromRoom);
    const typingUsers = useChatStore(s => s.typingUsers);

    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const router = useRouter(); // Use this
    const { onlineUsers } = usePresence();

    const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
    const [actionSheetVisible, setActionSheetVisible] = useState(false);
    const [reportModalVisible, setReportModalVisible] = useState(false);
    // const [isTyping, setIsTyping] = useState(false); // Removed, using store
    const [lastTyped, setLastTyped] = useState(0);

    const room = rooms.find(r => r.id === id);
    const otherUser = room?.other_user;

    // Derived typing state
    const isOtherUserTyping = otherUser ? typingUsers.has(otherUser.id) : false;

    // Check Status
    const isUserBlocked = otherUser ? isBlocked(otherUser.id) : false;
    const haveIBlockedThem = otherUser ? isBlockedByMe(otherUser.id) : false; // [NEW]

    // Message Request & Follow Gate Logic
    const [iFollowThem, setIFollowThem] = useState(true);
    const [theyFollowMe, setTheyFollowMe] = useState(true);
    const [isCheckingFollow, setIsCheckingFollow] = useState(true);

    useEffect(() => {
        if (otherUser && currentUserId) {
            checkFollowStatus();
        }
    }, [otherUser, currentUserId]);

    const checkFollowStatus = async () => {
        if (!otherUser || !currentUserId) return;
        setIsCheckingFollow(true);
        try {
            const [myFollowRes, theirFollowRes] = await Promise.all([
                supabase.from('follows').select('*').eq('follower_id', currentUserId).eq('following_id', otherUser.id).maybeSingle(),
                supabase.from('follows').select('*').eq('follower_id', otherUser.id).eq('following_id', currentUserId).maybeSingle()
            ]);

            setIFollowThem(!!myFollowRes.data);
            setTheyFollowMe(!!theirFollowRes.data);
        } catch (e) {
            console.error(e);
        } finally {
            setIsCheckingFollow(false);
        }
    };

    const handleFollow = async () => {
        if (!otherUser || !currentUserId) return;
        try {
            const { data, error } = await supabase.rpc('toggle_follow', {
                target_user_id: otherUser.id
            });
            if (error) throw error;

            // If it returns 'following', update local state
            if (data === 'following') {
                setIFollowThem(true);
            }
        } catch (e) {
            Alert.alert("Error", "Could not follow user.");
        }
    };

    const handleBlockRequest = () => {
        if (otherUser) {
            Alert.alert("Block User", "They won't be able to message you.", [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Block", style: 'destructive', onPress: async () => {
                        await blockUser(otherUser.id);
                        router.back();
                    }
                }
            ]);
        }
    };

    const handleDeleteRequest = () => {
        Alert.alert("Delete Chat", "This will remove the conversation for you.", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete", style: 'destructive', onPress: async () => {
                    if (id) {
                        await deleteRoom(id);
                        router.back();
                    }
                }
            }
        ]);
    };

    // Determine if this is a "Reply Case" or a "Start Case"
    const hasIncomingMessages = activeRoomMessages.some(m => m.user_id === otherUser?.id);

    useEffect(() => {
        if (id) {
            subscribeToRoom(id);
        }
        return () => {
            unsubscribeFromRoom();
        };
    }, [id, subscribeToRoom, unsubscribeFromRoom]);

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user) setCurrentUserId(user.id);
        });

        if (id) {
            fetchMessages(id);
            // ONLY MARK READ IF: I follow them (not a request)
            if (currentUserId && iFollowThem) {
                markMessagesAsRead(id, currentUserId);
            }
        }
    }, [id, iFollowThem]);

    // Mark read when new messages arrive (primitive)
    useEffect(() => {
        if (id && currentUserId && activeRoomMessages.length > 0 && iFollowThem) {
            const latest = activeRoomMessages[0];
            if (!latest.is_read && latest.user_id !== currentUserId) {
                markMessagesAsRead(id, currentUserId);
            }
        }
    }, [activeRoomMessages, id, currentUserId, iFollowThem]);


    const handleSend = async (text: string) => {
        if (id && currentUserId) {
            await sendMessage(id, text, currentUserId);
        }
    };

    const handleSendImage = async (uri: string) => {
        if (id && currentUserId) {
            await sendImageMessage(id, uri, currentUserId);
        }
    };

    // If room details are missing (e.g. started new chat), try to fetch them
    useEffect(() => {
        if (id && !room && currentUserId) {
            // We can reuse fetchRooms for now which gets all rooms.
            // Ideally we'd fetch just one, but this works to populate the header.
            useChatStore.getState().fetchRooms();
        }
    }, [id, room, currentUserId]);

    if (!id || !currentUserId) {
        return <View style={styles.center}><ActivityIndicator /></View>;
    }

    const handleLongPress = (message: Message) => {
        setSelectedMessage(message);
        setActionSheetVisible(true);
    };

    // const blockUser = useChatStore(s => s.blockUser); // Already defined above

    // ...

    const handleAction = async (action: string) => {
        setActionSheetVisible(false);
        if (!selectedMessage) return;

        if (action === 'deleteForMe') {
            Alert.alert(
                "Delete for Me",
                "This message will be removed from your device only.",
                [
                    { text: "Cancel", style: "cancel" },
                    {
                        text: "Delete",
                        style: "destructive",
                        onPress: () => {
                            deleteForMe(selectedMessage.id);
                            setSelectedMessage(null);
                        }
                    }
                ]
            );
        } else if (action === 'deleteEveryone') {
            Alert.alert(
                "Unsend Message",
                "This message will be deleted for everyone in the chat.",
                [
                    { text: "Cancel", style: "cancel" },
                    {
                        text: "Unsend",
                        style: "destructive",
                        onPress: async () => {
                            await deleteMessage(selectedMessage.id);
                            setSelectedMessage(null);
                        }
                    }
                ]
            );
        } else if (action === 'report') {
            setReportModalVisible(true);
        } else if (action === 'block') {
            Alert.alert(
                "Block User",
                "Are you sure you want to block this user? You will no longer receive messages from them.",
                [
                    { text: "Cancel", style: "cancel" },
                    {
                        text: "Block",
                        style: "destructive",
                        onPress: async () => {
                            await blockUser(selectedMessage.user_id);
                            setSelectedMessage(null);
                            // Optionally navigate back or show toast
                            router.back();
                            Alert.alert("User Blocked", "You have blocked this user.");
                        }
                    }
                ]
            );
        }
    };

    const handleSubmitReport = async (reason: string, details: string) => {
        if (selectedMessage) {
            await reportContent(selectedMessage.id, 'message', reason, details);
            setReportModalVisible(false);
            setSelectedMessage(null);
            Alert.alert("Report Sent", "Thank you. We will review this message.");
        }
    };

    // Throttled typing sender
    const handleTyping = () => {
        const now = Date.now();
        if (now - lastTyped > 2000 && id && currentUserId) {
            sendTyping(id, currentUserId);
            setLastTyped(now);
        }
    };

    const handleHeaderMenu = () => {
        Alert.alert(
            "Chat Options",
            "What would you like to do?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: 'Report User',
                    style: 'default',
                    onPress: () => {
                        setTimeout(() => setReportModalVisible(true), 100);
                    }
                },
                {
                    text: 'Block User',
                    style: 'destructive',
                    onPress: handleBlockRequest // Reuses existing confirmation alert
                }
            ]
        );
    };

    // Calculate options based on selected message
    const actionOptions: ActionSheetOption[] = [];
    if (selectedMessage && currentUserId) {
        const isMe = selectedMessage.user_id === currentUserId;

        // Everyone can "Delete for Me"
        actionOptions.push({
            label: 'Delete for Me',
            icon: 'trash-can-outline',
            isDestructive: true,
            onPress: () => handleAction('deleteForMe')
        });

        if (isMe) {
            // Sender can also "Unsend"
            actionOptions.push({
                label: 'Unsend (Everyone)',
                icon: 'trash-bin-outline', // Distinct icon
                isDestructive: true,
                onPress: () => handleAction('deleteEveryone')
            });
        } else {
            actionOptions.push({
                label: 'Report Message',
                icon: 'alert-octagon-outline',
                isDestructive: true,
                onPress: () => handleAction('report')
            });
            actionOptions.push({
                label: 'Block User',
                icon: 'block-helper',
                isDestructive: true,
                onPress: () => handleAction('block')
            });
        }
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* ... Screen Content ... */}

            {/* Header ... */}
            <View style={styles.header}>
                {/* Keeping existing header rendering */}
                <Ionicons
                    name="chevron-back"
                    size={28}
                    color={Colors.dark.text}
                    onPress={() => router.back()}
                    style={styles.backButton}
                />
                {otherUser ? (
                    <TouchableOpacity
                        style={[styles.headerContent, { flex: 1 }]} // flex 1 to push menu to right
                        onPress={() => router.push(`/user/${otherUser.id}` as any)}
                    >
                        <Avatar
                            uri={otherUser.avatar_url}
                            name={otherUser.full_name || otherUser.username}
                            size={36}
                        />
                        <View style={styles.headerTextContainer}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <Text style={styles.headerName}>{otherUser.full_name || otherUser.username}</Text>
                                <UserBadges user={otherUser} size={14} />
                            </View>
                            {onlineUsers.has(otherUser.id) && iFollowThem ? (
                                <Text style={styles.onlineText}>Online</Text>
                            ) : (
                                <Text style={styles.offlineText}>
                                    {!iFollowThem
                                        ? 'Message Request'
                                        : otherUser.last_seen
                                            ? `Last seen ${formatLastSeen(otherUser.last_seen)}`
                                            : 'Offline'
                                    }
                                </Text>
                            )}
                        </View>
                    </TouchableOpacity>
                ) : (
                    <View style={[styles.headerContent, { flex: 1 }]}>
                        <Text style={styles.headerName}>Chat</Text>
                    </View>
                )}

                {/* 3-Dots Menu */}
                {otherUser && (
                    <TouchableOpacity onPress={handleHeaderMenu} style={{ padding: 4 }}>
                        <Ionicons name="ellipsis-horizontal" size={24} color={Colors.dark.text} />
                    </TouchableOpacity>
                )}
            </View>

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
                <View style={{ flex: 1 }}>
                    <FlatList
                        data={activeRoomMessages}
                        renderItem={({ item }) => (
                            <MessageBubble
                                message={item}
                                isMe={item.user_id === currentUserId}
                                onLongPress={() => handleLongPress(item)}
                            />
                        )}
                        inverted
                        ListHeaderComponent={() => (
                            isOtherUserTyping ? <TypingBubble /> : null
                        )}
                        contentContainerStyle={styles.listContent}
                        keyboardDismissMode="interactive"
                        keyExtractor={item => item.id}
                    />
                </View>

                {/* Blocked State Handling */}
                {isUserBlocked ? (
                    <View style={[styles.inputContainer, { justifyContent: 'center', alignItems: 'center', padding: 20 }]}>
                        <Text style={{ color: Colors.dark.textSecondary }}>
                            {haveIBlockedThem ? "You have blocked this user." : "You cannot message this user."}
                        </Text>
                        {haveIBlockedThem && (
                            <TouchableOpacity onPress={() => useChatStore.getState().unblockUser(otherUser!.id)} style={{ marginTop: 10 }}>
                                <Text style={{ color: Colors.dark.primary }}>Unblock</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                ) : !iFollowThem ? (
                    <View style={styles.requestContainer}>
                        <Text style={styles.requestTitle}>
                            {hasIncomingMessages ? 'Message Request' : 'Follow to Message'}
                        </Text>
                        <Text style={styles.requestSubtitle}>
                            {hasIncomingMessages
                                ? `@${otherUser?.username} wants to chat. Follow back to reply and see their activity.`
                                : `You need to follow @${otherUser?.username} to send them a message.`}
                        </Text>
                        {hasIncomingMessages ? (
                            <View style={styles.requestButtons}>
                                <TouchableOpacity style={[styles.reqBtn, styles.reqBtnBlock]} onPress={handleBlockRequest}>
                                    <Text style={styles.reqBtnTextDestructive}>Block</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.reqBtn, styles.reqBtnDelete]} onPress={handleDeleteRequest}>
                                    <Text style={styles.reqBtnTextDestructive}>Delete</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.reqBtn, styles.reqBtnAccept, { flex: 1 }]} onPress={handleFollow}>
                                    <Text style={styles.reqBtnTextPrimary}>Follow Back</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <TouchableOpacity
                                style={[styles.reqBtn, { backgroundColor: Colors.dark.primary, width: '100%', maxWidth: 200 }]}
                                onPress={handleFollow}
                            >
                                <Text style={[styles.reqBtnTextPrimary, { fontSize: 16 }]}>Follow</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                ) : (
                    <ChatInput
                        onSend={handleSend}
                        onSendImage={handleSendImage}
                        onTyping={handleTyping}
                    />
                )}
            </KeyboardAvoidingView>

            {/* Action Sheet & Modals */}
            <CustomActionSheet
                visible={actionSheetVisible}
                onClose={() => setActionSheetVisible(false)}
                options={actionOptions}
                title="Message Options"
            />

            <ReportModal
                visible={reportModalVisible}
                onClose={() => setReportModalVisible(false)}
                // onSubmit={handleSubmitReport} // Removed
                targetType="message"
                targetId={selectedMessage?.id}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    requestContainer: {
        padding: 20,
        backgroundColor: '#1E1E1E',
        borderTopWidth: 1,
        borderTopColor: '#333',
        alignItems: 'center',
        paddingBottom: 40 // Safe Area
    },
    requestTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: 'white',
        marginBottom: 8
    },
    requestSubtitle: {
        fontSize: 14,
        color: '#999',
        textAlign: 'center',
        marginBottom: 20
    },
    requestButtons: {
        flexDirection: 'row',
        gap: 15,
        width: '100%',
        justifyContent: 'center'
    },
    reqBtn: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 20,
        backgroundColor: '#333',
        minWidth: 80,
        alignItems: 'center'
    },
    reqBtnBlock: { backgroundColor: 'rgba(255,59,48,0.1)' },
    reqBtnDelete: { backgroundColor: 'rgba(255,59,48,0.1)' },
    reqBtnAccept: { backgroundColor: Colors.dark.primary },
    reqBtnTextDestructive: { color: '#FF3B30', fontWeight: '600' },
    reqBtnTextPrimary: { color: 'black', fontWeight: '600' },
    inputContainer: {
        borderTopWidth: 1,
        borderTopColor: Colors.dark.border,
        paddingBottom: 20,
        backgroundColor: Colors.dark.background
    },
    container: {
        flex: 1,
        backgroundColor: Colors.dark.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#222',
        backgroundColor: Colors.dark.background,
    },
    backButton: {
        marginRight: 12,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerTextContainer: {
        marginLeft: 10,
    },
    headerName: {
        color: Colors.dark.text,
        fontSize: 16,
        fontWeight: '600',
    },
    onlineText: {
        color: Colors.dark.primary, // Or a specific Green
        fontSize: 12,
    },
    typingText: {
        color: Colors.dark.primary,
        fontSize: 12,
        fontStyle: 'italic',
    },
    offlineText: {
        color: Colors.dark.textSecondary,
        fontSize: 12,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.dark.background,
    },
    listContent: {
        paddingHorizontal: 16,
        paddingVertical: 16,
    },
});
