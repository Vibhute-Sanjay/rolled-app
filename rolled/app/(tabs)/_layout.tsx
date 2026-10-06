
import { FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import { DeviceEventEmitter, Image, Platform, Pressable, StyleSheet, View, Dimensions } from 'react-native';
import Animated, { useAnimatedStyle, interpolate, Extrapolation } from 'react-native-reanimated';
import { Colors } from '../../constants/Colors';

import { useUnreadNotifications } from '../../hooks/useUnreadNotifications';
import { useUserStore } from '../../stores/userStore';
import { useFeedScroll } from '../../context/FeedScrollContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// @ts-ignore
import { WebSidebar } from '../../components/WebSidebar';

const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 88 : 60;

// Custom animated tab bar that slides down on scroll
function AnimatedTabBar({ state, descriptors, navigation }: any) {
    const { hasUnread } = useUnreadNotifications();
    const profile = useUserStore(s => s.profile);
    const insets = useSafeAreaInsets();
    const { tabBarTranslateY } = useFeedScroll();

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [
                {
                    translateY: interpolate(
                        tabBarTranslateY.value,
                        [0, TAB_BAR_HEIGHT],
                        [0, TAB_BAR_HEIGHT + insets.bottom + 20],
                        Extrapolation.CLAMP
                    )
                }
            ],
        };
    });

    const getIcon = (routeName: string, focused: boolean, color: string) => {
        switch (routeName) {
            case 'feed':
                return (
                    <View style={focused ? styles.activeIconFloat : undefined}>
                        <FontAwesome5 name="home" size={20} color={color} />
                    </View>
                );
            case 'search':
                return (
                    <View style={focused ? styles.activeIconFloat : undefined}>
                        <FontAwesome5 name="search" size={20} color={color} />
                    </View>
                );
            case 'unrolled':
                return (
                    <View style={[
                        styles.ghostContainer,
                        focused && styles.ghostContainerActive,
                    ]}>
                        <MaterialCommunityIcons
                            name="ghost"
                            size={24}
                            color={focused ? '#000' : Colors.dark.primary}
                        />
                    </View>
                );
            case 'activities':
                return (
                    <View style={focused ? styles.activeIconFloat : undefined}>
                        <FontAwesome5 name="compass" size={20} color={color} />
                        {hasUnread && <View style={styles.unreadDot} />}
                    </View>
                );
            case 'profile':
                return (
                    <View style={focused ? styles.activeIconFloat : undefined}>
                        {profile?.avatar_url ? (
                            <View style={{
                                width: 26, height: 26, borderRadius: 13,
                                borderWidth: focused ? 1.5 : 0,
                                borderColor: Colors.dark.primary,
                                padding: 1,
                                overflow: 'hidden'
                            }}>
                                <Image
                                    source={{ uri: profile.avatar_url }}
                                    style={{ width: '100%', height: '100%', borderRadius: 12 }}
                                />
                            </View>
                        ) : (
                            <FontAwesome5 name="user" size={20} color={color} />
                        )}
                    </View>
                );
            default:
                return null;
        }
    };

    return (
        <Animated.View style={[
            styles.tabBar,
            {
                height: Platform.OS === 'ios' ? 88 : 60 + insets.bottom,
                paddingBottom: Platform.OS === 'ios' ? insets.bottom : insets.bottom,
            },
            animatedStyle,
        ]}>
            {/* Background */}
            <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000000', borderTopWidth: 1, borderTopColor: '#1A1A1A' }]} />

            {/* Tab buttons */}
            <View style={styles.tabRow}>
                {state.routes.map((route: any, index: number) => {
                    const focused = state.index === index;
                    const color = focused ? Colors.dark.primary : Colors.dark.textSecondary;

                    const onPress = () => {
                        const event = navigation.emit({
                            type: 'tabPress',
                            target: route.key,
                            canPreventDefault: true,
                        });

                        if (!focused && !event.defaultPrevented) {
                            navigation.navigate(route.name);
                        }

                        if (focused && route.name === 'feed') {
                            DeviceEventEmitter.emit('scrollToTop_feed');
                            DeviceEventEmitter.emit('refresh_feed');
                        }

                        // Profile scroll-to-top on double tap
                        if (focused && route.name === 'profile') {
                            DeviceEventEmitter.emit('scrollToTop_profile');
                        }
                    };

                    return (
                        <Pressable
                            key={route.key}
                            onPress={onPress}
                            style={styles.tabButton}
                        >
                            {getIcon(route.name, focused, color)}
                        </Pressable>
                    );
                })}
            </View>
        </Animated.View>
    );
}

export default function TabLayout() {
    return (
        <View style={{ flex: 1, backgroundColor: '#000' }}>
            <Tabs
                tabBar={(props) => <AnimatedTabBar {...props} />}
                screenOptions={{
                    headerShown: false,
                }}
            >
                <Tabs.Screen name="feed" />
                <Tabs.Screen name="search" />
                <Tabs.Screen name="unrolled" />
                <Tabs.Screen name="activities" />
                <Tabs.Screen name="profile" />
            </Tabs>
        </View>
    );
}

const styles = StyleSheet.create({
    tabBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        borderTopWidth: 0,
        elevation: 0,
        backgroundColor: 'transparent',
        overflow: 'visible',
    },
    tabRow: {
        flexDirection: 'row',
        flex: 1,
        alignItems: 'center',
        paddingTop: 10,
    },
    tabButton: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    activeIconFloat: {
        marginTop: -6,
    },
    ghostContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'transparent',
        overflow: 'hidden',
    },
    ghostContainerActive: {
        backgroundColor: Colors.dark.primary,
        borderRadius: 18,
        overflow: 'hidden',
        shadowColor: Colors.dark.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
        elevation: 6,
    },
    unreadDot: {
        position: 'absolute',
        top: -2,
        right: -4,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#00FFFF',
        borderWidth: 1,
        borderColor: Colors.dark.card
    }
});
