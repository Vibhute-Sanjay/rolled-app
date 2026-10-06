import { Redirect } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { useEffect, useState } from 'react';
import { Colors } from '../constants/Colors';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

export default function Index() {
    const { session, isLoading: authLoading } = useAuth();
    const [isReady, setIsReady] = useState(false);
    const [targetRoute, setTargetRoute] = useState<string | null>(null);

    useEffect(() => {
        const checkProfile = async () => {
            if (!session?.user) {
                setTargetRoute('/(auth)/welcome');
                setIsReady(true);
                return;
            }

            // Check if user is onboarded
            const { data, error } = await supabase
                .from('profiles')
                .select('is_onboarded')
                .eq('id', session.user.id)
                .single();

            if (data?.is_onboarded) {
                setTargetRoute('/(tabs)/feed');
            } else {
                setTargetRoute('/(auth)/signup/profile');
            }
            setIsReady(true);
        };

        if (!authLoading) {
            checkProfile();
        }
    }, [session, authLoading]);

    if (!isReady || authLoading) return null; // Splash handles this

    return <Redirect href={targetRoute as any} />;
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.dark.background, // Match app theme
        justifyContent: 'center',
        alignItems: 'center',
    },
    centerContent: {
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
    },
    logo: {
        fontSize: 56,
        fontWeight: 'bold', // or '900'
        color: '#FFFFFF',
        letterSpacing: -2,
    },
    dot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: Colors.dark.primary, // Cyan
        marginLeft: 4,
    },
    tagline: {
        fontSize: 18,
        color: Colors.dark.primary, // Cyan
        fontStyle: 'italic',
        marginTop: 8,
        letterSpacing: 1,
    },
    footer: {
        position: 'absolute',
        bottom: 50,
        alignItems: 'center',
    },
    fromText: {
        fontSize: 12,
        color: Colors.dark.textSecondary,
        letterSpacing: 1,
        marginBottom: 4,
    },
    brandText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.dark.primary, // Cyan/Blue
        letterSpacing: 0.5,
    },
});
