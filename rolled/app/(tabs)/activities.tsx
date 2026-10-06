
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActivityCard, ActivityProps } from '../../components/ActivityCard';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { ShareContent, ShareModal } from '../../components/ShareModal';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useUnreadNotifications } from '../../hooks/useUnreadNotifications';
import { supabase } from '../../lib/supabase';
import { useChatStore } from '../../stores/chatStore';
import { useUserStore } from '../../stores/userStore';

export default function ActivitiesScreen() {
    const { hasUnread } = useUnreadNotifications();
    const { colors, theme } = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { user } = useAuth();
    const { profile } = useUserStore();

    console.log("🔍 Current User Role:", user?.user_metadata?.role);
    console.log("🔍 Admin Status:", profile?.is_admin);

    const [activities, setActivities] = useState<ActivityProps[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [userStatuses, setUserStatuses] = useState<Record<string, 'pending' | 'approved' | 'rejected'>>({});

    const blockedUserIds = useChatStore(s => s.blockedUserIds);

    // Reactive filter: hide activities from users we blocked or who blocked us
    useEffect(() => {
        if (blockedUserIds.length > 0) {
            setActivities(prev => prev.filter(a => !blockedUserIds.includes(a.organizer_id)));
        }
    }, [blockedUserIds]);

    const fetchActivities = async () => {
        try {
            let activityQuery = supabase
                .from('activities')
                .select('*, profiles:organizer_id(full_name, avatar_url, username, is_verified, is_admin, is_og)');

            // EXCLUDE BLOCKED USERS
            if (blockedUserIds.length > 0) {
                activityQuery = activityQuery.not('organizer_id', 'in', `(${blockedUserIds})`);
            }

            const [activitiesRes, requestsRes] = await Promise.all([
                activityQuery.order('created_at', { ascending: false }),
                user ? supabase
                    .from('activity_requests')
                    .select('activity_id, status')
                    .eq('user_id', user.id)
                    : Promise.resolve({ data: [], error: null })
            ]);

            if (activitiesRes.error) throw activitiesRes.error;
            if (activitiesRes.data) setActivities(activitiesRes.data as ActivityProps[]);

            if (requestsRes.data) {
                const statusMap: Record<string, any> = {};
                requestsRes.data.forEach((r: any) => {
                    statusMap[r.activity_id] = r.status;
                });
                setUserStatuses(statusMap);
            }

        } catch (error) {
            console.log('Error fetching activities:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        React.useCallback(() => {
            fetchActivities();
        }, [])
    );

    const onRefresh = () => {
        setRefreshing(true);
        fetchActivities();
    };

    const handleDelete = (deletedId: string) => {
        setActivities(prev => prev.filter(a => a.id !== deletedId));
    };

    const [shareVisible, setShareVisible] = useState(false);
    const [sharedContent, setSharedContent] = useState<ShareContent | null>(null);

    const handleShareInApp = (activity: ActivityProps) => {
        setSharedContent({
            type: 'activity',
            id: activity.id,
            preview: {
                title: activity.title,
                image: activity.cover_image || undefined,
                subtitle: activity.location || 'Activity'
            },
            data: activity
        });
        setShareVisible(true);
    };

    return (
        <ScreenWrapper style={{ paddingHorizontal: 0 }}>
            {/* Sticky Header */}
            <View style={[styles.header, { marginTop: insets.top, backgroundColor: colors.background, zIndex: 100 }]}>
                <Text style={[styles.title, { color: colors.text }]}>
                    Explore
                    <Text style={{ color: colors.primary }}>.</Text>
                </Text>

                <TouchableOpacity
                    onPress={() => router.push('/notifications')}
                    style={{ position: 'absolute', right: 20, top: 20 }}
                >
                    <Ionicons name="flash-outline" size={26} color={hasUnread ? colors.primary : colors.text} />
                    {hasUnread && (
                        <View style={{
                            position: 'absolute',
                            top: -2,
                            right: -2,
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: '#00FFFF'
                        }} />
                    )}
                </TouchableOpacity>
            </View>

            {/* Feed List */}
            <FlashList<ActivityProps>
                data={activities}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <ActivityCard
                        activity={item}
                        onDelete={handleDelete}
                        onShareInApp={() => handleShareInApp(item)}
                        initialUserStatus={userStatuses[item.id]}
                    />
                )}
                // @ts-ignore
                estimatedItemSize={250}
                contentContainerStyle={{ paddingTop: 100, paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
                onRefresh={onRefresh}
                refreshing={refreshing}
                ListEmptyComponent={
                    !loading ? (
                        <View style={{ alignItems: 'center', marginTop: 50 }}>
                            <Text style={{ color: colors.textSecondary }}>No activities found.</Text>
                            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Be the first to create one!</Text>
                        </View>
                    ) : null
                }
            />

            <ShareModal
                visible={shareVisible}
                onClose={() => setShareVisible(false)}
                content={sharedContent}
            />

            {/* Floating Action Button (Only for Clubs/Organizations/Admins) */}
            {(user?.user_metadata?.role === 'club' || user?.user_metadata?.role === 'organization' || user?.user_metadata?.role === 'admin' || profile?.is_admin) && (
                <TouchableOpacity
                    style={[styles.fab, { backgroundColor: colors.primary }]}
                    onPress={() => router.push('/create-activity')}
                >
                    <Ionicons name="add" size={32} color="#000" />
                </TouchableOpacity>
            )}

        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    header: {
        position: 'absolute', // Sticky
        top: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 20,
        paddingBottom: 10,
        paddingTop: 16,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
    },
    fab: {
        position: 'absolute',
        bottom: 90,
        right: 20,
        width: 60, height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
        elevation: 8,
        zIndex: 200
    }
});
