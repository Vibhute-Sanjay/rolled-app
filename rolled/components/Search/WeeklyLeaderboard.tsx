import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, FlatList, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { supabase } from '../../lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');
const SLIDE_WIDTH = width - 40; // Full width minus padding

const SECTION_TYPES = [
    { id: '1', title: "🗣️ Most Discussed", func: 'get_weekly_top_normal', cat: 'replied', color: '#FFD700', isAnon: false },
    { id: '2', title: "🌶️ Most Controversial", func: 'get_weekly_top_unrolled', cat: 'controversial', color: '#FF4500', isAnon: true },
    { id: '3', title: "❤️ Campus Favorites", func: 'get_weekly_top_normal', cat: 'liked', color: '#FF69B4', isAnon: false },
    { id: '4', title: "👑 Hall of Fame", func: 'get_weekly_top_unrolled', cat: 'upvoted', color: '#00F0FF', isAnon: true }
];

export const WeeklyLeaderboard = () => {
    return (
        <View style={styles.container}>
            <View style={styles.headerRow}>
                <Text style={styles.mainTitle}>🏆 Top of the Week</Text>
                <Text style={styles.swipeHint}>Swipe for more →</Text>
            </View>

            <FlatList
                data={SECTION_TYPES}
                renderItem={({ item }) => <LeaderboardSlide config={item} />}
                keyExtractor={item => item.id}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                snapToInterval={SLIDE_WIDTH + 10} // Slide + Margin
                decelerationRate="fast"
                contentContainerStyle={{ paddingHorizontal: 20 }}
            />
        </View>
    );
};

const LeaderboardSlide = ({ config }: { config: typeof SECTION_TYPES[0] }) => {
    const router = useRouter();
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetch = async () => {
            try {
                // Fetch only Top 3
                const { data: res, error } = await supabase.rpc(config.func, { sort_category: config.cat, limit_count: 3 });
                if (!error) setData(res || []);
            } finally {
                setLoading(false);
            }
        };
        fetch();
    }, []);

    return (
        <View style={styles.slide}>
            <View style={styles.slideHeader}>
                <Text style={styles.slideTitle}>{config.title}</Text>
                <View style={[styles.dot, { backgroundColor: config.color }]} />
            </View>

            {data.map((item, index) => (
                <TouchableOpacity
                    key={item.id}
                    style={styles.row}
                    onPress={() => {
                        if (config.isAnon) router.push(`/unrolled/${item.id}`);
                        else router.push(`/post/${item.id}`);
                    }}
                >
                    {/* Rank */}
                    <Text style={[styles.rank, index === 0 && { color: config.color, fontSize: 18 }]}>#{index + 1}</Text>

                    {/* Content */}
                    <View style={styles.contentContainer}>
                        <View style={styles.authorRow}>
                            {config.isAnon ? (
                                <View style={[styles.avatar, { backgroundColor: item.avatar_color }]} />
                            ) : (
                                <Image source={{ uri: item.avatar_url || 'https://via.placeholder.com/20' }} style={styles.avatar} />
                            )}
                            <Text style={styles.authorName}>
                                {config.isAnon ? item.anon_name : `@${item.username}`}
                            </Text>
                        </View>

                        <Text style={styles.postText} numberOfLines={2}>{item.content}</Text>

                        <Text style={styles.statsText}>
                            {config.isAnon
                                ? `${config.cat === 'controversial' ? 'Total Activity' : 'Score'}: ${item.score}`
                                : `❤️ ${item.likes_count}  💬 ${item.comments_count}`
                            }
                        </Text>
                    </View>

                    {/* Thumbnail for Normal */}
                    {!config.isAnon && item.media_urls && item.media_urls.length > 0 && (
                        <Image source={{ uri: item.media_urls[0] }} style={styles.thumbnail} />
                    )}
                </TouchableOpacity>
            ))}

            {/* Empty State */}
            {!loading && data.length === 0 && (
                <Text style={styles.emptyText}>No posts yet this week.</Text>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 30,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        paddingHorizontal: 20,
        marginBottom: 10,
    },
    mainTitle: {
        color: 'white',
        fontSize: 20,
        fontWeight: '900',
    },
    swipeHint: {
        color: Colors.dark.textSecondary,
        fontSize: 12,
    },
    slide: {
        width: SLIDE_WIDTH,
        marginRight: 10,
        backgroundColor: '#111',
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: '#222',
        minHeight: 250, // Ensure consistent height
    },
    slideHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    slideTitle: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
        marginRight: 8,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
    },
    rank: {
        color: '#666',
        fontSize: 14,
        fontWeight: 'bold',
        width: 30,
    },
    contentContainer: {
        flex: 1,
        marginRight: 10,
    },
    authorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    avatar: {
        width: 14,
        height: 14,
        borderRadius: 7,
        marginRight: 6,
    },
    authorName: {
        color: '#999',
        fontSize: 11,
        fontWeight: '600',
    },
    postText: {
        color: 'white',
        fontSize: 13,
        lineHeight: 18,
        marginBottom: 2,
    },
    statsText: {
        color: '#666',
        fontSize: 10,
    },
    thumbnail: {
        width: 40,
        height: 40,
        borderRadius: 6,
        backgroundColor: '#333',
    },
    emptyText: {
        color: '#666',
        textAlign: 'center',
        marginTop: 20,
        fontStyle: 'italic',
    }
});
