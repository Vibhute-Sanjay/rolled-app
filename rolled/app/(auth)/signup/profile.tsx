
import { FontAwesome5 } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, DeviceEventEmitter, Image, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Avatar } from '../../../components/Avatar';
import { Button } from '../../../components/Button';
import { Input } from '../../../components/Input';
import { ScreenWrapper } from '../../../components/ScreenWrapper';
import { Colors } from '../../../constants/Colors';
import { useAuth } from '../../../context/AuthContext';
import { uploadToCloudinary } from '../../../lib/cloudinary';
import { supabase } from '../../../lib/supabase';

const MAJORS = [
    "Computer Science", "Information Technology", "Mechanical Engineering",
    "Civil Engineering", "Electronics", "Business Administration", "Economics",
    "Psychology", "Design", "Architecture", "Law", "Pharmacy"
];

const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

const STATUS_OPTIONS = ["Single", "Committed", "Talking to someone", "It's complicated"];

export default function ProfileSetupScreen() {
    const router = useRouter();
    const { user } = useAuth();

    const [loading, setLoading] = useState(false);

    // Data State
    const [fullName, setFullName] = useState('');
    const [bio, setBio] = useState('');
    const [dob, setDob] = useState(new Date());
    const [major, setMajor] = useState('');
    const [year, setYear] = useState('');

    // Image State
    const [bgImage, setBgImage] = useState<string | null>(null);
    const [profileImage, setProfileImage] = useState<string | null>(null);

    // Modal State
    const [showMajorPicker, setShowMajorPicker] = useState(false);
    const [showYearPicker, setShowYearPicker] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showStatusPicker, setShowStatusPicker] = useState(false);
    const [status, setStatus] = useState('');

    // Listen for cropped images
    useEffect(() => {
        const sub = DeviceEventEmitter.addListener('image_cropped', ({ uri, target }) => {
            if (target === 'profile') setProfileImage(uri);
            if (target === 'cover' || target === 'bg') setBgImage(uri);
        });
        return () => sub.remove();
    }, []);

    // Pick Image Logic
    const pickImage = async (type: 'bg' | 'profile') => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: false, // Use our custom cropper instead
            quality: 1,
        });

        if (!result.canceled && result.assets.length > 0) {
            const originalUri = result.assets[0].uri;
            try {
                // Resize to prevent OOM
                const manipResult = await ImageManipulator.manipulateAsync(
                    originalUri,
                    [{ resize: { width: 1080 } }],
                    { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
                );

                router.push({
                    pathname: '/post/crop',
                    params: {
                        uri: encodeURIComponent(manipResult.uri),
                        target: type === 'bg' ? 'cover' : 'profile'
                    }
                });
            } catch (error) {
                console.error("Image Prep Error:", error);
                Alert.alert("Error", "Could not process image. Please try another.");
            }
        }
    };

    const handleComplete = async () => {
        // Enforce mandatory fields
        if (!fullName || !major || !year || !status) {
            Alert.alert('Missing Fields', 'Please fill in Name, Major, Year, and Status.');
            return;
        }

        setLoading(true);

        try {
            let bgUrl = null;
            let avatarUrl = null;

            // Upload Images
            const folderPath = `rolled_users/${user?.id}/profile`;
            if (bgImage) bgUrl = await uploadToCloudinary(bgImage, folderPath);
            if (profileImage) {
                avatarUrl = await uploadToCloudinary(profileImage, folderPath);
            }
            // If no profileImage, avatarUrl remains null, and the UI will handle the local asset fallback.

            // Update Profile
            // Note: The user might already have a row if we used triggers, 
            // OR we need to insert if we didn't use triggers.
            // `upsert` is safest.

            const updates = {
                id: user?.id,
                full_name: fullName,
                bio: bio,
                dob: dob.toISOString().split('T')[0],
                major: major,
                year: year,
                relationship_status: status,
                bg_image_url: bgUrl,
                avatar_url: avatarUrl,
                is_onboarded: true, // Mark as onboarded after completing profile
                updated_at: new Date(),
            };

            const { error } = await supabase.from('profiles').upsert(updates);

            if (error) throw error;

            // Done!
            router.replace('/(auth)/welcome-splash' as any);

        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScreenWrapper style={{ paddingHorizontal: 0 }}>
            <ScrollView contentContainerStyle={{ paddingBottom: 50 }}>

                {/* Background Image Area */}
                <TouchableOpacity style={styles.bgContainer} onPress={() => pickImage('bg')}>
                    {bgImage ? (
                        <Image source={{ uri: bgImage }} style={styles.bgImage} />
                    ) : (
                        <View style={styles.bgPlaceholder}>
                            <FontAwesome5 name="camera" size={24} color={Colors.dark.textSecondary} />
                            <Text style={styles.uploadText}>Add Background</Text>
                        </View>
                    )}
                </TouchableOpacity>

                <View style={styles.contentContainer}>
                    {/* Profile Picture (overlapping) */}
                    <TouchableOpacity style={styles.avatarContainer} onPress={() => pickImage('profile')}>
                        <Avatar
                            uri={profileImage}
                            name={fullName}
                            size={100}
                            style={styles.avatarImage}
                        />
                        <View style={styles.editBadge}>
                            <FontAwesome5 name="pencil-alt" size={10} color="#000" />
                        </View>
                    </TouchableOpacity>

                    <View style={{ marginTop: 60, paddingHorizontal: 15 }}>
                        <Text style={styles.title}>Setup Profile</Text>
                        <Text style={styles.subtitle}>Let’s make it look good.</Text>

                        <Input
                            placeholder="Display Name"
                            value={fullName}
                            onChangeText={setFullName}
                            leftIcon="user"
                            containerStyle={{ marginTop: 20 }}
                        />

                        <Input
                            placeholder="Bio"
                            value={bio}
                            onChangeText={setBio}
                            leftIcon="info-circle"
                            multiline
                            inputContainerStyle={{ height: 80 }}
                            style={{ height: '100%', paddingVertical: 10, textAlignVertical: 'top' }}
                        />

                        {/* Date of Birth */}
                        <Text style={styles.label}>Date of Birth</Text>
                        <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.pickerTrigger}>
                            <FontAwesome5 name="calendar" size={16} color={Colors.dark.textSecondary} />
                            <Text style={styles.pickerText}>{dob.toDateString()}</Text>
                        </TouchableOpacity>
                        {showDatePicker && (Platform.OS === 'ios' ? (
                            <DateTimePicker
                                value={dob}
                                mode="date"
                                display="spinner"
                                onChange={(e, d) => {
                                    if (d) setDob(d);
                                    // keep open on iOS usually, but for simplicity toggle
                                }}
                                style={{ height: 120, width: '100%' }}
                                textColor="white"
                            />
                        ) : (
                            <DateTimePicker
                                value={dob}
                                mode="date"
                                display="default"
                                onChange={(e, d) => {
                                    setShowDatePicker(false);
                                    if (d) setDob(d);
                                }}
                            />
                        ))}

                        {/* Pickers Row */}
                        <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
                            {/* Major Picker Trigger */}
                            <View style={{ flex: 2 }}>
                                <Text style={styles.label}>Major</Text>
                                <TouchableOpacity onPress={() => setShowMajorPicker(true)} style={styles.pickerTrigger}>
                                    <FontAwesome5 name="graduation-cap" size={16} color={Colors.dark.textSecondary} />
                                    <Text style={styles.pickerText} numberOfLines={1}>{major || "Select Major"}</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Year Picker Trigger */}
                            <View style={{ flex: 1 }}>
                                <Text style={styles.label}>Year</Text>
                                <TouchableOpacity onPress={() => setShowYearPicker(true)} style={styles.pickerTrigger}>
                                    <Text style={styles.pickerText}>{year || "Year"}</Text>
                                    <FontAwesome5 name="chevron-down" size={12} color={Colors.dark.textSecondary} />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Status Picker */}
                        <View style={{ marginTop: 16 }}>
                            <Text style={styles.label}>Relationship Status</Text>
                            <TouchableOpacity onPress={() => setShowStatusPicker(true)} style={styles.pickerTrigger}>
                                <FontAwesome5 name="heart" size={16} color={Colors.dark.textSecondary} />
                                <Text style={styles.pickerText} numberOfLines={1}>{status || "Select Status"}</Text>
                            </TouchableOpacity>
                            <Text style={{ color: Colors.dark.textSecondary, fontSize: 12, marginTop: 6, marginLeft: 4 }}>
                                You can change or hide this later in your settings.
                            </Text>
                        </View>

                        <Button
                            title="Complete Setup"
                            onPress={handleComplete}
                            loading={loading}
                            disabled={!fullName || !major || !year || !status || loading}
                            style={{ marginTop: 40 }}
                        />
                    </View>
                </View>

            </ScrollView>

            {/* Custom Modal for Major Selection (Bottom Sheet Style) */}
            <Modal visible={showMajorPicker} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Select Major</Text>
                            <TouchableOpacity onPress={() => setShowMajorPicker(false)}>
                                <FontAwesome5 name="times" size={20} color={Colors.dark.textSecondary} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView>
                            {MAJORS.map(m => (
                                <TouchableOpacity
                                    key={m} style={styles.modalItem}
                                    onPress={() => { setMajor(m); setShowMajorPicker(false); }}
                                >
                                    <Text style={[styles.modalItemText, major === m && { color: Colors.dark.primary }]}>{m}</Text>
                                    {major === m && <FontAwesome5 name="check" size={14} color={Colors.dark.primary} />}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Custom Modal for Year Selection */}
            <Modal visible={showYearPicker} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Select Year</Text>
                            <TouchableOpacity onPress={() => setShowYearPicker(false)}>
                                <FontAwesome5 name="times" size={20} color={Colors.dark.textSecondary} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView>
                            {YEARS.map(y => (
                                <TouchableOpacity
                                    key={y} style={styles.modalItem}
                                    onPress={() => { setYear(y); setShowYearPicker(false); }}
                                >
                                    <Text style={[styles.modalItemText, year === y && { color: Colors.dark.primary }]}>{y}</Text>
                                    {year === y && <FontAwesome5 name="check" size={14} color={Colors.dark.primary} />}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Custom Modal for Status Selection */}
            <Modal visible={showStatusPicker} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Select Status</Text>
                            <TouchableOpacity onPress={() => setShowStatusPicker(false)}>
                                <FontAwesome5 name="times" size={20} color={Colors.dark.textSecondary} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView>
                            {STATUS_OPTIONS.map(s => (
                                <TouchableOpacity
                                    key={s} style={styles.modalItem}
                                    onPress={() => { setStatus(s); setShowStatusPicker(false); }}
                                >
                                    <Text style={[styles.modalItemText, status === s && { color: Colors.dark.primary }]}>{s}</Text>
                                    {status === s && <FontAwesome5 name="check" size={14} color={Colors.dark.primary} />}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    bgContainer: { width: '100%', height: 200, backgroundColor: Colors.dark.card },
    bgImage: { width: '100%', height: '100%' },
    bgPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
    uploadText: { color: Colors.dark.textSecondary, fontSize: 14 },

    contentContainer: { flex: 1 },

    avatarContainer: {
        width: 100, height: 100, borderRadius: 50, backgroundColor: Colors.dark.background,
        position: 'absolute', top: -50, alignSelf: 'center',
        borderWidth: 4, borderColor: Colors.dark.background,
        justifyContent: 'center', alignItems: 'center', zIndex: 10
    },
    avatarImage: { width: '100%', height: '100%', borderRadius: 50 },
    avatarPlaceholder: { width: '100%', height: '100%', borderRadius: 50, backgroundColor: Colors.dark.inputBackground, justifyContent: 'center', alignItems: 'center' },
    editBadge: {
        position: 'absolute', bottom: 0, right: 0,
        backgroundColor: Colors.dark.primary, width: 24, height: 24, borderRadius: 12,
        justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Colors.dark.background
    },

    title: { fontSize: 28, fontWeight: 'bold', color: Colors.dark.text, textAlign: 'center' },
    subtitle: { fontSize: 16, color: Colors.dark.textSecondary, textAlign: 'center', marginBottom: 20 },

    label: { color: Colors.dark.textSecondary, marginBottom: 8, fontSize: 14, fontWeight: '600' },
    pickerTrigger: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        backgroundColor: Colors.dark.inputBackground,
        padding: 16, borderRadius: 12, borderWidth: 1, borderColor: Colors.dark.border
    },
    pickerText: { color: Colors.dark.text, fontSize: 16 },

    // Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: Colors.dark.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '60%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.dark.text },
    modalItem: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.dark.border, flexDirection: 'row', justifyContent: 'space-between' },
    modalItemText: { fontSize: 16, color: Colors.dark.text, fontWeight: '500' },
});
