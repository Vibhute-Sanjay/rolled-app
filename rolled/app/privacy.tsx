import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Colors } from '../constants/Colors';
import { FontAwesome5 } from '@expo/vector-icons';

export default function PrivacyPolicy() {
    const router = useRouter();

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <FontAwesome5 name="arrow-left" size={20} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Privacy Policy</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.lastUpdated}>Last updated: January 13, 2026</Text>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>1. Introduction</Text>
                    <Text style={styles.paragraph}>
                        Welcome to Rolled ("we," "our," or "us"). As a college-focused social platform, we are committed to protecting your privacy while connecting you with your campus community.
                        This policy explains how we collect and use data when you use the Rolled mobile application (the "App") and website (rolledapp.com).
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>2. Information We Collect</Text>
                    <Text style={styles.paragraph}>
                        We collect information you provide directly to us, such as when you create an account, update your profile, post content, or communicate with us. This may include your name, email address (university email), profile photo, and other information you choose to provide.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>3. How We Use Information</Text>
                    <Text style={styles.paragraph}>
                        We use the information we collect to provide, maintain, and improve our services, including to facilitate connections with other students, personalize your experience, and detect and prevent fraud and abuse.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>4. Contact Us</Text>
                    <Text style={styles.paragraph}>
                        If you have any questions about this Privacy Policy, please contact us at support@rolledapp.com.
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
