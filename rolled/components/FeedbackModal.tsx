import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import * as Device from 'expo-device';

interface FeedbackModalProps {
    visible: boolean;
    onClose: () => void;
}

export const FeedbackModal = ({ visible, onClose }: FeedbackModalProps) => {
    const { user } = useAuth();
    const [message, setMessage] = useState('');
    const [type, setType] = useState<'feedback' | 'bug' | 'other'>('feedback');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (!message.trim()) {
            Alert.alert("Empty", "Please enter your message.");
            return;
        }

        setLoading(true);
        try {
            const deviceInfo = {
                brand: Device.brand,
                modelName: Device.modelName,
                osName: Device.osName,
                osVersion: Device.osVersion,
            };

            const { error } = await supabase.from('feedback').insert({
                user_id: user?.id,
                message: message.trim(),
                type,
                device_info: deviceInfo
            });

            if (error) throw error;

            Alert.alert("Thank You!", "We appreciate your feedback.");
            setMessage('');
            setType('feedback');
            onClose();

        } catch (error: any) {
            console.error(error);
            Alert.alert("Error", "Failed to send feedback. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.modalOverlay}
            >
                <View style={styles.modalContent}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.title}>Send Feedback</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color={Colors.dark.text} />
                        </TouchableOpacity>
                    </View>

                    {/* Type Selector */}
                    <View style={styles.typeContainer}>
                        {(['feedback', 'bug', 'other'] as const).map((t) => (
                            <TouchableOpacity
                                key={t}
                                style={[
                                    styles.typeButton,
                                    type === t && styles.typeButtonActive
                                ]}
                                onPress={() => setType(t)}
                            >
                                <Text style={[
                                    styles.typeText,
                                    type === t && styles.typeTextActive
                                ]}>
                                    {t.charAt(0).toUpperCase() + t.slice(1)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Input */}
                    <TextInput
                        style={styles.input}
                        placeholder="Tell us what you think or report a bug..."
                        placeholderTextColor={Colors.dark.textSecondary}
                        multiline
                        textAlignVertical="top"
                        value={message}
                        onChangeText={setMessage}
                    />

                    {/* Submit Button */}
                    <TouchableOpacity
                        style={[styles.submitButton, loading && { opacity: 0.7 }]}
                        onPress={handleSubmit}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#000" />
                        ) : (
                            <Text style={styles.submitText}>Send Feedback</Text>
                        )}
                    </TouchableOpacity>

                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: Colors.dark.card,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        paddingBottom: 40,
        minHeight: 400,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: Colors.dark.text,
    },
    typeContainer: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 20,
    },
    typeButton: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: Colors.dark.border,
        backgroundColor: Colors.dark.background,
    },
    typeButtonActive: {
        backgroundColor: Colors.dark.primary,
        borderColor: Colors.dark.primary,
    },
    typeText: {
        color: Colors.dark.textSecondary,
        fontWeight: '600',
    },
    typeTextActive: {
        color: '#000',
    },
    input: {
        backgroundColor: Colors.dark.background,
        borderRadius: 12,
        padding: 15,
        height: 150,
        color: Colors.dark.text,
        fontSize: 16,
        marginBottom: 20,
    },
    submitButton: {
        backgroundColor: Colors.dark.primary,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    submitText: {
        color: '#000',
        fontWeight: 'bold',
        fontSize: 16,
    },
});
