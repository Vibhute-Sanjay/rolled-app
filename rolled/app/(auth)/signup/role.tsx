
import { useRouter } from 'expo-router';
import { Text, View, StyleSheet, TouchableOpacity } from 'react-native';
import { ScreenWrapper } from '../../../components/ScreenWrapper';
import { Colors } from '../../../constants/Colors';
import { FontAwesome5 } from '@expo/vector-icons';

export default function RoleSelection() {
    const router = useRouter();

    const handleSelect = (role: 'student' | 'club') => {
        router.push({
            pathname: '/(auth)/signup/username',
            params: { role },
        });
    };

    const RoleCard = ({ role, icon, title, desc }: { role: 'student' | 'club', icon: string, title: string, desc: string }) => (
        <TouchableOpacity
            style={styles.card}
            onPress={() => handleSelect(role)}
            activeOpacity={0.7}
        >
            <View style={styles.iconContainer}>
                <FontAwesome5 name={icon} size={24} color={Colors.dark.primary} />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{title}</Text>
                <Text style={styles.cardDesc}>{desc}</Text>
            </View>
            <FontAwesome5 name="chevron-right" size={16} color={Colors.dark.textSecondary} />
        </TouchableOpacity>
    );

    return (
        <ScreenWrapper>
            <View style={styles.header}>
                <Text style={styles.stepIndicator}>Step 1 of 6</Text>
                <Text style={styles.title}>Who are you?</Text>
                <Text style={styles.subtitle}>Choose how you want to be identified on Rolled.</Text>
            </View>

            <View style={styles.cardsContainer}>
                <RoleCard
                    role="student"
                    icon="user-graduate"
                    title="Student"
                    desc="I am a student at MIT WPU."
                />
                <RoleCard
                    role="club"
                    icon="users"
                    title="Club / Organization"
                    desc="We are an official campus club."
                />
            </View>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    header: {
        marginTop: 20,
        marginBottom: 40,
    },
    stepIndicator: {
        fontSize: 14,
        color: Colors.dark.primary,
        fontWeight: 'bold',
        marginBottom: 8,
        textTransform: 'uppercase',
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: Colors.dark.text,
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 16,
        color: Colors.dark.textSecondary,
        lineHeight: 22,
    },
    cardsContainer: {
        gap: 16,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.dark.card,
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    iconContainer: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: 'rgba(0, 240, 255, 0.1)', // Primary with opacity
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.dark.text,
        marginBottom: 4,
    },
    cardDesc: {
        fontSize: 14,
        color: Colors.dark.textSecondary,
    },
});
