import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, FlatList, Image, Linking, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '../../components/Avatar';
import { UserBadges } from '../../components/UserBadges';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../lib/supabase';

export default function ActivityDetailScreen() {
    const { colors, theme } = useTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const { user } = useAuth();

    const { width: windowWidth, height } = useWindowDimensions();
    const width = windowWidth;

    // Parse params back to object (some might be strings if passed via URL)
    const activityParams = params;
    // Sanitize ID (remove req- or org- prefixes if coming from profile)
    const rawId = getString(activityParams.id);
    const activityId = rawId ? rawId.replace(/^(req-|org-)/, '') : null;

    // Helpers
    function getString(val: string | string[] | undefined) {
        if (!val) return null;
        return Array.isArray(val) ? val[0] : val;
    }

    const [activity, setActivity] = useState<any>(activityParams);
    const [spotsLeft, setSpotsLeft] = useState<number | null>(null); // Null means unlimited or loading
    const [participants, setParticipants] = useState<any[]>([]);
    const [userStatus, setUserStatus] = useState<'none' | 'pending' | 'approved' | 'rejected' | 'organizer'>((getString(params.initialStatus) as any) || 'none');
    const [reconfirmNeeded, setReconfirmNeeded] = useState(false);
    const [loadingAction, setLoadingAction] = useState(false);

    const [guestsModalVisible, setGuestsModalVisible] = useState(false);
    const [fullScreenImageIndex, setFullScreenImageIndex] = useState<number | null>(null);
    const [allGuests, setAllGuests] = useState<any[]>([]);
    const [loadingGuests, setLoadingGuests] = useState(false);
    const [isLiked, setIsLiked] = useState(false); // [NEW]

    const toggleLike = async () => {
        if (!user) {
            Alert.alert("Login Required", "You must be logged in to like events.");
            return;
        }

        // Optimistic
        setIsLiked((prev) => !prev);

        try {
            if (isLiked) {
                // Unlike
                const { error } = await supabase
                    .from('activity_likes')
                    .delete()
                    .eq('activity_id', activityId)
                    .eq('user_id', user.id);
                if (error) throw error;
            } else {
                // Like
                const { error } = await supabase
                    .from('activity_likes')
                    .insert({ activity_id: activityId, user_id: user.id });
                if (error) throw error;
            }
        } catch (error) {
            console.error(error);
            setIsLiked((prev) => !prev); // Revert
        }
    };

    // ... (rest of component)


    // Derived values
    const category = getString(activity?.category) || 'EVENT';
    const externalLink = getString(activity?.external_link);
    const images = [activity?.cover_image, ...(Array.isArray(activity?.additional_images) ? activity.additional_images : [])].filter(Boolean);
    const organizerName = activity?.organizer?.full_name || activity?.organizer?.username || activity?.organizer_name || 'Anonymous';
    const organizerAvatar = activity?.organizer?.avatar_url || activity?.organizer_avatar;
    const capacity = activity?.capacity ? parseInt(activity.capacity) : null;

    const [activeSlide, setActiveSlide] = useState(0);

    // Use Focus Effect to ensure data is fresh when navigating back
    useFocusEffect(
        React.useCallback(() => {
            if (activityId) {
                fetchRealTimeData();
                const sub = subscribeToChanges();
                return () => sub(); // Unsubscribe on blur/unmount logic handled by helper but good to be explicit
            }
        }, [activityId, user])
    );

    const fetchRealTimeData = async () => {
        try {
            // 0. Fetch Full Activity Details (including Organizer)
            const { data: actData, error: actError } = await supabase
                .from('activities')
                .select('*, organizer:organizer_id(*)')
                .eq('id', activityId)
                .single();

            if (actError) {
                console.log("Error fetching activity details:", actError);
                if (actError.code === 'PGRST116') {
                    setActivity(null); // Signal deletion
                    return;
                }
            }
            if (actData) {
                // Merge fetched data with params, favoring fetched data
                setActivity((prev: any) => ({ ...prev, ...actData }));
            } else if (!activity?.title && !actData) {
                // If we have no title (just ID param) and no data, it's gone
                setActivity(null);
                return;
            }

            // 1. Fetch Approved Requests (Participants)
            const { data: approvedReqs, error: partError } = await supabase
                .from('activity_requests')
                .select('user_id, profiles:user_id(avatar_url)')
                .eq('activity_id', activityId)
                .eq('status', 'approved');

            if (partError && partError.code !== 'PGRST116') console.log("Part error:", partError);

            const approvedCount = approvedReqs?.length || 0;
            const fetchedParticipants = approvedReqs?.map((r: any) => r.profiles) || [];
            setParticipants(fetchedParticipants);

            // 2. Check User Status
            if (user) {
                const { data: likeData } = await supabase
                    .from('activity_likes')
                    .select('activity_id')
                    .eq('activity_id', activityId)
                    .eq('user_id', user.id)
                    .maybeSingle();

                setIsLiked(!!likeData);
            }

            // 2. Calculate Spot Left
            const cap = actData?.capacity ? parseInt(actData.capacity) : capacity;
            if (cap !== null && cap !== undefined && !isNaN(cap)) {
                setSpotsLeft(Math.max(0, cap - approvedCount));
            } else {
                setSpotsLeft(null); // Unlimited
            }

            // 3. Check User Status
            if (user) {
                // Check if user is organizer
                // Safety check: actData might specific organizer_id
                const orgId = actData?.organizer_id || activity?.organizer_id;
                if (user.id === orgId) {
                    setUserStatus('organizer');
                    return;
                }

                const { data: myReq, error: myReqError } = await supabase
                    .from('activity_requests')
                    .select('status, reconfirm_needed')
                    .eq('activity_id', activityId)
                    .eq('user_id', user.id)
                    .maybeSingle(); // Use maybeSingle to avoid 406 error logs for "no row"

                if (myReq) {
                    setUserStatus(myReq.status);
                    setReconfirmNeeded(myReq.reconfirm_needed);
                } else {
                    setUserStatus('none');
                    setReconfirmNeeded(false);
                }
            }

        } catch (error) {
            console.error("Error fetching activity data:", error);
        }
    };

    const subscribeToChanges = () => {
        const subscription = supabase
            .channel(`activity_room:${activityId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'activity_requests', filter: `activity_id=eq.${activityId}` },
                (payload) => {
                    // Simple approach: Refetch all on any change. 
                    // Optimized app would update state locally.
                    console.log('Real-time change received!', payload);
                    fetchRealTimeData();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    };

    const handleBookSpot = async () => {
        if (!user) {
            Alert.alert("Login Required", "You need to log in to join events.");
            return;
        }

        // Organizer Check
        if (activity.organizer_id === user.id) {
            setGuestsModalVisible(true);
            return;
        }

        // Double check status before sending
        if (userStatus === 'pending') {
            Alert.alert("Request Pending", "Waiting for the organizer to approve.");
            return;
        }
        if (userStatus === 'approved') {
            Alert.alert("Already Joined", "You are already on the guest list!");
            return;
        }
        if (userStatus === 'rejected') {
            Alert.alert("Request Denied", "Your request to join this event was denied.");
            return;
        }

        setLoadingAction(true);
        try {
            const { error } = await supabase.from('activity_requests').insert({
                activity_id: activityId,
                user_id: user.id
            });

            if (error) throw error;

            setUserStatus('pending'); // Optimistic update
            Alert.alert("Request Sent", "The organizer has been notified!");
        } catch (error: any) {
            // Handle Duplicate Key Error (Code 23505)
            if (error.code === '23505' || error.message?.includes('duplicate key')) {
                // If it's a duplicate, it means we ARE pending or approved (or rejected).
                // We'll optimistically set it to pending and let the user know.
                // Or ideally fetch the actual status, but pending is safe fallback.
                setUserStatus('pending');
                Alert.alert("Status Updated", "You already have a request for this event.");
            } else {
                Alert.alert("Error", error.message || "Failed to book spot.");
            }
        } finally {
            setLoadingAction(false);
        }
    };


    const onScroll = (event: any) => {
        const slide = Math.ceil(event.nativeEvent.contentOffset.x / event.nativeEvent.layoutMeasurement.width);
        if (slide !== activeSlide) setActiveSlide(slide);
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    };

    // UI HELPER: Get Button Config
    const getButtonConfig = () => {
        if (loadingAction) return { text: "Processing...", color: '#666', icon: "loading" };

        // [FIX] Immediate check to prevent flicker
        // If we have the user and they match the organizer_id (even before async status update), show Manage
        if (user && activity?.organizer_id === user.id) {
            return { text: "Manage Event", color: '#333', icon: "cog-outline" };
        }

        switch (userStatus) {
            case 'organizer': return { text: "Manage Event", color: '#333', icon: "cog-outline" };
            case 'approved': return { text: "Joined", color: '#00C851', icon: "check-circle-outline" };
            case 'pending': return { text: "Pending Approval", color: '#FFBB33', icon: "clock-outline", disabled: true };
            case 'rejected': return { text: "Rejected", color: '#FF4444', icon: "close-circle-outline" };
            default:
                // Check if full
                if (spotsLeft === 0) return { text: "Sold Out", color: '#666', icon: "close-circle-outline", disabled: true };
                return { text: "Book Spot", color: '#22d3ee', icon: "ticket-confirmation-outline" };
        }
    };

    const btnConfig = getButtonConfig();

    const fetchAllGuests = async () => {
        setLoadingGuests(true);
        try {
            const { data, error } = await supabase
                .from('activity_requests')
                .select('user_id, status, created_at, profiles:user_id(*)')
                .eq('activity_id', activityId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setAllGuests(data || []);
        } catch (e) {
            console.error(e);
            Alert.alert("Error", "Could not fetch guest list.");
        } finally {
            setLoadingGuests(false);
        }
    };

    const handleGuestAction = async (guestId: string, action: 'approved' | 'rejected') => {
        try {
            const { error } = await supabase
                .from('activity_requests')
                .update({ status: action })
                .eq('activity_id', activityId)
                .eq('user_id', guestId);

            if (error) throw error;

            // Update local state
            setAllGuests(prev => prev.map(g => g.user_id === guestId ? { ...g, status: action } : g));
            fetchRealTimeData(); // Update spot counts
            Alert.alert("Success", `User ${action}.`);
        } catch (e) {
            Alert.alert("Error", "Action failed.");
        }
    };

    useEffect(() => {
        if (guestsModalVisible) {
            fetchAllGuests();
        }
    }, [guestsModalVisible]);

    return (
        <View style={{ flex: 1, backgroundColor: '#000' }}>
            <StatusBar style="light" />

            {!activity ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 20 }}>
                    <MaterialCommunityIcons name="calendar-remove" size={60} color="#666" />
                    <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>This event is deleted.</Text>
                    <TouchableOpacity onPress={() => router.back()} style={{ backgroundColor: '#222', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 }}>
                        <Text style={{ color: '#fff' }}>Go Back</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <>
                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
                        {/* HERO CAROUSEL */}
                        <View style={{ height: height * 0.5 }}>
                            <ScrollView
                                horizontal
                                pagingEnabled
                                showsHorizontalScrollIndicator={false}
                                onScroll={onScroll}
                                scrollEventThrottle={16}
                            >
                                {images.map((img, index) => (
                                    <TouchableOpacity key={index} activeOpacity={0.9} onPress={() => setFullScreenImageIndex(index)}>
                                        <View style={{ width, height: height * 0.5, backgroundColor: '#000' }}>
                                            {/* Layer 1: Blurred BG */}
                                            <Image
                                                source={{ uri: img as string }}
                                                style={[StyleSheet.absoluteFill]}
                                                blurRadius={30}
                                                resizeMode="cover"
                                            />
                                            {/* Layer 2: Contained Main Image */}
                                            <Image
                                                source={{ uri: img as string }}
                                                style={[StyleSheet.absoluteFill]}
                                                resizeMode="contain"
                                            />
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            {/* Carousel Dots */}
                            {images.length > 1 && (
                                <View style={styles.pagination}>
                                    {images.map((_, i) => (
                                        <View key={i} style={[styles.dot, { backgroundColor: i === activeSlide ? '#22d3ee' : 'rgba(255,255,255,0.5)' }]} />
                                    ))}
                                </View>
                            )}

                            {/* Header Overlay (Back, Share, Heart) */}
                            <LinearGradient
                                colors={['rgba(0,0,0,0.6)', 'transparent']}
                                style={[styles.headerGradient, { paddingTop: insets.top }]}
                            >
                                <View style={styles.topBar}>
                                    <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
                                        <Ionicons name="chevron-back" size={24} color="#FFF" />
                                    </TouchableOpacity>
                                    <View style={{ flexDirection: 'row', gap: 12 }}>
                                        {userStatus === 'organizer' && (
                                            <TouchableOpacity style={styles.iconBtn} onPress={() => router.push(`/activity/edit/${activityId}`)}>
                                                <Feather name="edit-2" size={20} color="#FFF" />
                                            </TouchableOpacity>
                                        )}
                                        <TouchableOpacity style={styles.iconBtn} onPress={toggleLike}>
                                            <Ionicons name={isLiked ? "heart" : "heart-outline"} size={24} color={isLiked ? "#FF4500" : "#FFF"} />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* Organizer Info Overlay */}
                                <TouchableOpacity style={styles.organizerOverlay} onPress={() => router.push(`/user/${activity.organizer_id}`)}>
                                    <Avatar
                                        uri={organizerAvatar}
                                        name={organizerName}
                                        size={50}
                                        style={styles.orgAvatar}
                                    />
                                    <View>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                            <Text style={styles.orgName}>{organizerName}</Text>
                                            <UserBadges user={activity.organizer} size={14} />
                                        </View>
                                        <Text style={styles.orgLabel}>ORGANIZER</Text>
                                    </View>
                                </TouchableOpacity>
                            </LinearGradient>
                        </View>

                        {/* CONTENT BODY */}
                        <View style={styles.body}>
                            {/* Category Pill */}
                            <View style={styles.categoryPill}>
                                <Text style={styles.categoryText}>{category.toUpperCase()}</Text>
                            </View>

                            <Text style={styles.title}>{activity.title}</Text>

                            <View style={styles.subtitleContainer}>
                                <View style={styles.verticalLine} />
                                <Text style={styles.subtitle}>
                                    {activity.short_description || "A 24-hour marathon to build the future."}
                                </Text>
                            </View>

                            {/* INFO BLOCKS */}
                            <View style={styles.cardsContainer}>
                                {/* Date */}
                                <View style={styles.infoBlock}>
                                    <View style={styles.blockHeader}>
                                        <Ionicons name="calendar-outline" size={20} color="#22d3ee" />
                                        <Text style={styles.blockLabel}>DATE</Text>
                                    </View>
                                    <Text style={styles.blockValue}>{formatDate(activity.start_time as string)}</Text>
                                </View>

                                {/* Time */}
                                <View style={styles.infoBlock}>
                                    <View style={styles.blockHeader}>
                                        <Ionicons name="time-outline" size={20} color="#22d3ee" />
                                        <Text style={styles.blockLabel}>TIME</Text>
                                    </View>
                                    <Text style={styles.blockValue}>{formatTime(activity.start_time as string)}</Text>
                                </View>

                                {/* Location */}
                                <View style={styles.infoBlock}>
                                    <View style={styles.blockHeader}>
                                        <Ionicons name="location-outline" size={20} color="#22d3ee" />
                                        <Text style={styles.blockLabel}>LOCATION</Text>
                                        <View style={{ flex: 1 }} />
                                        <Ionicons name="arrow-forward" size={20} color="#666" />
                                    </View>
                                    <Text style={styles.blockValue}>{activity.location || 'TBA'}</Text>
                                </View>

                                {/* Link */}
                                {externalLink ? (
                                    <TouchableOpacity
                                        onPress={() => {
                                            let url = externalLink;
                                            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                                                url = 'https://' + url;
                                            }
                                            Linking.openURL(url).catch(err => console.error("Couldn't load page", err));
                                        }}
                                        style={styles.infoBlock}
                                    >
                                        <View style={styles.blockHeader}>
                                            <Ionicons name="link-outline" size={20} color="#22d3ee" />
                                            <Text style={styles.blockLabel}>OFFICIAL LINK</Text>
                                        </View>
                                        <Text style={[styles.blockValue, { color: '#22d3ee' }]} numberOfLines={1}>
                                            {externalLink.replace(/^https?:\/\//, '')}
                                        </Text>
                                    </TouchableOpacity>
                                ) : null}
                            </View>

                            {/* EVENT DETAILS */}
                            <Text style={styles.sectionTitle}>EVENT DETAILS</Text>
                            <View style={styles.divider} />
                            <Text style={styles.description}>
                                {activity.full_details || activity.short_description}
                            </Text>

                            {/* SPOTS REMAINING CARD - REAL TIME */}
                            <View style={styles.spotsCard}>
                                <View style={{ marginBottom: 16 }}>
                                    <Text style={styles.spotsCount}>
                                        {spotsLeft === null ? '∞' : spotsLeft}
                                    </Text>
                                    <Text style={styles.spotsLabel}>
                                        {spotsLeft === null ? 'UNLIMITED SPOTS' : 'SPOTS REMAINING'}
                                    </Text>
                                </View>

                                {/* Progress Bar (Only if limited) */}
                                {spotsLeft !== null && capacity ? (
                                    <View style={styles.progressBarBg}>
                                        <View style={[styles.progressBarFill, {
                                            width: `${Math.min(100, ((capacity - spotsLeft) / capacity) * 100)}%`
                                        }]} />
                                    </View>
                                ) : null}

                                {/* Attendees List */}
                                {participants.length > 0 ? (
                                    <View style={styles.avatarsRow}>
                                        {participants.slice(0, 5).map((p, i) => (
                                            <View key={i} style={[styles.miniAvatarContainer, { marginLeft: i > 0 ? -10 : 0, zIndex: 10 - i }]}>
                                                {p.avatar_url ? (
                                                    <Image source={{ uri: p.avatar_url }} style={styles.miniAvatar} />
                                                ) : (
                                                    <View style={[styles.miniAvatar, { backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' }]}>
                                                        <Ionicons name="person" size={12} color="#666" />
                                                    </View>
                                                )}
                                            </View>
                                        ))}
                                        {participants.length > 5 && (
                                            <View style={[styles.miniAvatarContainer, { marginLeft: -10, backgroundColor: '#22d3ee', zIndex: 0 }]}>
                                                <Text style={{ fontSize: 10, fontWeight: 'bold' }}>+{participants.length - 5}</Text>
                                            </View>
                                        )}
                                    </View>
                                ) : (
                                    <Text style={{ color: '#666', fontSize: 12, fontStyle: 'italic' }}>Be the first to join!</Text>
                                )}
                            </View>

                            <View style={{ height: 120 }} />
                        </View>
                    </ScrollView>

                    {/* RECONFIRMATION BANNER */}
                    {reconfirmNeeded && (
                        <View style={styles.reconfirmSticky}>
                            <Text style={styles.reconfirmText}>The event time has changed. Do you still want to go?</Text>
                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <TouchableOpacity
                                    style={[styles.reconfirmBtn, { backgroundColor: '#00C851' }]}
                                    onPress={async () => {
                                        try {
                                            const { error } = await supabase.from('activity_requests').update({ reconfirm_needed: false }).eq('activity_id', activityId).eq('user_id', user?.id);
                                            if (error) throw error;
                                            setReconfirmNeeded(false);
                                            Alert.alert("Confirmed", "You are all set!");
                                        } catch (e) { Alert.alert("Error", "Action failed"); }
                                    }}
                                >
                                    <MaterialCommunityIcons name="check" size={20} color="#FFF" />
                                    <Text style={styles.reconfirmBtnText}>Yes</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.reconfirmBtn, { backgroundColor: '#FF4444' }]}
                                    onPress={async () => {
                                        Alert.alert("Cancel Attendance", "Are you sure?", [
                                            { text: "No", style: "cancel" },
                                            {
                                                text: "Yes, Leave", style: 'destructive', onPress: async () => {
                                                    // Delete or Reject? User said "check or cross". Cross usually means leave.
                                                    await supabase.from('activity_requests').delete().eq('activity_id', activityId).eq('user_id', user?.id);
                                                    setUserStatus('none');
                                                    setReconfirmNeeded(false);
                                                    fetchRealTimeData();
                                                }
                                            }
                                        ])
                                    }}
                                >
                                    <MaterialCommunityIcons name="close" size={20} color="#FFF" />
                                    <Text style={styles.reconfirmBtnText}>No</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {/* FLOATING FOOTER */}
                    <View style={[styles.floatingFooter, { bottom: insets.bottom + 10 }]}>
                        <View style={{ paddingLeft: 20 }}>
                            <Text style={styles.footerLabel}>ENTRY FEE</Text>
                            <Text style={styles.footerPrice}>
                                {(activity.ticket_type === 'Free' || !activity.price) ? 'Free' : `₹${activity.price}`}
                            </Text>
                        </View>
                        <TouchableOpacity
                            style={[styles.floatingBookBtn, { backgroundColor: btnConfig.color, opacity: btnConfig.disabled ? 0.6 : 1 }]}
                            onPress={handleBookSpot}
                            disabled={btnConfig.disabled || loadingAction || userStatus === 'rejected'}
                        >
                            <Text style={[styles.floatingBookText, { color: (userStatus === 'approved' || userStatus === 'rejected' || userStatus === 'organizer') ? '#FFF' : '#000' }]}>
                                {btnConfig.text}
                            </Text>
                            {btnConfig.icon === 'loading' ? (
                                <ActivityIndicator color="#000" size="small" />
                            ) : (
                                <MaterialCommunityIcons name={btnConfig.icon as any} size={20} color={(userStatus === 'approved' || userStatus === 'rejected' || userStatus === 'organizer') ? '#FFF' : '#000'} />
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* GUESTS MODAL */}
                    <Modal
                        visible={guestsModalVisible}
                        animationType="slide"
                        transparent={true}
                        onRequestClose={() => setGuestsModalVisible(false)}
                    >
                        <View style={styles.modalContainer}>
                            <View style={styles.modalContent}>
                                <View style={styles.modalHeader}>
                                    <Text style={styles.modalTitle}>Guest List ({allGuests.length})</Text>
                                    <TouchableOpacity onPress={() => setGuestsModalVisible(false)}>
                                        <Ionicons name="close-circle" size={30} color="#666" />
                                    </TouchableOpacity>
                                </View>

                                {loadingGuests ? (
                                    <ActivityIndicator color="#22d3ee" style={{ marginTop: 20 }} />
                                ) : (
                                    <FlatList
                                        data={allGuests}
                                        keyExtractor={(item) => item.user_id}
                                        showsVerticalScrollIndicator={false}
                                        renderItem={({ item }) => (
                                            <View style={styles.guestItem}>
                                                <TouchableOpacity onPress={() => {
                                                    setGuestsModalVisible(false);
                                                    router.push(`/user/${item.user_id}`);
                                                }}>
                                                    {item.profiles?.avatar_url ? (
                                                        <Image source={{ uri: item.profiles.avatar_url }} style={styles.guestAvatar} />
                                                    ) : (
                                                        <View style={[styles.guestAvatar, { backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' }]}>
                                                            <Ionicons name="person" size={20} color="#666" />
                                                        </View>
                                                    )}
                                                </TouchableOpacity>
                                                <View style={styles.guestInfo}>
                                                    <Text style={styles.guestName}>{item.profiles?.full_name || item.profiles?.username || 'User'}</Text>
                                                    <Text style={[styles.guestStatus, { color: item.status === 'approved' ? '#00C851' : item.status === 'rejected' ? '#FF4444' : '#FFBB33' }]}>
                                                        {item.status.toUpperCase()}
                                                    </Text>
                                                </View>

                                                {/* Pending Actions */}
                                                {item.status === 'pending' ? (
                                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                                        <TouchableOpacity
                                                            style={[styles.guestActionBtn, { backgroundColor: '#00C851' }]}
                                                            onPress={() => handleGuestAction(item.user_id, 'approved')}
                                                        >
                                                            <Ionicons name="checkmark" size={20} color="#FFF" />
                                                        </TouchableOpacity>
                                                        <TouchableOpacity
                                                            style={[styles.guestActionBtn, { backgroundColor: '#FF4444' }]}
                                                            onPress={() => handleGuestAction(item.user_id, 'rejected')}
                                                        >
                                                            <Ionicons name="close" size={20} color="#FFF" />
                                                        </TouchableOpacity>
                                                    </View>
                                                ) : (
                                                    <View style={{ flexDirection: 'row' }}>
                                                        {/* Message Button */}
                                                        <TouchableOpacity
                                                            style={styles.guestActionBtn}
                                                            onPress={() => {
                                                                setGuestsModalVisible(false);
                                                                router.push({
                                                                    pathname: `/messages/${item.user_id}` as any,
                                                                    params: {
                                                                        name: item.profiles?.full_name,
                                                                        username: item.profiles?.username,
                                                                        avatar_url: item.profiles?.avatar_url
                                                                    }
                                                                });
                                                            }}
                                                        >
                                                            <MaterialCommunityIcons name="message-text-outline" size={20} color="#FFF" />
                                                        </TouchableOpacity>

                                                        {/* Profile Button */}
                                                        <TouchableOpacity
                                                            style={styles.guestActionBtn}
                                                            onPress={() => {
                                                                setGuestsModalVisible(false);
                                                                router.push(`/user/${item.user_id}`);
                                                            }}
                                                        >
                                                            <Ionicons name="person-outline" size={20} color="#FFF" />
                                                        </TouchableOpacity>
                                                    </View>
                                                )}
                                            </View>
                                        )}
                                        ListEmptyComponent={
                                            <Text style={{ color: '#666', textAlign: 'center', marginTop: 20 }}>No interactions yet.</Text>
                                        }
                                    />
                                )}
                            </View>
                        </View>
                    </Modal>

                    {/* FULLSCREEN IMAGE MODAL */}
                    {/* FULLSCREEN IMAGE MODAL (SWIPEABLE) */}
                    <Modal
                        visible={fullScreenImageIndex !== null}
                        transparent={true}
                        statusBarTranslucent={true}
                        animationType="fade"
                        onRequestClose={() => setFullScreenImageIndex(null)}
                    >
                        <View style={{ width: width, height: height, backgroundColor: '#000' }}>
                            <StatusBar hidden />

                            {/* Close Button */}
                            <TouchableOpacity
                                style={{ position: 'absolute', top: 50, right: 20, zIndex: 20, padding: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 30 }}
                                onPress={() => setFullScreenImageIndex(null)}
                            >
                                <Ionicons name="close" size={30} color="#FFF" />
                            </TouchableOpacity>

                            {/* Image Counter */}
                            <View style={{ position: 'absolute', top: 60, alignSelf: 'center', zIndex: 10, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 15, paddingVertical: 5, borderRadius: 15 }}>
                                <Text style={{ color: '#FFF', fontWeight: 'bold' }}>
                                    {(fullScreenImageIndex !== null ? fullScreenImageIndex + 1 : 1)} / {images.length}
                                </Text>
                            </View>

                            {fullScreenImageIndex !== null && (
                                <FlatList
                                    data={images}
                                    keyExtractor={(_, i) => i.toString()}
                                    horizontal
                                    pagingEnabled
                                    showsHorizontalScrollIndicator={false}
                                    initialScrollIndex={fullScreenImageIndex}
                                    onMomentumScrollEnd={(ev) => {
                                        const newIndex = Math.round(ev.nativeEvent.contentOffset.x / width);
                                        setFullScreenImageIndex(newIndex);
                                    }}
                                    getItemLayout={(_, index) => ({
                                        length: width,
                                        offset: width * index,
                                        index,
                                    })}
                                    renderItem={({ item }) => (
                                        <View style={{ width: width, height: height, justifyContent: 'center', alignItems: 'center' }}>
                                            <Image
                                                source={{ uri: item as string }}
                                                style={{ width: width, height: height, resizeMode: 'contain' }}
                                            />
                                        </View>
                                    )}
                                />
                            )}
                        </View>
                    </Modal>
                </>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    pagination: {
        position: 'absolute',
        bottom: 20,
        alignSelf: 'center',
        flexDirection: 'row',
        gap: 8
    },
    dot: {
        width: 8, height: 8, borderRadius: 4,
    },
    headerGradient: {
        position: 'absolute',
        top: 0, left: 0, right: 0,
        height: 150,
        paddingHorizontal: 20,
    },
    topBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 10,
    },
    iconBtn: {
        width: 44, height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center', alignItems: 'center',
        backdropFilter: 'blur(10px)',
    },
    organizerOverlay: {
        position: 'absolute',
        bottom: 30, left: 20, // Moved from Top to Bottom-Left
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        zIndex: 5,
    },
    orgAvatar: {
        width: 40, height: 40,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: '#22d3ee',
    },
    orgName: {
        color: '#FFF', fontWeight: 'bold', fontSize: 16,
    },
    orgLabel: {
        color: '#22d3ee', fontSize: 10, fontWeight: 'bold', letterSpacing: 1,
    },
    body: {
        backgroundColor: '#000',
        paddingHorizontal: 20,
        paddingTop: 24,
        marginTop: -30,
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
    },
    // GUEST MODAL STYLES
    modalContainer: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#1e1e1e',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        height: '80%',
        padding: 20
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: 'bold',
    },
    guestItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        backgroundColor: '#252525',
        padding: 12,
        borderRadius: 16,
    },
    guestAvatar: {
        width: 44, height: 44, borderRadius: 22, marginRight: 12,
    },
    guestInfo: {
        flex: 1,
    },
    guestName: {
        color: '#FFF', fontWeight: 'bold', fontSize: 16,
    },
    guestStatus: {
        fontSize: 12, fontWeight: '500', marginTop: 2
    },
    guestActionBtn: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: '#333',
        justifyContent: 'center', alignItems: 'center',
        marginLeft: 8
    },
    categoryPill: {
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(34, 211, 238, 0.15)',
        paddingVertical: 6,
        paddingHorizontal: 16,
        borderRadius: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(34, 211, 238, 0.3)',
    },
    categoryText: {
        color: '#22d3ee',
        fontSize: 10,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    title: {
        color: '#FFF',
        fontSize: 32,
        fontWeight: 'bold',
        marginBottom: 16,
    },
    subtitleContainer: {
        flexDirection: 'row',
        marginBottom: 30,
        gap: 12,
    },
    verticalLine: {
        width: 3,
        backgroundColor: '#22d3ee',
        borderRadius: 2,
    },
    subtitle: {
        color: '#94a3b8',
        fontSize: 16,
        lineHeight: 24,
        flex: 1,
    },
    cardsContainer: {
        gap: 12,
        marginBottom: 30,
    },
    infoBlock: {
        backgroundColor: '#111',
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: '#222',
        gap: 12,
    },
    blockHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    blockLabel: {
        color: '#666',
        fontSize: 11,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    blockValue: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
        marginLeft: 30, // Align with text start not icon
    },
    sectionTitle: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: 'bold',
        letterSpacing: 1,
        marginBottom: 12,
        marginTop: 10,
    },
    divider: {
        height: 1,
        backgroundColor: '#222',
        marginBottom: 16,
    },
    description: {
        color: '#94a3b8',
        fontSize: 16,
        lineHeight: 26,
        marginBottom: 30,
    },
    spotsCard: {
        backgroundColor: '#111',
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        borderColor: '#222',
    },
    spotsCount: {
        color: '#FFF', fontSize: 28, fontWeight: 'bold', marginBottom: 4,
    },
    spotsLabel: {
        color: '#666', fontSize: 10, fontWeight: 'bold', letterSpacing: 1,
    },
    progressBarBg: {
        height: 6,
        backgroundColor: '#222',
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: 20,
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: '#22d3ee',
        borderRadius: 3,
    },
    avatarsRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    miniAvatarContainer: {
        width: 32, height: 32, borderRadius: 16,
        borderWidth: 2, borderColor: '#111',
        overflow: 'hidden', justifyContent: 'center', alignItems: 'center',
    },
    miniAvatar: {
        width: '100%', height: '100%',
    },
    // Floating Footer
    floatingFooter: {
        position: 'absolute',
        left: 20, right: 20,
        backgroundColor: '#1e1e1e', // Dark Gray
        borderRadius: 40,
        height: 80,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 8,
        borderWidth: 1,
        borderColor: '#333',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 10,
    },
    footerLabel: {
        color: '#666', fontSize: 10, fontWeight: 'bold', letterSpacing: 1,
    },
    footerPrice: {
        color: '#FFF', fontSize: 20, fontWeight: 'bold',
    },
    floatingBookBtn: {
        backgroundColor: '#22d3ee',
        height: '100%',
        paddingHorizontal: 32,
        borderRadius: 32,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    floatingBookText: {
        color: '#000', fontSize: 16, fontWeight: 'bold',
    },
    // Reconfirm Sticky
    reconfirmSticky: {
        position: 'absolute', bottom: 120, left: 20, right: 20,
        backgroundColor: '#1E1E1E',
        borderRadius: 20,
        padding: 16,
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        borderWidth: 1, borderColor: '#FFBB33',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
        elevation: 10,
    },
    reconfirmText: {
        color: '#FFF', fontWeight: 'bold', fontSize: 14, textAlign: 'center'
    },
    reconfirmBtn: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 8, paddingHorizontal: 20,
        borderRadius: 20
    },
    reconfirmBtnText: {
        color: '#FFF', fontWeight: 'bold', marginLeft: 4
    }
});
