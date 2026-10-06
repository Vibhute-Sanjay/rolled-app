
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenWrapper } from '../components/ScreenWrapper';
import { Colors } from '../constants/Colors';
import { FontAwesome5 } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { FlashList } from '@shopify/flash-list';
import { UserBadges } from '../components/UserBadges';

interface UserItemProps {
    id: string;
    username: string;
    full_name: string;
    avatar_url: string;
    is_following: boolean; // Does current user follow this person?
    is_verified?: boolean;
    is_admin?: boolean;
    is_og?: boolean;
}

export default function UserListScreen() {
    const { userId, type } = useLocalSearchParams(); // type: 'followers' | 'following'
    const router = useRouter();
    const { user: currentUser } = useAuth();

    const [users, setUsers] = useState<UserItemProps[]>([]);
    const [loading, setLoading] = useState(true);
    const [title, setTitle] = useState(type === 'followers' ? 'Followers' : 'Following');

    useEffect(() => {
        if (userId && type) {
            fetchUsers();
        }
    }, [userId, type]);

    const fetchUsers = async () => {
        try {
            let data: any[] = [];

            if (type === 'followers') {
                // Get people who follow userId
                // Join with profiles table to get details of the follower
                const { data: followers, error } = await supabase
                    .from('follows')
                    .select(`
                        follower_id,
                        follower:profiles!follows_follower_id_fkey(id, username, full_name, avatar_url, is_verified, is_admin, is_og)
                    `)
                    .eq('following_id', userId);

                if (error) throw error;
                data = followers.map((f: any) => f.follower);
            } else {
                // Get people who userId follows
                // Join with profiles table to get details of the followed person
                const { data: following, error } = await supabase
                    .from('follows')
                    .select(`
                        following_id,
                        following:profiles!follows_following_id_fkey(id, username, full_name, avatar_url, is_verified, is_admin)
                    `)
                    .eq('follower_id', userId);

                if (error) throw error;
                data = following.map((f: any) => f.following);
            }

            // Enrich with "is_following" status relative to CURRENT USER
            const enrichedUsers = await checkFollowStatus(data);
            setUsers(enrichedUsers);

        } catch (error) {
            console.error("Error fetching users:", error);
        } finally {
            setLoading(false);
        }
    };

    const checkFollowStatus = async (profiles: any[]) => {
        if (!currentUser || profiles.length === 0) return profiles.map(p => ({ ...p, is_following: false }));

        const profileIds = profiles.map(p => p.id);
        const { data } = await supabase
            .from('follows')
            .select('following_id')
            .eq('follower_id', currentUser.id)
            .in('following_id', profileIds);

        const myFollows = new Set(data?.map(d => d.following_id));

        return profiles.map(p => ({
            ...p,
            is_following: myFollows.has(p.id)
        }));
    };

    const handleFollowToggle = async (targetUser: UserItemProps) => {
        if (!currentUser) return;

        // Optimistic update
        setUsers(prev => prev.map(u => u.id === targetUser.id ? { ...u, is_following: !u.is_following } : u));

        try {
            if (targetUser.is_following) {
                // Unfollow
                const { error } = await supabase
                    .from('follows')
                    .delete()
                    .eq('follower_id', currentUser.id)
                    .eq('following_id', targetUser.id);
                if (error) throw error;
            } else {
                // Follow
                const { error } = await supabase
                    .from('follows')
                    .insert({ follower_id: currentUser.id, following_id: targetUser.id });
                if (error) throw error;
            }
        } catch (error) {
            console.error("Follow toggle error:", error);
            // Revert
            setUsers(prev => prev.map(u => u.id === targetUser.id ? { ...u, is_following: targetUser.is_following } : u));
        }
    };

    const renderItem = ({ item }: { item: UserItemProps }) => (
        <TouchableOpacity style={styles.userCard} onPress={() => router.push(`/user/${item.id}`)}>
            <Image source={{ uri: item.avatar_url || 'https://via.placeholder.com/50' }} style={styles.avatar} />
            <View style={styles.userInfo}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={styles.username}>{item.username}</Text>
                    <UserBadges user={item} size={14} />
                </View>
                <Text style={styles.fullName}>{item.full_name}</Text>
            </View>

            {currentUser?.id !== item.id && (
                <TouchableOpacity
                    style={[styles.followButton, item.is_following && styles.followingButton]}
                    onPress={() => handleFollowToggle(item)}
                >
                    <Text style={[styles.followButtonText, item.is_following && styles.followingButtonText]}>
                        {item.is_following ? "Following" : "Follow"}
                    </Text>
                </TouchableOpacity>
            )}
        </TouchableOpacity>
    );

    return (
        <ScreenWrapper style={{ paddingHorizontal: 0 }}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <FontAwesome5 name="arrow-left" size={20} color={Colors.dark.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{title}</Text>
            </View>

            {loading ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator color={Colors.dark.primary} />
                </View>
            ) : (
                <FlashList
                    data={users}
                    renderItem={renderItem}
                    // @ts-ignore
                    estimatedItemSize={70}
                    contentContainerStyle={{ paddingBottom: 20 }}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>No users found.</Text>
                        </View>
                    }
                />
            )}
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 15,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#222',
        marginBottom: 10
    },
    backButton: { marginRight: 20 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.dark.text, textTransform: 'capitalize' },

    userCard: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#222',
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#333',
    },
    userInfo: {
        flex: 1,
        marginLeft: 15,
    },
    username: {
        color: Colors.dark.text,
        fontWeight: 'bold',
        fontSize: 16,
    },
    fullName: {
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
    emptyContainer: {
        alignItems: 'center',
        marginTop: 50,
    },
    emptyText: {
        color: Colors.dark.textSecondary,
    }
});
