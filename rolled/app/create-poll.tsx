import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScreenWrapper } from '../components/ScreenWrapper';
import { Colors } from '../constants/Colors';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export default function CreatePollScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { user } = useAuth();

    const [question, setQuestion] = useState('');
    const [options, setOptions] = useState(['', '']); // Start with 2 empty options
    const [loading, setLoading] = useState(false);

    const handleAddOption = () => {
        if (options.length >= 5) {
            Alert.alert("Limit Reached", "You can have a maximum of 5 options.");
            return;
        }
        setOptions([...options, '']);
    };

    const handleRemoveOption = (index: number) => {
        if (options.length <= 2) {
            Alert.alert("Minimum Options", "A poll must have at least 2 options.");
            return;
        }
        const newOptions = options.filter((_, i) => i !== index);
        setOptions(newOptions);
    };

    const handleOptionChange = (text: string, index: number) => {
        const newOptions = [...options];
        newOptions[index] = text;
        setOptions(newOptions);
    };

    const handlePost = async () => {
        if (!question.trim()) {
            Alert.alert("Missing Question", "Please ask a question.");
            return;
        }

        const validOptions = options.map(o => o.trim()).filter(o => o.length > 0);
        if (validOptions.length < 2) {
            Alert.alert("Invalid Options", "Please provide at least 2 valid options.");
            return;
        }

        if (!user) return;
        setLoading(true);

        try {
            // 1. Create Post
            const { data: postData, error: postError } = await supabase
                .from('posts')
                .insert({
                    user_id: user.id,
                    content: question.trim(),
                    has_poll: true,
                    audience: 'public' // Default to public for now
                })
                .select()
                .single();

            if (postError) throw postError;

            // 2. Create Options
            const optionsToInsert = validOptions.map((text, index) => ({
                post_id: postData.id,
                option_text: text,
                index: index
            }));

            const { error: optionsError } = await supabase
                .from('poll_options')
                .insert(optionsToInsert);

            if (optionsError) throw optionsError;

            // Success
            router.back();

        } catch (error: any) {
            console.error("Poll creation failed:", error);
            Alert.alert("Error", error.message);
        } finally {
            setLoading(false);
        }
    };

    const isValid = question.trim().length > 0 && options.every(o => o.trim().length > 0);

    return (
        <ScreenWrapper style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
                    <Ionicons name="close" size={28} color="white" />
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.postButton, !isValid && styles.postButtonDisabled]}
                    onPress={handlePost}
                    disabled={!isValid || loading}
                >
                    {loading ? (
                        <ActivityIndicator color="white" size="small" />
                    ) : (
                        <Text style={styles.postButtonText}>Post</Text>
                    )}
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
                <Text style={styles.label}>Question</Text>
                <TextInput
                    style={styles.questionInput}
                    placeholder="Ask a question..."
                    placeholderTextColor="#666"
                    multiline
                    maxLength={280}
                    value={question}
                    onChangeText={setQuestion}
                    autoFocus
                />

                <Text style={styles.label}>Options</Text>
                <View style={styles.optionsContainer}>
                    {options.map((option, index) => (
                        <View key={index} style={styles.optionRow}>
                            <View style={styles.optionInputContainer}>
                                <TextInput
                                    style={styles.optionInput}
                                    placeholder={`Option ${index + 1}`}
                                    placeholderTextColor="#666"
                                    value={option}
                                    onChangeText={(text) => handleOptionChange(text, index)}
                                    maxLength={50}
                                />
                            </View>
                            {options.length > 2 && (
                                <TouchableOpacity onPress={() => handleRemoveOption(index)} style={styles.removeButton}>
                                    <Ionicons name="close-circle" size={20} color={Colors.dark.textSecondary} />
                                </TouchableOpacity>
                            )}
                        </View>
                    ))}
                </View>

                {options.length < 5 && (
                    <TouchableOpacity style={styles.addOptionButton} onPress={handleAddOption}>
                        <Ionicons name="add" size={20} color={Colors.dark.primary} />
                        <Text style={styles.addOptionText}>Add another option</Text>
                    </TouchableOpacity>
                )}

                <Text style={styles.hint}>
                    Polls last for 24 hours. Everyone can see the results.
                </Text>
            </ScrollView>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.dark.background,
        paddingHorizontal: 0, // Override ScreenWrapper default
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    closeButton: {
        padding: 5,
    },
    postButton: {
        backgroundColor: Colors.dark.primary,
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 20,
    },
    postButtonDisabled: {
        backgroundColor: '#333',
        opacity: 0.7,
    },
    postButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14,
    },
    content: {
        flex: 1,
        padding: 10,
    },
    label: {
        color: Colors.dark.textSecondary,
        fontSize: 12,
        fontWeight: 'bold',
        marginBottom: 10,
        marginTop: 10,
        textTransform: 'uppercase',
        letterSpacing: 1
    },
    questionInput: {
        color: 'white',
        fontSize: 18,
        minHeight: 80,
        textAlignVertical: 'top',
        marginBottom: 20,
    },
    optionsContainer: {
        gap: 8, // Reduced from 15
    },
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    optionInputContainer: {
        flex: 1,
        backgroundColor: '#222',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#333',
        paddingHorizontal: 15,
        paddingVertical: 12, // Taller buttons
    },
    optionInput: {
        color: 'white',
        fontSize: 16,
    },
    removeButton: {
        padding: 5,
    },
    addOptionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 20,
        gap: 8,
        paddingVertical: 10,
    },
    addOptionText: {
        color: Colors.dark.primary,
        fontSize: 15,
        fontWeight: '500',
    },
    hint: {
        color: '#666',
        fontSize: 12,
        marginTop: 30,
        textAlign: 'center',
    }
});
