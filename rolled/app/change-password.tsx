
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View, StyleSheet, Alert, KeyboardAvoidingView, Platform, TouchableOpacity, ScrollView } from 'react-native';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { ScreenWrapper } from '../components/ScreenWrapper';
import { Colors } from '../constants/Colors';
import { supabase } from '../lib/supabase';
import { FontAwesome5 } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

export default function ChangePasswordScreen() {
    const router = useRouter();
    const { user } = useAuth(); // Need user email for re-auth

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const [secureCurrent, setSecureCurrent] = useState(true);
    const [secureNew, setSecureNew] = useState(true);
    const [secureConfirm, setSecureConfirm] = useState(true);

    // Regex from screenshot: at least 6 chars, 1 uppercase, 1 number, 1 special char
    const strongRegex = new RegExp("^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])(?=.{6,})");

    const handleUpdatePassword = async () => {
        if (!user || !user.email) {
            Alert.alert("Error", "User not authenticated correctly.");
            return;
        }

        if (newPassword !== confirmPassword) {
            Alert.alert("Error", "New passwords do not match.");
            return;
        }

        if (!strongRegex.test(newPassword)) {
            Alert.alert("Weak Password", "Password must contain at least 6 characters, 1 uppercase letter, 1 number, and 1 special character.");
            return;
        }

        setLoading(true);

        try {
            // 1. Re-authenticate with Current Password
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: user.email,
                password: currentPassword,
            });

            if (signInError) {
                setLoading(false);
                Alert.alert("Error", "Incorrect current password.");
                return;
            }

            // 2. Update Password
            const { error: updateError } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (updateError) throw updateError;

            Alert.alert("Success", "Password updated successfully!");
            router.back();

        } catch (error: any) {
            Alert.alert("Error", error.message || "Failed to update password");
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScreenWrapper style={{ paddingHorizontal: 0 }}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    {/* Title Area matching screenshot */}
                    <Text style={styles.pageTitle}>Change Password</Text>
                    <Text style={styles.description}>
                        For your security, create a strong password containing at least 6 characters, 1 uppercase letter, 1 number, and 1 special character.
                    </Text>

                    <View style={styles.form}>
                        <Text style={styles.label}>Current Password</Text>
                        <Input
                            placeholder="Enter current password"
                            value={currentPassword}
                            onChangeText={setCurrentPassword}
                            secureTextEntry={secureCurrent}
                            rightIcon={secureCurrent ? "eye" : "eye-slash"}
                            onRightIconPress={() => setSecureCurrent(!secureCurrent)}
                            inputContainerStyle={styles.inputBox}
                        />

                        <Text style={styles.label}>New Password</Text>
                        <Input
                            placeholder="Enter new password"
                            value={newPassword}
                            onChangeText={setNewPassword}
                            secureTextEntry={secureNew}
                            rightIcon={secureNew ? "eye" : "eye-slash"}
                            onRightIconPress={() => setSecureNew(!secureNew)}
                            inputContainerStyle={styles.inputBox}
                        />

                        <Text style={styles.label}>Confirm New Password</Text>
                        <Input
                            placeholder="Enter confirm new password"
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            secureTextEntry={secureConfirm}
                            rightIcon={secureConfirm ? "eye" : "eye-slash"}
                            onRightIconPress={() => setSecureConfirm(!secureConfirm)}
                            inputContainerStyle={styles.inputBox}
                        />

                        <TouchableOpacity style={{ alignSelf: 'flex-start', marginBottom: 30 }}>
                            <Text style={styles.forgotPassword}>Forgot Password?</Text>
                        </TouchableOpacity>

                        <Button
                            title="Update Password"
                            onPress={handleUpdatePassword}
                            loading={loading}
                            style={styles.updateButton}
                        />
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    scrollContent: {
        paddingHorizontal: 24,
        paddingTop: 40,
        paddingBottom: 40,
    },
    pageTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: 'white',
        marginBottom: 12,
    },
    description: {
        fontSize: 14,
        color: '#888',
        lineHeight: 20,
        marginBottom: 30,
    },
    form: {
        gap: 0, // Input component has marginBottom inside it
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#ccc',
        marginBottom: 8,
    },
    inputBox: {
        backgroundColor: '#111', // Darker background from screenshot
        borderWidth: 1,
        borderColor: '#333',
        height: 50,
    },
    forgotPassword: {
        color: '#888',
        fontWeight: 'bold',
    },
    updateButton: {
        backgroundColor: '#008b99', // Teal/Blue from screenshot
        marginTop: 10,
        borderRadius: 8,
    }
});
