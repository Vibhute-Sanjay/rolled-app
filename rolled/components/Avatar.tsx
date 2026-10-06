import { FontAwesome5 } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { Image, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

interface AvatarProps {
    uri?: string | null;
    name?: string;
    size?: number;
    style?: StyleProp<ViewStyle>;
}

const COLORS = [
    '#F44336', '#E91E63', '#9C27B0', '#673AB7', '#3F51B5',
    '#2196F3', '#03A9F4', '#00BCD4', '#009688', '#4CAF50',
    '#8BC34A', '#CDDC39', '#FFC107', '#FF9800', '#FF5722',
    '#795548', '#9E9E9E', '#607D8B'
];

export const Avatar = React.memo(({ uri, name = 'User', size = 40, style }: AvatarProps) => {
    const [hasError, setHasError] = useState(false);

    // Reset error state when URI changes (e.g. after upload)
    useEffect(() => {
        setHasError(false);
    }, [uri]);

    // Generate consistent color from name
    const backgroundColor = useMemo(() => {
        const str = name || 'User';
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        return COLORS[Math.abs(hash) % COLORS.length];
    }, [name]);

    const initials = useMemo(() => {
        const str = (name || 'User').trim();
        if (!str) return '?';
        const parts = str.split(/\s+/);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return str.substring(0, 2).toUpperCase();
    }, [name]);

    const stylesInternal = StyleSheet.create({
        container: {
            width: size,
            height: size,
            borderRadius: size / 2,
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'hidden',
            backgroundColor,
        },
        image: {
            width: '100%',
            height: '100%',
        },
        text: {
            color: '#FFFFFF',
            fontWeight: 'bold',
            fontSize: Math.max(size * 0.35, 12),
            textAlign: 'center',
            includeFontPadding: false,
            textAlignVertical: 'center',
        }
    });

    const isValidUri = uri && typeof uri === 'string' && uri.trim() !== '' && !hasError;

    if (isValidUri) {
        return (
            <View style={[stylesInternal.container, style]}>
                <Image
                    source={{ uri }}
                    style={stylesInternal.image}
                    resizeMode="cover"
                    onError={() => setHasError(true)}
                />
            </View>
        );
    }

    return (
        <View style={[stylesInternal.container, style]}>
            {initials ? (
                <Text style={stylesInternal.text} allowFontScaling={false}>
                    {initials}
                </Text>
            ) : (
                <FontAwesome5 name="user" size={size * 0.5} color="#FFF" />
            )}
        </View>
    );
});
