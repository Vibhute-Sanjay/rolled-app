
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, { FadeInUp, FadeOutUp, SlideInUp, SlideOutUp, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { Colors } from '../constants/Colors';
import { FontAwesome5 } from '@expo/vector-icons';

type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
    visible: boolean;
    message: string;
    type?: ToastType;
    onHide: () => void;
    duration?: number;
    position?: 'top' | 'bottom';
}

export const CustomToast = ({ visible, message, type = 'info', onHide, duration = 3000, position = 'bottom' }: ToastProps) => {

    useEffect(() => {
        if (visible) {
            const timer = setTimeout(() => {
                onHide();
            }, duration);
            return () => clearTimeout(timer);
        }
    }, [visible, duration]);

    if (!visible) return null;

    const getIcon = () => {
        switch (type) {
            case 'success': return 'check-circle';
            case 'error': return 'times-circle';
            case 'info': return 'info-circle';
        }
    };

    const getColor = () => {
        switch (type) {
            case 'success': return Colors.dark.success;
            case 'error': return Colors.dark.error;
            case 'info': return Colors.dark.primary;
        }
    };

    const positionStyle = position === 'top' ? { top: 60 } : { bottom: 40 };
    const enteringAnimation = position === 'top' ? SlideInUp.duration(300) : SlideInDown.duration(300);
    const exitingAnimation = position === 'top' ? SlideOutUp.duration(300) : SlideOutDown.duration(300);

    return (
        <Animated.View
            entering={enteringAnimation}
            exiting={exitingAnimation}
            style={[styles.container, positionStyle, { borderLeftColor: getColor() }]}
        >
            <View style={styles.content}>
                <FontAwesome5 name={getIcon()} size={20} color={getColor()} style={styles.icon} />
                <Text style={styles.message}>{message}</Text>
            </View>
            <TouchableOpacity onPress={onHide} style={styles.closeButton}>
                <FontAwesome5 name="times" size={14} color={Colors.dark.textSecondary} />
            </TouchableOpacity>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        // Top/Bottom handled dynamically
        left: 20,
        right: 20,
        backgroundColor: '#1A1A1A', // Slightly lighter than pure black for contrast
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.30,
        shadowRadius: 4.65,
        elevation: 8,
        zIndex: 9999,
        borderLeftWidth: 4,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    icon: {
        marginRight: 12,
    },
    message: {
        color: 'white',
        fontSize: 14,
        fontWeight: '500',
        flex: 1,
    },
    closeButton: {
        padding: 4,
        marginLeft: 8,
    }
});
