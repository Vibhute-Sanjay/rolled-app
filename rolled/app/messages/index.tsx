import { FontAwesome5 } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChatRoomItem } from '../../components/Chat/ChatRoomItem';
import { Colors } from '../../constants/Colors';
import { useChatStore } from '../../stores/chatStore';

import { Alert, TouchableOpacity } from 'react-native';
import { ActionSheetOption, CustomActionSheet } from '../../components/CustomActionSheet';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

export default function MessagesScreen() {
    const { user } = useAuth();
    const rooms = useChatStore(s => s.rooms);
    const fetchRooms = useChatStore(s => s.fetchRooms);
    const deleteRoom = useChatStore(s => s.deleteRoom);
    const isLoading = useChatStore(s => s.isLoading);
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');

    const [actionSheetVisible, setActionSheetVisible] = useState(false);
    const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

    useFocusEffect(
        useCallback(() => {
            fetchRooms();
            markMessagesRead();
        }, [user])
    );

    const markMessagesRead = async () => {
        if (!user) return;
        await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', user.id)
            .eq('type', 'message')
            .eq('is_read', false);
    };

    const filteredRooms = rooms.filter(room => {
        const other = room.other_user;
        if (!other) return false;
        const query = searchQuery.toLowerCase();
        return other.username.toLowerCase().includes(query) ||
            other.full_name?.toLowerCase().includes(query);
    });

    const handleLongPress = (roomId: string) => {
        setSelectedRoomId(roomId);
        setActionSheetVisible(true);
    };

    const handleDeleteChat = () => {
        if (!selectedRoomId) return;

        Alert.alert(
            "Delete Chat",
            "Are you sure you want to delete this conversation? This cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        await deleteRoom(selectedRoomId);
                        setActionSheetVisible(false);
                    }
                }
            ]
        );
    };

    const actionSheetOptions: ActionSheetOption[] = [
        {
            label: 'Delete Chat',
            icon: 'trash-can-outline',
            isDestructive: true,
            onPress: handleDeleteChat
        }
    ];

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <View style={styles.titleContainer}>
                    <Text style={styles.headerTitle}>Messages</Text>
                    <Text style={styles.headerDot}>.</Text>
                </View>
            </View>

            <View style={styles.searchContainer}>
                <View style={styles.searchBar}>
                    <FontAwesome5 name="search" size={16} color={Colors.dark.textSecondary} style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search"
                        placeholderTextColor={Colors.dark.textSecondary}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>
            </View>

            {isLoading && rooms.length === 0 ? (
                <View style={styles.center}>
                    <ActivityIndicator color={Colors.dark.primary} />
                </View>
            ) : (
                <FlashList
                    data={filteredRooms}
                    renderItem={({ item }) => (
                        <ChatRoomItem
                            room={item}
                            onLongPress={() => handleLongPress(item.id)}
                        />
                    )}
                    estimatedItemSize={74}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={() => (
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>No messages yet.</Text>
                            <Text style={styles.emptySubText}>Start a conversation from a profile!</Text>
                        </View>
                    )}
                />
            )}

            <CustomActionSheet
                visible={actionSheetVisible}
                onClose={() => setActionSheetVisible(false)}
                options={actionSheetOptions}
                title="Chat Options"
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.dark.background,
    },
    header: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'flex-start',
    },
    titleContainer: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    headerTitle: {
        fontSize: 32,
        fontWeight: 'bold',
        color: Colors.dark.text,
    },
    headerDot: {
        fontSize: 32,
        fontWeight: 'bold',
        color: 'cyan',
    },
    searchContainer: {
        paddingHorizontal: 0,
        paddingBottom: 10,
    },
    searchBar: {
        backgroundColor: Colors.dark.card,
        height: 44,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        marginHorizontal: 0,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: '#333',
    },
    searchIcon: {
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        color: Colors.dark.text,
        fontSize: 16,
        height: '100%',
    },
    listContent: {
        paddingBottom: 100,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        color: Colors.dark.text,
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 8,
    },
    emptySubText: {
        color: Colors.dark.textSecondary,
        fontSize: 14,
        textAlign: 'center',
    },
});
