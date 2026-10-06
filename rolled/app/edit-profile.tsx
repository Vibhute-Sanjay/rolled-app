import { FontAwesome5 } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, DeviceEventEmitter, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { ScreenWrapper } from '../components/ScreenWrapper';
import { Colors } from '../constants/Colors';
import { useAuth } from '../context/AuthContext';
import { uploadToCloudinary } from '../lib/cloudinary';
import { supabase } from '../lib/supabase';

const MAJORS = [
    "Computer Science", "Information Technology", "Mechanical Engineering",
    "Civil Engineering", "Electronics", "Business Administration", "Economics",
    "Psychology", "Design", "Architecture", "Law", "Pharmacy"
];

const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

const STATUS_OPTIONS = ["Single", "Committed", "Talking to someone", "It's complicated", "Hidden"];

export default function EditProfileScreen() {
    const router = useRouter();
    const { user } = useAuth();

    const [loading, setLoading] = useState(false);
    // Removed initialLoading state

    // Data State
    const [fullName, setFullName] = useState(user?.user_metadata?.full_name || '');
    const [bio, setBio] = useState('');
    const [originalBg, setOriginalBg] = useState<string | null>(null);
    const [originalAvatar, setOriginalAvatar] = useState<string | null>(null);
    const [major, setMajor] = useState('');
    const [year, setYear] = useState('');
    const [status, setStatus] = useState('');

    // Image State (New selections)
    const [bgImage, setBgImage] = useState<string | null>(null);
    const [profileImage, setProfileImage] = useState<string | null>(null);

    // Modal State
    const [showMajorPicker, setShowMajorPicker] = useState(false);
    const [showYearPicker, setShowYearPicker] = useState(false);
    const [showStatusPicker, setShowStatusPicker] = useState(false);

    useEffect(() => {
        fetchProfile();
    }, [user]);

    // Listen for cropped images
    useEffect(() => {
        const sub = DeviceEventEmitter.addListener('image_cropped', ({ uri, target }) => {
            if (target === 'profile') setProfileImage(uri);
            if (target === 'cover' || target === 'bg') setBgImage(uri);
        });
        return () => sub.remove();
    }, []);

    const fetchProfile = async () => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user?.id)
                .single();

            if (data) {
                setFullName(data.full_name || '');
                setBio(data.bio || '');
                setMajor(data.major || '');
                setYear(data.year || '');
                setStatus(data.relationship_status || '');
                setOriginalBg(data.bg_image_url);
                setOriginalAvatar(data.avatar_url);
            }
        } catch (e) {
            console.error(e);
        }
    };

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

    const handleSave = async () => {
        setLoading(true);

        try {
            let bgUrl = originalBg;
            let avatarUrl = originalAvatar;

            // Upload Images if changed
            const folderPath = `rolled_users/${user?.id}/profile`;
            if (bgImage) bgUrl = await uploadToCloudinary(bgImage, folderPath);
            if (profileImage) avatarUrl = await uploadToCloudinary(profileImage, folderPath);

            const updates = {
                id: user?.id,
                full_name: fullName,
                bio: bio,
                major: major,
                year: year,
                relationship_status: status,
                bg_image_url: bgUrl,
                avatar_url: avatarUrl,
                updated_at: new Date(),
            };

            const { error } = await supabase.from('profiles').upsert(updates);

            if (error) throw error;

            // Cleanup old images if they were replaced
            const imagesToDelete: string[] = [];
            if (bgImage && originalBg) imagesToDelete.push(originalBg);
            if (profileImage && originalAvatar) imagesToDelete.push(originalAvatar);

            if (imagesToDelete.length > 0) {
                // Fire and forget cleanup
                supabase.functions.invoke('delete-cloudinary-asset', {
                    body: { urls: imagesToDelete }
                }).then(({ error }) => {
                    if (error) console.error('Cleanup error:', error);
                    else console.log('Old images cleaned up');
                });
            }

            Alert.alert("Success", "Profile updated successfully!");
            router.back();

        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally {
            setLoading(false);
        }
    };

    // Removed initialLoading check

    return (
        <ScreenWrapper style={{ paddingHorizontal: 0 }}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <FontAwesome5 name="arrow-left" size={20} color={Colors.dark.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Edit Profile</Text>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 50 }}>

                {/* Background Image Area - Full Width */}
                <TouchableOpacity style={styles.bgContainer} onPress={() => pickImage('bg')}>
                    {(bgImage || originalBg) ? (
                        <Image source={{ uri: bgImage || originalBg! }} style={styles.bgImage} />
                    ) : (
                        <View style={styles.bgPlaceholder}>
                            <FontAwesome5 name="camera" size={24} color={Colors.dark.textSecondary} />
                            <Text style={styles.uploadText}>Change Background</Text>
                        </View>
                    )}
                    <View style={styles.overlayIcon}>
                        <FontAwesome5 name="pencil-alt" size={16} color="white" />
                    </View>
                </TouchableOpacity>

                <View style={styles.contentContainer}>
                    {/* ... (Rest of content remains same but will be padded by contentContainer style) ... */}
                    {/* Profile Picture */}
                    <TouchableOpacity style={styles.avatarContainer} onPress={() => pickImage('profile')}>
                        <Avatar
                            uri={profileImage || originalAvatar}
                            name={fullName}
                            size={100}
                            style={styles.avatarImage}
                        />
                        <View style={styles.editBadge}>
                            <FontAwesome5 name="camera" size={12} color="white" />
                        </View>
                    </TouchableOpacity>

                    <View style={{ marginTop: 60, paddingHorizontal: 4 }}>
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

                        {/* Pickers Row */}
                        <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
                            <View style={{ flex: 2 }}>
                                <Text style={styles.label}>Major</Text>
                                <TouchableOpacity onPress={() => setShowMajorPicker(true)} style={styles.pickerTrigger}>
                                    <FontAwesome5 name="graduation-cap" size={16} color={Colors.dark.textSecondary} />
                                    <Text style={styles.pickerText} numberOfLines={1}>{major || "Select Major"}</Text>
                                </TouchableOpacity>
                            </View>

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
                        </View>

                        <Button
                            title="Save Changes"
                            onPress={handleSave}
                            loading={loading}
                            style={{ marginTop: 40 }}
                        />
                    </View>
                </View>

            </ScrollView>

            {/* Custom Modal for Major Selection */}
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
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#222',
        marginBottom: 0, // Removed bottom margin, handle in scroll view or components
        paddingHorizontal: 20 // Added padding since ScreenWrapper padding removed
    },
    backButton: { marginRight: 20 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.dark.text },

    bgContainer: { width: '100%', height: 200, backgroundColor: Colors.dark.card, overflow: 'hidden' }, // Removed borderRadius
    bgImage: { width: '100%', height: '100%' },
    bgPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
    uploadText: { color: Colors.dark.textSecondary, fontSize: 14 },
    overlayIcon: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.5)', padding: 8, borderRadius: 20 },

    contentContainer: { flex: 1, paddingHorizontal: 15 }, // Adjusted padding for fuller layout

    avatarContainer: {
        width: 100, height: 100, borderRadius: 50, backgroundColor: Colors.dark.background,
        alignSelf: 'center', marginTop: -50,
        borderWidth: 4, borderColor: Colors.dark.background,
        justifyContent: 'center', alignItems: 'center', zIndex: 10
    },
    avatarImage: { width: '100%', height: '100%', borderRadius: 50 },
    avatarPlaceholder: { width: '100%', height: '100%', borderRadius: 50, backgroundColor: Colors.dark.inputBackground, justifyContent: 'center', alignItems: 'center' },
    editBadge: {
        position: 'absolute', bottom: 0, right: 0,
        backgroundColor: Colors.dark.primary, width: 28, height: 28, borderRadius: 14,
        justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Colors.dark.background
    },

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
