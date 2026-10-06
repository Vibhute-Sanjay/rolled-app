import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Image, ActivityIndicator } from 'react-native';
import { Colors } from '../constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { UserBadges } from './UserBadges';

interface PollVotersModalProps {
    visible: boolean;
    onClose: () => void;
    postId: string;
    options: any[]; // { id, option_text }
}

export const PollVotersModal = ({ visible, onClose, postId, options }: PollVotersModalProps) => {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [votes, setVotes] = useState<any[]>([]);

    useEffect(() => {
        if (visible) {
            fetchVoters();
        }
    }, [visible]);

    const fetchVoters = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('poll_votes')
                .select(`
                    option_id,
                    user:profiles!poll_votes_user_id_fkey(id, username, full_name, avatar_url, is_verified, is_admin, is_og)
                `)
                .eq('post_id', postId);

            if (error) throw error;
            setVotes(data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    // Group votes by option
    const groupedVotes = options.map(opt => ({
        ...opt,
        voters: votes.filter(v => v.option_id === opt.id).map(v => v.user)
    }));

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={[styles.container, { paddingTop: 20 }]}>
                <View style={styles.header}>
                    <Text style={styles.title}>Poll Analytics</Text>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Ionicons name="close" size={24} color="white" />
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <View style={{ flex: 1, justifyContent: 'center' }}>
                        <ActivityIndicator color={Colors.dark.primary} />
                    </View>
                ) : (
                    <ScrollView contentContainerStyle={{ paddingBottom: 50 }}>
                        {groupedVotes.map((group, index) => (
                            <View key={group.id} style={styles.groupContainer}>
                                <View style={styles.groupHeader}>
                                    <Text style={styles.groupTitle}>{group.option_text}</Text>
                                    <View style={styles.countBadge}>
                                        <Text style={styles.countText}>{group.voters.length} votes</Text>
                                    </View>
                                </View>

                                {group.voters.length === 0 ? (
                                    <Text style={styles.emptyText}>No votes yet.</Text>
                                ) : (
                                    group.voters.map((voter: any, vIndex: number) => (
                                        <TouchableOpacity
                                            key={voter.id || vIndex}
                                            style={styles.voterRow}
                                            onPress={() => {
                                                onClose();
                                                router.push(`/user/${voter.id}`);
                                            }}
                                        >
                                            <Image source={{ uri: voter.avatar_url || 'https://via.placeholder.com/30' }} style={styles.avatar} />
                                            <Text style={styles.username}>@{voter.username}</Text>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                <Text style={styles.fullName}>{voter.full_name}</Text>
                                                <UserBadges user={voter} size={12} />
                                            </View>
                                        </TouchableOpacity>
                                    ))
                                )}
                            </View>
                        ))}
                    </ScrollView>
                )}
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#111',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    title: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
    closeButton: {
        padding: 4,
    },
    groupContainer: {
        marginTop: 25,
        paddingHorizontal: 20,
    },
    groupHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    groupTitle: {
        color: Colors.dark.primary,
        fontSize: 16,
        fontWeight: 'bold',
        flex: 1,
    },
    countBadge: {
        backgroundColor: '#333',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 10,
    },
    countText: {
        color: '#ccc',
        fontSize: 12,
        fontWeight: 'bold',
    },
    emptyText: {
        color: '#666',
        fontStyle: 'italic',
        fontSize: 14,
    },
    voterRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#222',
        gap: 10,
    },
    avatar: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#444',
    },
    username: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14,
    },
    fullName: {
        color: '#888',
        fontSize: 12,
    }
});
