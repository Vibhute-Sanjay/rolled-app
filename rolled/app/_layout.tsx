
import NetInfo from '@react-native-community/netinfo';
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NetworkBanner } from '../components/NetworkBanner';
import { RealtimeManager } from '../components/RealtimeManager';
import { Colors } from '../constants/Colors';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { PresenceProvider } from '../context/PresenceContext';
import { useChatStore } from '../stores/chatStore';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

import { usePushNotifications } from '../hooks/usePushNotifications';
import {
    useFonts,
    Outfit_300Light,
    Outfit_400Regular,
    Outfit_600SemiBold,
    Outfit_900Black
} from '@expo-google-fonts/outfit';

import { FeedScrollProvider } from '../context/FeedScrollContext';

// Internal component to handle side-effects that require Context availability
function AppInit({ fontsLoaded }: { fontsLoaded: boolean }) {
    // This component is rendered INSIDE AuthProvider, so it can access useAuth() safely.
    const { isLoading, user } = useAuth();
    const fetchBlocks = useChatStore(s => s.fetchBlocks);
    usePushNotifications();

    useEffect(() => {
        if (!isLoading && fontsLoaded) {
            SplashScreen.hideAsync();
            if (user) fetchBlocks();
        }
    }, [isLoading, user, fontsLoaded]);

    // Safety fallback: Hide splash screen after 2smax if something hangs
    useEffect(() => {
        const timer = setTimeout(() => {
            SplashScreen.hideAsync();
        }, 2000);
        return () => clearTimeout(timer);
    }, []);


    return null; // Logic only, no UI
}

export default function RootLayout() {
    const [isOffline, setIsOffline] = useState(false);

    // Load Fonts
    const [fontsLoaded] = useFonts({
        Outfit_300Light,
        Outfit_400Regular,
        Outfit_600SemiBold,
        Outfit_900Black,
    });

    // Network detection
    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener(state => {
            setIsOffline(!state.isConnected);
        });

        return () => unsubscribe();
    }, []);

    const MyDarkTheme = {
        ...DarkTheme,
        colors: {
            ...DarkTheme.colors,
            background: Colors.dark.background,
            card: Colors.dark.card,
            text: Colors.dark.text,
            border: Colors.dark.border,
            primary: Colors.dark.primary,
        }
    };

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaProvider>
                <ThemeProvider value={MyDarkTheme}>
                    <AuthProvider>
                        <PresenceProvider>
                            <FeedScrollProvider>
                                <AppInit fontsLoaded={fontsLoaded} />
                                <RealtimeManager />
                                <NetworkBanner isOffline={isOffline} />
                                <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
                                    <Stack.Screen name="index" />
                                    <Stack.Screen name="(auth)" />
                                    <Stack.Screen name="(tabs)" />
                                    <Stack.Screen
                                        name="settings"
                                        options={{
                                            presentation: 'fullScreenModal',
                                            animation: 'slide_from_bottom'
                                        }}
                                    />
                                    <Stack.Screen
                                        name="edit-profile"
                                        options={{
                                            presentation: 'card',
                                            animation: 'default'
                                        }}
                                    />
                                    <Stack.Screen
                                        name="create-post"
                                        options={{
                                            presentation: 'fullScreenModal',
                                            animation: 'slide_from_bottom'
                                        }}
                                    />
                                    <Stack.Screen
                                        name="post/[id]"
                                        options={{
                                            presentation: 'fullScreenModal',
                                            headerShown: false,
                                        }}
                                    />
                                </Stack>
                                <StatusBar style="light" />
                            </FeedScrollProvider>
                        </PresenceProvider>
                    </AuthProvider>
                </ThemeProvider>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}
