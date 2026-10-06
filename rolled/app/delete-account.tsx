import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ScreenWrapper } from '../components/ScreenWrapper';
import { Colors } from '../constants/Colors';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

export default function DeleteAccountScreen() {
    const router = useRouter();
    const { signOut } = useAuth();
    const [deleting, setDeleting] = useState(false);

    const handleDeleteAccount = () => {
        Alert.alert(
            "⚠️ Final Confirmation",
            "This action cannot be undone. Your account and all associated data will be permanently deleted. Are you absolutely sure?",
            [
                {
                    text: "Cancel",
                    style: "cancel"
                },
                {
                    text: "Yes, Delete Everything",
                    style: "destructive",
                    onPress: async () => {
                        setDeleting(true);
                        try {
                            const { error } = await supabase.rpc('delete_own_account');
                            if (error) throw error;

                            Alert.alert("Account Deleted", "Your account has been successfully deleted.", [
                                { text: "OK", onPress: () => signOut() }
                            ]);
                        } catch (e: any) {
                            setDeleting(false);
                            Alert.alert("Error", e.message || "Failed to delete account. Please try again or contact support.");
                        }
                    }
                }
            ]
        );
    };

    const items = [
        {
            icon: "image",
            title: "All Media",
            description: "Profile pictures, post images, and event photos will be removed from our servers",
            color: "#FF453A"
        },
        {
            icon: "newspaper",
            title: "Your Posts & Content",
            description: "Every Roll (post) and upcoming Activity you've created",
            color: "#FF9F0A"
        },
        {
            icon: "chatbubbles",
            title: "Messages & Chats",
            description: "All your conversations and message history",
            color: "#FFD60A"
        },
        {
            icon: "people",
            title: "Social Connections",
            description: "Your followers, following list, and blocked users",
            color: "#30D158"
        },
        {
            icon: "heart",
            title: "Interactions",
            description: "Your likes, comments, and saved posts",
            color: "#BF5AF2"
        },
        {
            icon: "eye-off",
            title: "Anonymous Identity",
            description: "Your Unrolled personality and all anonymous posts",
            color: "#0A84FF"
        },
        {
            icon: "bookmark",
            title: "Saved Items",
            description: "Any posts or activities you've saved",
            color: "#5E5CE6"
        }
    ];

    return (
        <ScreenWrapper style={{ paddingHorizontal: 0 }}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={28} color={Colors.dark.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Delete Account</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Warning Box */}
                <View style={styles.warningBox}>
                    <MaterialCommunityIcons name="alert-circle" size={48} color="#FF453A" />
                    <Text style={styles.warningTitle}>Permanent Action</Text>
                    <Text style={styles.warningText}>
                        Once you delete your account, there's no going back. Please be certain.
                    </Text>
                </View>

                {/* Delete Button */}
                <TouchableOpacity
                    style={[styles.deleteButton, deleting && styles.deleteButtonDisabled]}
                    onPress={handleDeleteAccount}
                    disabled={deleting}
                    activeOpacity={0.7}
                >
                    <Ionicons name="trash-bin" size={20} color="#FFF" />
                    <Text style={styles.deleteButtonText}>
                        {deleting ? "Deleting..." : "Delete My Account"}
                    </Text>
                </TouchableOpacity>

                {/* What Will Be Deleted Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>What will be permanently deleted:</Text>

                    {items.map((item, index) => (
                        <View key={index} style={styles.item}>
                            <View style={[styles.iconCircle, { backgroundColor: `${item.color}15` }]}>
                                <Ionicons name={item.icon as any} size={20} color={item.color} />
                            </View>
                            <View style={styles.itemContent}>
                                <Text style={styles.itemTitle}>{item.title}</Text>
                                <Text style={styles.itemDescription}>{item.description}</Text>
                            </View>
                        </View>
                    ))}
                </View>

                {/* Note Section */}
                <View style={styles.noteBox}>
                    <Ionicons name="information-circle" size={20} color={Colors.dark.primary} />
                    <Text style={styles.noteText}>
                        <Text style={{ fontWeight: 'bold' }}>Note: </Text>
                        Any reports you've submitted will remain for moderation purposes, but your identity will be anonymized.
                    </Text>
                </View>

                {/* Spacer */}
                <View style={{ height: 40 }} />
            </ScrollView>
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
    },
    backButton: {
        marginRight: 15,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: Colors.dark.text,
    },
    scrollContent: {
        paddingBottom: 40,
    },
    warningBox: {
        alignItems: 'center',
        backgroundColor: 'rgba(255, 69, 58, 0.1)',
        padding: 24,
        marginHorizontal: 20,
        marginTop: 20,
        marginBottom: 24,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 69, 58, 0.2)',
    },
    warningTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#FF453A',
        marginTop: 12,
        marginBottom: 8,
    },
    warningText: {
        fontSize: 14,
        color: Colors.dark.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
    },
    deleteButton: {
        backgroundColor: '#FF453A',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        marginHorizontal: 20,
        borderRadius: 12,
        marginBottom: 32,
        gap: 10,
        shadowColor: '#FF453A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    deleteButtonDisabled: {
        opacity: 0.6,
    },
    deleteButtonText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
    section: {
        marginHorizontal: 20,
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.dark.text,
        marginBottom: 16,
    },
    item: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: '#1A1A1A',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
    },
    iconCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    itemContent: {
        flex: 1,
    },
    itemTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.dark.text,
        marginBottom: 4,
    },
    itemDescription: {
        fontSize: 13,
        color: Colors.dark.textSecondary,
        lineHeight: 18,
    },
    noteBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: 'rgba(34, 211, 238, 0.1)',
        borderRadius: 12,
        padding: 16,
        marginHorizontal: 20,
        gap: 12,
        borderWidth: 1,
        borderColor: 'rgba(34, 211, 238, 0.2)',
    },
    noteText: {
        flex: 1,
        fontSize: 13,
        color: Colors.dark.textSecondary,
        lineHeight: 18,
    },
});
