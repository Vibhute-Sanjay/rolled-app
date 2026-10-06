import React, { useState, useRef } from 'react';
import { View, Modal, Image, StyleSheet, TouchableOpacity, Text, Dimensions, ActivityIndicator } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import ViewShot from 'react-native-view-shot';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CANVAS_WIDTH = SCREEN_WIDTH - 40; // 20px padding each side
const CANVAS_HEIGHT = CANVAS_WIDTH * 1.25; // 4:5 aspect ratio

interface ImageCropperModalProps {
    visible: boolean;
    imageUri: string;
    onComplete: (croppedUri: string) => void;
    onCancel: () => void;
}

export const ImageCropperModal: React.FC<ImageCropperModalProps> = ({
    visible,
    imageUri,
    onComplete,
    onCancel,
}) => {
    const viewShotRef = useRef<ViewShot>(null);
    const [capturing, setCapturing] = useState(false);

    // Gesture values
    const scale = useSharedValue(1);
    const savedScale = useSharedValue(1);
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const savedTranslateX = useSharedValue(0);
    const savedTranslateY = useSharedValue(0);

    // Pinch gesture
    const pinchGesture = Gesture.Pinch()
        .onUpdate((e) => {
            scale.value = savedScale.value * e.scale;
        })
        .onEnd(() => {
            // Limit zoom
            if (scale.value < 0.5) scale.value = withSpring(0.5);
            if (scale.value > 3) scale.value = withSpring(3);
            savedScale.value = scale.value;
        });

    // Pan gesture
    const panGesture = Gesture.Pan()
        .onUpdate((e) => {
            translateX.value = savedTranslateX.value + e.translationX;
            translateY.value = savedTranslateY.value + e.translationY;
        })
        .onEnd(() => {
            savedTranslateX.value = translateX.value;
            savedTranslateY.value = translateY.value;
        });

    const composed = Gesture.Simultaneous(pinchGesture, panGesture);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
            { scale: scale.value },
        ],
    }));

    const handleReset = () => {
        scale.value = withSpring(1);
        savedScale.value = 1;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
    };

    const handleCapture = async () => {
        setCapturing(true);
        try {
            if (viewShotRef.current) {
                const uri = await viewShotRef.current.capture();
                onComplete(uri);
            }
        } catch (error) {
            console.error('Capture failed:', error);
            alert('Failed to capture image');
        } finally {
            setCapturing(false);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent={false}>
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={onCancel} style={styles.headerBtn}>
                        <Ionicons name="close" size={28} color="#FFF" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Adjust Image</Text>
                    <TouchableOpacity onPress={handleReset} style={styles.headerBtn}>
                        <Ionicons name="refresh" size={24} color="#FFF" />
                    </TouchableOpacity>
                </View>

                {/* Canvas Area */}
                <View style={styles.canvasContainer}>
                    <ViewShot
                        ref={viewShotRef}
                        options={{ format: 'jpg', quality: 0.9 }}
                        style={styles.canvas}
                    >
                        {/* Black background for blank space */}
                        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }]} />

                        {/* Draggable/Scalable Image */}
                        <GestureDetector gesture={composed}>
                            <Animated.View style={[styles.imageContainer, animatedStyle]}>
                                <Image
                                    source={{ uri: imageUri }}
                                    style={styles.image}
                                    resizeMode="contain"
                                />
                            </Animated.View>
                        </GestureDetector>
                    </ViewShot>
                </View>

                {/* Instructions */}
                <Text style={styles.instructions}>
                    Pinch to zoom • Drag to reposition
                </Text>

                {/* Done Button */}
                <TouchableOpacity
                    style={styles.doneButton}
                    onPress={handleCapture}
                    disabled={capturing}
                >
                    {capturing ? (
                        <ActivityIndicator color="#000" />
                    ) : (
                        <Text style={styles.doneButtonText}>Done</Text>
                    )}
                </TouchableOpacity>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        position: 'absolute',
        top: 50,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        zIndex: 10,
    },
    headerBtn: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
    canvasContainer: {
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        justifyContent: 'center',
        alignItems: 'center',
    },
    canvas: {
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        backgroundColor: '#000',
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: '#22d3ee',
        borderRadius: 8,
    },
    imageContainer: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    image: {
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
    },
    instructions: {
        color: '#888',
        fontSize: 14,
        marginTop: 20,
        textAlign: 'center',
    },
    doneButton: {
        position: 'absolute',
        bottom: 50,
        backgroundColor: '#22d3ee',
        paddingVertical: 16,
        paddingHorizontal: 60,
        borderRadius: 30,
        minWidth: 200,
        alignItems: 'center',
    },
    doneButtonText: {
        color: '#000',
        fontSize: 18,
        fontWeight: 'bold',
    },
});
