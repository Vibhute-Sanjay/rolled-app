import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { useUploadStore } from '../stores/uploadStore';
import { Colors } from '../constants/Colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, { useAnimatedStyle, withTiming, withSequence, withDelay } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

export function UploadProgressBanner() {
    const { status, progress, errorMessage, reset, uploadedPostData } = useUploadStore();
    const insets = useSafeAreaInsets();
    const [isVisible, setIsVisible] = useState(false);
    const router = useRouter();
    
    // Auto-hide success/error toasts after 5 seconds
    useEffect(() => {
        if (status === 'success' || status === 'error') {
            setIsVisible(true);
            const timer = setTimeout(() => {
                setIsVisible(false);
                setTimeout(reset, 300); // Wait for fade out animation
            }, 5000);
            return () => clearTimeout(timer);
        } else if (status === 'uploading' || status === 'processing') {
            setIsVisible(true);
        } else {
            setIsVisible(false);
        }
    }, [status, reset]);

    const handleViewRoll = () => {
        if (uploadedPostData) {
            router.push({
                pathname: `/post/${uploadedPostData.id}`,
                params: { initialData: JSON.stringify(uploadedPostData) }
            });
        }
        setIsVisible(false);
        setTimeout(reset, 300);
    };

    if (status === 'idle') return null;

    if (status === 'uploading' || status === 'processing') {
        // Bulky Progress Bar overlaying the "Campus Roll / My Roll" tabs
        return (
            <View style={[styles.bulkyProgressContainer, { top: insets.top + 48 }]}>
                <Animated.View style={[styles.bulkyProgressFill, { width: `${progress}%` }]} />
                <View style={styles.bulkyProgressTextContainer}>
                    <Text style={styles.bulkyProgressText}>
                        {status === 'processing' ? 'Processing video...' : `Uploading... ${progress}%`}
                    </Text>
                </View>
            </View>
        );
    }

    // Sleek Pill Toast for Success / Error
    return (
        <Animated.View 
            style={[
                styles.toastContainer, 
                { top: insets.top + 10, opacity: isVisible ? 1 : 0 }
            ]}
        >
            {status === 'error' ? (
                <View style={[styles.toastPill, styles.errorPill]}>
                    <Text style={styles.toastText}>{errorMessage || 'Upload failed'}</Text>
                    <TouchableOpacity onPress={reset} hitSlop={{top:10, bottom:10, left:10, right:10}}>
                        <MaterialCommunityIcons name="close" size={16} color="white" />
                    </TouchableOpacity>
                </View>
            ) : (
                <View style={styles.toastPill}>
                    <Text style={styles.toastText}>Your Roll was sent.</Text>
                    <TouchableOpacity onPress={handleViewRoll} style={styles.viewAction}>
                        <Text style={styles.viewActionText}>View</Text>
                    </TouchableOpacity>
                </View>
            )}
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    bulkyProgressContainer: {
        position: 'absolute',
        left: 0,
        right: 0,
        height: 42,
        backgroundColor: Colors.dark.background, // Match header background
        zIndex: 2000,
        borderBottomWidth: 1,
        borderBottomColor: '#222',
        overflow: 'hidden',
    },
    bulkyProgressFill: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        backgroundColor: Colors.dark.card, // Dark grey fill moving across
    },
    bulkyProgressTextContainer: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
    bulkyProgressText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14,
        letterSpacing: 0.5,
    },
    toastContainer: {
        position: 'absolute',
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 2000,
    },
    toastPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1DA1F2', // X blue or use our own brand color, let's use brand primary
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 30,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 5,
        gap: 12,
    },
    errorPill: {
        backgroundColor: Colors.dark.error,
    },
    toastText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 14,
    },
    viewAction: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    viewActionText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 12,
    }
});
