
import { useRouter } from 'expo-router';
import { Text, View, StyleSheet } from 'react-native';
import { Button } from '../../components/Button';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { Colors } from '../../constants/Colors';

export default function AuthIndex() {
    const router = useRouter();

    return (
        <ScreenWrapper style={{ justifyContent: 'center' }}>
            <View style={{ marginBottom: 50 }}>
                <Text style={styles.title}>Get Started</Text>
                <Text style={styles.subtitle}>Join the hype.</Text>
            </View>

            <Button
                title="Sign Up"
                onPress={() => router.push('/(auth)/signup/role')}
                style={{ marginBottom: 16 }}
            />

            <Button
                title="Log In"
                variant="outline"
                onPress={() => router.push('/(auth)/login')}
            />
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    title: {
        fontSize: 36,
        fontWeight: 'bold',
        color: Colors.dark.text,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 18,
        color: Colors.dark.textSecondary,
    },
});
