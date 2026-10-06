import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { ScreenWrapper } from '../components/ScreenWrapper';
import { Colors } from '../constants/Colors';
import { FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useUnrolledStore } from '../stores/unrolledStore';

export default function UnrolledBlockedUsersScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user) fetchBlockedIdentities();
    }, [user]);

    const fetchBlockedIdentities = async () => {
        try {
            if (!user?.id) return;

            const { data, error } = await supabase
                .from('unrolled_blocks')
                .select(`
                    id,
                    blocked_identity_id,
                    identity:anon_identities!blocked_identity_id(anon_name, avatar_color)
                `)
                .eq('blocker_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setBlockedUsers(data || []);
        } catch (error: any) {
            console.error("Error fetching unrolled blocked users:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleUnblock = async (blockId: string, blockedIdentityId: string, anonName: string) => {
        Alert.alert("Unblock Anonymous User", `Are you sure you want to unblock ~ ${anonName}? Their posts will reappear in your Unrolled feed.`, [
            { text: "Cancel", style: "cancel" },
            {
                text: "Unblock",
                onPress: async () => {
                    try {
                        await useUnrolledStore.getState().unblockIdentity(blockedIdentityId);
                        setBlockedUsers(prev => prev.filter(item => item.id !== blockId));
                    } catch (err) {
                        console.error("Failed to unblock anon user:", err);
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
                <Text style={styles.headerTitle}>Unrolled Blocks</Text>
            </View>

            <FlatList
                data={blockedUsers}
                keyExtractor={item => item.id}
                contentContainerStyle={{ padding: 0 }}
                ListEmptyComponent={
                    <Text style={styles.emptyText}>You haven't blocked any anonymous users yet.</Text>
                }
                renderItem={({ item }) => {
                    const anonName = item.identity?.anon_name || 'Anonymous';
                    const avatarColor = item.identity?.avatar_color || '#333';
                    
                    return (
                        <View style={styles.userItem}>
                            <View style={styles.userInfo}>
                                <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
                                    <MaterialCommunityIcons name="ghost" size={24} color="white" />
                                </View>
                                <View>
                                    <Text style={styles.name}>~ {anonName}</Text>
                                    <Text style={styles.handle}>Anonymous User</Text>
                                </View>
                            </View>
                            <TouchableOpacity
                                style={styles.unblockButton}
                                onPress={() => handleUnblock(item.id, item.blocked_identity_id, anonName)}
                            >
                                <Text style={styles.unblockText}>Unblock</Text>
                            </TouchableOpacity>
                        </View>
                    );
                }}
            />
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: Colors.dark.border
    },
    backButton: {
        padding: 10,
        marginLeft: -10,
        marginRight: 10
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: Colors.dark.text
    },
    emptyText: {
        color: '#666',
        textAlign: 'center',
        marginTop: 50,
        fontSize: 16
    },
    userItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: Colors.dark.border
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginRight: 15,
        justifyContent: 'center',
        alignItems: 'center'
    },
    name: {
        color: Colors.dark.text,
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 2
    },
    handle: {
        color: '#666',
        fontSize: 14
    },
    unblockButton: {
        paddingHorizontal: 15,
        paddingVertical: 8,
        backgroundColor: '#333',
        borderRadius: 20
    },
    unblockText: {
        color: 'white',
        fontWeight: '600'
    }
});
