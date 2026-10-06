import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { Colors } from '../constants/Colors';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

interface PollOption {
    id: string;
    option_text: string;
    index: number;
    vote_count?: number; // Calculated locally
}

import { PollVotersModal } from './PollVotersModal'; // [NEW]

interface PollViewProps {
    postId: string;
    authorId?: string; // [NEW]
}

export const PollView = ({ postId, authorId }: PollViewProps) => {
    const { user } = useAuth();
    const [options, setOptions] = useState<PollOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [myVote, setMyVote] = useState<string | null>(null); // Option ID
    const [votesMap, setVotesMap] = useState<Record<string, number>>({}); // optionId -> count
    const [totalVotes, setTotalVotes] = useState(0);
    const [analyticsVisible, setAnalyticsVisible] = useState(false); // [NEW]

    useEffect(() => {
        fetchPollData();
    }, [postId]);

    const fetchPollData = async () => {
        try {
            // 1. Fetch Options
            const { data: optionsData, error: optError } = await supabase
                .from('poll_options')
                .select('*')
                .eq('post_id', postId)
                .order('index', { ascending: true });

            if (optError) throw optError;
            setOptions(optionsData || []);

            // 2. Fetch All Votes (Aggregation)
            // Note: For scalability, we should use a `.count()` query per option or a view, 
            // but for MVP, fetching all votes for this post is okay if < thousands. 
            // Actually, best persistence is a DB function or groupBy. 
            // Let's use a simpler query: Get all votes for this post.
            const { data: votesData, error: voteError } = await supabase
                .from('poll_votes')
                .select('option_id, user_id')
                .eq('post_id', postId);

            if (voteError) throw voteError;

            // Process Votes
            const newVotesMap: Record<string, number> = {};
            let newTotal = 0;
            let myVotedOption = null;

            (votesData || []).forEach((v: any) => {
                newVotesMap[v.option_id] = (newVotesMap[v.option_id] || 0) + 1;
                newTotal++;
                if (user && v.user_id === user.id) {
                    myVotedOption = v.option_id;
                }
            });

            setVotesMap(newVotesMap);
            setTotalVotes(newTotal);
            setMyVote(myVotedOption);

        } catch (error) {
            console.error("Error fetching poll:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleVote = async (optionId: string) => {
        if (!user) return;
        if (myVote) return; // Prevent changing vote (per requirement "Visuals: results update", usually implies finalized)

        // Optimistic Update
        const previousMap = { ...votesMap };
        const previousTotal = totalVotes;

        setMyVote(optionId);
        setVotesMap(prev => ({ ...prev, [optionId]: (prev[optionId] || 0) + 1 }));
        setTotalVotes(prev => prev + 1);

        try {
            const { error } = await supabase
                .from('poll_votes')
                .insert({
                    post_id: postId,
                    option_id: optionId,
                    user_id: user.id
                });

            if (error) {
                if (error.code === '23505') {
                    // Already voted (race condition), just silent refresh
                    fetchPollData();
                } else {
                    throw error;
                }
            }
        } catch (error: any) {
            console.error("Vote failed:", error);
            // Revert
            setMyVote(null);
            setVotesMap(previousMap);
            setTotalVotes(previousTotal);
            Alert.alert("Error", "Could not submit vote.");
        }
    };

    const isAuthor = user?.id === authorId; // [NEW]

    if (loading) return null; // Or skeleton

    return (
        <View style={styles.container}>
            {options.map((option) => {
                const count = votesMap[option.id] || 0;
                const percent = totalVotes > 0 ? (count / totalVotes) * 100 : 0;
                const isSelected = myVote === option.id;
                const showResults = !!myVote; // Show results only after voting

                return (
                    <TouchableOpacity
                        key={option.id}
                        style={[
                            styles.optionRow,
                            isSelected && styles.optionRowSelected // Cyan Border if selected
                        ]}
                        onPress={() => handleVote(option.id)}
                        disabled={!!myVote}
                        activeOpacity={0.8}
                    >
                        {/* Progress Bar (Background) */}
                        {showResults && (
                            <View
                                style={[
                                    styles.progressBar,
                                    { width: `${percent}%`, backgroundColor: isSelected ? 'rgba(0, 255, 255, 0.15)' : '#333' }
                                ]}
                            />
                        )}

                        {/* Content */}
                        <View style={styles.contentRow}>
                            {/* Circle Indicator (Only if not voted, or if voted and it's this one?) 
                                Reference image shows Circle for the selected one, and empty circles for others? 
                                Actually reference shows text percentages.
                             */}

                            {!showResults ? (
                                <View style={styles.radioCircle} />
                            ) : (
                                // If Voted, show percentage if selected or just text? 
                                // Reference: Selected has big Check or Circle? 
                                // Let's keep it clean: always text
                                <View style={[styles.radioCircle, isSelected && { borderColor: Colors.dark.primary, borderWidth: 5 }]} />
                            )}

                            <Text style={[
                                styles.optionText,
                                isSelected && { color: Colors.dark.primary, fontWeight: 'bold' }
                            ]}>
                                {option.option_text}
                            </Text>

                            {showResults && (
                                <Text style={[
                                    styles.percentText,
                                    isSelected && { color: Colors.dark.primary }
                                ]}>
                                    {Math.round(percent)}%
                                </Text>
                            )}
                        </View>
                    </TouchableOpacity>
                );
            })}

            <View style={styles.footer}>
                <Text style={styles.voteCount}>{totalVotes} votes</Text>
                {myVote && <Text style={styles.finalResults}>• Final results</Text>}

                {/* Author Analytics Button */}
                {isAuthor && totalVotes > 0 && (
                    <TouchableOpacity onPress={() => setAnalyticsVisible(true)} style={{ marginLeft: 'auto' }}>
                        <Text style={{ color: Colors.dark.primary, fontSize: 12, fontWeight: 'bold' }}>View Voters</Text>
                    </TouchableOpacity>
                )}
            </View>

            <PollVotersModal
                visible={analyticsVisible}
                onClose={() => setAnalyticsVisible(false)}
                postId={postId}
                options={options}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginTop: 10,
        marginBottom: 10,
        width: '100%',
    },
    optionRow: {
        height: 50,
        marginBottom: 8,
        borderRadius: 8,
        backgroundColor: '#1A1A1A', // Dark grey default
        justifyContent: 'center',
        overflow: 'hidden', // Trim progress bar
        borderWidth: 1,
        borderColor: 'transparent',
    },
    optionRowSelected: {
        borderColor: Colors.dark.primary,
    },
    progressBar: {
        position: 'absolute',
        top: 0,
        left: 0,
        height: '100%',
        backgroundColor: '#333',
        zIndex: -1,
    },
    contentRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        width: '100%',
    },
    radioCircle: {
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 2,
        borderColor: '#666',
        marginRight: 10,
    },
    optionText: {
        color: 'white',
        fontSize: 14,
        flex: 1,
        fontWeight: '500',
    },
    percentText: {
        color: 'white',
        fontSize: 14,
        fontWeight: 'bold',
    },
    footer: {
        flexDirection: 'row',
        marginTop: 4,
        paddingHorizontal: 4
    },
    voteCount: {
        color: '#888',
        fontSize: 12,
    },
    finalResults: {
        color: '#888',
        fontSize: 12,
        marginLeft: 6
    }
});
