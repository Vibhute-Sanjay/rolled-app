
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Text, View, StyleSheet, Animated } from 'react-native';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { Colors } from '../../constants/Colors';

export default function WelcomeSplashScreen() {
    const router = useRouter();
    const fadeAnim = new Animated.Value(0);

    useEffect(() => {
        // Fade In
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
        }).start();

        // Wait then redirect
        const timer = setTimeout(() => {
            router.replace('/(tabs)/feed' as any);
        }, 2500);

        return () => clearTimeout(timer);
    }, []);

    return (
        <ScreenWrapper style={{ justifyContent: 'center', alignItems: 'center' }}>
            <Animated.View style={{ opacity: fadeAnim, alignItems: 'center' }}>
                <Text style={styles.title}>You're In.</Text>
                <Text style={styles.subtitle}>Welcome to Rolled.</Text>
            </Animated.View>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    title: {
        fontSize: 48,
        fontWeight: '900',
        color: Colors.dark.primary,
        marginBottom: 16,
        letterSpacing: -1,
    },
    subtitle: {
        fontSize: 20,
        color: Colors.dark.text,
    },
});
