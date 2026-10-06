import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, Alert, Platform, ActivityIndicator, Modal } from 'react-native';
import { ScreenWrapper } from '../../../components/ScreenWrapper';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function EditActivityScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { colors } = useTheme();
    const { user } = useAuth();

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Original Data (for comparison)
    const [originalData, setOriginalData] = useState<any>(null);

    // Form State
    const [title, setTitle] = useState('');
    const [desc, setDesc] = useState('');
    const [details, setDetails] = useState('');
    const [location, setLocation] = useState('');
    const [capacity, setCapacity] = useState('');
    const [price, setPrice] = useState('');

    // Date/Time State
    const [startTime, setStartTime] = useState(new Date());

    const [showStartPicker, setShowStartPicker] = useState(false);
    const [mode, setMode] = useState<'date' | 'time'>('date');

    // Warning Modal
    const [warningVisible, setWarningVisible] = useState(false);

    useEffect(() => {
        if (id) fetchActivity();
    }, [id]);

    const fetchActivity = async () => {
        try {
            const { data, error } = await supabase
                .from('activities')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;
            if (data.organizer_id !== user?.id) {
                Alert.alert("Error", "You are not authorized to edit this event.");
                router.back();
                return;
            }

            setOriginalData(data);

            // Populate Form
            setTitle(data.title);
            setDesc(data.short_description || '');
            setDetails(data.full_details || '');
            setLocation(data.location || '');
            setCapacity(data.capacity ? String(data.capacity) : '');
            setPrice(data.price ? String(data.price) : '');
            setStartTime(new Date(data.start_time));


        } catch (e) {
            console.error(e);
            Alert.alert("Error", "Failed to fetch event details.");
            router.back();
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (confirmedNotify: boolean = false) => {
        if (!title || !desc || !startTime) {
            Alert.alert("Missing Fields", "Please fill in all required fields.");
            return;
        }

        const isTimeChanged = originalData.start_time !== startTime.toISOString();

        // Check guest count if time changed
        if (isTimeChanged && !confirmedNotify) {
            const { count } = await supabase
                .from('activity_requests')
                .select('*', { count: 'exact', head: true })
                .eq('activity_id', id)
                .eq('status', 'approved');

            if (count && count > 0) {
                setWarningVisible(true);
                return;
            }
        }

        setSubmitting(true);
        try {
            const updates: any = {
                title,
                short_description: desc,
                full_details: details,
                location,
                start_time: startTime.toISOString(),
                // end_time removed as per requirement
                capacity: capacity ? parseInt(capacity) : null,
                price: price ? parseFloat(price) : 0,
                is_updated: true // Always mark as updated on edit
            };

            const { error } = await supabase
                .from('activities')
                .update(updates)
                .eq('id', id);

            if (error) throw error;

            if (isTimeChanged && confirmedNotify) {
                // Trigger Notification Function
                // We use RPC call or manual Insert loop. Using RPC as planned.
                const { error: rpcError } = await supabase.rpc('notify_activity_update', {
                    p_activity_id: id,
                    p_message: `Event '${title}' has been rescheduled to ${startTime.toLocaleDateString()} at ${startTime.toLocaleTimeString()}. Please confirm if you can still make it.`
                });
                if (rpcError) console.error("Notification Error", rpcError);
            }

            Alert.alert("Success", "Event updated successfully.");
            router.back(); // Or router.push(`/activity/${id}`);
        } catch (e: any) {
            Alert.alert("Error", e.message);
        } finally {
            setSubmitting(false);
            setWarningVisible(false);
        }
    };

    const onDateChange = (event: any, selectedDate?: Date) => {
        const currentDate = selectedDate || startTime;
        if (Platform.OS === 'android') {
            setShowStartPicker(false);
        }
        setStartTime(currentDate);
    };

    if (loading) return <ScreenWrapper style={{ justifyContent: 'center' }}><ActivityIndicator color={colors.primary} /></ScreenWrapper>;

    return (
        <ScreenWrapper>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Text style={{ color: colors.textSecondary }}>Cancel</Text>
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Edit Event</Text>
                <TouchableOpacity onPress={() => handleSave(false)} disabled={submitting}>
                    <Text style={{ color: colors.primary, fontWeight: 'bold' }}>Save</Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 50 }}>
                {/* Title */}
                <View style={styles.inputGroup}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>Event Name</Text>
                    <TextInput
                        style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                        value={title}
                        onChangeText={setTitle}
                        placeholderTextColor="#666"
                    />
                </View>

                {/* Date & Time */}
                <View style={styles.inputGroup}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>Start Time</Text>
                    <TouchableOpacity
                        style={[styles.input, { flexDirection: 'row', alignItems: 'center', borderColor: colors.border }]}
                        onPress={() => { setMode('date'); setShowStartPicker(true); }}
                    >
                        <MaterialCommunityIcons name="calendar-clock" size={20} color={colors.primary} style={{ marginRight: 10 }} />
                        <Text style={{ color: colors.text }}>{startTime.toLocaleString()}</Text>
                    </TouchableOpacity>
                </View>

                {/* End Time Removed as per user request */}

                {/* Location */}
                <View style={styles.inputGroup}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>Location</Text>
                    <TextInput
                        style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                        value={location}
                        onChangeText={setLocation}
                        placeholderTextColor="#666"
                    />
                </View>

                {/* Description */}
                <View style={styles.inputGroup}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>Short Description</Text>
                    <TextInput
                        style={[styles.input, { color: colors.text, borderColor: colors.border, height: 80 }]}
                        value={desc}
                        onChangeText={setDesc}
                        multiline
                        placeholderTextColor="#666"
                    />
                </View>

                {/* Full Details */}
                <View style={styles.inputGroup}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>Full Details</Text>
                    <TextInput
                        style={[styles.input, { color: colors.text, borderColor: colors.border, height: 120 }]}
                        value={details}
                        onChangeText={setDetails}
                        multiline
                        textAlignVertical="top"
                        placeholderTextColor="#666"
                    />
                </View>

                {/* Capacity & Price */}
                <View style={{ flexDirection: 'row', gap: 15 }}>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>Capacity</Text>
                        <TextInput
                            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                            value={capacity}
                            onChangeText={setCapacity}
                            keyboardType="numeric"
                            placeholder="Unlimited"
                            placeholderTextColor="#666"
                        />
                    </View>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>Price (₹)</Text>
                        <TextInput
                            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                            value={price}
                            onChangeText={setPrice}
                            keyboardType="numeric"
                            placeholder="0"
                            placeholderTextColor="#666"
                        />
                    </View>
                </View>

                {/* Pickers */}
                {showStartPicker && (
                    <DateTimePicker
                        value={startTime}
                        mode={mode}
                        is24Hour={false}
                        display="default"
                        onChange={(e, d) => {
                            onDateChange(e, d);
                            setShowStartPicker(false);
                        }}
                    />
                )}
            </ScrollView>

            {/* Warning Modal */}
            <Modal
                visible={warningVisible}
                transparent
                animationType="fade"
            >
                <View style={styles.modalBg}>
                    <View style={styles.modalContent}>
                        <Ionicons name="warning" size={40} color="#FFBB33" style={{ marginBottom: 15 }} />
                        <Text style={styles.modalTitle}>Notify Guests?</Text>
                        <Text style={styles.modalText}>
                            You are changing the time of this event. This will trigger a notification to all confirmed guests asking them to re-confirm.
                        </Text>

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setWarningVisible(false)}>
                                <Text style={styles.cancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.confirmBtn} onPress={() => handleSave(true)}>
                                <Text style={styles.confirmText}>Yes, Notify</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {submitting && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color="#22d3ee" />
                </View>
            )}
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingVertical: 15, marginBottom: 20
    },
    headerTitle: { fontSize: 18, fontWeight: 'bold' },
    inputGroup: { marginBottom: 20 },
    label: { fontSize: 14, marginBottom: 8, fontWeight: '600' },
    input: {
        borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 16,
        backgroundColor: 'rgba(255,255,255,0.05)'
    },
    modalBg: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center', alignItems: 'center', padding: 20
    },
    modalContent: {
        backgroundColor: '#1e1e1e', width: '100%', maxWidth: 320,
        borderRadius: 20, padding: 24, alignItems: 'center'
    },
    modalTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
    modalText: { color: '#CCC', textAlign: 'center', marginBottom: 24, lineHeight: 22 },
    modalActions: { flexDirection: 'row', gap: 12, width: '100%' },
    cancelBtn: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: '#333', alignItems: 'center' },
    confirmBtn: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: '#22d3ee', alignItems: 'center' },
    cancelText: { color: '#FFF', fontWeight: 'bold' },
    confirmText: { color: '#000', fontWeight: 'bold' },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center', alignItems: 'center',
        zIndex: 100
    }
});
