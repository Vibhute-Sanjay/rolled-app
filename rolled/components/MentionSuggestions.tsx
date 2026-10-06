import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';
import { Colors } from '../constants/Colors';
import { UserBadges } from './UserBadges';

interface Profile {
    id: string;
    username: string;
    full_name: string;
    avatar_url: string;
    is_verified: boolean;
    is_admin: boolean;
    is_og: boolean;
}

interface MentionSuggestionsProps {
    query: string;
    onSelect: (username: string) => void;
}

export const MentionSuggestions = ({ query, onSelect }: MentionSuggestionsProps) => {
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!query || query.length < 1) {
            setProfiles([]);
            return;
        }

        const fetchSuggestions = async () => {
            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('id, username, full_name, avatar_url, is_verified, is_admin, is_og')
                    .ilike('username', `${query}%`)
                    .limit(5);

                if (error) throw error;
                setProfiles(data || []);
            } catch (err) {
                console.error("Fetch suggestions error:", err);
            } finally {
                setLoading(false);
            }
        };

        const timer = setTimeout(fetchSuggestions, 300);
        return () => clearTimeout(timer);
    }, [query]);

    if (!query || (profiles.length === 0 && !loading)) return null;

    return (
        <View style={styles.container}>
            {loading && profiles.length === 0 ? (
                <View style={styles.loading}>
                    <ActivityIndicator size="small" color={Colors.dark.primary} />
                </View>
            ) : (
                <FlatList
                    data={profiles}
                    keyExtractor={(item) => item.id}
                    keyboardShouldPersistTaps="always"
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={styles.item}
                            onPress={() => onSelect(item.username)}
                        >
                            <Image
                                source={{ uri: item.avatar_url || 'https://via.placeholder.com/32' }}
                                style={styles.avatar}
                            />
                            <View style={{ flex: 1 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                    <Text style={styles.username}>@{item.username}</Text>
                                    <UserBadges user={item} size={12} />
                                </View>
                                <Text style={styles.fullName}>{item.full_name}</Text>
                            </View>
                        </TouchableOpacity>
                    )}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: '100%',
        left: 0,
        right: 0,
        backgroundColor: '#1E1E1E',
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
        maxHeight: 200,
        borderWidth: 1,
        borderColor: '#333',
        borderBottomWidth: 0,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 5,
    },
    loading: {
        padding: 15,
        alignItems: 'center',
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#2A2A2A',
    },
    avatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        marginRight: 10,
        backgroundColor: '#333',
    },
    username: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14,
    },
    fullName: {
        color: Colors.dark.textSecondary,
        fontSize: 12,
    }
});
