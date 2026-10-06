import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';

export default function CommunityGuidelinesScreen() {
    const router = useRouter();

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <FontAwesome5 name="arrow-left" size={20} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Community Guidelines</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <Text style={styles.lastUpdated}>Effective Date: January 2026 | Last Updated: September 2026</Text>

                <View style={styles.calloutBox}>
                    <View style={styles.calloutHeader}>
                        <MaterialCommunityIcons name="shield-check" size={22} color={Colors.dark.primary} />
                        <Text style={styles.calloutTitle}>Our Core Principle: Remember the Human</Text>
                    </View>
                    <Text style={styles.calloutText}>
                        Behind every handle and post is a peer in your campus community. Unrolled is built to empower honest, open dialogue through designated handles while maintaining mutual respect and safety. Freedom of expression exists alongside shared accountability.
                    </Text>
                </View>

                {/* Rule 1 */}
                <View style={styles.ruleCard}>
                    <View style={styles.ruleBadge}>
                        <Text style={styles.ruleBadgeText}>RULE 1</Text>
                    </View>
                    <Text style={styles.ruleTitle}>No Harassment, Targeted Defamation, or Bullying</Text>
                    <Text style={styles.ruleDescription}>
                        We have zero tolerance for targeted attacks, intimidation, or bullying. Debate ideas and institutions vigorously, but never target individuals.
                    </Text>
                    <View style={styles.bulletList}>
                        <Text style={styles.bulletItem}>• Naming or singling out private individuals (peers, classmates, or staff) for ridicule, degradation, or humiliation is strictly prohibited.</Text>
                        <Text style={styles.bulletItem}>• Directing persistent hostility, threats, vulgar mockery, or unwanted sexual commentary will result in immediate suspension.</Text>
                        <Text style={styles.bulletItem}>• Coordinated harassment campaigns or brigading against any student will not be tolerated.</Text>
                    </View>
                </View>

                {/* Rule 2 */}
                <View style={styles.ruleCard}>
                    <View style={styles.ruleBadge}>
                        <Text style={styles.ruleBadgeText}>RULE 2</Text>
                    </View>
                    <Text style={styles.ruleTitle}>No Hate Speech or Discrimination</Text>
                    <Text style={styles.ruleDescription}>
                        Every student has the right to feel welcome and safe in the community regardless of identity or background.
                    </Text>
                    <View style={styles.bulletList}>
                        <Text style={styles.bulletItem}>• Prohibits promoting hatred, exclusion, degradation, or violence against individuals or groups based on race, ethnicity, caste, nationality, religion, sexual orientation, gender identity, sex, disability, or serious medical conditions.</Text>
                        <Text style={styles.bulletItem}>• Slurs, dehumanizing tropes, and hate symbols are automatically flagged and removed.</Text>
                    </View>
                </View>

                {/* Rule 3 */}
                <View style={styles.ruleCard}>
                    <View style={styles.ruleBadge}>
                        <Text style={styles.ruleBadgeText}>RULE 3</Text>
                    </View>
                    <Text style={styles.ruleTitle}>Protect Privacy & Non-Public Personal Information</Text>
                    <Text style={styles.ruleDescription}>
                        Never post confidential or personally identifiable information (anti-doxxing policy).
                    </Text>
                    <View style={styles.bulletList}>
                        <Text style={styles.bulletItem}>• Do not disclose legal names of private peers, phone numbers, dorm room numbers, residential addresses, student ID numbers, or personal social media handles.</Text>
                        <Text style={styles.bulletItem}>• Do not share private messages, unredacted chat screenshots, or communications without explicit mutual consent.</Text>
                        <Text style={styles.bulletItem}>• Attempting to unmask or expose the real-world identity behind any handle is strictly forbidden.</Text>
                    </View>
                </View>

                {/* Rule 4 */}
                <View style={styles.ruleCard}>
                    <View style={styles.ruleBadge}>
                        <Text style={styles.ruleBadgeText}>RULE 4</Text>
                    </View>
                    <Text style={styles.ruleTitle}>Safety, Violence Prevention & Self-Harm Support</Text>
                    <Text style={styles.ruleDescription}>
                        Any threat to physical well-being or platform safety is met with immediate intervention.
                    </Text>
                    <View style={styles.bulletList}>
                        <Text style={styles.bulletItem}>• Threats of physical violence, incitement to assault, property damage, or weapons violations are escalated immediately.</Text>
                        <Text style={styles.bulletItem}>• Content encouraging, instructing, or glorifying suicide or self-inflicted harm is strictly prohibited.</Text>
                        <Text style={styles.bulletItem}>• Users expressing distress will be guided toward institutional support resources and crisis response helplines.</Text>
                    </View>
                </View>

                {/* Rule 5 */}
                <View style={styles.ruleCard}>
                    <View style={styles.ruleBadge}>
                        <Text style={styles.ruleBadgeText}>RULE 5</Text>
                    </View>
                    <Text style={styles.ruleTitle}>No Non-Consensual Imagery or Explicit Content</Text>
                    <Text style={styles.ruleDescription}>
                        Sexually explicit, non-consensual, or exploitative media is strictly prohibited.
                    </Text>
                    <View style={styles.bulletList}>
                        <Text style={styles.bulletItem}>• Non-consensual intimate imagery, voyeuristic recordings, and depictions captured in private settings (dormitories, restrooms) result in permanent bans.</Text>
                        <Text style={styles.bulletItem}>• Child sexual exploitation and abuse content results in immediate platform termination and referral to law enforcement and NCMEC.</Text>
                        <Text style={styles.bulletItem}>• Solicitation of commercial sexual services or pornography is strictly forbidden.</Text>
                    </View>
                </View>

                {/* Rule 6 */}
                <View style={styles.ruleCard}>
                    <View style={styles.ruleBadge}>
                        <Text style={styles.ruleBadgeText}>RULE 6</Text>
                    </View>
                    <Text style={styles.ruleTitle}>No Impersonation, False Representation, or Defamation</Text>
                    <Text style={styles.ruleDescription}>
                        Maintain authentic interactions without deceiving peers.
                    </Text>
                    <View style={styles.bulletList}>
                        <Text style={styles.bulletItem}>• Do not choose handles or posture as specific classmates, faculty members, campus administrators, or university offices.</Text>
                        <Text style={styles.bulletItem}>• Fabricating malicious rumors or defamatory falsehoods designed to damage a student's reputation is prohibited.</Text>
                    </View>
                </View>

                {/* Rule 7 */}
                <View style={styles.ruleCard}>
                    <View style={styles.ruleBadge}>
                        <Text style={styles.ruleBadgeText}>RULE 7</Text>
                    </View>
                    <Text style={styles.ruleTitle}>Academic Integrity & Honor Codes</Text>
                    <Text style={styles.ruleDescription}>
                        Respect university academic honesty policies.
                    </Text>
                    <View style={styles.bulletList}>
                        <Text style={styles.bulletItem}>• Do not solicit or distribute current exam papers, active test questions, or unauthorized answer keys.</Text>
                        <Text style={styles.bulletItem}>• Paid contract cheating, impersonation for academic submissions, and commercial homework completion services are banned.</Text>
                    </View>
                </View>

                {/* Rule 8 */}
                <View style={styles.ruleCard}>
                    <View style={styles.ruleBadge}>
                        <Text style={styles.ruleBadgeText}>RULE 8</Text>
                    </View>
                    <Text style={styles.ruleTitle}>Platform Integrity, Spam & Illegal Transactions</Text>
                    <Text style={styles.ruleDescription}>
                        Preserve the quality of the campus forum.
                    </Text>
                    <View style={styles.bulletList}>
                        <Text style={styles.bulletItem}>• Automated bots, scrapers, vote manipulation, or mass-flagging schemes are blocked.</Text>
                        <Text style={styles.bulletItem}>• Commercial promotional spam, pyramid schemes, or unsolicited marketing are prohibited.</Text>
                        <Text style={styles.bulletItem}>• Soliciting or facilitating transactions involving illegal substances, prescription medications, firearms, or counterfeit goods is banned.</Text>
                    </View>
                </View>

                {/* Moderation & Enforcement */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Enforcement & Consequences</Text>
                    <Text style={styles.paragraph}>
                        Violations are addressed proportionally through our multi-tiered moderation framework:
                    </Text>
                    <View style={styles.enforcementItem}>
                        <Text style={styles.enforcementLevel}>1. Content Removal</Text>
                        <Text style={styles.enforcementDesc}>Posts or comments violating guidelines are deleted immediately.</Text>
                    </View>
                    <View style={styles.enforcementItem}>
                        <Text style={styles.enforcementLevel}>2. Formal Warning</Text>
                        <Text style={styles.enforcementDesc}>Accounts receive educational notices detailing the specific breach.</Text>
                    </View>
                    <View style={styles.enforcementItem}>
                        <Text style={styles.enforcementLevel}>3. Account Cooldown / Suspension</Text>
                        <Text style={styles.enforcementDesc}>Temporary restriction of posting and commenting privileges.</Text>
                    </View>
                    <View style={styles.enforcementItem}>
                        <Text style={styles.enforcementLevel}>4. Permanent Platform Expulsion</Text>
                        <Text style={styles.enforcementDesc}>Irrevocable revocation of access for severe, repeated, or dangerous conduct.</Text>
                    </View>
                    <View style={styles.enforcementItem}>
                        <Text style={styles.enforcementLevel}>5. Institutional Escalation</Text>
                        <Text style={styles.enforcementDesc}>Referral to campus administration or law enforcement for credible threats of violence or illegal harm.</Text>
                    </View>
                </View>

                {/* Reporting & Contact */}
                <View style={styles.contactCard}>
                    <Text style={styles.contactTitle}>Reporting & Safety Inquiries</Text>
                    <Text style={styles.contactText}>
                        To report any content, tap the menu on the post or comment and select "Report". For appeals or trust inquiries, contact our moderation team directly at:
                    </Text>
                    <Text style={styles.emailText}>support@rolledapp.com</Text>
                </View>

                <View style={{ height: 60 }} />
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
        padding: 20,
    },
    lastUpdated: {
        color: '#777',
        fontSize: 12,
        marginBottom: 20,
        fontStyle: 'italic',
    },
    calloutBox: {
        backgroundColor: '#0d1117',
        borderWidth: 1,
        borderColor: '#1f2937',
        borderRadius: 14,
        padding: 16,
        marginBottom: 24,
    },
    calloutHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    calloutTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#fff',
    },
    calloutText: {
        fontSize: 13,
        lineHeight: 20,
        color: '#9ca3af',
    },
    ruleCard: {
        backgroundColor: '#0b0b0b',
        borderWidth: 1,
        borderColor: '#1f1f1f',
        borderRadius: 14,
        padding: 18,
        marginBottom: 16,
    },
    ruleBadge: {
        alignSelf: 'flex-start',
        backgroundColor: '#1a1a1a',
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 3,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#2a2a2a',
    },
    ruleBadgeText: {
        fontSize: 11,
        fontWeight: '800',
        color: Colors.dark.primary,
        letterSpacing: 0.8,
    },
    ruleTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#ffffff',
        marginBottom: 8,
    },
    ruleDescription: {
        fontSize: 13,
        lineHeight: 19,
        color: '#a1a1aa',
        marginBottom: 12,
    },
    bulletList: {
        gap: 8,
    },
    bulletItem: {
        fontSize: 13,
        lineHeight: 19,
        color: '#d4d4d8',
    },
    section: {
        marginTop: 12,
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 8,
    },
    paragraph: {
        fontSize: 14,
        lineHeight: 21,
        color: '#a1a1aa',
        marginBottom: 16,
    },
    enforcementItem: {
        backgroundColor: '#0e0e0e',
        borderLeftWidth: 3,
        borderLeftColor: Colors.dark.primary,
        padding: 12,
        borderRadius: 6,
        marginBottom: 10,
    },
    enforcementLevel: {
        fontSize: 14,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 4,
    },
    enforcementDesc: {
        fontSize: 13,
        lineHeight: 18,
        color: '#9ca3af',
    },
    contactCard: {
        backgroundColor: '#111',
        borderRadius: 14,
        padding: 18,
        borderWidth: 1,
        borderColor: '#222',
        alignItems: 'center',
        marginTop: 8,
    },
    contactTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 8,
    },
    contactText: {
        fontSize: 13,
        lineHeight: 19,
        color: '#999',
        textAlign: 'center',
        marginBottom: 10,
    },
    emailText: {
        fontSize: 14,
        fontWeight: '700',
        color: Colors.dark.primary,
    },
});
