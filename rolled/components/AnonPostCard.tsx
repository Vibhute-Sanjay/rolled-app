import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '../constants/Colors';
import { FontAwesome5, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { isPostFire } from '../utils/scoring';

export interface AnonPostProps {
    id: string;
    content: string;
    identity_id: string;
    anon_name: string;
    avatar_color: string;
    created_at: string;
    upvotes: number;
    downvotes: number;
    reply_count: number;
    badge?: string;
    vote_type?: 1 | -1 | 0; // Current user's vote
}

interface AnonPostCardProps {
    post: AnonPostProps;
    onUpvote: () => void;
    onDownvote: () => void;
    onReply: () => void;
    onReport?: () => void;
    onShare?: () => void;
}

import { useInteractionStore } from '../store/interactionStore';

export const AnonPostCard = ({ post, onUpvote, onDownvote, onReply, onReport, onShare }: AnonPostCardProps) => {

    // Subscribe to store for realtime updates
    const interactionState = useInteractionStore(state => state.interactions[post.id]);
    const replyCount = interactionState?.comments_count ?? post.reply_count;

    const score = post.upvotes - post.downvotes;


    const formatShortTime = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (seconds < 60) return 'now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h`;
        const days = Math.floor(hours / 24);
        if (days < 7) return `${days}d`;
        return `${Math.floor(days / 7)}w`;
    };

    const getDisplayBadge = (badge?: string) => {
        if (!badge) return '';
        const lower = badge.toLowerCase();
        if (lower === 'rant') return 'VENT';
        if (lower === 'confession') return 'SPILL';
        if (lower === 'chill') return 'DISCUSSION';
        return badge.toUpperCase();
    };

    const getBadgeColor = (badge?: string) => {
        switch (badge?.toLowerCase()) {
            case 'rant':
            case 'vent': return '#FF4444';
            case 'confession':
            case 'spill': return '#D070FB'; // Lavender/Purple
            case 'stories': return '#FF8C00'; // Orange
            case 'opinions': return '#1E90FF'; // Blue
            case 'chill':
            case 'discussion': return '#00C851'; // Green
            default: return Colors.dark.primary;
        }
    };

    const accentColor = getBadgeColor(post.badge);

    return (
        <View style={styles.cardContainer}>
            {/* Main Content (Clickable) */}
            <TouchableOpacity
                style={styles.contentContainer}
                onPress={onReply}
                activeOpacity={0.8}
            >
                {/* Top Row: Badge & Utils */}
                <View style={styles.topRow}>
                    {post.badge ? (
                        <View style={[styles.badgePill, { backgroundColor: accentColor + '20', borderColor: accentColor }]}>
                            <Text style={[styles.badgeText, { color: accentColor }]}>{getDisplayBadge(post.badge)}</Text>
                        </View>
                    ) : <View />}

                    {/* Spacer to push everything else to the right */}
                    <View style={{ flex: 1 }} />

                    {/* Fire Icon Logic - Far Right */}
                    {isPostFire({
                        upvotes: post.upvotes,
                        downvotes: post.downvotes,
                        replies_count: post.reply_count,
                        created_at: post.created_at
                    }) && (
                            <MaterialCommunityIcons
                                name="fire"
                                size={20}
                                color="#FF0000"
                                style={{ marginRight: 8 }} // Spacing from menu 
                            />
                        )}

                    {/* 3-Dots Menu */}
                    <TouchableOpacity onPress={onReport} style={styles.menuBtn}>
                        <MaterialCommunityIcons name="dots-horizontal" size={20} color="#666" />
                    </TouchableOpacity>
                </View>

                {/* Post Text */}
                <Text style={styles.postContent}>{post.content}</Text>

                {/* Footer: Signature & Time */}
                <View style={styles.footerRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        {/* Profile-pic style Ghost Icon */}
                        <View style={[styles.ghostAvatar, { borderColor: accentColor }]}>
                            <MaterialCommunityIcons name="ghost" size={18} color="#FFF" />
                        </View>
                        {/* Username style name */}
                        <Text style={[styles.authorName, { color: accentColor }]}>
                            @{post.anon_name?.toLowerCase().replace(/\s+/g, '_') || 'anonymous'}
                        </Text>
                    </View>
                    <Text style={styles.timestamp}>
                        {formatShortTime(post.created_at)}
                    </Text>
                </View>
            </TouchableOpacity>

            {/* Right Action Column */}
            <View style={styles.actionColumn}>
                <TouchableOpacity onPress={onUpvote} style={styles.actionBtn}>
                    <MaterialCommunityIcons
                        name={post.vote_type === 1 ? "arrow-up-bold" : "arrow-up-bold-outline"}
                        size={28}
                        color={post.vote_type === 1 ? '#00C851' : "#888"} // Fixed Green for Upvote
                    />
                </TouchableOpacity>

                {/* Net Score in Middle */}
                <Text style={styles.voteCount}>{score}</Text>

                <TouchableOpacity onPress={onDownvote} style={styles.actionBtn}>
                    <MaterialCommunityIcons
                        name={post.vote_type === -1 ? "arrow-down-bold" : "arrow-down-bold-outline"}
                        size={28}
                        color={post.vote_type === -1 ? '#FF4444' : "#888"} // Fixed Red for Downvote
                    />
                </TouchableOpacity>

                {/* Total Votes Below */}
                <Text style={styles.totalVotesText}>{post.upvotes + post.downvotes} votes</Text>

                {/* Reply */}
                <TouchableOpacity onPress={onReply} style={[styles.actionBtn, { marginTop: 12 }]}>
                    <MaterialCommunityIcons name="comment-outline" size={28} color="#888" />
                    <Text style={{ color: '#888', fontSize: 10, marginTop: 2 }}>
                        {replyCount}
                    </Text>
                </TouchableOpacity>

                {/* Share (from feed) */}
                <TouchableOpacity style={[styles.actionBtn, { marginTop: 8 }]} onPress={onShare}>
                    <MaterialCommunityIcons name="send-outline" size={22} color="#888" />
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    cardContainer: {
        flexDirection: 'row',
        backgroundColor: '#000', // Deep black card
        marginHorizontal: 16,
        marginBottom: 12, // Reduced margin
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#1A4A52', // Dark subtle cyan border
        minHeight: 100, // Reduced minHeight
    },
    contentContainer: {
        flex: 1,
        padding: 12, // Reduced padding
        justifyContent: 'space-between',
    },
    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    badgePill: {
        paddingHorizontal: 8, // Reduced padding
        paddingVertical: 2,
        borderRadius: 6,
        borderWidth: 1,
    },
    menuBtn: {
        padding: 4,
        marginRight: -4, // Align with edge
    },
    badgeText: {
        fontSize: 9, // Smaller font
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    postContent: {
        color: '#FFF',
        fontSize: 15, // Slightly smaller font
        lineHeight: 20,
        fontWeight: '500',
        marginBottom: 10, // Reduced margin
    },
    footerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 'auto',
        borderTopWidth: 1,
        borderTopColor: '#1A1A1A',
        paddingTop: 10, // Slightly increased padding for the circle
    },
    ghostAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#1A1A1A',
        borderWidth: 2, // Matches the theme accent color dynamically
        justifyContent: 'center',
        alignItems: 'center',
    },
    authorName: {
        fontWeight: 'bold',
        fontSize: 13,
        letterSpacing: 0.5,
    },
    timestamp: {
        color: '#444',
        fontSize: 11, // Smaller font
    },
    actionColumn: {
        width: 44, // Slightly narrower
        alignItems: 'center',
        paddingVertical: 12, // Reduced padding
        paddingRight: 4,
        borderLeftWidth: 1,
        borderLeftColor: '#111',
    },
    actionBtn: {
        padding: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    voteCount: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 13,
        marginVertical: 2, // Reduced margin
    },
    totalVotesText: {
        color: '#666',
        fontSize: 9, // Smaller font
        marginTop: 2,
        textAlign: 'center'
    }
});
