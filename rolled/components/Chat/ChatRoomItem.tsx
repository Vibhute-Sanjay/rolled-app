import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { ChatRoom } from '../../stores/chatStore';
import { Avatar } from '../Avatar';
import { Colors } from '../../constants/Colors';
import { formatDistanceToNow } from 'date-fns';
import { UserBadges } from '../UserBadges';

type ChatRoomItemProps = {
    room: ChatRoom;
    onLongPress?: () => void;
};

export const ChatRoomItem = ({ room, onLongPress }: ChatRoomItemProps) => {
    const router = useRouter();
    const otherUser = room.other_user;

    if (!otherUser) return null;

    const handlePress = () => {
        router.push(`/messages/${room.id}` as any);
    };

    const timeAgo = room.last_message?.created_at
        ? formatDistanceToNow(new Date(room.last_message.created_at), { addSuffix: false })
        : '';

    // Shorten time string
    const shortTime = timeAgo
        .replace('less than a minute', 'now')
        .replace(' minutes', 'm')
        .replace(' minute', 'm')
        .replace(' hours', 'h')
        .replace(' hour', 'h')
        .replace(' days', 'd')
        .replace(' day', 'd');

    // Show dot if message is NOT read AND I am NOT the sender (it's incoming)
    // We don't strictly know "my" ID here without context/store, but usually we filter messages.
    // Ideally we should pass currentUserId or check last_message.user_id !== myId.
    // For now, let's assume if it's NOT read, we check if it is FROM the other user.
    const isUnread = room.last_message && !room.last_message.is_read && room.last_message.user_id === otherUser.id;

    return (
        <TouchableOpacity
            style={styles.container}
            onPress={handlePress}
            onLongPress={onLongPress}
            delayLongPress={500}
            activeOpacity={0.7}
        >
            <View style={styles.avatarContainer}>
                <Avatar
                    uri={otherUser.avatar_url}
                    name={otherUser.full_name || otherUser.username}
                    size={50}
                />
            </View>

            <View style={styles.contentContainer}>
                <View style={styles.topRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 4 }}>
                        <Text style={styles.name} numberOfLines={1}>{otherUser.full_name || otherUser.username}</Text>
                        <UserBadges user={otherUser} size={14} />
                    </View>
                    {shortTime ? <Text style={styles.time}>{shortTime}</Text> : null}
                </View>

                <View style={styles.bottomRow}>
                    <Text style={[styles.message, isUnread && styles.unreadMessage]} numberOfLines={1}>
                        {room.last_message?.content || 'Started a chat'}
                    </Text>
                    {isUnread && <View style={styles.unreadDot} />}
                </View>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        paddingVertical: 12,
        paddingHorizontal: 16,
        alignItems: 'center',
        backgroundColor: Colors.dark.background,
    },
    avatarContainer: {
        marginRight: 12,
    },
    contentContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    name: {
        color: Colors.dark.text,
        fontSize: 16,
        fontWeight: '600',
        flexShrink: 1,
    },
    time: {
        color: Colors.dark.textSecondary,
        fontSize: 12,
        marginLeft: 8,
    },
    bottomRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    message: {
        color: Colors.dark.textSecondary,
        fontSize: 14,
        flex: 1,
        marginRight: 8,
    },
    unreadMessage: {
        color: Colors.dark.text,
        fontWeight: '700', // Bold for unread
    },
    unreadDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: 'cyan', // Requested Cyan
    },
});
