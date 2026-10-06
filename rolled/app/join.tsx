import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TextInput, TouchableOpacity, ScrollView, Linking, Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Colors } from '../constants/Colors';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';

export default function JoinPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [refCode, setRefCode] = useState('');
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');
    const [position, setPosition] = useState<number | null>(null);
    const [inviteCode, setInviteCode] = useState<string | null>(null);

    const handleSubmit = async () => {
        if (!email.trim() || !email.includes('@')) {
            setStatus('error');
            setMessage('Please enter a valid university email.');
            return;
        }

        setStatus('loading');
        try {
            // Check if user exists
            const { data: existing } = await supabase
                .from('waitlist')
                .select('*')
                .eq('email', email)
                .single();

            if (existing) {
                setStatus('success');
                setPosition(existing.position);
                setInviteCode(existing.referral_code);
                setMessage("You're already on the list!");
                return;
            }

            // Join waitlist
            const { data, error } = await supabase
                .from('waitlist')
                .insert([{
                    email,
                    referred_by: refCode || null,
                    platform: Platform.OS,
                }])
                .select()
                .single();

            if (error) throw error;

            setStatus('success');
            setPosition(data.position);
            setInviteCode(data.referral_code);
        } catch (e: any) {
            setStatus('error');
            setMessage(e.message || 'Something went wrong. Try again.');
        }
    };

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Navbar Placeholder */}
                <View style={styles.navBar}>
                    <Text style={styles.logo}>ROLLED<Text style={styles.dot}>.</Text></Text>
                    <TouchableOpacity onPress={() => router.push('/(auth)/welcome')}>
                        <Text style={styles.loginLink}>Login</Text>
                    </TouchableOpacity>
                </View>

                {/* Hero Section */}
                <View style={styles.heroSection}>
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>GET ROLLL'N</Text>
                    </View>

                    <Text style={styles.heroTitle}>
                        UNROLL THE{'\n'}
                        <Text style={styles.gradientText}>REAL CAMPUS.</Text>
                    </Text>

                    <Text style={styles.heroSubtitle}>
                        The first social platform built exclusively for your campus.{'\n'}
                        No cringe. Just vibes.
                    </Text>
                </View>

                {/* Setup / Waitlist Form */}
                <View style={styles.formContainer}>
                    {status === 'success' ? (
                        <View style={styles.successCard}>
                            <Text style={styles.successTitle}>YOU ARE ON THE <Text style={styles.cyanText}>WAITLIST</Text>.</Text>

                            <View style={styles.statBox}>
                                <Text style={styles.statLabel}>CURRENT POSITION</Text>
                                <Text style={styles.statValue}>#{position}</Text>
                            </View>

                            <View style={[styles.statBox, { marginTop: 20 }]}>
                                <Text style={styles.statLabel}>YOUR INVITE CODE</Text>
                                <Text style={styles.inviteCode}>{inviteCode}</Text>
                            </View>

                            <Text style={styles.shareText}>Share this code to move up the queue!</Text>
                        </View>
                    ) : (
                        <View style={styles.inputCard}>
                            <Text style={styles.cardTitle}>SECURE YOUR <Text style={styles.cyanText}>OG BADGE</Text>.</Text>
                            <Text style={styles.cardSubtitle}>Limited spots for early access.</Text>

                            <View style={styles.inputGroup}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="University Email"
                                    placeholderTextColor="#666"
                                    value={email}
                                    onChangeText={setEmail}
                                    autoCapitalize="none"
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Referral Code (Optional)"
                                    placeholderTextColor="#666"
                                    value={refCode}
                                    onChangeText={setRefCode}
                                    autoCapitalize="characters"
                                />
                            </View>

                            {status === 'error' && (
                                <Text style={styles.errorText}>{message}</Text>
                            )}

                            <TouchableOpacity
                                style={[styles.button, status === 'loading' && styles.buttonDisabled]}
                                onPress={handleSubmit}
                                disabled={status === 'loading'}
                            >
                                <Text style={styles.buttonText}>
                                    {status === 'loading' ? 'JOINING...' : 'JOIN WAITLIST'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* Footer Links */}
                <View style={styles.footer}>
                    <View style={styles.footerLinks}>
                        <TouchableOpacity onPress={() => router.push('/privacy')}>
                            <Text style={styles.footerLink}>Privacy</Text>
                        </TouchableOpacity>
                        <Text style={styles.footerSep}>•</Text>
                        <TouchableOpacity onPress={() => router.push('/terms')}>
                            <Text style={styles.footerLink}>Terms</Text>
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.copyright}>© 2026 Rolled Inc.</Text>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#030303',
    },
    scrollContent: {
        paddingBottom: 40,
    },
    navBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 24,
    },
    logo: {
        fontSize: 24,
        fontWeight: '900',
        color: '#fff',
        letterSpacing: -1,
    },
    dot: {
        color: '#00f2ea',
    },
    loginLink: {
        color: '#888',
        fontWeight: '600',
    },
    heroSection: {
        alignItems: 'center',
        paddingVertical: 60,
        paddingHorizontal: 20,
    },
    badge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        backgroundColor: 'rgba(0, 242, 234, 0.1)',
        borderColor: 'rgba(0, 242, 234, 0.3)',
        borderWidth: 1,
        borderRadius: 100,
        marginBottom: 20,
    },
    badgeText: {
        color: '#00f2ea',
        fontSize: 10,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    heroTitle: {
        fontSize: 48,
        fontWeight: '900',
        color: '#fff',
        textAlign: 'center',
        lineHeight: 48,
        letterSpacing: -2,
        marginBottom: 20,
    },
    gradientText: {
        color: '#00f2ea',
    },
    heroSubtitle: {
        color: '#888',
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
        maxWidth: 400,
    },
    formContainer: {
        paddingHorizontal: 20,
        alignItems: 'center',
    },
    inputCard: {
        width: '100%',
        maxWidth: 400,
        backgroundColor: '#121212',
        borderRadius: 20,
        padding: 30,
        borderWidth: 1,
        borderColor: '#222',
        alignItems: 'center',
    },
    successCard: {
        width: '100%',
        maxWidth: 400,
        backgroundColor: '#121212',
        borderRadius: 20,
        padding: 40,
        borderWidth: 1,
        borderColor: '#00f2ea',
        alignItems: 'center',
    },
    cardTitle: {
        color: '#fff',
        fontSize: 24,
        fontWeight: '900',
        textAlign: 'center',
        marginBottom: 8,
    },
    successTitle: {
        color: '#fff',
        fontSize: 28,
        fontWeight: '900',
        textAlign: 'center',
        marginBottom: 30,
        lineHeight: 32,
    },
    cardSubtitle: {
        color: '#666',
        fontSize: 14,
        marginBottom: 30,
    },
    cyanText: {
        color: '#00f2ea',
    },
    inputGroup: {
        width: '100%',
        marginBottom: 16,
    },
    input: {
        width: '100%',
        height: 50,
        backgroundColor: '#0a0a0a',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#333',
        paddingHorizontal: 16,
        color: '#fff',
        fontSize: 16,
    },
    button: {
        width: '100%',
        height: 50,
        backgroundColor: '#00f2ea',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 10,
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    buttonText: {
        color: '#000',
        fontWeight: 'bold',
        fontSize: 16,
        letterSpacing: 1,
    },
    errorText: {
        color: '#ff4444',
        marginBottom: 16,
        textAlign: 'center',
    },
    statBox: {
        alignItems: 'center',
    },
    statLabel: {
        color: '#666',
        fontSize: 12,
        fontWeight: 'bold',
        letterSpacing: 2,
        marginBottom: 4,
    },
    statValue: {
        color: '#fff',
        fontSize: 48,
        fontWeight: '900',
        letterSpacing: -2,
    },
    inviteCode: {
        color: '#00f2ea',
        fontSize: 32,
        fontWeight: 'bold',
        fontFamily: 'monospace',
        letterSpacing: 4,
    },
    shareText: {
        color: '#888',
        marginTop: 20,
        fontSize: 14,
    },
    footer: {
        marginTop: 60,
        alignItems: 'center',
        gap: 16,
    },
    footerLinks: {
        flexDirection: 'row',
        gap: 20,
    },
    footerLink: {
        color: '#666',
        fontSize: 12,
    },
    footerSep: {
        color: '#333',
    },
    copyright: {
        color: '#444',
        fontSize: 12,
    },
});
