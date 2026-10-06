import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View, StyleSheet, Alert } from 'react-native';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { Colors } from '../../constants/Colors';
import { supabase } from '../../lib/supabase';

export default function VerifyResetOtpScreen() {
    const router = useRouter();
    const { email } = useLocalSearchParams<{ email: string }>();

    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleVerify = async () => {
        if (otp.length !== 6) {
            setError("OTP must be 6 digits.");
            return;
        }

        setLoading(true);
        setError(null);

        // Verify OTP for Recovery (Magic Link type works for OTP too usually, or 'recovery')
        // Supabase `verifyOtp` uses `type: 'recovery'` for password resets via email link, 
        // but for pure OTP it's technically `email` or `magiclink`.
        // However, `signInWithOtp` sends a `magiclink` or `signup` or `recovery` token.
        // For password reset flow initiated by signInWithOtp, we usually use type: 'recovery' or 'magiclink' depending on config.
        // Let's try 'recovery' first as it's semantically correct for passwords.

        const { data, error } = await supabase.auth.verifyOtp({
            email: email!,
            token: otp,
            type: 'recovery',
        });

        // Fallback: If 'recovery' fails, try 'magiclink' (sometimes needed depending on backend config)
        if (error) {
            console.log("Recovery type failed, trying magiclink...");
            const { data: retryData, error: retryError } = await supabase.auth.verifyOtp({
                email: email!,
                token: otp,
                type: 'magiclink',
            });

            setLoading(false);

            if (retryError) {
                Alert.alert('Invalid Code', error.message); // Show original error usually
                return;
            }
        } else {
            setLoading(false);
        }

        // If we get here, we are authenticated!
        router.replace('/(auth)/reset-password');
    };

    return (
        <ScreenWrapper>
            <View style={styles.header}>
                <Text style={styles.stepIndicator}>Step 2 of 3</Text>
                <Text style={styles.title}>Verify it's you</Text>
                <Text style={styles.subtitle}>Enter the 6-digit code sent to {email}.</Text>
            </View>

            <Input
                placeholder="123456"
                value={otp}
                onChangeText={(t) => {
                    setOtp(t.replace(/[^0-9]/g, ''));
                    setError(null);
                }}
                keyboardType="number-pad"
                maxLength={6}
                leftIcon="key"
                error={error}
                style={{ fontSize: 24, letterSpacing: 8, textAlign: 'center' }}
            />

            <Button
                title="Verify Code"
                onPress={handleVerify}
                disabled={otp.length !== 6 || loading}
                loading={loading}
                style={{ marginTop: 24 }}
            />

            <Button
                title="Resend Code"
                variant="ghost"
                onPress={async () => {
                    await supabase.auth.signInWithOtp({ email: email!, options: { shouldCreateUser: false } });
                    Alert.alert('Sent!', 'Check your inbox again.');
                }}
                style={{ marginTop: 10 }}
            />
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    header: { marginTop: 40, marginBottom: 40 },
    stepIndicator: { fontSize: 14, color: Colors.dark.primary, fontWeight: 'bold', marginBottom: 8, textTransform: 'uppercase' },
    title: { fontSize: 32, fontWeight: 'bold', color: Colors.dark.text, marginBottom: 10 },
    subtitle: { fontSize: 16, color: Colors.dark.textSecondary },
});
