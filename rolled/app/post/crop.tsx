import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, DeviceEventEmitter, Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, runOnJS } from 'react-native-reanimated';
import ViewShot from 'react-native-view-shot';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { Colors } from '../../constants/Colors';
import { useCreatePostStore } from '../../stores/createPostStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CANVAS_WIDTH = SCREEN_WIDTH - 40;

export default function CropScreen() {
    const router = useRouter();
    const { uri, index, isSequence, target } = useLocalSearchParams<{ uri: string; index?: string; isSequence?: string; target?: string }>();
    const { addMedia, updateMedia, setCroppedCoverImage, aspectRatio: storeRatio, setAspectRatio } = useCreatePostStore();
    const totalMedia = useCreatePostStore((state) => state.media.length);

    // Determine ratio
    const isFirstImage = (!index || index === '0') && target !== 'profile' && target !== 'cover';
    // Standard React Native `aspectRatio` = Width / Height
    let ratio = storeRatio || 0.8; // Default 0.8 (4:5 Portrait)
    if (target === 'profile') ratio = 1;
    if (target === 'cover') ratio = 16 / 9; // Cover is wide layout

    // Calculate CANVAS_HEIGHT correctly: Height = Width / AspectRatio
    const CANVAS_HEIGHT = CANVAS_WIDTH / ratio;

    const viewShotRef = useRef<ViewShot>(null);
    const [processing, setProcessing] = useState(false);
    const [imageSize, setImageSize] = useState({ width: 1, height: 1 });

    useEffect(() => {
        if (uri) {
            Image.getSize(uri, (w, h) => {
                setImageSize({ width: w || 1, height: h || 1 });
            });
        }
    }, [uri]);

    // Math for bounding
    const R_image = imageSize.width / imageSize.height;
    const R_canvas = CANVAS_WIDTH / CANVAS_HEIGHT;

    let renderedWidth = CANVAS_WIDTH;
    let renderedHeight = CANVAS_HEIGHT;

    if (R_image > R_canvas) {
        // Image is wider than canvas
        const scaleToFit = CANVAS_HEIGHT / imageSize.height;
        renderedWidth = imageSize.width * scaleToFit;
        renderedHeight = CANVAS_HEIGHT;
    } else {
        // Image is taller than or equal to canvas
        const scaleToFit = CANVAS_WIDTH / imageSize.width;
        renderedWidth = CANVAS_WIDTH;
        renderedHeight = imageSize.height * scaleToFit;
    }

    // Gesture values
    const scale = useSharedValue(1);
    const savedScale = useSharedValue(1);
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const savedTranslateX = useSharedValue(0);
    const savedTranslateY = useSharedValue(0);

    // Update bounds dynamically based on current scale
    const clamp = (value: number, lowerBound: number, upperBound: number) => {
        'worklet';
        return Math.max(lowerBound, Math.min(value, upperBound));
    };

    // Pinch gesture
    const pinchGesture = Gesture.Pinch()
        .onUpdate((e) => {
            scale.value = Math.max(1, savedScale.value * e.scale); // Prevent zooming out less than 1 (showing blank space)

            // Adjust translation to keep within bounds while zooming
            const maxTx = Math.max(0, (renderedWidth * scale.value - CANVAS_WIDTH) / 2);
            const maxTy = Math.max(0, (renderedHeight * scale.value - CANVAS_HEIGHT) / 2);
            translateX.value = clamp(translateX.value, -maxTx, maxTx);
            translateY.value = clamp(translateY.value, -maxTy, maxTy);
        })
        .onEnd(() => {
            if (scale.value < 1) scale.value = withSpring(1);
            if (scale.value > 5) scale.value = withSpring(5);
            savedScale.value = scale.value;
        });

    // Pan gesture
    const panGesture = Gesture.Pan()
        .onUpdate((e) => {
            const maxTx = Math.max(0, (renderedWidth * scale.value - CANVAS_WIDTH) / 2);
            const maxTy = Math.max(0, (renderedHeight * scale.value - CANVAS_HEIGHT) / 2);

            translateX.value = clamp(savedTranslateX.value + e.translationX, -maxTx, maxTx);
            translateY.value = clamp(savedTranslateY.value + e.translationY, -maxTy, maxTy);
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

    const handleRatioChange = (newRatio: number) => {
        setAspectRatio(newRatio);
        handleReset(); // Reset zoom/pan when changing ratio so logic recalculates cleanly
    };

    const handleSave = async () => {
        if (!viewShotRef.current || !uri) return;

        setProcessing(true);
        try {
            if (viewShotRef.current && typeof viewShotRef.current.capture === 'function') {
                const croppedUri = await viewShotRef.current.capture();

                if (target === 'cover' || target === 'profile') {
                    if (target === 'cover') {
                        setCroppedCoverImage(croppedUri);
                    }
                    DeviceEventEmitter.emit('image_cropped', { uri: croppedUri, target });
                    router.back();
                    return;
                }

                if (index !== undefined && index !== null) {
                    updateMedia(Number(index), croppedUri);
                } else {
                    addMedia(croppedUri);
                }

                const currentIndex = Number(index);
                const nextIndex = currentIndex + 1;

                if (isSequence === 'true' && nextIndex < totalMedia) {
                    const nextUri = useCreatePostStore.getState().media[nextIndex];
                    router.replace({
                        pathname: '/post/crop',
                        params: {
                            uri: nextUri,
                            index: nextIndex.toString(),
                            isSequence: 'true',
                        },
                    });
                } else {
                    router.back();
                }
            }
        } catch (error) {
            console.error('Capture failed:', error);
            alert('Failed to save image');
        } finally {
            setProcessing(false);
        }
    };

    const hasNext = isSequence === 'true' && index && Number(index) + 1 < totalMedia;

    return (
        <ScreenWrapper style={{ backgroundColor: '#000', paddingHorizontal: 0 }}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => { router.back(); setAspectRatio(0.8); }}>
                    <Ionicons name="close" size={28} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Adjust Photo</Text>
                <TouchableOpacity onPress={handleSave} disabled={processing}>
                    {processing ? (
                        <ActivityIndicator color={Colors.dark.primary} />
                    ) : (
                        <Text style={styles.headerAction}>{hasNext ? 'Next' : 'Done'}</Text>
                    )}
                </TouchableOpacity>
            </View>

            {/* Ratio Selector (First Image Only) */}
            {isFirstImage && (
                <View style={styles.ratioSelector}>
                    <TouchableOpacity onPress={() => handleRatioChange(0.8)} style={[styles.ratioBtn, ratio === 0.8 && styles.ratioBtnActive]}>
                        <Text style={[styles.ratioText, ratio === 0.8 && styles.ratioTextActive]}>4:5</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleRatioChange(1)} style={[styles.ratioBtn, ratio === 1 && styles.ratioBtnActive]}>
                        <Text style={[styles.ratioText, ratio === 1 && styles.ratioTextActive]}>1:1</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleRatioChange(16 / 9)} style={[styles.ratioBtn, ratio === 16 / 9 && styles.ratioBtnActive]}>
                        <Text style={[styles.ratioText, ratio === 16 / 9 && styles.ratioTextActive]}>16:9</Text>
                    </TouchableOpacity>
                </View>
            )}

            {!isFirstImage && target !== 'cover' && target !== 'profile' && (
                <View style={styles.ratioLocked}>
                    <Ionicons name="lock-closed" size={14} color="#888" style={{ marginRight: 6 }} />
                    <Text style={styles.instructions2}>Ratio locked to first image</Text>
                </View>
            )}

            {/* Canvas Container */}
            <View style={styles.canvasOuter}>
                <View style={[styles.borderWrapper, { width: CANVAS_WIDTH, height: CANVAS_HEIGHT }]}>
                    <ViewShot
                        ref={viewShotRef}
                        options={{ format: 'jpg', quality: 0.9 }}
                        style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, backgroundColor: '#000', overflow: 'hidden' }}
                    >
                        <GestureHandlerRootView style={{ flex: 1 }}>
                            <GestureDetector gesture={composed}>
                                <Animated.View style={[styles.imageContainer, animatedStyle]}>
                                    <Image
                                        source={{ uri }}
                                        style={{ width: renderedWidth, height: renderedHeight }}
                                        resizeMode="cover"
                                    />
                                </Animated.View>
                            </GestureDetector>
                        </GestureHandlerRootView>
                    </ViewShot>
                </View>
            </View>

            {/* Instructions */}
            <View style={styles.footer}>
                <TouchableOpacity onPress={handleReset} style={styles.resetButton}>
                    <Ionicons name="refresh" size={20} color={Colors.dark.primary} />
                    <Text style={styles.resetText}>Reset</Text>
                </TouchableOpacity>
                <Text style={styles.instructions}>
                    Pinch to zoom • Drag to pan
                </Text>
            </View>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 15,
    },
    headerTitle: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
    headerAction: {
        color: Colors.dark.primary,
        fontSize: 18,
        fontWeight: 'bold',
    },
    ratioSelector: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 10,
        gap: 16,
    },
    ratioLocked: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 10,
    },
    ratioBtn: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#111',
        borderWidth: 1,
        borderColor: '#333',
    },
    ratioBtnActive: {
        borderColor: Colors.dark.primary,
        backgroundColor: Colors.dark.primary + '20',
    },
    ratioText: {
        color: '#888',
        fontWeight: '600',
    },
    ratioTextActive: {
        color: Colors.dark.primary,
    },
    canvasOuter: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 10,
    },
    borderWrapper: {
        borderWidth: 2,
        borderColor: Colors.dark.primary,
        borderRadius: 8,
        overflow: 'hidden',
    },
    imageContainer: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    footer: {
        paddingVertical: 20,
        alignItems: 'center',
        gap: 8,
    },
    resetButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: 'rgba(34, 211, 238, 0.1)',
        marginBottom: 10,
    },
    resetText: {
        color: Colors.dark.primary,
        fontWeight: '600',
    },
    instructions: {
        color: '#888',
        fontSize: 14,
    },
    instructions2: {
        color: '#666',
        fontSize: 12,
        fontStyle: 'italic',
    },
});
