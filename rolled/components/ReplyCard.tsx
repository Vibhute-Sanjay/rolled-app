import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions } from 'react-native';
import { Colors } from '../constants/Colors';
import { MaterialCommunityIcons, Ionicons, Feather } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { formatTimeAgo } from '../utils/date';
import { UserBadges } from './UserBadges';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

export interface ReplyProps {
    id: string;
    content: string;
    created_at: string;
    user: {
        id: string;
        username: string;
        full_name: string;
        avatar_url: string;
        is_verified?: boolean;
        is_admin?: boolean;
        is_og?: boolean;
    };
    parent_post?: {
        id: string;
        user: { // The author of the parent post
            username: string;
        }
    };
    likes_count: number;
    replies_count: number;
    has_liked: boolean;
}

interface ReplyCardProps {
    reply: ReplyProps;
    onLike?: () => void;
    onReply?: () => void;
    onShare?: () => void;
    onShowOptions?: (reply: ReplyProps) => void;
}

export const ReplyCard = ({ reply, onLike, onReply, onShare, onShowOptions }: ReplyCardProps) => {
    const timeAgo = formatTimeAgo(reply.created_at);
    const router = useRouter();

    const handleUserPress = () => {
        router.push(`/user/${reply.user.id}`);
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerUserInfo}>
                    <TouchableOpacity onPress={handleUserPress}>
                        <Image source={{ uri: reply.user.avatar_url || 'https://via.placeholder.com/40' }} style={styles.avatar} />
                    </TouchableOpacity>
                    <View style={styles.headerText}>
                        <TouchableOpacity onPress={handleUserPress} style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={styles.name} numberOfLines={1}>{reply.user.full_name}</Text>
                            <UserBadges user={reply.user} size={14} />
                            <Text style={styles.handle} numberOfLines={1}>@{reply.user.username}</Text>
                            <Text style={styles.dot}>•</Text>
                            <Text style={styles.time}>{timeAgo}</Text>
                        </TouchableOpacity>
                        {reply.parent_post && (
                            <View style={styles.replyingToRow}>
                                <Text style={styles.replyingText}>Replying to </Text>
                                <Text style={styles.replyingHandle}>@{reply.parent_post.user.username}</Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Options Menu - Moved inside header */}
                <TouchableOpacity style={{ padding: 4, marginLeft: 8 }} onPress={() => onShowOptions?.(reply)}>
                    <MaterialCommunityIcons name="dots-horizontal" size={20} color={Colors.dark.textSecondary} />
                </TouchableOpacity>
            </View>

            {/* Clickable Body & Footer area */}
            <TouchableOpacity onPress={() => reply.parent_post && router.push(`/post/${reply.parent_post.id}`)} activeOpacity={0.8}>
                {/* Content */}
                <Text style={styles.content}>{reply.content}</Text>

                {/* Footer Actions - Shifted to right */}
                <View style={styles.footer}>
                    <View style={{ flex: 1 }} />
                    <View style={styles.rightActions}>
                        <TouchableOpacity style={styles.actionButton} onPress={onLike}>
                            <Ionicons name={reply.has_liked ? "heart" : "heart-outline"} size={20} color={reply.has_liked ? "#ff3040" : Colors.dark.textSecondary} />
                            <Text style={styles.actionText}>{reply.likes_count || 0}</Text>
                        </TouchableOpacity>

                        {/* Removed Reply Button as requested */}

                        <TouchableOpacity style={styles.actionButton} onPress={onShare}>
                            <MaterialCommunityIcons name="send-outline" size={22} color={Colors.dark.textSecondary} />
                        </TouchableOpacity>
                    </View>
                </View>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 15,
        paddingVertical: 12,
        backgroundColor: Colors.dark.background,
        borderBottomWidth: 1,
        borderBottomColor: '#222',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    headerUserInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    avatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#333',
        marginRight: 10,
    },
    headerText: {
        flex: 1,
        justifyContent: 'center',
    },
    name: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 15,
        flexShrink: 1,
    },
    handle: {
        color: Colors.dark.textSecondary,
        fontSize: 14,
        marginLeft: 6,
        flexShrink: 1,
    },
    dot: {
        color: Colors.dark.textSecondary,
        fontSize: 12,
        marginHorizontal: 4,
    },
    time: {
        color: Colors.dark.textSecondary,
        fontSize: 14,
    },
    replyingToRow: {
        flexDirection: 'row',
        marginTop: 1,
    },
    replyingText: {
        color: Colors.dark.textSecondary,
        fontSize: 13,
    },
    replyingHandle: {
        color: Colors.dark.primary,
        fontSize: 13,
    },
    content: {
        color: 'white',
        fontSize: 15,
        lineHeight: 22,
        marginTop: 0,
        marginBottom: 12,
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 4,
    },
    rightActions: {
        flexDirection: 'row',
        gap: 20,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    actionText: {
        color: Colors.dark.textSecondary,
        fontSize: 12,
        fontWeight: '500',
    },
});
