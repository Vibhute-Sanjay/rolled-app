import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Colors } from '../constants/Colors';
import { FontAwesome5 } from '@expo/vector-icons';

export default function TermsOfService() {
    const router = useRouter();

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <FontAwesome5 name="arrow-left" size={20} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Terms of Service</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.lastUpdated}>Last updated: January 13, 2026</Text>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>1. Agreement to Terms</Text>
                    <Text style={styles.paragraph}>
                        By accessing Rolled, you agree to these Terms. If you are a student, these terms include an agreement to uphold your university's code of conduct while using the platform.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>2. Use of Services</Text>
                    <Text style={styles.paragraph}>
                        You are responsible for your use of the Services and for any content you provide, including compliance with applicable laws, rules, and regulations. You may only use the Services if you are a verified student at a supported university.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>3. User Conduct</Text>
                    <Text style={styles.paragraph}>
                        We have zero tolerance for bullying, harassment, or hate speech. We reserve the right to suspend or ban users who violate these guidelines or our community standards.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>4. Termination</Text>
                    <Text style={styles.paragraph}>
                        We may terminate or suspend your access to the Services at any time, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.
                    </Text>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#030303',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 60,
        paddingBottom: 20,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#1a1a1a',
        backgroundColor: '#030303',
    },
    backButton: {
        padding: 8,
        marginRight: 16,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
    },
    content: {
        padding: 24,
    },
    lastUpdated: {
        color: '#666',
        marginBottom: 30,
        fontStyle: 'italic',
    },
    section: {
        marginBottom: 30,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 12,
    },
    paragraph: {
        fontSize: 16,
        color: '#ccc',
        lineHeight: 24,
    },
});
