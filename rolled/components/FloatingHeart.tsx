import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

const HEART_COLOR = '#FF2D55'; // Vibrant shiny red-pink (like Instagram/Apple)

interface FloatingHeartProps {
    trigger: number; // Increment this to trigger a new heart
}

export const FloatingHeart = ({ trigger }: FloatingHeartProps) => {
    const hearts = useRef<{ id: number; anim: Animated.Value; opacity: Animated.Value; x: number }[]>([]);
    const counterRef = useRef(0);
    const [, setTick] = useState(0);

    useEffect(() => {
        if (trigger === 0) return;

        const id = counterRef.current++;
        const anim = new Animated.Value(0);
        const opacity = new Animated.Value(1);
        const x = (Math.random() - 0.5) * 40; // Random slight horizontal offset

        hearts.current = [...hearts.current, { id, anim, opacity, x }];
        setTick(t => t + 1); // Force re-render to show the new heart

        Animated.parallel([
            Animated.timing(anim, {
                toValue: 1,
                duration: 800,
                useNativeDriver: true,
            }),
            Animated.timing(opacity, {
                toValue: 0,
                duration: 800,
                useNativeDriver: true,
            }),
        ]).start(() => {
            hearts.current = hearts.current.filter(h => h.id !== id);
        });
    }, [trigger]);

    return (
        <View style={styles.container} pointerEvents="none">
            {hearts.current.map(heart => (
                <Animated.View
                    key={heart.id}
                    style={[
                        styles.heart,
                        {
                            transform: [
                                { translateY: heart.anim.interpolate({ inputRange: [0, 1], outputRange: [0, -80] }) },
                                { translateX: heart.x },
                                { scale: heart.anim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.5, 1.3, 0.8] }) },
                            ],
                            opacity: heart.opacity,
                        },
                    ]}
                >
                    <MaterialCommunityIcons name="heart" size={24} color={HEART_COLOR} />
                </Animated.View>
            ))}
        </View>
    );
};

export const LIKE_COLOR = HEART_COLOR;

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: -10,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        overflow: 'visible',
    },
    heart: {
        position: 'absolute',
        bottom: 0,
    },
});
