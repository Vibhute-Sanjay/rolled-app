import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { Colors } from '../../constants/Colors';

export const TypingBubble = () => {
    const [opacity] = useState(new Animated.Value(0));

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(opacity, {
                    toValue: 1,
                    duration: 500,
                    useNativeDriver: true,
                    easing: Easing.ease,
                }),
                Animated.timing(opacity, {
                    toValue: 0.3,
                    duration: 500,
                    useNativeDriver: true,
                    easing: Easing.ease,
                }),
            ])
        ).start();
    }, []);

    return (
        <View style={styles.container}>
            <View style={styles.bubble}>
                <Animated.View style={[styles.dot, { opacity, marginRight: 4 }]} />
                <Animated.View style={[styles.dot, { opacity, marginRight: 4, animationDelay: '200ms' }]} />
                <Animated.View style={[styles.dot, { opacity }]} />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        alignItems: 'flex-start', // Left align for other user
    },
    bubble: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#333', // Dark bubble for received
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 20,
        borderBottomLeftRadius: 4,
        minWidth: 50,
        height: 40,
        justifyContent: 'center'
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#999',
    }
});
