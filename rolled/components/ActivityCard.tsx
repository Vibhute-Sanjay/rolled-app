import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Dimensions, Image, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';
import { Avatar } from './Avatar';
import { CustomActionSheet } from './CustomActionSheet';
import { CustomToast } from './CustomToast';
import { ReportModal } from './ReportModal';
import { UserBadges } from './UserBadges';

const { width } = Dimensions.get('window');

export interface ActivityProps {
    id: string;
    title: string;
    cover_image: string | null;
    category: string;
    short_description: string | null;
    full_details: string | null;
    start_time: string;
    location: string | null;
    ticket_type: 'Free' | 'Paid';
    price: number;
    organizer_id: string;
    created_at: string;
    attendees_count?: number;
    additional_images?: string[];
    profiles?: {
        full_name: string;
        avatar_url: string | null;
        username?: string;
        is_verified?: boolean;
        is_admin?: boolean;
        is_og?: boolean;
    };
}

export const ActivityCard = ({ activity, onDelete, onShareInApp, initialUserStatus }: { activity: ActivityProps, onDelete?: (id: string) => void, onShareInApp?: () => void, initialUserStatus?: 'pending' | 'approved' | 'rejected' }) => {
    const { colors } = useTheme();
    const router = useRouter();
    const { user } = useAuth();

    // State for real-time data
    const [approvedCount, setApprovedCount] = useState<number>(0);
    const [participants, setParticipants] = useState<any[]>([]);
    const [loadingCount, setLoadingCount] = useState(true);

    const [menuVisible, setMenuVisible] = useState(false);
    const [reportModalVisible, setReportModalVisible] = useState(false);
    const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
    const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'error' | 'info' }>({
        visible: false, message: '', type: 'info'
    });

    const [userStatus, setUserStatus] = useState<'pending' | 'approved' | 'rejected' | 'none'>(initialUserStatus || 'none');

    // Update status if prop changes (e.g. refresh)
    useEffect(() => {
        if (initialUserStatus) setUserStatus(initialUserStatus);
    }, [initialUserStatus]);

    // Fetch real-time participants count & user status (only if not provided or to be safe)
    useEffect(() => {
        let isMounted = true;
        const fetchData = async () => {
            // 1. Get Count & Participants
            const { data, count, error } = await supabase
                .from('activity_requests')
                .select('user_id, profiles:user_id(avatar_url)', { count: 'exact' })
                .eq('activity_id', activity.id)
                .eq('status', 'approved')
                .limit(4);

            if (isMounted && !error) {
                setApprovedCount(count || 0);
                setParticipants(data?.map((d: any) => d.profiles) || []);
            }

            // 2. Get User Status (if logged in)
            if (user) {
                const { data: myReq } = await supabase
                    .from('activity_requests')
                    .select('status')
                    .eq('activity_id', activity.id)
                    .eq('user_id', user.id)
                    .single();

                if (isMounted && myReq) {
                    setUserStatus(myReq.status as any);
                }
            }

            setLoadingCount(false);
        };
        fetchData();
        return () => { isMounted = false; };
    }, [activity.id, user]);

    const dateObj = new Date(activity.start_time);
    const dateStr = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const timeStr = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const fullDateString = `${dateStr} • ${timeStr}`;

    const organizerName = activity.profiles?.full_name || activity.profiles?.username || 'Unknown Host';
    const organizerAvatar = activity.profiles?.avatar_url;

    const timeAgo = (dateString: string) => {
        const now = new Date();
        const created = new Date(dateString);
        const diffMs = now.getTime() - created.getTime();
        const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
        if (diffHrs < 1) return 'Just now';
        if (diffHrs < 24) return `${diffHrs}h ago`;
        return `${Math.floor(diffHrs / 24)}d ago`;
    };

    const handlePress = () => {
        router.push({
            pathname: '/activity/[id]',
            params: {
                ...activity,
                organizer_name: activity.profiles?.full_name,
                organizer_avatar: activity.profiles?.avatar_url,
                initialStatus: userStatus // Pass current status to details
            } as any
        });
    };

    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
        setToast({ visible: true, message, type });
    };

    // ACTIONS
    const handleShare = async () => {
        try {
            await Share.share({
                message: `Check out this event: ${activity.title}\n${activity.short_description || ''}\nDownload the app to join!`,
            });
        } catch (error) {
            console.error(error);
        }
    };

    const handleFavorite = () => {
        // TODO: Backend integration
        showToast("Saved to Favorites", 'success');
    };

    // Step 1: Triggered from Main Menu
    const handleDeletePrompt = () => {
        setMenuVisible(false); // Close main menu
        setTimeout(() => setDeleteConfirmVisible(true), 300); // Open confirm sheet
    };

    // Step 2: Confirmation Action
    const confirmDelete = async () => {
        try {
            const { error } = await supabase.from('activities').delete().eq('id', activity.id);
            if (error) throw error;
            showToast("Activity deleted", 'success');
            if (onDelete) onDelete(activity.id);
        } catch (e: any) {
            showToast(e.message, 'error');
        } finally {
            setDeleteConfirmVisible(false);
        }
    };

    const handleReport = async (reason: string, details: string) => {
        try {
            const { error } = await supabase.from('reports').insert({
                reporter_id: user?.id,
                reported_user_id: activity.organizer_id,
                target_type: 'activity',
                target_id: activity.id,
                reason: reason,
                details: details
            });
            if (error) throw error;
            showToast("Report submitted. Thank you.", 'success');
        } catch (e: any) {
            showToast("Failed to submit report.", 'error');
        } finally {
            setReportModalVisible(false);
        }
    };

    const isOwner = user?.id === activity.organizer_id;
    // const capacity = activity.price ? (activity as any).capacity : null; // Hack: price/capacity type 

    // Calculate spots
    const hasCapacity = (activity as any).capacity !== null && (activity as any).capacity !== undefined;
    const spotsLeft = hasCapacity ? Math.max(0, (activity as any).capacity - approvedCount) : null;

    const menuOptions: any[] = [
        { label: "Send to Chat", icon: "send", onPress: () => { setMenuVisible(false); onShareInApp && onShareInApp(); } },
    ];

    if (isOwner) {
        menuOptions.push({ label: "Delete", icon: "trash-can-outline", isDestructive: true, onPress: handleDeletePrompt });
    } else {
        menuOptions.push({
            label: "Report",
            icon: "alert-octagon-outline",
            isDestructive: true,
            onPress: () => {
                setMenuVisible(false);
                setTimeout(() => setReportModalVisible(true), 300);
            }
        });
    }

    const deleteOptions = [
        {
            label: "Yes, Delete Activity",
            icon: "trash-can",
            isDestructive: true,
            onPress: confirmDelete
        },
        { label: "Cancel", icon: "close", onPress: () => { } }
    ];

    return (
        <TouchableOpacity activeOpacity={0.95} style={styles.cardContainer} onPress={handlePress}>
            {/* Main Image (Cover/Fill) */}
            <Image
                source={{ uri: activity.cover_image || 'https://images.unsplash.com/photo-1542385002-31d773419999?q=80&w=3227&auto=format&fit=crop' }}
                style={[StyleSheet.absoluteFill, { borderRadius: 16 }]}
                resizeMode="cover"
            />

            {/* Gradient & Content Overlay */}
            <View style={styles.cardImage} pointerEvents="box-none">
                {/* Lighter Gradient Overlay - Preserves letterbox visibility */}
                <LinearGradient
                    colors={['transparent', 'transparent', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.9)']}
                    locations={[0, 0.3, 0.7, 1]}
                    style={styles.gradientOverlay}
                    pointerEvents="none"
                />

                {/* HEADER: Organizer info */}
                <View style={styles.headerRow}>
                    <TouchableOpacity
                        style={styles.organizerInfo}
                        onPress={() => router.push(`/user/${activity.organizer_id}`)}
                    >
                        <View style={styles.avatarContainer}>
                            <Avatar
                                uri={organizerAvatar}
                                name={activity.profiles?.full_name}
                                size={36}
                            />
                        </View>
                        <View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <Text style={styles.organizerName}>{organizerName}</Text>
                                {(activity.profiles?.is_verified || activity.profiles?.is_admin) && <UserBadges user={activity.profiles} size={14} />}
                            </View>
                            <Text style={styles.postedTime}>{timeAgo(activity.created_at)}</Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.menuButton} onPress={() => setMenuVisible(true)}>
                        <Ionicons name="ellipsis-horizontal" size={20} color="#FFF" />
                    </TouchableOpacity>
                </View>


                {/* CONTENT: Bottom aligned */}
                <View style={styles.contentContainer}>
                    {/* Title */}
                    <Text style={styles.title} numberOfLines={2}>
                        {activity.title}
                    </Text>

                    {/* Date Pill - Cyan Glass */}
                    <View style={styles.pillRow}>
                        <View style={styles.datePill}>
                            <MaterialCommunityIcons name="calendar-month-outline" size={16} color="#22d3ee" style={{ marginRight: 6 }} />
                            <Text style={styles.dateText}>{fullDateString}</Text>
                        </View>
                        {(activity as any).is_updated && (
                            <View style={[styles.datePill, { marginLeft: 8, borderColor: '#FFBB33', backgroundColor: 'rgba(255, 187, 51, 0.15)' }]}>
                                <Text style={[styles.dateText, { color: '#FFBB33', fontSize: 10 }]}>UPDATED</Text>
                            </View>
                        )}
                    </View>

                    {/* Location Pill - Dark Glass */}
                    <View style={styles.locationPill}>
                        <Ionicons name="location-sharp" size={16} color="#e2e8f0" style={{ marginRight: 4 }} />
                        <Text style={styles.locationText} numberOfLines={1}>{activity.location || 'Remote Event'}</Text>
                    </View>

                    {/* Description */}
                    <Text style={styles.description} numberOfLines={2}>
                        {activity.short_description || activity.full_details}
                    </Text>

                    {/* Footer: Attendees + Join Button */}
                    <View style={styles.footerRow}>
                        {/* Attendee Stack */}
                        <View style={styles.attendeeStack}>
                            {participants.map((p, i) => (
                                <View key={i} style={[styles.miniAvatarContainer, { marginLeft: i === 0 ? 0 : -10, zIndex: 10 - i }]}>
                                    <Avatar
                                        uri={p?.avatar_url}
                                        name={p?.full_name || 'User'}
                                        size={36}
                                    />
                                </View>
                            ))}
                            {/* Show "Spots Left" text if we have capacity, else show joined count */}
                            <View style={[styles.miniAvatarContainer, { marginLeft: participants.length > 0 ? -10 : 0, backgroundColor: '#333', width: 'auto', paddingHorizontal: 10, zIndex: 0 }]}>
                                <Text style={{ color: '#FFF', fontSize: 10, fontWeight: 'bold' }}>
                                    {spotsLeft !== null && spotsLeft > 0
                                        ? `${spotsLeft} Left`
                                        : approvedCount > 0 ? `${approvedCount > 4 ? '+' + (approvedCount - 3) : ''} Joined` : 'Be the first!'}
                                </Text>
                            </View>
                        </View>

                        {/* Join Button */}
                        {/* Join Button */}
                        <TouchableOpacity
                            style={[
                                styles.joinButton,
                                userStatus === 'pending' && { backgroundColor: '#FFBB33' },
                                userStatus === 'approved' && { backgroundColor: '#00C851' },
                                userStatus === 'rejected' && { backgroundColor: '#FF4444' }
                            ]}
                            onPress={handlePress}
                        >
                            <Text style={styles.joinButtonText}>
                                {userStatus === 'pending' ? 'Pending' :
                                    userStatus === 'approved' ? 'Joined' :
                                        userStatus === 'rejected' ? 'Rejected' :
                                            spotsLeft === 0 ? 'Sold Out' :
                                                (activity.ticket_type === 'Free' ? 'Join' : `₹${activity.price}`)}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            <CustomActionSheet
                visible={menuVisible}
                onClose={() => setMenuVisible(false)}
                options={menuOptions}
                title="Event Options"
            />

            {/* CONFIRM DELETE SHEET */}
            <CustomActionSheet
                visible={deleteConfirmVisible}
                onClose={() => setDeleteConfirmVisible(false)}
                options={deleteOptions}
                title="Are you sure you want to delete this event?"
            />

            <ReportModal
                visible={reportModalVisible}
                onClose={() => setReportModalVisible(false)}
                // onSubmit={handleReport} // Removed
                targetType="activity"
                targetId={activity.id}
            />

            <CustomToast
                visible={toast.visible}
                message={toast.message}
                type={toast.type}
                onHide={() => setToast(prev => ({ ...prev, visible: false }))}
            />
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    cardContainer: {
        width: width - 16, // Near full width
        height: 450,
        alignSelf: 'center',
        borderRadius: 16,
        marginBottom: 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 12,
        borderWidth: 0.5,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    cardImage: {
        flex: 1,
        justifyContent: 'space-between', // Push Header up, Content down
        padding: 20,
    },
    gradientOverlay: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 16,
    },

    // Header
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 10,
    },
    organizerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    avatarContainer: {
        // Removed border ring
        borderRadius: 50,
    },
    avatarImg: {
        width: 36, height: 36,
        borderRadius: 20,
    },
    organizerName: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 16,
    },
    postedTime: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 12,
    },
    menuButton: {
        width: 40, height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center', alignItems: 'center',
        // backdropFilter removed
    },

    // Content
    contentContainer: {
        gap: 8,
    },
    title: {
        color: '#FFF',
        fontSize: 34,
        fontWeight: '800', // Extra Bold
        lineHeight: 40,
        marginBottom: 4,
    },
    pillRow: {
        flexDirection: 'row',
        marginBottom: 4,
    },
    datePill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(6, 182, 212, 0.25)', // Cyan tint
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(34, 211, 238, 0.3)',
    },
    dateText: {
        color: '#22d3ee', // Cyan Text
        fontWeight: '600',
        fontSize: 14,
    },
    locationPill: {
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 12,
        marginBottom: 8,
    },
    locationText: {
        color: '#e2e8f0',
        fontSize: 14,
        fontWeight: '500',
    },
    description: {
        color: '#94a3b8',
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 16,
    },

    // Footer
    footerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    attendeeStack: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    miniAvatarContainer: {
        width: 36, height: 36,
        borderRadius: 18,
        borderWidth: 2,
        borderColor: '#000', // Match bg
        justifyContent: 'center', alignItems: 'center',
        overflow: 'hidden',
    },
    miniAvatar: {
        width: '100%', height: '100%',
    },
    joinButton: {
        backgroundColor: '#22d3ee', // Cyan 400
        paddingVertical: 12,
        paddingHorizontal: 32,
        borderRadius: 24,
    },
    joinButtonText: {
        color: '#0f172a', // Dark Slate
        fontWeight: 'bold',
        fontSize: 16,
    }
});
