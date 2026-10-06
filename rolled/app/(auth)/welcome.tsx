import { useRouter } from 'expo-router';
import { Text, View, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import { Button } from '../../components/Button';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { Colors } from '../../constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';

const { width } = Dimensions.get('window');

export default function WelcomeScreen() {
    const router = useRouter();

    // Animation Values
    const pulseAnim = useRef(new Animated.Value(1)).current;

    // Floating Animations (Subtle breathing)
    const floatAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // 1. Core Breathing (Very subtle, premium feel)
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.05, duration: 3000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 3000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            ])
        ).start();

        // 2. Satellite Floating (Slow unified hover)
        Animated.loop(
            Animated.sequence([
                Animated.timing(floatAnim, { toValue: -5, duration: 4000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
                Animated.timing(floatAnim, { toValue: 5, duration: 4000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            ])
        ).start();

    }, []);

    return (
        <ScreenWrapper style={{ justifyContent: 'space-between', paddingVertical: 40 }}>
            {/* Top Section */}
            <View style={{ marginTop: 40, alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center' }}>
                    <Text style={styles.logoText}>rolled</Text>
                    <View style={styles.dot} />
                </View>
                <Text style={styles.tagline}>The social network for campus life.</Text>
            </View>

            {/* Middle Section: Premium Molecule System */}
            <View style={styles.centerWrapper}>

                {/* 1. Core (Subtle Pulse) */}
                <Animated.View style={[styles.coreCircle, { transform: [{ scale: pulseAnim }] }]}>
                    <Ionicons name="people" size={50} color={Colors.dark.primary} />
                </Animated.View>

                {/* 2. Satellites (Tightly Clustered & Floating) */}
                {/* We group them in a container that moves slightly to create depth */}
                <Animated.View style={[styles.orbitLayer, { transform: [{ translateY: floatAnim }] }]}>

                    {/* Top */}
                    <View style={[styles.satellite, { top: 10, alignSelf: 'center' }]}>
                        <Ionicons name="notifications" size={18} color={Colors.dark.textSecondary} />
                    </View>

                    {/* Top Right */}
                    <View style={[styles.satellite, { top: 40, right: 30 }]}>
                        <Ionicons name="search" size={18} color={Colors.dark.textSecondary} />
                    </View>

                    {/* Bottom Right */}
                    <View style={[styles.satellite, { bottom: 40, right: 30 }]}>
                        <Ionicons name="images" size={18} color={Colors.dark.textSecondary} />
                    </View>

                    {/* Bottom */}
                    <View style={[styles.satellite, { bottom: 10, alignSelf: 'center' }]}>
                        <Ionicons name="home" size={18} color={Colors.dark.textSecondary} />
                    </View>

                    {/* Bottom Left */}
                    <View style={[styles.satellite, { bottom: 40, left: 30 }]}>
                        <Ionicons name="calendar" size={18} color={Colors.dark.textSecondary} />
                    </View>

                    {/* Top Left */}
                    <View style={[styles.satellite, { top: 40, left: 30 }]}>
                        <Ionicons name="chatbubbles" size={18} color={Colors.dark.textSecondary} />
                    </View>

                </Animated.View>
            </View>


            {/* Bottom Section */}
            <View>
                <Text style={styles.welcomeTitle}>Welcome to Rolled</Text>
                <Text style={styles.subText}>
                    Connect with students, clubs, and events at MIT WPU.
                </Text>
                <Button
                    title="Continue"
                    onPress={() => router.push('/(auth)/' as any)}
                    style={{ marginTop: 30 }}
                />

                <Text style={styles.legalText}>
                    By continuing, you agree to our{' '}
                    <Text
                        style={styles.linkText}
                        onPress={() => router.push('https://rolledapp.com/terms')}>
                        Terms of Service
                    </Text>
                    {' '}and{' '}
                    <Text
                        style={styles.linkText}
                        onPress={() => router.push('https://rolledapp.com/privacy')}>
                        Privacy Policy
                    </Text>.
                </Text>
            </View>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    logoText: {
        fontSize: 56,
        color: '#FFFFFF',
        fontWeight: '900',
        letterSpacing: -2,
    },
    dot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: Colors.dark.primary,
        marginLeft: 4,
    },
    tagline: {
        fontSize: 16,
        color: Colors.dark.textSecondary,
        marginTop: 8,
        textAlign: 'center',
        fontWeight: '500',
        letterSpacing: 0.5
    },
    centerWrapper: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 260,
        height: 260,
        alignSelf: 'center',
    },
    coreCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#151515', // Subtle dark
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#2A2A2A',
        shadowColor: Colors.dark.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.15, // Very subtle glow
        shadowRadius: 20,
        elevation: 10,
        zIndex: 10
    },
    orbitLayer: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        zIndex: 5,
    },
    satellite: {
        position: 'absolute',
        width: 36, height: 36, // Smaller, tighter
        borderRadius: 18,
        backgroundColor: '#1A1A1A',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#252525',
    },
    welcomeTitle: {
        fontSize: 28,
        color: Colors.dark.text,
        fontWeight: 'bold',
        marginBottom: 10,
        textAlign: 'center'
    },
    subText: {
        fontSize: 16,
        color: Colors.dark.textSecondary,
        lineHeight: 24,
        textAlign: 'center'
    },
    legalText: {
        marginTop: 20,
        fontSize: 12,
        color: Colors.dark.textSecondary,
        textAlign: 'center',
        lineHeight: 18,
    },
    linkText: {
        color: Colors.dark.primary,
        fontWeight: 'bold',
    }
});
