import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, FlatList, TouchableOpacity, Image, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Colors } from '../constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { UserBadges } from './UserBadges';

export interface ShareContent {
    type: 'post' | 'unrolled' | 'activity';
    id: string;
    preview?: {
        image?: string;
        title?: string;
        subtitle?: string;
    };
    data?: any; // Original object
}

interface ShareModalProps {
    visible: boolean;
    onClose: () => void;
    content: ShareContent | null;
}

interface UserProfile {
    id: string;
    username: string;
    full_name: string;
    avatar_url: string | null;
    is_verified?: boolean;
    is_admin?: boolean;
    is_og?: boolean;
}

export const ShareModal = ({ visible, onClose, content }: ShareModalProps) => {
    const { user: currentUser } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(false);
    const [sendingId, setSendingId] = useState<string | null>(null);
    const [sentTo, setSentTo] = useState<Set<string>>(new Set()); // Track who received share

    // Fetch users (mock "followers" or search results)
    useEffect(() => {
        if (visible) {
            fetchUsers();
        } else {
            // Reset state when modal closes
            setSearchQuery('');
            setUsers([]);
            setSentTo(new Set()); // Clear sent state
        }
    }, [visible, searchQuery]);

    const fetchUsers = async () => {
        if (!currentUser) return;
        setLoading(true);
        try {
            // 1. Fetch Follows (People I follow or who follow me)
            const { data: followsData } = await supabase
                .from('follows')
                .select('follower_id, following_id')
                .or(`follower_id.eq.${currentUser.id},following_id.eq.${currentUser.id}`);

            const priorityUserIds = new Set<string>();
            if (followsData) {
                followsData.forEach(f => {
                    if (f.follower_id !== currentUser.id) priorityUserIds.add(f.follower_id);
                    if (f.following_id !== currentUser.id) priorityUserIds.add(f.following_id);
                });
            }

            let fetchedUsers: UserProfile[] = [];

            if (searchQuery) {
                // Search Mode
                const { data, error } = await supabase
                    .from('profiles')
                    .select('id, username, full_name, avatar_url, is_verified, is_admin, is_og')
                    .neq('id', currentUser.id)
                    .ilike('username', `%${searchQuery}%`)
                    .limit(30);
                if (error) throw error;
                fetchedUsers = data || [];
            } else {
                // Default Mode: Priority users first
                const priorityArray = Array.from(priorityUserIds).slice(0, 30);

                if (priorityArray.length > 0) {
                    const { data, error } = await supabase
                        .from('profiles')
                        .select('id, username, full_name, avatar_url, is_verified, is_admin, is_og')
                        .in('id', priorityArray);
                    if (data) fetchedUsers = data;
                }

                // If we don't have enough priority users, fetch some random people
                if (fetchedUsers.length < 20) {
                    const { data, error } = await supabase
                        .from('profiles')
                        .select('id, username, full_name, avatar_url, is_verified, is_admin, is_og')
                        .neq('id', currentUser.id)
                        .limit(20 - fetchedUsers.length);

                    if (data) {
                        const existingIds = new Set(fetchedUsers.map(u => u.id));
                        data.forEach(u => {
                            if (!existingIds.has(u.id)) fetchedUsers.push(u);
                        });
                    }
                }
            }

            // Finally, sort so priority users are at the top
            fetchedUsers.sort((a, b) => {
                const aIsPriority = priorityUserIds.has(a.id);
                const bIsPriority = priorityUserIds.has(b.id);
                if (aIsPriority && !bIsPriority) return -1;
                if (!aIsPriority && bIsPriority) return 1;
                return a.username.localeCompare(b.username);
            });

            setUsers(fetchedUsers);
        } catch (error) {
            console.error('Error fetching users for share:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSend = async (targetUserId: string) => {
        if (!currentUser || !content) return;
        setSendingId(targetUserId);

        try {
            // 1. Get or Create Room
            const { data: roomId, error: roomError } = await supabase.rpc('get_or_create_dm_room', {
                other_user_id: targetUserId
            });

            if (roomError) throw roomError;
            if (!roomId) throw new Error("Failed to create room");

            // 2. Prepare Message Payload
            const payload: any = {
                room_id: roomId,
                user_id: currentUser.id, // Correct column name for sender
                content: content.preview?.title || (content.type === 'post' ? 'Shared a roll' : 'Shared content'),
            };

            // Add specific ID based on type
            if (content.type === 'post') {
                payload.post_id = content.id;
            } else if (content.type === 'unrolled') {
                payload.anon_post_id = content.id;
            } else if (content.type === 'activity') {
                payload.activity_id = content.id;
            }

            const { error: msgError } = await supabase.from('messages').insert(payload);
            if (msgError) throw msgError;

            // Update room timestamp
            await supabase.from('chat_rooms').update({ last_message_at: new Date() }).eq('id', roomId);

            // Mark as sent (don't close modal, let user share to multiple)
            setSentTo(prev => new Set(prev).add(targetUserId));
            setSendingId(null);

        } catch (error) {
            console.error('Send error:', error);
        } finally {
            setSendingId(null);
        }
    };

    const renderItem = ({ item }: { item: UserProfile }) => {
        const isSending = sendingId === item.id;
        const alreadySent = sentTo.has(item.id);

        return (
            <View style={styles.userItem}>
                <Image
                    source={{ uri: item.avatar_url || 'https://via.placeholder.com/40' }}
                    style={styles.avatar}
                />
                <View style={styles.userInfo}>
                    <Text style={styles.username}>{item.username}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={styles.fullname}>{item.full_name}</Text>
                        <UserBadges user={item} size={12} />
                    </View>
                </View>
                {alreadySent ? (
                    <View style={styles.sentContainer}>
                        <Ionicons name="checkmark-circle" size={18} color="#00C851" />
                        <Text style={styles.sentText}>Sent</Text>
                    </View>
                ) : (
                    <TouchableOpacity
                        style={[styles.sendButton, isSending && styles.sendingButton]}
                        onPress={() => handleSend(item.id)}
                        disabled={isSending}
                    >
                        {isSending ? (
                            <ActivityIndicator size="small" color="white" />
                        ) : (
                            <Text style={styles.sendButtonText}>Send</Text>
                        )}
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.modalOverlay}
            >
                <View style={styles.modalContent}>
                    {/* Handle bar */}
                    <View style={styles.handleBar} />

                    <View style={styles.header}>
                        <Text style={styles.title}>Share to</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color={Colors.dark.text} />
                        </TouchableOpacity>
                    </View>

                    {/* Search Input */}
                    <View style={styles.searchContainer}>
                        <Ionicons name="search" size={20} color={Colors.dark.textSecondary} style={styles.searchIcon} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search"
                            placeholderTextColor={Colors.dark.textSecondary}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            autoCorrect={false}
                        />
                    </View>

                    {/* Content Preview (Mini) */}
                    {content && content.preview && (
                        <View style={styles.postPreview}>
                            {content.preview.image ? (
                                <Image source={{ uri: content.preview.image }} style={styles.previewImage} />
                            ) : (
                                <View style={[styles.previewImage, { backgroundColor: '#333' }]} />
                            )}
                            <View style={{ flex: 1 }}>
                                <Text style={styles.previewTitle} numberOfLines={1}>
                                    {content.preview.title}
                                </Text>
                                <Text style={styles.previewSubtitle} numberOfLines={1}>
                                    {content.preview.subtitle}
                                </Text>
                            </View>
                        </View>
                    )}

                    {/* User List */}
                    {loading && users.length === 0 ? (
                        <ActivityIndicator size="large" color={Colors.dark.primary} style={{ marginTop: 20 }} />
                    ) : (
                        <FlatList
                            data={users}
                            renderItem={renderItem}
                            keyExtractor={item => item.id}
                            contentContainerStyle={styles.listContent}
                            ListEmptyComponent={
                                <Text style={styles.emptyText}>No users found</Text>
                            }
                        />
                    )}
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalContent: {
        backgroundColor: Colors.dark.background,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        height: '80%', // Occupy bottom 80%
        paddingTop: 10,
    },
    handleBar: {
        width: 40,
        height: 4,
        backgroundColor: '#444',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 10,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 15,
        marginBottom: 15,
        position: 'relative',
    },
    title: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
    closeButton: {
        position: 'absolute',
        right: 15,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1A1A1A',
        marginHorizontal: 15,
        borderRadius: 10,
        paddingHorizontal: 10,
        height: 40,
        marginBottom: 15,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        color: 'white',
        fontSize: 16,
    },
    postPreview: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#222',
        marginHorizontal: 15,
        padding: 8,
        borderRadius: 8,
        marginBottom: 15,
    },
    previewImage: {
        width: 36,
        height: 36,
        borderRadius: 4,
        marginRight: 10,
    },
    previewTitle: {
        color: 'white',
        fontSize: 14,
        fontWeight: '500',
    },
    previewSubtitle: {
        color: Colors.dark.textSecondary,
        fontSize: 12,
    },
    listContent: {
        paddingHorizontal: 15,
        paddingBottom: 40,
    },
    userItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#333',
    },
    userInfo: {
        flex: 1,
        marginLeft: 12,
    },
    username: {
        color: 'white',
        fontWeight: '600',
        fontSize: 14,
    },
    fullname: {
        color: Colors.dark.textSecondary,
        fontSize: 12,
    },
    sendButton: {
        backgroundColor: Colors.dark.primary,
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 6,
    },
    sendingButton: {
        backgroundColor: '#444',
    },
    sendButtonText: {
        color: 'black',
        fontWeight: 'bold',
        fontSize: 12,
    },
    emptyText: {
        color: Colors.dark.textSecondary,
        textAlign: 'center',
        marginTop: 20,
    },
    sentContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    sentText: {
        color: '#00C851',
        fontWeight: '600',
        fontSize: 12,
    },
});
