import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { Colors } from '../../constants/Colors';
import { supabase } from '../../lib/supabase';

export default function ResetPasswordScreen() {
    const router = useRouter();
    const [password, setPassword] = useState('');
    const [securePassword, setSecurePassword] = useState(true);
    const [loading, setLoading] = useState(false);

    const handleUpdatePassword = async () => {
        if (password.length < 6) {
            Alert.alert("Weak Password", "Password must be at least 6 characters.");
            return;
        }

        setLoading(true);
        const { error } = await supabase.auth.updateUser({
            password: password
        });
        setLoading(false);

        if (error) {
            Alert.alert("Error", error.message);
        } else {
            Alert.alert(
                "Success",
                "Your password has been updated!",
                [
                    {
                        text: "Go to Login",
                        onPress: () => {
                            // Sign out to force re-login with new password, or just go to feed?
                            // Best practice: Go to Feed if session is active, or Login.
                            // Since `updateUser` keeps session, we can go to Feed or Login.
                            // Let's go to Login for security/clarity.
                            supabase.auth.signOut();
                            router.dismissAll();
                            router.replace('/(auth)/login' as any);
                        }
                    }
                ]
            );
        }
    };

    return (
        <ScreenWrapper>
            <View style={styles.header}>
                <Text style={styles.stepIndicator}>Step 3 of 3</Text>
                <Text style={styles.title}>New Password</Text>
                <Text style={styles.subtitle}>Enter your new password below.</Text>
            </View>

            <Input
                placeholder="New Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={securePassword}
                leftIcon="lock"
                rightIcon={securePassword ? "eye" : "eye-slash"}
                onRightIconPress={() => setSecurePassword(!securePassword)}
            />

            <Button
                title="Update Password"
                onPress={handleUpdatePassword}
                loading={loading}
                disabled={!password || loading}
                style={{ marginTop: 24 }}
            />

            <Button
                title="Cancel & Sign Out"
                variant="ghost"
                onPress={async () => {
                    await supabase.auth.signOut();
                    router.dismissAll();
                    router.replace('/(auth)/login' as any);
                }}
                style={{ marginTop: 12 }}
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
