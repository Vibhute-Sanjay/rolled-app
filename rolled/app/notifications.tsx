import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ScreenWrapper } from '../components/ScreenWrapper';
import { Colors } from '../constants/Colors';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useChatStore } from '../stores/chatStore';

interface Notification {
    id: string;
    type: 'follow' | 'follow_request' | 'like' | 'reply' | 'mention' | 'system' | 'activity_request' | 'activity_approved' | 'activity_rejected' | 'activity_updated' | 'new_activity' | 'vote' | 'new_post';
    actor_id: string;
    resource_id: string;
    content: string;
    is_read: boolean;
    created_at: string;

    actor?: {
        username: string;
        avatar_url: string;
    };
}

export default function NotificationsScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const blockedUserIds = useChatStore(s => s.blockedUserIds);

    // Reactive filter: hide notifications from blocked users
    useEffect(() => {
        if (blockedUserIds.length > 0) {
            setNotifications(prev => prev.filter(n => !blockedUserIds.includes(n.actor_id)));
        }
    }, [blockedUserIds]);

    useFocusEffect(
        useCallback(() => {
            fetchNotifications();
            markAllRead();
        }, [user])
    );

    const fetchNotifications = async () => {
        if (!user) return;
        try {
            let query = supabase
                .from('notifications')
                .select(`
                    *,
                    actor:profiles!notifications_actor_id_fkey(username, avatar_url)
                `);

            if (blockedUserIds.length > 0) {
                query = query.not('actor_id', 'in', `(${blockedUserIds})`);
            }

            const { data, error } = await query
                .eq('user_id', user.id)
                .neq('type', 'message') // <--- HIDE MESSAGES (They have their own tab)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;
            setNotifications(data || []);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const markAllRead = async () => {
        if (!user) return;
        await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', user.id)
            .eq('is_read', false);
    };

    const handleFollowRequest = async (notif: Notification, action: 'accept' | 'reject') => {
        setNotifications(prev => prev.filter(n => n.id !== notif.id));
        try {
            const { error } = await supabase.rpc('handle_follow_request', {
                requester_id: notif.actor_id,
                action: action
            });
            if (error) throw error;
            await supabase.from('notifications').delete().eq('id', notif.id);
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Action failed");
            fetchNotifications();
        }
    };

    const handleActivityRequest = async (notif: Notification, action: 'approve' | 'reject') => {
        setNotifications(prev => prev.filter(n => n.id !== notif.id));
        try {
            const status = action === 'approve' ? 'approved' : 'rejected';
            const { error } = await supabase
                .from('activity_requests')
                .update({ status: status })
                .eq('activity_id', notif.resource_id)
                .eq('user_id', notif.actor_id);

            if (error) throw error;
            await supabase.from('notifications').delete().eq('id', notif.id);
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Action failed");
            fetchNotifications();
        }
    };

    const handleActivityUpdateResponse = async (notif: Notification, action: 'confirm' | 'leave') => {
        setNotifications(prev => prev.filter(n => n.id !== notif.id));
        try {
            if (action === 'confirm') {
                const { error } = await supabase
                    .from('activity_requests')
                    .update({ reconfirm_needed: false })
                    .eq('activity_id', notif.resource_id)
                    .eq('user_id', user?.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('activity_requests')
                    .delete()
                    .eq('activity_id', notif.resource_id)
                    .eq('user_id', user?.id);
                if (error) throw error;
            }
            await supabase.from('notifications').delete().eq('id', notif.id);
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Action failed");
            fetchNotifications();
        }
    };

    const handlePress = (notif: Notification) => {

        if (notif.type === 'follow' || notif.type === 'follow_request') {
            router.push(`/user/${notif.actor_id}`);
        } else if (notif.type === 'like' || notif.type === 'reply' || notif.type === 'mention' || notif.type === 'vote' || notif.type === 'new_post') {
            // All social notifications are for regular posts only (anon posts don't get notifications by design)
            router.push(`/post/${notif.resource_id}`);
        } else if (
            notif.type === 'activity_request' ||
            notif.type === 'activity_approved' ||
            notif.type === 'activity_rejected' ||
            notif.type === 'activity_updated' ||
            notif.type === 'new_activity'
        ) {
            // FIX: If it's a request, stay here (already on notifications screen) or go to activity to manage? 
            // User said: "it should take to notification feed". 
            // Since we are ALREADY on the notifications screen, we don't need to push if it's activity_request.
            if (notif.type === 'activity_request') {
                // Optionally scroll to top or refresh?
                return;
            }

            // Decisions (approved/rejected) and new events go to activity details
            router.push(`/activity/${notif.resource_id}`);
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'like': return <MaterialCommunityIcons name="heart" size={20} color="#FF4500" />;
            case 'reply': return <MaterialCommunityIcons name="comment" size={20} color={Colors.dark.primary} />;
            case 'mention': return <MaterialCommunityIcons name="at" size={20} color={Colors.dark.primary} />;
            case 'vote': return <MaterialCommunityIcons name="poll" size={20} color={Colors.dark.primary} />;
            case 'follow': return <MaterialCommunityIcons name="account-plus" size={20} color="#00C851" />;
            case 'follow_request': return <MaterialCommunityIcons name="account-clock" size={20} color="#FFBB33" />;
            case 'activity_request': return <MaterialCommunityIcons name="ticket-confirmation" size={20} color="#22d3ee" />;
            case 'activity_approved': return <MaterialCommunityIcons name="check-decagram" size={20} color="#00C851" />;
            case 'activity_rejected': return <MaterialCommunityIcons name="close-circle" size={20} color="#FF4444" />;
            case 'new_activity': return <MaterialCommunityIcons name="calendar-star" size={20} color="#a855f7" />;
            default: return <MaterialCommunityIcons name="bell" size={20} color={Colors.dark.text} />;
        }
    };

    const renderItem = ({ item }: { item: Notification }) => (
        <TouchableOpacity
            style={[styles.item, !item.is_read && styles.unreadItem]}
            onPress={() => handlePress(item)}
        >
            <View style={styles.iconContainer}>
                {item.actor?.avatar_url ? (
                    <Image source={{ uri: item.actor.avatar_url }} style={styles.avatar} />
                ) : (
                    <View style={[styles.avatar, { backgroundColor: '#333' }]} />
                )}
                <View style={styles.miniIconBadge}>
                    {getIcon(item.type)}
                </View>
            </View>

            <View style={{ flex: 1 }}>
                <Text style={styles.text}>
                    <Text style={{ fontWeight: 'bold', color: '#FFF' }}>{item.actor?.username || 'Someone'}</Text>
                    <Text style={{ color: '#AAA' }}> {item.content}</Text>
                </Text>
                <Text style={styles.time}>{formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}</Text>

                {item.type === 'follow_request' && (
                    <View style={styles.actionRow}>
                        <TouchableOpacity style={[styles.acceptBtn, { backgroundColor: '#00C851', flex: 1, alignItems: 'center', justifyContent: 'center' }]} onPress={() => handleFollowRequest(item, 'accept')}>
                            <MaterialCommunityIcons name="check" size={18} color="#FFF" />
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.rejectBtn, { flex: 1, alignItems: 'center', justifyContent: 'center', borderColor: '#FF4444' }]} onPress={() => handleFollowRequest(item, 'reject')}>
                            <MaterialCommunityIcons name="close" size={18} color="#FF4444" />
                        </TouchableOpacity>
                    </View>
                )}

                {item.type === 'activity_request' && (
                    <View style={styles.actionRow}>
                        <TouchableOpacity style={[styles.acceptBtn, { backgroundColor: '#22d3ee' }]} onPress={() => handleActivityRequest(item, 'approve')}>
                            <Text style={[styles.btnText, { color: '#000' }]}>Approve</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.rejectBtn} onPress={() => handleActivityRequest(item, 'reject')}>
                            <Text style={[styles.btnText, { color: '#FF4444' }]}>Reject</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {item.type === 'activity_updated' && (
                    <View style={styles.reconfirmBanner}>
                        <Text style={styles.reconfirmTitle}>Will you still attend?</Text>
                        <View style={styles.actionRow}>
                            <TouchableOpacity
                                style={[styles.acceptBtn, { backgroundColor: '#00C851', flex: 1, alignItems: 'center' }]}
                                onPress={() => handleActivityUpdateResponse(item, 'confirm')}
                            >
                                <MaterialCommunityIcons name="check" size={16} color="#FFF" />
                                <Text style={[styles.btnText, { color: '#FFF', marginLeft: 4 }]}>Yes</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.rejectBtn, { flex: 1, alignItems: 'center' }]}
                                onPress={() => handleActivityUpdateResponse(item, 'leave')}
                            >
                                <MaterialCommunityIcons name="close" size={16} color="#FF4444" />
                                <Text style={[styles.btnText, { color: '#FF4444', marginLeft: 4 }]}>No</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </View>

            {!item.is_read && <View style={styles.dot} />}
        </TouchableOpacity>
    );

    return (
        <ScreenWrapper style={{ paddingHorizontal: 0 }}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Notifications</Text>
            </View>

            {loading && !refreshing ? (
                <ActivityIndicator color={Colors.dark.primary} style={{ marginTop: 20 }} />
            ) : (
                <FlatList
                    data={notifications}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchNotifications(); }} tintColor={Colors.dark.primary} />
                    }
                    ListEmptyComponent={
                        <View style={{ alignItems: 'center', marginTop: 50 }}>
                            <Text style={{ color: '#666' }}>No notifications yet</Text>
                        </View>
                    }
                />
            )}
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row', alignItems: 'center', gap: 15,
        padding: 15, borderBottomWidth: 1, borderBottomColor: '#222'
    },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#FFF' },
    item: {
        flexDirection: 'row', padding: 15, borderBottomWidth: 1, borderBottomColor: '#1A1A1A',
        alignItems: 'flex-start'
    },
    unreadItem: { backgroundColor: '#111' },
    iconContainer: { marginRight: 15, position: 'relative' },
    avatar: { width: 40, height: 40, borderRadius: 20 },
    miniIconBadge: {
        position: 'absolute', bottom: -2, right: -2,
        backgroundColor: '#000', borderRadius: 10, padding: 2
    },
    text: { fontSize: 14, color: '#FFF', lineHeight: 20 },
    time: { fontSize: 12, color: '#666', marginTop: 4 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.dark.primary, marginTop: 6 },

    actionRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
    acceptBtn: {
        backgroundColor: Colors.dark.primary,
        paddingVertical: 6, paddingHorizontal: 16, borderRadius: 15
    },
    rejectBtn: {
        backgroundColor: '#222',
        paddingVertical: 6, paddingHorizontal: 16, borderRadius: 15, borderWidth: 1, borderColor: '#333'
    },
    btnText: { color: '#FFF', fontWeight: 'bold', fontSize: 12 },

    // Reconfirm Banner
    reconfirmBanner: {
        marginTop: 10,
        backgroundColor: '#252525',
        padding: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#333'
    },
    reconfirmTitle: {
        color: '#CCC', fontSize: 12, marginBottom: 8, fontWeight: '600'
    }
});
