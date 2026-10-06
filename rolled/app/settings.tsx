
import { FontAwesome5 } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Platform, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { FeedbackModal } from '../components/FeedbackModal';
import { ScreenWrapper } from '../components/ScreenWrapper';
import { Colors } from '../constants/Colors';
import { useAuth } from '../context/AuthContext';

export default function SettingsScreen() {
    const router = useRouter();
    const { signOut, user } = useAuth();
    const [feedbackVisible, setFeedbackVisible] = useState(false);
    // Privacy logic removed


    const handleLogout = () => {
        Alert.alert(
            "Log Out",
            "Are you sure you want to log out?",
            [
                { text: "Cancel", style: "cancel" },
                { text: "Log Out", style: "destructive", onPress: signOut }
            ]
        );
    };

    const handleDeleteAccount = () => {
        router.push('/delete-account');
    };

    const SettingItem = ({ icon, label, onPress, destructive = false }: { icon: string, label: string, onPress: () => void, destructive?: boolean }) => (
        <TouchableOpacity style={styles.item} onPress={onPress}>
            <View style={styles.itemLeft}>
                <View style={[styles.iconBox, destructive && { backgroundColor: 'rgba(255, 69, 58, 0.1)' }]}>
                    <FontAwesome5 name={icon} size={16} color={destructive ? Colors.dark.error : Colors.dark.text} />
                </View>
                <Text style={[styles.label, destructive && { color: Colors.dark.error }]}>{label}</Text>
            </View>
            <FontAwesome5 name="chevron-right" size={12} color={Colors.dark.textSecondary} />
        </TouchableOpacity>
    );

    const ToggleItem = ({ icon, label, value, onValueChange }: { icon: string, label: string, value: boolean, onValueChange: (val: boolean) => void }) => (
        <View style={styles.item}>
            <View style={styles.itemLeft}>
                <View style={styles.iconBox}>
                    <FontAwesome5 name={icon} size={16} color={Colors.dark.text} />
                </View>
                <Text style={styles.label}>{label}</Text>
            </View>
            <Switch
                value={value}
                onValueChange={onValueChange}
                trackColor={{ false: '#333', true: Colors.dark.primary }}
                thumbColor={'#FFF'}
            />
        </View>
    );

    return (
        <ScreenWrapper>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <FontAwesome5 name="arrow-left" size={20} color={Colors.dark.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Settings</Text>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
                {/* Feedback Banner */}
                <TouchableOpacity
                    style={styles.feedbackBanner}
                    onPress={() => setFeedbackVisible(true)}
                >
                    <View style={styles.feedbackContent}>
                        <FontAwesome5 name="bug" size={20} color={Colors.dark.primary} />
                        <View style={{ flex: 1 }}>
                            <Text style={styles.feedbackTitle}>Report a bug or give feedback</Text>
                            <Text style={styles.feedbackSubtitle}>Help us improve Rolled!</Text>
                        </View>
                        <FontAwesome5 name="chevron-right" size={12} color={Colors.dark.textSecondary} />
                    </View>
                </TouchableOpacity>

                <Text style={styles.sectionTitle}>Profile Settings</Text>

                {/* Visual grouping for Profile Settings */}
                <SettingItem
                    icon="user-edit"
                    label="Edit Profile"
                    onPress={() => router.push('/edit-profile')}
                />

                <SettingItem
                    icon="key"
                    label="Change Password"
                    onPress={() => router.push('/change-password')}
                />

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Account</Text>
                    <SettingItem icon="bell" label="Notifications" onPress={() => router.push('/notifications')} />
                    <SettingItem icon="user-lock" label="Blocked Users" onPress={() => router.push('/blocked-users')} />
                    <SettingItem icon="ghost-off" label="Unrolled Blocked Users" onPress={() => router.push('/unrolled-blocked-users')} />
                </View>

                <Text style={styles.sectionTitle}>Support</Text>
                <SettingItem icon="shield-alt" label="Community Guidelines" onPress={() => router.push('/community-guidelines' as any)} />
                <SettingItem icon="question-circle" label="Help Center" onPress={() => Linking.openURL('mailto:support@rolledapp.com')} />
                <SettingItem icon="lock" label="Privacy Policy" onPress={() => Linking.openURL('https://rolledapp.com/privacy')} />
                <SettingItem icon="file-contract" label="Terms & Conditions" onPress={() => Linking.openURL('https://rolledapp.com/terms')} />

                <View style={{ marginTop: 40 }}>
                    <SettingItem
                        icon="sign-out-alt"
                        label="Log Out"
                        onPress={handleLogout}
                        destructive
                    />
                    <SettingItem
                        icon="trash"
                        label="Delete Account"
                        onPress={handleDeleteAccount}
                        destructive
                    />
                </View>

                <Text style={styles.version}>Rolled v{Constants.expoConfig?.version} ({Platform.OS === 'ios' ? Constants.expoConfig?.ios?.buildNumber : Constants.expoConfig?.android?.versionCode})</Text>
            </ScrollView>

            <FeedbackModal
                visible={feedbackVisible}
                onClose={() => setFeedbackVisible(false)}
            />
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#222',
        marginBottom: 20
    },
    backButton: { marginRight: 20 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.dark.text },

    feedbackBanner: {
        backgroundColor: 'rgba(34, 211, 238, 0.1)',
        marginHorizontal: 16,
        padding: 16,
        borderRadius: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: 'rgba(34, 211, 238, 0.2)'
    },
    feedbackContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 15
    },
    feedbackTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.dark.text
    },
    feedbackSubtitle: {
        fontSize: 12,
        color: Colors.dark.textSecondary,
        marginTop: 2
    },

    sectionTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: Colors.dark.primary,
        marginTop: 20,
        marginBottom: 10,
        textTransform: 'uppercase',
        letterSpacing: 1
    },
    section: {
        marginTop: 20
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#1A1A1A'
    },
    itemLeft: { flexDirection: 'row', alignItems: 'center', gap: 15 },
    iconBox: {
        width: 36, height: 36,
        borderRadius: 8,
        backgroundColor: '#1A1A1A',
        justifyContent: 'center', alignItems: 'center'
    },
    label: { fontSize: 16, color: Colors.dark.text, fontWeight: '500' },
    version: {
        textAlign: 'center',
        color: Colors.dark.textSecondary,
        marginTop: 40,
        fontSize: 12
    },
    helperText: {
        color: Colors.dark.textSecondary,
        fontSize: 12,
        marginLeft: 16,
        marginRight: 16,
        marginBottom: 10,
        marginTop: -5,
        lineHeight: 18
    }
});
