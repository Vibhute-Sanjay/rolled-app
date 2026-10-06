import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/Colors';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface NetworkBannerProps {
    isOffline: boolean;
}

export function NetworkBanner({ isOffline }: NetworkBannerProps) {
    const insets = useSafeAreaInsets();

    if (!isOffline) return null;

    return (
        <View style={[styles.banner, { paddingTop: insets.top + 8 }]}>
            <MaterialCommunityIcons name="wifi-off" size={16} color="#FFF" />
            <Text style={styles.text}>No Internet Connection</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    banner: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: '#FF3B30',
        paddingBottom: 8,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        zIndex: 9999,
        elevation: 10,
    },
    text: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
    },
});
