
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { Button } from '../../../components/Button';
import { Input } from '../../../components/Input';
import { ScreenWrapper } from '../../../components/ScreenWrapper';
import { Colors } from '../../../constants/Colors';
import { supabase } from '../../../lib/supabase';

export default function UsernameScreen() {
    const router = useRouter();
    const { role } = useLocalSearchParams<{ role: string }>();

    const [username, setUsername] = useState('');
    const [isAvailable, setIsAvailable] = useState<boolean | null>(null); // null = not checked, false = taken, true = available
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Debounce logic
    useEffect(() => {
        const checkAvailability = async () => {
            if (username.length < 3) {
                setIsAvailable(null);
                setError(null);
                return;
            }

            setLoading(true);
            setError(null);

            // Check Supabase
            const { data, error } = await supabase
                .from('profiles')
                .select('username')
                .eq('username', username)
                .single();

            setLoading(false);

            if (error && error.code === 'PGRST116') {
                // No row found, so it is unique!
                setIsAvailable(true);
                setError(null);
            } else if (data) {
                // Row found, taken
                setIsAvailable(false);
                setError('This username is already taken. Try another.');
            } else {
                // Some other error
                console.error(error);
            }
        };

        const debounce = setTimeout(() => {
            checkAvailability();
        }, 500);

        return () => clearTimeout(debounce);
    }, [username]);

    const handleContinue = () => {
        if (isAvailable) {
            router.push({
                pathname: '/(auth)/signup/email',
                params: { role, username }
            });
        }
    };

    return (
        <ScreenWrapper>
            <View style={styles.header}>
                <Text style={styles.stepIndicator}>Step 2 of 6</Text>
                <Text style={styles.title}>Create a username.</Text>
                <Text style={styles.subtitle}>Pick a unique handle for your profile.</Text>
            </View>

            <Input
                placeholder="@username"
                value={username}
                onChangeText={(t) => setUsername(t.toLowerCase().replace(/[^a-z0-9_.]/g, ''))} // only lowercase, nums, underscore, dot
                autoCapitalize="none"
                leftIcon="at"
                success={isAvailable === true && !loading}
                error={error}
                description={isAvailable === true ? "Username is available!" : "Must be at least 3 characters."}
            />

            <Button
                title="Continue"
                onPress={handleContinue}
                disabled={!isAvailable || loading}
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
