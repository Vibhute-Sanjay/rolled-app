import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const SLIDE_WIDTH = width * 0.75; // Cards take 75% of screen width

interface TrendingPost {
    id: string;
    content: string;
    chaos_score: number;
    badge: string;
    anon_name: string;
    avatar_color: string;
    created_at: string;
    reply_count: number;
    upvotes: number;
    downvotes: number;
}

export const TrendingCarousel = () => {
    const router = useRouter();
    const [posts, setPosts] = useState<TrendingPost[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchTrending();
    }, []);

    const fetchTrending = async () => {
        try {
            // Updated SQL function logic
            const { data, error } = await supabase.rpc('get_trending_unrolled', { limit_count: 5 });
            if (error) throw error;
            setPosts(data || []);
        } catch (err) {
            console.error('Error fetching trending:', err);
        } finally {
            setLoading(false);
        }
    };

    const getBadgeColor = (badge: string) => {
        const lower = (badge || '').toLowerCase();
        if (lower.includes('rant')) return '#FF0055'; // Red
        if (lower.includes('confession')) return '#8A2BE2'; // Purple
        if (lower.includes('chaos')) return '#FFD700'; // Gold
        if (lower.includes('chill')) return '#00FF9D'; // Green
        return Colors.dark.primary; // Default Cyan
    };

    const renderItem = ({ item }: { item: TrendingPost }) => {
        const badgeColor = getBadgeColor(item.badge);

        return (
            <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => router.push(`/unrolled/${item.id}`)}
                style={styles.cardContainer}
            >
                <LinearGradient
                    colors={[Colors.dark.card, Colors.dark.background]}
                    style={styles.card}
                >
                    {/* Header: Fire Icon + Badge */}
                    <View style={styles.header}>
                        <View style={[styles.badgeContainer, { backgroundColor: `${badgeColor}20` }]}>
                            <MaterialCommunityIcons name="fire" size={16} color={badgeColor} />
                            <Text style={[styles.badgeText, { color: badgeColor }]}>{item.badge || 'Trending'}</Text>
                        </View>
                        <Text style={styles.scoreText}>Score: {item.chaos_score}</Text>
                    </View>

                    {/* Content */}
                    <Text style={styles.content} numberOfLines={3}>{item.content}</Text>

                    {/* Footer: User + Stats */}
                    <View style={styles.footer}>
                        <View style={styles.userRow}>
                            <View style={[styles.avatar, { backgroundColor: item.avatar_color || '#333' }]} />
                            <Text style={styles.username}>{item.anon_name}</Text>
                        </View>
                        <View style={styles.statsRow}>
                            <Text style={styles.stat}>💬 {item.reply_count}</Text>
                            <Text style={styles.stat}>🔥 {item.upvotes + item.downvotes}</Text>
                        </View>
                    </View>
                </LinearGradient>
            </TouchableOpacity>
        );
    };

    if (loading) return null; // Or skeleton
    if (posts.length === 0) return null;

    return (
        <View style={styles.container}>
            <View style={styles.titleRow}>
                <MaterialCommunityIcons name="fire" size={24} color="#FF0000" style={{ marginRight: 8 }} />
                <View>
                    <Text style={styles.sectionTitle}>Trending Unroll's</Text>
                    <Text style={styles.subtitle}>Last 48h</Text>
                </View>
            </View>

            <FlatList
                data={posts}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
                snapToInterval={SLIDE_WIDTH + 15} // Width + Margin
                decelerationRate="fast"
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginTop: 20,
        marginBottom: 10,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        paddingHorizontal: 16,
        marginBottom: 10,
    },
    sectionTitle: {
        color: Colors.dark.text,
        fontSize: 18,
        fontWeight: 'bold',
        marginRight: 8,
    },
    subtitle: {
        color: Colors.dark.textSecondary,
        fontSize: 12,
    },
    listContent: {
        paddingHorizontal: 16,
        paddingBottom: 10,
    },
    cardContainer: {
        width: SLIDE_WIDTH,
        marginRight: 15,
        shadowColor: Colors.dark.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2, // Neon glow effect
        shadowRadius: 8,
    },
    card: {
        borderRadius: 16,
        padding: 16,
        height: 160, // Fixed height for uniformity
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'space-between',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    badgeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 240, 255, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    badgeText: {
        color: Colors.dark.primary,
        fontSize: 10,
        fontWeight: 'bold',
        marginLeft: 4,
        textTransform: 'uppercase',
    },
    scoreText: {
        color: Colors.dark.textSecondary,
        fontSize: 12,
        fontFamily: 'monospace', // Tech vibe
    },
    content: {
        color: Colors.dark.text,
        fontSize: 16,
        fontWeight: '500',
        lineHeight: 22,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    userRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        width: 20,
        height: 20,
        borderRadius: 10,
        marginRight: 6,
    },
    username: {
        color: Colors.dark.textSecondary,
        fontSize: 12,
        fontWeight: '600',
    },
    statsRow: {
        flexDirection: 'row',
        gap: 10,
    },
    stat: {
        color: Colors.dark.textSecondary,
        fontSize: 12,
    }
});
