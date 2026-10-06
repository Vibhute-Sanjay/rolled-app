
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../../components/Button';
import { Input } from '../../../components/Input';
import { ScreenWrapper } from '../../../components/ScreenWrapper';
import { Colors } from '../../../constants/Colors';
import { supabase } from '../../../lib/supabase';

export default function PasswordScreen() {
    const router = useRouter();
    const { role, username, email } = useLocalSearchParams<{ role: string, username: string, email: string }>();

    const [password, setPassword] = useState('');
    const [securePassword, setSecurePassword] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Regex: At least 1 Uppercase, 1 Number, 1 Symbol
    const strongRegex = new RegExp("^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])");
    const isStrong = strongRegex.test(password) && password.length >= 8;

    const handleSignUp = async () => {
        if (!isStrong) {
            setError("Password is not strong enough.");
            return;
        }

        setLoading(true);
        // Call Supabase SignUp
        // We pass metadata so we can use it in Step 8 or trigger
        const { data, error } = await supabase.auth.signUp({
            email: email!,
            password: password,
            options: {
                data: {
                    username: username,
                    role: role,
                }
            }
        });

        setLoading(false);

        if (error) {
            if (error.message.includes("already registered")) {
                Alert.alert(
                    'Account Exists',
                    'This email is already registered.',
                    [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Log In', onPress: () => router.push('/(auth)/login' as any) }
                    ]
                );
            } else {
                Alert.alert('Sign Up Failed', error.message);
            }
        } else {
            // Success!
            // Supabase usually sends an email now.
            // Navigate to OTP page.
            router.push({
                pathname: '/(auth)/signup/otp' as any,
                params: { email } // Pass email to confirm where code was sent
            });
        }
    };

    return (
        <ScreenWrapper>
            <View style={styles.header}>
                <Text style={styles.stepIndicator}>Step 4 of 6</Text>
                <Text style={styles.title}>Secure your account</Text>
                <Text style={styles.subtitle}>Create a strong password.</Text>
            </View>

            <Input
                placeholder="Password"
                value={password}
                onChangeText={(t) => {
                    setPassword(t);
                    setError(null);
                }}
                secureTextEntry={securePassword}
                leftIcon="lock"
                rightIcon={securePassword ? "eye" : "eye-slash"}
                onRightIconPress={() => setSecurePassword(!securePassword)}
                success={isStrong}
                error={error}
                description={
                    <Text>
                        Must contain: 1 Uppercase (A-Z), 1 Number (0-9), 1 Symbol (!@#$%), Min 8 chars.
                    </Text> as any // Casting to any to satisfy basic string prop if strict, but React Node is usually fine in RN Text
                }
            />

            <Button
                title="Sign Up & Send OTP"
                onPress={handleSignUp}
                disabled={!isStrong || loading}
                loading={loading}
                style={{ marginTop: 20 }}
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
