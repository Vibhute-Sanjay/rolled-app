import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    TextInput,
    TouchableWithoutFeedback,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    Image,
    ActivityIndicator,
    Alert
} from 'react-native';
import { Colors } from '../constants/Colors';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    runOnJS,
    Easing,
} from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface ReportModalProps {
    visible: boolean;
    onClose: () => void;
    onSubmit?: (reason: string, details: string) => Promise<void> | void;
    targetType?: 'post' | 'user' | 'comment' | 'message' | 'reply' | 'activity';
    targetId?: string;
}

const REASONS = [
    { id: 'harassment', label: 'Harassment or Bullying', icon: 'account-alert' },
    { id: 'hate_speech', label: 'Hate Speech', icon: 'bullhorn-variant' },
    { id: 'child_safety', label: 'Child Safety / CSAE', icon: 'shield-account' },
    { id: 'spam', label: 'Spam or Scam', icon: 'email-alert' },
    { id: 'inappropriate', label: 'Inappropriate Content', icon: 'eye-off' },
    { id: 'other', label: 'Other Issue', icon: 'alert-circle' },
];

// Animation durations - single source of truth
const ANIM_IN_DURATION = 350;
const ANIM_OUT_DURATION = 280;

export const ReportModal = ({ visible, onClose, onSubmit, targetType = 'post', targetId }: ReportModalProps) => {
    const { user } = useAuth();

    // --- Internal Form State ---
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [selectedReason, setSelectedReason] = useState<string | null>(null);
    const [details, setDetails] = useState('');
    const [imageUri, setImageUri] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // --- THE KEY FIX: isMounted controls when the native <Modal> is in the tree.
    // It is NOT the same as `visible`. It stays true during the exit animation
    // so the animated sheet has time to slide out before being destroyed.
    const [isMounted, setIsMounted] = useState(false);

    // --- Animation Values ---
    const translateY = useSharedValue(700);
    const overlayOpacity = useSharedValue(0);

    // Animated styles
    const sheetAnimStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));
    const overlayAnimStyle = useAnimatedStyle(() => ({
        opacity: overlayOpacity.value,
    }));

    // Reset all form state to initial values
    const resetFormState = useCallback(() => {
        setStep(1);
        setSelectedReason(null);
        setDetails('');
        setImageUri(null);
        setSubmitting(false);
    }, []);

    // Called by Reanimated on the JS thread after exit animation finishes
    const onAnimationOutComplete = useCallback(() => {
        // Order matters: reset first, unmount second, notify parent last.
        // This prevents any flash of Step 1 content while closing.
        resetFormState();
        setIsMounted(false);
        onClose();
    }, [onClose, resetFormState]);

    // Trigger the slide-down and fade-out animation, then clean up
    const animateOut = useCallback(() => {
        translateY.value = withTiming(700, {
            duration: ANIM_OUT_DURATION,
            easing: Easing.in(Easing.ease),
        });
        overlayOpacity.value = withTiming(0, {
            duration: ANIM_OUT_DURATION,
        }, (isFinished) => {
            // runOnJS bridges Reanimated's UI thread back to the JS thread
            if (isFinished) {
                runOnJS(onAnimationOutComplete)();
            }
        });
    }, [onAnimationOutComplete]);

    // React to parent's `visible` prop changes
    useEffect(() => {
        if (visible) {
            // Mount the modal first, then start the enter animation on next frame
            setIsMounted(true);
            translateY.value = 700; // Ensure it starts from off-screen
            overlayOpacity.value = 0;

            // requestAnimationFrame ensures the component is fully mounted before animating
            const frameId = requestAnimationFrame(() => {
                translateY.value = withTiming(0, {
                    duration: ANIM_IN_DURATION,
                    easing: Easing.out(Easing.ease),
                });
                overlayOpacity.value = withTiming(1, {
                    duration: ANIM_IN_DURATION,
                });
            });
            return () => cancelAnimationFrame(frameId);
        } else if (isMounted) {
            // Don't unmount immediately. Animate out first.
            animateOut();
        }
    }, [visible]);

    // User-facing close handler (called by Close button, overlay tap, Done button)
    const handleClose = useCallback(() => {
        animateOut();
    }, [animateOut]);

    // ---- Handlers ----

    const handleReasonSelect = (reasonId: string) => {
        setSelectedReason(reasonId);
        setStep(2);
    };

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: false,
            quality: 0.8,
        });
        if (!result.canceled) {
            setImageUri(result.assets[0].uri);
        }
    };

    const uploadScreenshot = async (uri: string): Promise<string | null> => {
        try {
            const ext = uri.substring(uri.lastIndexOf('.') + 1);
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
            const filePath = `${user?.id || 'anon'}/${fileName}`;

            const formData = new FormData();
            formData.append('file', {
                uri,
                name: fileName,
                type: `image/${ext === 'jpg' ? 'jpeg' : ext}`
            } as any);

            const { data, error } = await supabase.storage
                .from('report-evidence')
                .upload(filePath, formData, { upsert: false });

            if (error) throw error;

            const { data: publicData } = supabase.storage
                .from('report-evidence')
                .getPublicUrl(filePath);

            return publicData.publicUrl;
        } catch (error) {
            console.error("Upload failed", error);
            Alert.alert("Upload Error", "Failed to upload screenshot. Please try again.");
            return null;
        }
    };

    const handleSubmit = async () => {
        if (!selectedReason) return;
        if (!imageUri) {
            Alert.alert("Evidence Required", "Please attach a screenshot of the issue to help us review it.");
            return;
        }

        setSubmitting(true);

        try {
            const screenshotUrl = await uploadScreenshot(imageUri);
            if (!screenshotUrl) {
                setSubmitting(false);
                return;
            }

            if (targetId) {
                const { error } = await supabase.from('unified_reports').insert({
                    reporter_id: user?.id,
                    target_id: targetId,
                    target_type: targetType,
                    reason: selectedReason,
                    details: details,
                    screenshot_url: screenshotUrl,
                    status: 'pending'
                });
                if (error) throw error;
            } else if (onSubmit) {
                await onSubmit(selectedReason, details + `\n\n[Screenshot]: ${screenshotUrl}`);
            }

            setSubmitting(false);
            setStep(3); // Show success view
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Failed to submit report.");
            setSubmitting(false);
        }
    };

    // If not mounted, render nothing at all (no ghost elements)
    if (!isMounted) return null;

    return (
        <Modal
            transparent
            visible={isMounted}
            animationType="none"
            onRequestClose={handleClose}
            statusBarTranslucent
        >
            {/* Animated Overlay - separate from the sheet so they animate independently */}
            <Animated.View style={[styles.overlay, overlayAnimStyle]}>
                <TouchableWithoutFeedback onPress={handleClose}>
                    <View style={StyleSheet.absoluteFill} />
                </TouchableWithoutFeedback>
            </Animated.View>

            {/* Animated Sheet - sits on top of overlay */}
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardContainer}
                pointerEvents="box-none"
            >
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <Animated.View style={[styles.sheetContainer, sheetAnimStyle]}>
                        {/* Handle */}
                        <View style={styles.handleIndicator} />

                        {/* Header (hidden on success step) */}
                        {step !== 3 && (
                            <View style={styles.header}>
                                {step === 2 && (
                                    <TouchableOpacity onPress={() => setStep(1)} style={styles.backBtn}>
                                        <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.dark.text} />
                                    </TouchableOpacity>
                                )}
                                <Text style={styles.title}>
                                    {step === 1 ? `Report ${targetType.charAt(0).toUpperCase() + targetType.slice(1)}` : 'Evidence & Details'}
                                </Text>
                                <TouchableOpacity onPress={handleClose}>
                                    <MaterialCommunityIcons name="close" size={24} color={Colors.dark.text} />
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* Step 1: Reason Selection */}
                        {step === 1 && (
                            <View style={styles.optionsContainer}>
                                <Text style={styles.subtitle}>Why are you reporting this {targetType}?</Text>
                                {REASONS.map((reason) => (
                                    <TouchableOpacity
                                        key={reason.id}
                                        style={styles.reasonItem}
                                        onPress={() => handleReasonSelect(reason.id)}
                                    >
                                        <MaterialCommunityIcons name={reason.icon as any} size={24} color="#888" />
                                        <Text style={styles.reasonLabel}>{reason.label}</Text>
                                        <MaterialCommunityIcons name="chevron-right" size={20} color="#444" style={{ marginLeft: 'auto' }} />
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}

                        {/* Step 2: Evidence & Details */}
                        {step === 2 && (
                            <View style={styles.detailsContainer}>
                                <Text style={styles.sectionLabel}>Evidence (Required)</Text>
                                <TouchableOpacity style={styles.uploadBox} onPress={pickImage}>
                                    {imageUri ? (
                                        <Image source={{ uri: imageUri }} style={styles.previewImage} />
                                    ) : (
                                        <View style={styles.uploadPlaceholder}>
                                            <MaterialCommunityIcons name="camera-plus" size={32} color={Colors.dark.primary} />
                                            <Text style={styles.uploadText}>Attach Screenshot</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>

                                <Text style={styles.sectionLabel}>Additional Details (Optional)</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Describe the issue..."
                                    placeholderTextColor="#666"
                                    multiline
                                    numberOfLines={3}
                                    value={details}
                                    onChangeText={setDetails}
                                    textAlignVertical="top"
                                />

                                <TouchableOpacity
                                    style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
                                    onPress={handleSubmit}
                                    disabled={submitting}
                                >
                                    {submitting ? (
                                        <ActivityIndicator color="#000" />
                                    ) : (
                                        <Text style={styles.submitBtnText}>Submit Report</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* Step 3: Success */}
                        {step === 3 && (
                            <View style={styles.successContainer}>
                                <View style={styles.successIconCircle}>
                                    <MaterialCommunityIcons name="check" size={40} color="#000" />
                                </View>
                                <Text style={styles.successTitle}>Report Submitted</Text>
                                <Text style={styles.successText}>
                                    We've received your report and the evidence. We will review it manually and take action if necessary.
                                </Text>
                                <TouchableOpacity style={styles.doneBtn} onPress={handleClose}>
                                    <Text style={styles.doneBtnText}>Done</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </Animated.View>
                </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.7)',
    },
    keyboardContainer: {
        flex: 1,
        justifyContent: 'flex-end',
        pointerEvents: 'box-none',
    },
    sheetContainer: {
        backgroundColor: '#111',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingBottom: Platform.OS === 'ios' ? 40 : 20,
        paddingHorizontal: 20,
        paddingTop: 10,
        minHeight: 500,
        borderWidth: 1,
        borderColor: '#222',
        borderBottomWidth: 0,
    },
    handleIndicator: {
        width: 40,
        height: 4,
        backgroundColor: '#333',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 20,
        marginTop: 5,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    backBtn: {
        marginRight: 10,
    },
    title: {
        color: Colors.dark.text,
        fontSize: 18,
        fontWeight: 'bold',
        flex: 1,
        textAlign: 'center',
    },
    subtitle: {
        color: '#888',
        fontSize: 14,
        marginBottom: 16,
    },
    optionsContainer: {
        gap: 12,
    },
    reasonItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1A1A1A',
        padding: 16,
        borderRadius: 16,
        gap: 12,
        borderWidth: 1,
        borderColor: '#222',
    },
    reasonLabel: {
        color: Colors.dark.text,
        fontSize: 16,
        fontWeight: '500',
    },
    detailsContainer: {
        gap: 16,
    },
    sectionLabel: {
        color: '#CCC',
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 4,
    },
    uploadBox: {
        height: 150,
        backgroundColor: '#1A1A1A',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#333',
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    uploadPlaceholder: {
        alignItems: 'center',
        gap: 8,
    },
    uploadText: {
        color: Colors.dark.primary,
        fontSize: 14,
        fontWeight: '600',
    },
    previewImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    input: {
        backgroundColor: '#1A1A1A',
        color: Colors.dark.text,
        padding: 16,
        borderRadius: 16,
        height: 100,
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#333',
    },
    submitBtn: {
        backgroundColor: Colors.dark.primary,
        padding: 16,
        borderRadius: 16,
        alignItems: 'center',
        marginTop: 8,
    },
    submitBtnText: {
        color: '#000',
        fontWeight: 'bold',
        fontSize: 16,
    },
    successContainer: {
        alignItems: 'center',
        paddingVertical: 30,
        gap: 15,
    },
    successIconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: Colors.dark.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
    },
    successTitle: {
        color: 'white',
        fontSize: 20,
        fontWeight: 'bold',
    },
    successText: {
        color: '#888',
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 22,
        maxWidth: '90%',
    },
    doneBtn: {
        marginTop: 20,
        backgroundColor: '#222',
        paddingVertical: 12,
        paddingHorizontal: 40,
        borderRadius: 30,
        borderWidth: 1,
        borderColor: '#333',
    },
    doneBtnText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 16,
    }
});
