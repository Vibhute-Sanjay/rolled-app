import React, { useState, useEffect } from 'react';
import { useRouter, useNavigation } from 'expo-router';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, Image, ActivityIndicator, Keyboard, BackHandler } from 'react-native';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { Colors } from '../../constants/Colors';
import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { TrendingCarousel } from '../../components/Search/TrendingCarousel';
import { WeeklyLeaderboard } from '../../components/Search/WeeklyLeaderboard';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { UserBadges } from '../../components/UserBadges';
import { useChatStore } from '../../stores/chatStore';
import { useUserStore } from '../../stores/userStore';

export default function SearchScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [activeTab, setActiveTab] = useState<'users' | 'lostfound' | 'queries'>('users');

    const navigation = useNavigation();

    // Search Results State
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [loadingResults, setLoadingResults] = useState(false);

    // [NEW] Use Global Store
    const followingIds = useUserStore(s => s.followingIds);
    const toggleFollowing = useUserStore(s => s.toggleFollowing);
    const setFollowingList = useUserStore(s => s.setFollowingList);

    useEffect(() => {
        if (user) fetchFollowing();
    }, [user]);

    // ...

    const fetchFollowing = async () => {
        // Only fetch if empty to save reads? Or always fetch to sync?
        // Let's always fetch on mount/auth change to be safe.
        const { data } = await supabase.from('follows').select('following_id').eq('follower_id', user?.id);
        if (data) {
            setFollowingList(data.map(f => f.following_id));
        }
    };

    const toggleFollow = async (targetUserId: string) => {
        if (!user) return;

        // Optimistic Update Global Store
        const wasFollowing = followingIds.includes(targetUserId);
        toggleFollowing(targetUserId);

        try {
            if (wasFollowing) {
                await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', targetUserId);
            } else {
                await supabase.from('follows').insert({ follower_id: user.id, following_id: targetUserId });
            }
        } catch (error) {
            console.error('Follow error:', error);
            // Revert on error
            toggleFollowing(targetUserId);
        }
    };

    const reactiveBlockedIds = useChatStore(s => s.blockedUserIds);

    // Debounce Search Logic
    useEffect(() => {
        const timer = setTimeout(() => {
            if (isSearching) {
                performSearch();
            }
        }, 500); // 500ms debounce
        return () => clearTimeout(timer);
    }, [searchQuery, activeTab, isSearching, reactiveBlockedIds]);

    const performSearch = async () => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            return;
        }

        setLoadingResults(true);
        try {
            if (activeTab === 'users') {
                const blockedIds = reactiveBlockedIds;

                let query = supabase
                    .from('profiles')
                    .select('id, username, full_name, avatar_url, is_verified, is_admin, is_og')
                    .or(`username.ilike.%${searchQuery}%,full_name.ilike.%${searchQuery}%`)
                    .neq('id', user?.id);

                if (blockedIds.length > 0) {
                    query = query.not('id', 'in', `(${blockedIds})`);
                }

                const { data, error } = await query.limit(20);

                if (error) throw error;
                setSearchResults(data || []);
            }
            // Implement 'lostfound' and 'queries' search later
        } catch (error) {
            console.error("Search Error:", error);
        } finally {
            setLoadingResults(false);
        }
    };

    const handleSearchMove = () => {
        setIsSearching(true);
    };

    const handleCancelSearch = () => {
        Keyboard.dismiss();
        setIsSearching(false);
        setSearchQuery('');
        setSearchResults([]);
    };

    const DUMMY_TRENDING = [
        {
            id: '1',
            content: "Just realized that 2024 is almost over and I've achieved nothing but a high score in Tetris. 🕹️",
            author: "Anonymous_Specter",
            time: "2h ago",
            votes: "4.2k",
            tags: ["GAMING", "LIFE"],
            accent: Colors.dark.primary
        },
        {
            id: '2',
            content: "Why does coffee smell like heaven but taste like anxiety? ☕💀",
            author: "Neon_Drifter",
            time: "4h ago",
            votes: "12.5k",
            tags: ["COFFEE", "MOOD"],
            accent: "#A020F0"
        },
        {
            id: '3',
            content: "The best code is the one you didn't write. Less bugs, more sleep.",
            author: "Null_Pointer",
            time: "6h ago",
            votes: "8.1k",
            tags: ["DEV", "WISDOM"],
            accent: "#00FF00"
        },
    ];

    return (
        <ScreenWrapper style={{ paddingHorizontal: 0 }}>
            {/* Sticky Header Container */}
            <View style={{ paddingBottom: 10 }}>
                {/* Large Title (Only visible when NOT searching) */}
                {!isSearching && (
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>Search<Text style={{ color: Colors.dark.primary }}>.</Text></Text>
                    </View>
                )}

                {/* Search Bar */}
                <View style={styles.rowContainer}>
                    <View style={styles.searchContainer}>
                        <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search users"
                            placeholderTextColor="#666"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            onFocus={handleSearchMove}
                        />
                    </View>
                    {isSearching && (
                        <TouchableOpacity onPress={handleCancelSearch} style={{ marginLeft: 10, marginRight: 20 }}>
                            <Text style={{ color: Colors.dark.textSecondary }}>Cancel</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Tabs (Only when searching) */}
                {isSearching && (
                    <View style={styles.tabsContainer}>
                        {['Users'].map((tab) => {
                            const tabKey = tab === 'Users' ? 'users' : tab === 'Lost & Found' ? 'lostfound' : 'queries';
                            const isActive = activeTab === tabKey;
                            return (
                                <TouchableOpacity
                                    key={tab}
                                    onPress={() => setActiveTab(tabKey as any)}
                                    style={[styles.tabItem, isActive && styles.activeTabItem]}
                                >
                                    <Text style={[styles.tabText, isActive && styles.activeTabText]}>{tab}</Text>
                                    {isActive && <View style={styles.activeIndicator} />}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>

                {/* CASE 1: LANDING STATE (Trending) */}
                {/* CASE 1: LANDING STATE (Trending) */}
                {!isSearching && (
                    <>
                        <TrendingCarousel />
                        <View style={{ height: 10 }} />
                        <WeeklyLeaderboard />
                    </>
                )}

                {/* CASE 2: SEARCH RESULTS */}
                {isSearching && (
                    <View style={{ paddingTop: 10 }}>
                        {activeTab === 'users' && (
                            <>


                                {loadingResults ? (
                                    <ActivityIndicator size="large" color={Colors.dark.primary} style={{ marginTop: 20 }} />
                                ) : (
                                    <View style={{ marginTop: 10 }}>
                                        {searchResults.map(profile => {
                                            const isFollowing = followingIds.includes(profile.id);
                                            return (
                                                <TouchableOpacity
                                                    key={profile.id}
                                                    style={styles.userRow}
                                                    onPress={() => router.push(`/user/${profile.id}`)}
                                                >
                                                    <Image
                                                        source={{ uri: profile.avatar_url || 'https://via.placeholder.com/50' }}
                                                        style={styles.avatar}
                                                    />
                                                    <View style={{ flex: 1, marginLeft: 15 }}>
                                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                            <Text style={styles.userName}>{profile.full_name || 'User'}</Text>
                                                            <UserBadges user={profile} size={14} />
                                                        </View>
                                                        <Text style={styles.userDesc}>@{profile.username}</Text>
                                                    </View>
                                                    <TouchableOpacity
                                                        style={[styles.followButton, isFollowing && styles.followingButton]}
                                                        onPress={() => toggleFollow(profile.id)}
                                                    >
                                                        <Text style={[styles.followButtonText, isFollowing && styles.followingButtonText]}>
                                                            {isFollowing ? 'Following' : 'Follow'}
                                                        </Text>
                                                    </TouchableOpacity>
                                                </TouchableOpacity>
                                            );
                                        })}
                                        {searchResults.length === 0 && searchQuery.length > 0 && (
                                            <Text style={styles.noResults}>No users found.</Text>
                                        )}
                                    </View>
                                )}
                            </>
                        )}

                        {activeTab !== 'users' && (
                            <View style={{ alignItems: 'center', marginTop: 50 }}>
                                <FontAwesome5 name="tools" size={40} color="#333" />
                                <Text style={{ color: '#666', marginTop: 10 }}>Coming Soon</Text>
                            </View>
                        )}
                    </View>
                )}

            </ScrollView>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    header: {
        paddingHorizontal: 20,
        paddingTop: 5,
        marginBottom: 15,
    },
    headerTitle: {
        fontSize: 34,
        fontWeight: '900',
        color: 'white',
        letterSpacing: 1,
    },
    rowContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    searchContainer: {
        flex: 1,
        marginHorizontal: 20,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#111',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#333',
        paddingHorizontal: 15,
        height: 50,
    },
    searchIcon: {
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        color: 'white',
        fontSize: 16,
        height: '100%',
    },
    section: {
        marginBottom: 20,
        marginTop: 10,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 20,
        gap: 8,
    },
    sectionTitle: {
        color: Colors.dark.textSecondary,
        fontSize: 12,
        fontWeight: 'bold',
        letterSpacing: 2,
    },

    // TABS
    tabsContainer: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        marginTop: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#222',
    },
    tabItem: {
        marginRight: 25,
        paddingBottom: 10,
        position: 'relative',
    },
    activeTabItem: {
        // 
    },
    tabText: {
        color: Colors.dark.textSecondary,
        fontSize: 16,
        fontWeight: '600',
    },
    activeTabText: {
        color: 'white',
    },
    activeIndicator: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 3,
        backgroundColor: Colors.dark.primary,
        borderRadius: 2,
    },

    // RESULTS
    chip: {
        backgroundColor: '#111',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#333',
    },
    chipText: {
        color: '#999',
    },
    userRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#222',
        width: '100%',
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#333'
    },
    userName: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
    userDesc: {
        color: Colors.dark.textSecondary,
        fontSize: 14,
    },
    followButton: {
        backgroundColor: Colors.dark.primary,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        minWidth: 90,
        alignItems: 'center',
    },
    followingButton: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: '#444',
    },
    followButtonText: {
        color: '#000',
        fontWeight: 'bold',
        fontSize: 12,
    },
    followingButtonText: {
        color: Colors.dark.text,
    },
    noResults: {
        color: Colors.dark.textSecondary,
        textAlign: 'center',
        marginTop: 20,
    }
});
