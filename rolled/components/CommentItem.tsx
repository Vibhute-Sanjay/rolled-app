import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Alert } from 'react-native';
import { Colors } from '../constants/Colors';
import { MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { formatTimeAgo } from '../utils/date';
import { UserBadges } from './UserBadges';
import { useRouter } from 'expo-router';
import { ParsedContent } from './ParsedContent';

export interface CommentProps {
    id: string;
    content: string;
    created_at: string;
    parent_id: string | null;
    user: {
        id: string;
        username: string;
        full_name: string;
        avatar_url?: string | null;
        is_verified?: boolean;
        is_admin?: boolean;
        is_og?: boolean;
    };
    has_liked?: boolean;
    replies_count?: number;
    isAnon?: boolean;
    anonColor?: string;
}

interface CommentItemProps {
    comment: CommentProps;
    onReply: (comment: CommentProps) => void;
    onLike?: (comment: CommentProps) => void;
    onShare?: (comment: CommentProps) => void;
    onShowOptions?: (comment: CommentProps) => void;
    currentUserId?: string;
}

export const CommentItem = ({ comment, onReply, onLike, onShare, onShowOptions, currentUserId }: CommentItemProps) => {
    const timeAgo = formatTimeAgo(comment.created_at);
    // For anon comments, ownership is via anon_identity_id which we mapped to user.id
    const isOwner = currentUserId === comment.user.id;
    const router = useRouter();

    const handleUserPress = () => {
        if (currentUserId === comment.user.id) {
            router.push('/profile');
        } else {
            router.push(`/user/${comment.user.id}`);
        }
    };

    return (
        <View style={[styles.container, comment.parent_id && styles.replyContainer]}>
            {/* Thread Line for Replies */}
            {comment.parent_id && <View style={styles.threadLine} />}

            <View style={styles.card}>
                <View style={styles.header}>
                    {comment.isAnon ? (
                        <View style={[styles.anonAvatar, { backgroundColor: comment.anonColor || '#333' }]}>
                            <Text style={styles.anonAvatarText}>
                                {comment.user.username.charAt(0).toUpperCase()}
                            </Text>
                        </View>
                    ) : (
                        <TouchableOpacity onPress={handleUserPress}>
                            <Image
                                source={{ uri: comment.user?.avatar_url || 'https://via.placeholder.com/40' }}
                                style={styles.avatar}
                            />
                        </TouchableOpacity>
                    )}
                    <View style={styles.headerText}>
                        <TouchableOpacity onPress={handleUserPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.name}>{comment.user.full_name || 'User'}</Text>
                            {!comment.isAnon && <UserBadges user={comment.user} size={12} />}
                            <Text style={styles.time}>{timeAgo}</Text>
                        </TouchableOpacity>
                        {comment.parent_id && (
                            <Text style={styles.replyingText}>
                                <MaterialCommunityIcons name="arrow-right-bottom" size={12} color={Colors.dark.textSecondary} /> replying
                            </Text>
                        )}
                    </View>

                    {/* Menu (Report / Delete) */}
                    <TouchableOpacity style={{ marginLeft: 'auto', padding: 4 }} onPress={() => onShowOptions?.(comment)}>
                        <MaterialCommunityIcons name="dots-horizontal" size={16} color={Colors.dark.textSecondary} />
                    </TouchableOpacity>
                </View>

                <ParsedContent content={comment.content} style={styles.content} />

                <View style={styles.footer}>
                    {/* Likes */}
                    <TouchableOpacity style={styles.action} onPress={() => onLike?.(comment)}>
                        <MaterialCommunityIcons
                            name={comment.has_liked ? "heart" : "heart-outline"}
                            size={16}
                            color={comment.has_liked ? "#ff3040" : Colors.dark.textSecondary}
                        />
                        {/* We hide count for now if assuming 0, or use passed count */}
                        {/* <Text style={styles.actionText}>{comment.likes_count || 0}</Text> */}
                    </TouchableOpacity>

                    {/* Reply (Count Logic) */}
                    <TouchableOpacity style={styles.action} onPress={() => onReply(comment)}>
                        <MaterialCommunityIcons name="comment-outline" size={16} color={Colors.dark.textSecondary} />
                        {comment.replies_count ? (
                            <Text style={styles.actionText}>{comment.replies_count} replies</Text>
                        ) : null}
                    </TouchableOpacity>


                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 12,
        paddingHorizontal: 15,
    },
    replyContainer: {
        marginLeft: 30, // Indent replies
    },
    card: {
        backgroundColor: '#1E1E1E', // Dark card bg from screenshot
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: '#333',
    },
    threadLine: {
        position: 'absolute',
        left: -15, // connect to parent roughly (visual only for now)
        top: -10,
        bottom: 20,
        width: 2,
        backgroundColor: '#333',
        // Creating a true tree thread line is complex in flatlist, simplified for now
        display: 'none', // Hiding custom thread line for now, sticking to indentation
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    avatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#333',
    },
    anonAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    anonAvatarText: {
        color: '#000',
        fontWeight: 'bold',
        fontSize: 16,
    },
    headerText: {
        marginLeft: 10,
    },
    name: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14,
    },
    time: {
        color: Colors.dark.textSecondary,
        fontSize: 12,
    },
    replyingText: {
        color: Colors.dark.textSecondary,
        fontSize: 11,
        marginTop: 2,
    },
    content: {
        color: '#ddd',
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 12,
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 20,
    },
    action: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    actionText: {
        color: Colors.dark.textSecondary,
        fontSize: 12,
    },
});
