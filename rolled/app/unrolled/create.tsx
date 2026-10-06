import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, ScrollView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { Colors } from '../../constants/Colors';
import { supabase } from '../../lib/supabase';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';

const BADGES = ['Chill', 'Stories', 'Opinions', 'Confession', 'Rant'];

export default function UnrolledCreate() {
    const router = useRouter();
    const [content, setContent] = useState('');
    const [selectedBadge, setSelectedBadge] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handlePost = async () => {
        if (!content.trim()) {
            Alert.alert("Empty Post", "Please write something.");
            return;
        }

        setLoading(true);
        try {
            const { data, error } = await supabase.rpc('create_anon_post', {
                content_text: content,
                badge_text: selectedBadge
            });

            if (error) throw error;
            router.back();
        } catch (e) {
            console.error("Post error:", e);
            Alert.alert("Error", "Could not create post.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScreenWrapper style={[styles.container, { paddingHorizontal: 0 }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
                    <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.postButton, (!content.trim() || loading) && { opacity: 0.5 }]}
                    onPress={handlePost}
                    disabled={!content.trim() || loading}
                >
                    {loading ? <ActivityIndicator color="#000" size="small" /> : <Text style={styles.postText}>Post</Text>}
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <TextInput
                    style={styles.input}
                    placeholder="Share your stories..."
                    placeholderTextColor="#666"
                    multiline
                    autoFocus
                    value={content}
                    onChangeText={setContent}
                />

                <Text style={styles.badgeLabel}>ADD A BADGE (OPTIONAL)</Text>
                <View style={styles.badgeRow}>
                    {BADGES.map(badge => (
                        <TouchableOpacity
                            key={badge}
                            style={[
                                styles.badgeItem,
                                selectedBadge === badge && styles.badgeActive,
                                selectedBadge === badge && { borderColor: getBadgeColor(badge) }
                            ]}
                            onPress={() => setSelectedBadge(selectedBadge === badge ? null : badge)}
                        >
                            <Text style={[
                                styles.badgeText,
                                selectedBadge === badge && { color: getBadgeColor(badge) }
                            ]}>
                                {getDisplayBadge(badge).toUpperCase()}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </ScrollView>
        </ScreenWrapper>
    );
}

const getDisplayBadge = (badge: string) => {
    if (badge === 'Rant') return 'Vent';
    if (badge === 'Confession') return 'Spill';
    if (badge === 'Chill') return 'Discussion';
    return badge;
}

const getBadgeColor = (badge: string) => {
    switch (badge.toLowerCase()) {
        case 'rant':
        case 'vent': return '#FF4444';
        case 'confession':
        case 'spill': return '#D070FB';
        case 'stories': return '#FF8C00';
        case 'opinions': return '#1E90FF';
        case 'chill':
        case 'discussion': return '#00C851';
        default: return Colors.dark.primary;
    }
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#000',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#222',
    },
    closeButton: {
        padding: 8,
    },
    cancelText: {
        color: '#fff',
        fontSize: 16,
    },
    postButton: {
        backgroundColor: Colors.dark.primary,
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 20,
    },
    postText: {
        color: '#000',
        fontWeight: 'bold',
    },
    content: {
        padding: 20,
    },
    input: {
        fontSize: 18,
        color: '#fff',
        minHeight: 150,
        textAlignVertical: 'top',
        marginBottom: 30,
    },
    badgeLabel: {
        color: '#666',
        fontSize: 12,
        fontWeight: 'bold',
        marginBottom: 12,
        letterSpacing: 1,
    },
    badgeRow: {
        flexDirection: 'row',
        gap: 10,
        flexWrap: 'wrap',
    },
    badgeItem: {
        borderWidth: 1,
        borderColor: '#333',
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: '#111',
    },
    badgeActive: {
        backgroundColor: '#000', // Or transparent with colored border
    },
    badgeText: {
        color: '#888',
        fontSize: 12,
        fontWeight: 'bold',
    }
});
