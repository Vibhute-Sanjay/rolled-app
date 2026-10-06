
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../../components/Button';
import { Input } from '../../../components/Input';
import { ScreenWrapper } from '../../../components/ScreenWrapper';
import { Colors } from '../../../constants/Colors';
import { supabase } from '../../../lib/supabase';

export default function OTPScreen() {
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

        const { data, error } = await supabase.auth.verifyOtp({
            email: email!,
            token: otp,
            type: 'signup',
        });

        setLoading(false);

        if (error) {
            Alert.alert('Verification Failed', error.message);
        } else {
            // Success! Session is set.
            // Navigate to Profile Setup.
            router.push('/(auth)/signup/profile' as any);
        }
    };

    return (
        <ScreenWrapper>
            <View style={styles.header}>
                <Text style={styles.stepIndicator}>Step 5 of 6</Text>
                <Text style={styles.title}>Check your email</Text>
                <Text style={styles.subtitle}>We sent a code to {email}.</Text>
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
                // Intentionally using "key" or "keypad" icon
                leftIcon="key"
                error={error}
                style={{ fontSize: 24, letterSpacing: 8, textAlign: 'center' }}
            />

            <Button
                title="Verify & Continue"
                onPress={handleVerify}
                disabled={otp.length !== 6 || loading}
                loading={loading}
                style={{ marginTop: 20 }}
            />

            <Button
                title="Resend Code"
                variant="ghost"
                onPress={async () => {
                    await supabase.auth.resend({ type: 'signup', email: email! });
                    Alert.alert('Sent!', 'Check your inbox again.');
                }}
                style={{ marginTop: 10 }}
            />
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    header: { marginTop: 20, marginBottom: 40 },
    stepIndicator: { fontSize: 14, color: Colors.dark.primary, fontWeight: 'bold', marginBottom: 8, textTransform: 'uppercase' },
    title: { fontSize: 32, fontWeight: 'bold', color: Colors.dark.text, marginBottom: 10 },
    subtitle: { fontSize: 16, color: Colors.dark.textSecondary },
});
