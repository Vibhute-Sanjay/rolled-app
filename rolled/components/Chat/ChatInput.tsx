import React, { useState } from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import * as ImagePicker from 'expo-image-picker';

type ChatInputProps = {
    onSend: (text: string) => void;
    onSendImage: (uri: string) => void;
    onTyping?: () => void;
    isLoading?: boolean;
};

import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const ChatInput = ({ onSend, onSendImage, onTyping, isLoading }: ChatInputProps) => {
    const [text, setText] = useState('');
    const [uploading, setUploading] = useState(false);
    const insets = useSafeAreaInsets();

    // ... (rest of logic)

    const handleSend = () => {
        if (!text.trim()) return;
        onSend(text.trim());
        setText('');
    };

    const handleChangeText = (val: string) => {
        setText(val);
        if (onTyping && val.length > 0) {
            onTyping();
        }
    };

    const pickImage = async (useCamera: boolean) => {
        try {
            const options: ImagePicker.ImagePickerOptions = {
                mediaTypes: ['images'],
                allowsEditing: true,
                quality: 0.5,
            };

            let result;
            if (useCamera) {
                const { status } = await ImagePicker.requestCameraPermissionsAsync();
                if (status !== 'granted') {
                    Alert.alert('Permission needed', 'Camera permission is required.');
                    return;
                }
                result = await ImagePicker.launchCameraAsync(options);
            } else {
                const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (status !== 'granted') {
                    Alert.alert('Permission needed', 'Gallery permission is required.');
                    return;
                }
                result = await ImagePicker.launchImageLibraryAsync({
                    ...options,
                    allowsEditing: false,
                    allowsMultipleSelection: true,
                    selectionLimit: 5
                });
            }

            if (!result.canceled) {
                setUploading(true);
                if (result.assets) {
                    for (const asset of result.assets) {
                        onSendImage(asset.uri);
                    }
                }
                setUploading(false);
            }
        } catch (error) {
            console.error('Image Picker Error:', error);
            setUploading(false);
            Alert.alert('Error', 'Failed to pick image.');
        }
    };

    return (
        <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 10) }]}>
            <TouchableOpacity
                style={styles.iconButton}
                onPress={() => pickImage(false)}
                disabled={isLoading || uploading}
            >
                <Ionicons name="attach" size={24} color={Colors.dark.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
                style={styles.iconButton}
                onPress={() => pickImage(true)}
                disabled={isLoading || uploading}
            >
                <FontAwesome5 name="camera" size={20} color={Colors.dark.primary} />
            </TouchableOpacity>

            <View style={styles.inputContainer}>
                <TextInput
                    style={styles.input}
                    placeholder="Message..."
                    placeholderTextColor={Colors.dark.textSecondary}
                    value={text}
                    onChangeText={handleChangeText}
                    multiline
                    maxLength={500}
                />
            </View>
            <TouchableOpacity
                style={[styles.sendButton, !text.trim() && styles.sendButtonDisabled]}
                onPress={handleSend}
                disabled={!text.trim() || isLoading || uploading}
            >
                {isLoading || uploading ? (
                    <ActivityIndicator size="small" color="#fff" />
                ) : (
                    <FontAwesome5 name="paper-plane" size={20} color={text.trim() ? Colors.dark.primary : Colors.dark.textSecondary} />
                )}
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: 16,
        paddingTop: 10,
        // paddingBottom handled dynamically
        backgroundColor: Colors.dark.background,
        borderTopWidth: 1,
        borderTopColor: Colors.dark.border,
    },
    inputContainer: {
        flex: 1,
        backgroundColor: Colors.dark.card,
        borderRadius: 24,
        paddingHorizontal: 16,
        paddingVertical: 8,
        minHeight: 44,
        maxHeight: 120,
        marginRight: 10,
        justifyContent: 'center',
    },
    input: {
        color: Colors.dark.text,
        fontSize: 16,
        paddingTop: 0,
        paddingBottom: 0,
    },
    sendButton: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 0,
    },
    sendButtonDisabled: {
        opacity: 0.5,
    },
    iconButton: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 0,
        marginRight: 8,
    },
});
