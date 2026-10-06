import React from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';

interface UserHelpers {
    is_verified?: boolean;
    is_admin?: boolean;
    is_og?: boolean;
}

interface Props {
    user?: UserHelpers;
    size?: number;
}

export const UserBadges = ({ user, size = 16 }: Props) => {
    if (!user) return null;

    return (
        <View style={styles.container}>
            {user.is_verified && (
                <MaterialIcons name="verified" size={size} color="#FFD700" style={styles.badge} />
            )}

            {/* OG Badge - Custom Image */}
            {user.is_og && (
                <Image
                    source={require('../assets/images/og-icon.jpg')}
                    style={{
                        width: size * 1.5, // Slightly larger for detail
                        height: size * 1.5,
                        borderRadius: 4,
                        marginLeft: 2
                    }}
                    resizeMode="contain"
                />
            )}

            {user.is_admin && (
                <Image
                    source={require('../assets/images/icon.png')}
                    style={{
                        width: size * 1.25,
                        height: size * 1.25,
                        borderRadius: 4,
                        marginLeft: 2
                    }}
                    resizeMode="cover"
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginLeft: 4,
    },
    badge: {
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
});
