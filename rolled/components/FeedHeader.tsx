import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/Colors';
import { FontAwesome5 } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useUnreadNotifications } from '../hooks/useUnreadNotifications';
import { useUnreadMessages } from '../hooks/useUnreadMessages';

interface FeedHeaderProps {
    activeTab: 'campus' | 'following';
    onTabChange: (tab: 'campus' | 'following') => void;
}

export const FeedHeader = ({ activeTab, onTabChange }: FeedHeaderProps) => {
    const router = useRouter();
    const { hasUnread } = useUnreadNotifications();
    const { hasUnreadMessages } = useUnreadMessages();

    return (
        <View style={styles.container}>
            {/* Top Row: Logo & Messages */}
            <View style={styles.topRow}>
                <View style={styles.logoContainer}>
                    <Text style={styles.logoText}>Rolled<Text style={styles.logoDot}>.</Text></Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <TouchableOpacity
                        style={styles.messageIcon}
                        onPress={() => router.push('/messages' as any)}
                    >
                        <FontAwesome5 name="envelope" size={22} color={Colors.dark.text} />
                        {hasUnreadMessages && (
                            <View style={styles.messageDot} />
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            {/* Tabs Row */}
            <View style={styles.tabsRow}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'campus' && styles.activeTab]}
                    onPress={() => onTabChange('campus')}
                >
                    <Text style={[styles.tabText, activeTab === 'campus' && styles.activeTabText]}>Campus Roll</Text>
                    {activeTab === 'campus' && <View style={styles.activeIndicator} />}
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.tab, activeTab === 'following' && styles.activeTab]}
                    onPress={() => onTabChange('following')}
                >
                    <Text style={[styles.tabText, activeTab === 'following' && styles.activeTabText]}>My Roll</Text>
                    {activeTab === 'following' && <View style={styles.activeIndicator} />}
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: Colors.dark.background,
        paddingTop: 10,
        paddingBottom: 0,
        borderBottomWidth: 1,
        borderBottomColor: '#222',
        zIndex: 100,
        height: '100%',
        justifyContent: 'flex-end',
    },
    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 15,
        marginBottom: 10,
    },
    logoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    logoText: {
        fontSize: 28,
        fontWeight: '900',
        color: 'white',
        letterSpacing: -1,
        fontStyle: 'italic',
    },
    logoDot: {
        color: Colors.dark.primary,
        fontSize: 32,
    },
    messageIcon: {
        padding: 5,
        position: 'relative',
    },
    messageDot: {
        position: 'absolute',
        top: 3,
        right: 3,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#00FFFF',
        borderWidth: 1.5,
        borderColor: Colors.dark.background,
    },
    tabsRow: {
        flexDirection: 'row',
        paddingHorizontal: 0,
    },
    tab: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 10,
        position: 'relative',
    },
    activeTab: {
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
        width: '100%',
        height: 3,
        backgroundColor: Colors.dark.primary,
        borderRadius: 2,
    },
    notificationDot: {
        position: 'absolute',
        top: 5,
        right: 5,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#22d3ee',
        borderWidth: 1.5,
        borderColor: Colors.dark.background,
    },
});

