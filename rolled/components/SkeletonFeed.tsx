import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withSequence
} from 'react-native-reanimated';
import { Colors } from '../constants/Colors';

const { width } = Dimensions.get('window');

const SkeletonItem = () => {
    const opacity = useSharedValue(0.3);

    useEffect(() => {
        opacity.value = withRepeat(
            withSequence(
                withTiming(0.7, { duration: 800 }),
                withTiming(0.3, { duration: 800 })
            ),
            -1, // Infinite repeat
            true // Reverse
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
    }));

    return (
        <View style={styles.card}>
            {/* Header */}
            <View style={styles.header}>
                <Animated.View style={[styles.avatar, animatedStyle]} />
                <View style={styles.headerText}>
                    <Animated.View style={[styles.titleLine, animatedStyle]} />
                    <Animated.View style={[styles.subtitleLine, animatedStyle]} />
                </View>
            </View>

            {/* Content Body */}
            <View style={styles.content}>
                <Animated.View style={[styles.textLine, { width: '90%' }, animatedStyle]} />
                <Animated.View style={[styles.textLine, { width: '70%' }, animatedStyle]} />
                <Animated.View style={[styles.textLine, { width: '80%' }, animatedStyle]} />
            </View>

            {/* Footer */}
            <View style={styles.footer}>
                <Animated.View style={[styles.actionButton, animatedStyle]} />
                <Animated.View style={[styles.actionButton, animatedStyle]} />
                <Animated.View style={[styles.actionButton, animatedStyle]} />
            </View>
        </View>
    );
};

export const SkeletonFeed = () => {
    return (
        <View style={styles.container}>
            <SkeletonItem />
            <SkeletonItem />
            <SkeletonItem />
            <SkeletonItem />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.dark.background,
        paddingTop: 10,
    },
    card: {
        backgroundColor: '#1E1E1E',
        borderRadius: 0, // Feed style
        marginBottom: 10,
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#333'
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#333',
        marginRight: 10,
    },
    headerText: {
        flex: 1,
    },
    titleLine: {
        width: 120,
        height: 14,
        borderRadius: 7,
        backgroundColor: '#333',
        marginBottom: 6,
    },
    subtitleLine: {
        width: 80,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#333',
    },
    content: {
        marginBottom: 15,
        gap: 8
    },
    textLine: {
        height: 12,
        borderRadius: 6,
        backgroundColor: '#333',
    },
    footer: {
        flexDirection: 'row',
        gap: 20,
    },
    actionButton: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#333',
    }
});
