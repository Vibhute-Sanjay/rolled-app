import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
import { ScreenWrapper } from '../components/ScreenWrapper';
import { Colors } from '../constants/Colors';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useChatStore } from '../stores/chatStore';

export default function BlockedUsersScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user) fetchBlockedUsers();
    }, [user]);

    const fetchBlockedUsers = async () => {
        try {
            if (!user?.id) return;

            // 1. Fetch block records for current user
            const { data: blocksData, error: blocksError } = await supabase
                .from('blocks')
                .select('id, blocked_id')
                .eq('blocker_id', user.id);

            if (blocksError) throw blocksError;

            if (!blocksData || blocksData.length === 0) {
                setBlockedUsers([]);
                return;
            }

            // 2. Batch fetch profiles for all blocked user IDs
            const blockedIds = blocksData.map(b => b.blocked_id).filter(Boolean);
            if (blockedIds.length === 0) {
                setBlockedUsers([]);
                return;
            }

            const { data: profilesData, error: profilesError } = await supabase
                .from('profiles')
                .select('id, username, full_name, avatar_url')
                .in('id', blockedIds);

            if (profilesError) throw profilesError;

            // 3. Map profiles to block rows with fallback for deleted accounts
            const profileMap = new Map((profilesData || []).map(p => [p.id, p]));
            const formatted = blocksData.map(b => {
                const profile = profileMap.get(b.blocked_id);
                return {
                    id: b.id,
                    blocked_id: b.blocked_id,
                    blocked: profile || {
                        id: b.blocked_id,
                        username: 'user',
                        full_name: 'Blocked User',
                        avatar_url: null
                    }
                };
            });

            setBlockedUsers(formatted);
        } catch (error: any) {
            console.error("Error fetching blocked users:", error);
        } finally {
            setLoading(false);
        }
    };

    const unblockUser = useChatStore(s => s.unblockUser);

    const handleUnblock = async (blockId: string, blockedUserId: string | undefined, username: string) => {
        if (!blockedUserId) return;
        Alert.alert("Unblock User", `Are you sure you want to unblock @${username || 'this user'}?`, [
            { text: "Cancel", style: "cancel" },
            {
                text: "Unblock",
                onPress: async () => {
                    try {
                        await unblockUser(blockedUserId);
                        setBlockedUsers(prev => prev.filter(item => item.id !== blockId));
                    } catch (err) {
                        console.error("Failed to unblock user:", err);
                    }
                }
            }
        ]);
    };

    if (loading) {
        return (
            <ScreenWrapper>
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={Colors.dark.primary} />
                </View>
            </ScreenWrapper>
        );
    }

    return (
        <ScreenWrapper style={{ paddingHorizontal: 0 }}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <FontAwesome5 name="arrow-left" size={20} color={Colors.dark.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Blocked Users</Text>
            </View>

            <FlatList
                data={blockedUsers}
                keyExtractor={item => item.id}
                contentContainerStyle={{ padding: 0 }}
                ListEmptyComponent={
                    <Text style={styles.emptyText}>You haven't blocked anyone yet.</Text>
                }
                renderItem={({ item }) => (
                    <View style={styles.userItem}>
                        <View style={styles.userInfo}>
                            <Image
                                source={{ uri: item.blocked?.avatar_url || 'https://via.placeholder.com/50' }}
                                style={styles.avatar}
                            />
                            <View>
                                <Text style={styles.name}>{item.blocked?.full_name || 'User'}</Text>
                                <Text style={styles.handle}>@{item.blocked?.username}</Text>
                            </View>
                        </View>
                        <TouchableOpacity
                            style={styles.unblockButton}
                            onPress={() => handleUnblock(item.id, item.blocked?.id, item.blocked?.username)}
                        >
                            <Text style={styles.unblockText}>Unblock</Text>
                        </TouchableOpacity>
                    </View>
                )}
            />
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 15,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#222',
    },
    backButton: { marginRight: 20 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.dark.text, textAlign: 'left' },
    emptyText: { color: Colors.dark.textSecondary, textAlign: 'center', marginTop: 50 },
    userItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 15,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#1A1A1A'
    },
    userInfo: { flexDirection: 'row', alignItems: 'center' },
    avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
    name: { color: Colors.dark.text, fontWeight: 'bold', fontSize: 14 },
    handle: { color: Colors.dark.textSecondary, fontSize: 12 },
    unblockButton: {
        borderWidth: 1,
        borderColor: Colors.dark.textSecondary,
        paddingHorizontal: 15,
        paddingVertical: 6,
        borderRadius: 20
    },
    unblockText: { color: Colors.dark.text, fontSize: 12, fontWeight: 'bold' }
});
