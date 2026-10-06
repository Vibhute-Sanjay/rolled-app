import React from 'react';
import { Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/Colors';

interface ParsedContentProps {
    content: string;
    style?: any;
    numberOfLines?: number;
}

export const ParsedContent = ({ content, style, numberOfLines }: ParsedContentProps) => {
    const router = useRouter();

    if (!content) return null;

    // Regex to find @username
    // Matches @ preceded by start of string or whitespace, followed by word characters
    const mentionRegex = /(^|\s)@(\w+)/g;

    // Use a slightly different strategy for safer rendering
    const parts = content.split(mentionRegex);
    // Result of split with 2 capturing groups: [text, leading_space, username, text, ...]

    if (parts.length === 1) {
        return (
            <Text style={style} numberOfLines={numberOfLines}>
                {content}
            </Text>
        );
    }

    const result: React.ReactNode[] = [];

    // Split logic: parts will be [text, leading_space, username, text, leading_space, username, ..., text]
    // because split with 2 capturing groups includes both in the result array.
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];

        if (i % 3 === 0) {
            // This is standard text
            if (part) result.push(<Text key={`text-${i}`}>{part}</Text>);
        } else if (i % 3 === 1) {
            // This is the leading character (space or empty if start of string)
            if (part) result.push(<Text key={`space-${i}`}>{part}</Text>);
        } else if (i % 3 === 2) {
            // This is the username!
            const username = part;
            result.push(
                <Text
                    key={`mention-${i}`}
                    style={styles.mention}
                    onPress={() => router.push(`/user/${username}`)}
                >
                    @{username}
                </Text>
            );
        }
    }

    return (
        <Text style={style} numberOfLines={numberOfLines}>
            {result}
        </Text>
    );
};

const styles = StyleSheet.create({
    mention: {
        color: Colors.dark.primary,
        fontWeight: '700',
    }
});
