import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '../constants/Colors';
import { FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

interface TrendingCardProps {
    content: string;
    author: string;
    time: string;
    votes: string;
    tags?: string[];
    accentColor?: string;
}

export const TrendingCard = ({ content, author, time, votes, tags = [], accentColor = Colors.dark.primary }: TrendingCardProps) => {
    return (
        <View style={[styles.card, { borderLeftColor: accentColor }]}>
            {/* Left Content */}
            <View style={styles.contentContainer}>
                {/* Tags */}
                <View style={styles.tagsRow}>
                    {tags.map((tag, index) => (
                        <View key={index} style={styles.tag}>
                            <Text style={styles.tagText}>{tag}</Text>
                        </View>
                    ))}
                </View>

                {/* Text Content */}
                <Text style={styles.contentText}>{content}</Text>

                {/* Footer: Author & Time */}
                <View style={styles.footer}>
                    <Text style={[styles.authorText, { color: accentColor }]}>~ {author}</Text>
                    <Text style={styles.timeText}>{time}</Text>
                </View>
            </View>

            {/* Right: Actions / Votes */}
            <View style={styles.actionsContainer}>
                <TouchableOpacity style={styles.actionButton}>
                    <MaterialCommunityIcons name="arrow-up-bold-outline" size={24} color={Colors.dark.textSecondary} />
                </TouchableOpacity>

                <Text style={styles.voteCount}>{votes}</Text>

                <TouchableOpacity style={styles.actionButton}>
                    <MaterialCommunityIcons name="arrow-down-bold-outline" size={24} color={Colors.dark.textSecondary} />
                </TouchableOpacity>

                <TouchableOpacity style={[styles.actionButton, { marginTop: 10 }]}>
                    <MaterialCommunityIcons name="reply" size={20} color={Colors.dark.textSecondary} />
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#0A0A0A', // Very dark bg
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderLeftWidth: 4,
        flexDirection: 'row',
        borderWidth: 1,
        borderColor: '#222', // Subtle border for the rest
    },
    contentContainer: {
        flex: 1,
        paddingRight: 10,
    },
    tagsRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
    },
    tag: {
        backgroundColor: '#1A1A1A',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#333',
    },
    tagText: {
        color: '#888',
        fontSize: 10,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    contentText: {
        color: 'white',
        fontSize: 16,
        lineHeight: 24,
        fontWeight: '500',
        marginBottom: 16,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 'auto',
        borderTopWidth: 1,
        borderTopColor: '#222',
        paddingTop: 12,
        borderStyle: 'dashed', // Aesthetic choice from reference
    },
    authorText: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    timeText: {
        color: '#666',
        fontSize: 12,
    },
    actionsContainer: {
        width: 40,
        alignItems: 'center',
        justifyContent: 'flex-start',
        borderLeftWidth: 1,
        borderLeftColor: '#222',
        paddingLeft: 10,
        marginLeft: 5,
    },
    actionButton: {
        paddingVertical: 4,
    },
    voteCount: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 12,
        marginVertical: 4,
    }
});
