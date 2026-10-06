
import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Colors } from '../constants/Colors';

interface ButtonProps {
    title: string;
    onPress: () => void;
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
    loading?: boolean;
    style?: ViewStyle;
    textStyle?: TextStyle;
    disabled?: boolean;
}

export const Button = ({ title, onPress, variant = 'primary', loading = false, style, textStyle, disabled }: ButtonProps) => {
    const getBackgroundColor = () => {
        if (disabled) return Colors.dark.card; // Disabled state
        switch (variant) {
            case 'primary': return Colors.dark.primary;
            case 'secondary': return Colors.dark.secondary;
            case 'outline': return 'transparent';
            case 'ghost': return 'transparent';
            default: return Colors.dark.primary;
        }
    };

    const getTextColor = () => {
        if (disabled) return Colors.dark.textSecondary;
        switch (variant) {
            case 'primary': return '#000000'; // Black text on neon blue
            case 'secondary': return '#FFFFFF';
            case 'outline': return Colors.dark.primary;
            case 'ghost': return Colors.dark.textSecondary;
            default: return '#000000';
        }
    };

    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={loading || disabled}
            style={[
                styles.container,
                { backgroundColor: getBackgroundColor() },
                variant === 'outline' && { borderWidth: 1, borderColor: Colors.dark.primary },
                style,
            ]}
            activeOpacity={0.8}
        >
            {loading ? (
                <ActivityIndicator color={getTextColor()} />
            ) : (
                <Text style={[styles.text, { color: getTextColor() }, textStyle]}>
                    {title}
                </Text>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        marginVertical: 8,
    },
    text: {
        fontSize: 16,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
});
