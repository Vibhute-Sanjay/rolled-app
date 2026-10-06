import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { Colors } from '../../constants/Colors';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';

export default function ForgotPasswordScreen() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSendCode = async () => {
        if (!email.includes('@')) {
            Alert.alert("Invalid Email", "Please enter a valid email address.");
            return;
        }

        setLoading(true);
        // Step 1: Send OTP for Recovery (Triggers "Reset Password" template)
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            // We don't provide a redirectTo because we want the code (Token), not a link.
            // Ensure your Supabase "Reset Password" template uses {{ .Token }}
        });

        setLoading(false);

        if (error) {
            Alert.alert("Error", error.message);
        } else {
            // Step 2: Navigate to Verify OTP Screen
            router.push({
                pathname: '/(auth)/verify-reset-otp',
                params: { email }
            } as any);
        }
    };

    return (
        <ScreenWrapper>
            <View style={styles.header}>
                <Ionicons name="lock-closed-outline" size={64} color={Colors.dark.primary} style={{ marginBottom: 20 }} />
                <Text style={styles.title}>Forgot Password?</Text>
                <Text style={styles.subtitle}>Enter your email to receive a 6-digit reset code.</Text>
            </View>

            <Input
                placeholder="student@mitwpu.edu.in"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                leftIcon="envelope"
            />

            <Button
                title="Send Code"
                onPress={handleSendCode}
                loading={loading}
                disabled={!email || loading}
                style={{ marginTop: 24 }}
            />

            <Button
                title="Back to Login"
                variant="ghost"
                onPress={() => router.back()}
                style={{ marginTop: 12 }}
            />
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    header: { alignItems: 'center', marginVertical: 40 },
    title: { fontSize: 28, fontWeight: 'bold', color: Colors.dark.text, marginBottom: 12 },
    subtitle: { fontSize: 16, color: Colors.dark.textSecondary, textAlign: 'center', paddingHorizontal: 20 },
});
