
import { Stack } from 'expo-router';
import { Colors } from '../../constants/Colors';

export default function AuthLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: Colors.dark.background },
                animation: 'slide_from_right', // Smooth transitions for the wizard feel
            }}
        >
            <Stack.Screen name="welcome" />
            <Stack.Screen name="index" />
            <Stack.Screen name="signup/role" />
            <Stack.Screen name="signup/username" />
            <Stack.Screen name="signup/email" />
            <Stack.Screen name="signup/password" />
            <Stack.Screen name="signup/otp" />
            <Stack.Screen name="signup/profile" />
            <Stack.Screen name="welcome-splash" options={{ animation: 'fade', gestureEnabled: false }} />
        </Stack>
    );
}
