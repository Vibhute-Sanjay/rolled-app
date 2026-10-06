
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../../components/Button';
import { Input } from '../../../components/Input';
import { ScreenWrapper } from '../../../components/ScreenWrapper';
import { Colors } from '../../../constants/Colors';

export default function EmailScreen() {
    const router = useRouter();
    const { role, username } = useLocalSearchParams<{ role: string, username: string }>();
    const [email, setEmail] = useState('');
    const [error, setError] = useState<string | null>(null);

    const isValid = email.endsWith('@mitwpu.edu.in');

    const handleContinue = () => {
        if (isValid) {
            router.push({
                pathname: '/(auth)/signup/password',
                params: { role, username, email }
            });
        } else {
            setError('Please use your official @mitwpu.edu.in email.');
        }
    };

    return (
        <ScreenWrapper>
            <View style={styles.header}>
                <Text style={styles.stepIndicator}>Step 3 of 6</Text>
                <Text style={styles.title}>Your Uni Email</Text>
                <Text style={styles.subtitle}>We verify every user to keep our community safe.</Text>
            </View>

            <Input
                placeholder="student@mitwpu.edu.in"
                value={email}
                onChangeText={(t) => {
                    setEmail(t.toLowerCase());
                    setError(null);
                }}
                autoCapitalize="none"
                keyboardType="email-address"
                leftIcon="envelope"
                success={isValid}
                error={error}
                description={isValid ? "Email domain looks good!" : "Only @mitwpu.edu.in emails are allowed."}
            />

            <Button
                title="Continue"
                onPress={handleContinue}
                disabled={!isValid}
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
