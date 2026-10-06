
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { Colors } from '../../constants/Colors';
import { supabase } from '../../lib/supabase';

export default function LoginScreen() {
    const router = useRouter();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [securePassword, setSecurePassword] = useState(true);
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        setLoading(true);
        const { error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });
        setLoading(false);

        if (error) {
            if (error.message.includes("Email not confirmed")) {
                Alert.alert(
                    'Email Not Verified',
                    'Please verify your email to log in.',
                    [
                        { text: 'Cancel', style: 'cancel' },
                        {
                            text: 'Verify Now',
                            onPress: () => router.push({ pathname: '/(auth)/signup/otp', params: { email } })
                        }
                    ]
                );
            } else {
                Alert.alert('Login Failed', error.message);
            }
        } else {
            // AuthContext will handle redirect to (tabs)
            router.replace('/(tabs)/feed' as any);
        }
    };

    return (
        <SafeAreaView style={{ flex: 1 }}>
            <ScreenWrapper style={{ justifyContent: 'center' }}>
                <Text style={styles.title}>Welcome Back</Text>
                <Text style={styles.subtitle}>Log in to continue.</Text>

                <Input
                    placeholder="student@mitwpu.edu.in"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    leftIcon="envelope"
                    containerStyle={{ marginTop: 24 }}
                />

                <Input
                    placeholder="Password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={securePassword}
                    leftIcon="lock"
                    rightIcon={securePassword ? "eye" : "eye-slash"}
                    onRightIconPress={() => setSecurePassword(!securePassword)}
                    containerStyle={{ marginTop: 16 }}
                />

                <Button
                    title="Log In"
                    onPress={handleLogin}
                    loading={loading}
                    style={{ marginTop: 20 }}
                />

                <Button
                    title="Forgot Password?"
                    variant="ghost"
                    onPress={() => router.push('/(auth)/forgot-password')}
                />
            </ScreenWrapper>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    title: { fontSize: 36, fontWeight: 'bold', color: Colors.dark.text, marginBottom: 8 },
    subtitle: { fontSize: 18, color: Colors.dark.textSecondary },
});
