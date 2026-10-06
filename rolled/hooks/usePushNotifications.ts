import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Linking, Platform } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: false, // Tray only, no banner
        shouldPlaySound: false, // Silent in foreground
        shouldSetBadge: true,
        shouldShowBanner: false,
        shouldShowList: true,
    }),
});

export function usePushNotifications() {
    const { user } = useAuth();
    const [expoPushToken, setExpoPushToken] = useState<string | undefined | null>(undefined);
    const [notification, setNotification] = useState<Notifications.Notification | undefined>(undefined);
    const notificationListener = useRef<Notifications.Subscription | undefined>(undefined);
    const responseListener = useRef<Notifications.Subscription | undefined>(undefined);

    // State for tracking if we've already saved to avoid spamming the DB on every render
    const [isTokenSaved, setIsTokenSaved] = useState(false);

    // 1. Initial Setup & Token Generation (Runs Once)
    useEffect(() => {
        let isMounted = true;

        // console.log('🔔 [Push Notifications] Starting registration flow...');
        registerForPushNotificationsAsync().then(token => {
            if (isMounted && token) {
                // console.log('🔔 [Push Notifications] Token acquired:', token);
                setExpoPushToken(token);
                // We do NOT save here. We wait for the second effect.
            }
        });

        // console.log("OTA Logic Patch Loaded"); 

        // 3. Listener for Incoming Notifications (In App)
        notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
            setNotification(notification);
        });

        // 4. Listener for USER INTERACTION (Tapping the notification)
        responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
            handleNotificationResponse(response);
        });

        // 5. Cold Start - Also use Linking
        Notifications.getLastNotificationResponseAsync().then(response => {
            handleNotificationResponse(response);
        });

        return () => {
            isMounted = false;
            notificationListener.current && notificationListener.current.remove();
            responseListener.current && responseListener.current.remove();
        };
    }, []); // Only run on mount!

    const handleNotificationResponse = (response: Notifications.NotificationResponse | null | undefined) => {
        if (!response) return;
        const data = response.notification.request.content.data;

        const type = data?.type;
        const resourceId = data?.resource_id || data?.related_entity_id || data?.entity_id;
        const actorId = data?.actor_id;


        if (!type) {
            if (data?.url) {
                const urlString = String(data.url);
                let path = urlString.startsWith('/') ? urlString.slice(1) : urlString;
                if (path.startsWith('chat/')) path = path.replace('chat/', 'messages/');

                const fullUrl = `rolled://${path}`;
                Linking.openURL(fullUrl).catch(err => {
                    router.push('/(tabs)/feed');
                });
            }
            return;
        }

        // --- SPECIFIC ROUTING LOGIC ---

        // 1. MESSAGES
        if (type === 'message') {
            if (resourceId) {
                router.push(`/messages/${resourceId}`);
            } else {
                router.push('/(tabs)/messages');
            }
            return;
        }

        // 2. ACTIVITY REQUEST (Organizer View) -> Go to Notifications Feed
        if (type === 'activity_request') {
            router.push('/notifications');
            return;
        }

        // 3. ACTIVITY DECISIONS & NEW ACTIVITIES (User View) -> Go to Activity Details
        if (
            type === 'activity_approved' ||
            type === 'activity_rejected' ||
            type === 'activity_invite' ||
            type === 'activity_updated' ||
            type === 'new_activity' ||
            type === 'activity_post'
        ) {
            if (resourceId) {
                router.push(`/activity/${resourceId}`);
            } else {
                router.push('/(tabs)/activities');
            }
            return;
        }

        // 4. SOCIAL FEED (Likes, Replies, Mentions)
        // Note: All social notifications are for regular posts only (anon posts don't get notifications by design)
        if (type === 'like' || type === 'reply' || type === 'mention' || type === 'new_post') {
            if (resourceId) {
                router.push(`/post/${resourceId}`);
            } else {
                router.push('/(tabs)/feed');
            }
            return;
        }

        // 5. FOLLOW
        if (type === 'follow' || type === 'follow_request') {
            if (actorId) {
                router.push(`/user/${actorId}`);
            } else {
                router.push('/(tabs)/profile');
            }
            return;
        }

        // Default Fallback
        router.push('/notifications');
    };

    // 2. Token Saving Logic (Runs when User OR Token changes)
    useEffect(() => {
        if (user && expoPushToken && !isTokenSaved) {
            // console.log('🔔 [Push Notifications] Both User and Token present. Saving...');
            saveTokenToDatabase(expoPushToken, user.id);
            setIsTokenSaved(true);
        } else {
            // console.log('Waiting for requirements...');
        }
    }, [user, expoPushToken]);

    const saveTokenToDatabase = async (token: string, userId: string) => {
        // console.log('🔔 [Push Notifications] ATTENTION: Using RPC to save token');

        // METHOD 1: Try RPC (Sledgehammer)
        const { error: rpcError } = await supabase.rpc('update_my_push_token', { token: token });

        if (rpcError) {
            // console.error("🔔 [Push Notifications] RPC Failed:", rpcError);

            // METHOD 2: Fallback to Direct Update
            const { error } = await supabase.from('profiles').update({ push_token: token }).eq('id', userId);
            if (error) {
                // console.error("🔔 [Push Notifications] Direct Update also failed:", error);
            } else {
                // console.log('🔔 [Push Notifications] Direct Update Success!');
            }
        } else {
            // console.log('🔔 [Push Notifications] RPC Success! Token saved.');
        }
    };

    return { expoPushToken, notification };
}

async function registerForPushNotificationsAsync() {
    let token;

    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
        });
    }

    if (Device.isDevice) {

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            console.log('Failed to get push token for push notification!');
            return;
        }

        try {
            const projectId = Constants?.expoConfig?.extra?.eas?.projectId || Constants?.easConfig?.projectId;
            if (!projectId) {
                console.warn('Project ID not found. Skipping push token registration (Dev Mode).');
                return null;
            }

            token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
        } catch (e: any) {
            console.error("Error getting push token:", e);
        }
    } else {
        console.log('Must use physical device for Push Notifications');
    }

    return token;
}
