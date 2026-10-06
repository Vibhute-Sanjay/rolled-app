import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { Colors } from '../../constants/Colors';
import { supabase } from '../../lib/supabase';
import { FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInUp, FadeIn } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

export default function UnrolledOnboarding() {
    const router = useRouter();
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleEnter = async () => {
        if (name.length < 3) {
            setError("Name must be at least 3 characters.");
            return;
        }
        if (name.length > 25) {
            setError("Name too long (max 25 chars).");
            return;
        }

        setLoading(true);
        setError('');

        try {
            const { data, error } = await supabase.rpc('create_anon_identity', {
                desired_name: name
            });

            if (error) throw error;

            if (data?.error) {
                setError(data.error);
            } else if (data?.success) {
                // success
                router.replace('/(tabs)/unrolled' as any);
            }
        } catch (e: any) {
            console.error(e);
            setError("Something went wrong. Try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScreenWrapper style={styles.container}>
            <View style={styles.topBar}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => {
                        if (router.canGoBack()) {
                            router.back();
                        } else {
                            router.replace('/(tabs)/feed' as any);
                        }
                    }}
                >
                    <FontAwesome5 name="arrow-left" size={18} color="#fff" />
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1, justifyContent: 'center' }}
            >
                <View style={styles.content}>
                    <Animated.View entering={FadeInUp.delay(200).springify()}>
                        <View style={styles.logoContainer}>
                            <MaterialCommunityIcons name="ghost" size={40} color={Colors.dark.primary} />
                            <Text style={styles.logoText}>Unrolled.</Text>
                        </View>
                    </Animated.View>

                    <Animated.View entering={FadeInUp.delay(400).springify()} style={styles.manifestoContainer}>
                        <Text style={styles.manifestoText}>Unrolled is a space to share</Text>
                        <Text style={styles.manifestoText}>campus banter, takes, and everyday stories.</Text>
                        <Text style={[styles.manifestoText, { color: Colors.dark.primary, marginTop: 10 }]}>Drop your takes. Speak your mind.</Text>
                    </Animated.View>

                    <Animated.View entering={FadeInUp.delay(600).springify()} style={styles.inputContainer}>
                        <Text style={styles.label}>CHOOSE YOUR SECRET NAME</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. Neon Drifter"
                            placeholderTextColor="#555"
                            value={name}
                            onChangeText={(t) => { setName(t); setError(''); }}
                            autoCapitalize="words"
                        />
                        {error ? <Text style={styles.errorText}>{error}</Text> : null}
                        <Text style={styles.helperText}>
                            Your name could be removed if it's inappropriate.
                        </Text>
                    </Animated.View>

                    <Animated.View entering={FadeIn.delay(800)} style={styles.buttonContainer}>
                        <TouchableOpacity
                            style={[styles.button, loading && { opacity: 0.7 }]}
                            onPress={handleEnter}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#000" />
                            ) : (
                                <Text style={styles.buttonText}>ENTER UNROLLED</Text>
                            )}
                        </TouchableOpacity>

                        <Text style={styles.agreementText}>
                            By continuing, you acknowledge that you are responsible for your actions and agree to our{' '}
                            <Text
                                style={styles.agreementLink}
                                onPress={() => router.push('/community-guidelines' as any)}
                            >
                                Community Guidelines
                            </Text>
                            .
                        </Text>
                    </Animated.View>
                </View>
            </KeyboardAvoidingView>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 0,
        backgroundColor: '#000', // Deep black for Unrolled
    },
    topBar: {
        paddingHorizontal: 20,
        paddingTop: 10,
        alignItems: 'flex-start',
        zIndex: 10,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#161616',
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        paddingHorizontal: 30,
        alignItems: 'center',
    },
    logoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 40,
        gap: 8
    },
    logoText: {
        fontSize: 32,
        fontWeight: '900',
        color: '#fff',
        fontStyle: 'italic',
    },
    manifestoContainer: {
        alignItems: 'center',
        marginBottom: 50,
        gap: 8,
    },
    manifestoText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#888',
        textAlign: 'center',
    },
    inputContainer: {
        width: '100%',
        marginBottom: 30,
    },
    label: {
        fontSize: 12,
        fontWeight: 'bold',
        color: Colors.dark.primary,
        marginBottom: 10,
        letterSpacing: 1,
    },
    input: {
        backgroundColor: '#111',
        borderWidth: 1,
        borderColor: '#333',
        borderRadius: 12,
        padding: 16,
        fontSize: 18,
        color: '#fff',
        fontWeight: '500',
    },
    helperText: {
        color: '#666',
        fontSize: 12,
        marginTop: 8,
        textAlign: 'center',
    },
    errorText: {
        color: '#ff4444',
        fontSize: 12,
        marginTop: 8,
        marginLeft: 4,
    },
    buttonContainer: {
        width: '100%',
    },
    button: {
        backgroundColor: Colors.dark.primary,
        paddingVertical: 16,
        borderRadius: 30,
        alignItems: 'center',
        shadowColor: Colors.dark.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
        elevation: 8,
    },
    buttonText: {
        color: '#000',
        fontSize: 16,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    agreementText: {
        color: '#8e8e93',
        fontSize: 12,
        lineHeight: 18,
        textAlign: 'center',
        marginTop: 18,
        paddingHorizontal: 8,
    },
    agreementLink: {
        color: Colors.dark.primary,
        fontWeight: '600',
        textDecorationLine: 'underline',
    },
});
