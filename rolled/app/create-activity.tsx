import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { Alert, DeviceEventEmitter, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

import DateTimePicker from '@react-native-community/datetimepicker';
import { uploadToCloudinary } from '../lib/cloudinary';
import { supabase } from '../lib/supabase';
import { useCreatePostStore } from '../stores/createPostStore';

export default function CreateActivityScreen() {
    const { colors, theme } = useTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    // Form State
    const [coverImage, setCoverImage] = useState<string | null>(null);
    const [eventName, setEventName] = useState('');
    const [category, setCategory] = useState('');
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [shortDescription, setShortDescription] = useState('');
    const [fullDetails, setFullDetails] = useState('');
    const [location, setLocation] = useState('');

    // Ticket State
    const [ticketType, setTicketType] = useState<'Free' | 'Paid'>('Free');
    const [price, setPrice] = useState('');

    // Logistics
    const [capacity, setCapacity] = useState('');
    const [externalLink, setExternalLink] = useState('');
    const [date, setDate] = useState(new Date());
    const [time, setTime] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);

    // Media Store (Reused from Post Flow for Cropping)
    const { media, addMedia, removeMedia, clearMedia, croppedCoverImage, setCroppedCoverImage } = useCreatePostStore();

    // Clear media on mount to ensure fresh state
    useEffect(() => {
        clearMedia();
        return () => clearMedia(); // Cleanup on unmount too
    }, []);

    // Sync Cropped Cover Image
    useEffect(() => {
        if (croppedCoverImage) {
            setCoverImage(croppedCoverImage);
        }
    }, [croppedCoverImage]);

    // Listener for Cropped Images [NEW - Direct fallback]
    useEffect(() => {
        const sub = DeviceEventEmitter.addListener('image_cropped', ({ uri, target }: { uri: string, target: string }) => {
            if (target === 'cover') {
                setCoverImage(uri);
            }
        });
        return () => sub.remove();
    }, []);

    const CATEGORIES = [
        "Club Event",
        "Sports/Outdoor Activities",
        "Party/Fests",
        "Creative/Culture",
        "Hackathons/Workshop",
        "Recruiting",
        "Others (Something New)"
    ];

    const [uploading, setUploading] = useState(false);

    const pickImage = async () => {
        // [MODIFIED] Use Custom Cropper instead of Native
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: false, // DISABLE Native Editor
            quality: 1,
        });

        if (!result.canceled) {
            // Send to Custom Crop Screen with 'target' param
            setCroppedCoverImage(null); // Clear previous to trigger effect change if same
            router.push({
                pathname: '/post/crop',
                params: {
                    uri: result.assets[0].uri,
                    target: 'cover'
                }
            });
        }
    };

    const pickAdditionalImage = async () => {
        if (media.length >= 4) {
            Alert.alert("Limit Reached", "You can only add up to 4 additional images.");
            return;
        }

        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsMultipleSelection: true,
                quality: 1,
                allowsEditing: false, // Use Custom Cropper
                selectionLimit: 4 - media.length
            });

            if (!result.canceled && result.assets.length > 0) {
                // Formatting logic from create-post.tsx
                if (result.assets.length === 1) {
                    const uri = result.assets[0].uri;
                    // Standard single image flow: Add then Crop
                    addMedia(uri);
                    // We need the index of the newly added item. Since state update is async/batched,
                    // safe bet is media.length (current length is index of next item).
                    // BUT waitFor state update is tricky.
                    // create-post passes 'params' and assumes user crop will 'update' or 'add'.
                    // create-post logic:
                    /*
                        if 1 image: router.push({ pathname: '/post/crop', params: { uri } })
                        The crop screen 'HandleSave' calls addMedia if index is missing.
                    */

                    // However, for this specific flow, let's follow create-post exactly.
                    router.push({ pathname: '/post/crop', params: { uri } });

                } else {
                    const newUris = result.assets.map(a => a.uri);
                    const startIndex = media.length;

                    // Add all to store
                    newUris.forEach(uri => addMedia(uri));

                    // Sequence Flow
                    router.push({
                        pathname: '/post/crop',
                        params: {
                            uri: newUris[0],
                            index: startIndex.toString(),
                            isSequence: 'true'
                        }
                    });
                }
            }
        } catch (error) {
            console.error("Error picking media:", error);
            Alert.alert("Error", "Failed to pick image.");
        }
    };

    const handleDateChange = (event: any, selectedDate?: Date) => {
        setShowDatePicker(false);
        if (selectedDate) setDate(selectedDate);
    };

    const handleTimeChange = (event: any, selectedTime?: Date) => {
        setShowTimePicker(false);
        if (selectedTime) setTime(selectedTime);
    };

    const handlePost = async () => {
        if (!eventName || !coverImage) {
            Alert.alert('Missing Info', 'Please add a cover image and event name.');
            return;
        }

        setUploading(true);
        try {
            // 1. Upload Cover
            // Use Cloudinary with specific folder
            const coverUrl = await uploadToCloudinary(coverImage, 'rolled_activities/covers');
            if (!coverUrl) throw new Error("Failed to upload cover image");

            // 2. Upload Additional Images (from STORE)
            const contentUrls = await Promise.all(
                media.map(async (img) => {
                    if (img.startsWith('http')) return img;
                    const url = await uploadToCloudinary(img, 'rolled_activities/gallery');
                    if (!url) throw new Error("Failed to upload gallery image");
                    return url;
                })
            );

            // 3. Insert Activity
            const { error } = await supabase.from('activities').insert({
                title: eventName,
                cover_image: coverUrl,
                category,
                short_description: shortDescription,
                full_details: fullDetails,
                location,
                ticket_type: ticketType,
                price: ticketType === 'Paid' ? parseFloat(price) || 0 : 0,
                capacity: capacity ? parseInt(capacity) : null, // Null = Unlimited
                external_link: externalLink,
                start_time: (() => {
                    // Combine Date and Time
                    const combined = new Date(date);
                    combined.setHours(time.getHours());
                    combined.setMinutes(time.getMinutes());
                    return combined.toISOString();
                })(),
                additional_images: contentUrls, // Use uploaded URLs
                organizer_id: (await supabase.auth.getUser()).data.user?.id
            });

            if (error) throw error;

            Alert.alert("Success", "Activity posted successfully!");
            clearMedia(); // Cleanup
            router.back();

        } catch (error: any) {
            console.error(error);
            Alert.alert("Post Failed", error.message);
        } finally {
            setUploading(false);
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>

                {/* Header - Touching top */}
                <View style={[styles.header, { paddingTop: insets.top, paddingBottom: 15, borderBottomColor: colors.border }]}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="chevron-back" size={28} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Create Activity</Text>
                    <TouchableOpacity disabled={uploading} onPress={handlePost} style={[styles.postButton, { backgroundColor: colors.text, opacity: uploading ? 0.7 : 1 }]}>
                        <Text style={[styles.postButtonText, { color: colors.background }]}>{uploading ? 'Posting...' : 'Post'}</Text>
                    </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                    {/* Cover Image Upload (Vertical) */}
                    <TouchableOpacity onPress={pickImage} style={[styles.coverUpload, { borderColor: colors.border }]}>
                        {coverImage ? (
                            // Simple 'Cover' preview of the cropped image
                            <Image
                                source={{ uri: coverImage }}
                                style={{ width: '100%', height: '100%', resizeMode: 'cover' }}
                            />
                        ) : (
                            <View style={styles.uploadPlaceholder}>
                                <View style={styles.uploadIconCircle}>
                                    <Ionicons name="cloud-upload-outline" size={32} color={colors.primary} />
                                </View>
                                <Text style={[styles.uploadText, { color: colors.text }]}>Upload Cover Image</Text>
                                <Text style={[styles.uploadSubText, { color: colors.textSecondary }]}>
                                    Size: <Text style={{ fontWeight: 'bold', color: colors.primary }}>Flexible (Free Crop)</Text>
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>

                    {/* Category Dropdown */}
                    <View style={styles.section}>
                        <Text style={[styles.sectionLabel, { color: colors.primary }]}>• CATEGORY</Text>
                        <TouchableOpacity
                            style={[styles.inputBox, { backgroundColor: colors.card, borderColor: colors.border }]}
                            onPress={() => setShowCategoryModal(true)}
                        >
                            <Ionicons name="search" size={20} color={colors.textSecondary} style={{ marginRight: 10 }} />
                            <Text style={[styles.input, { color: category ? colors.text : colors.textSecondary, textAlignVertical: 'center', paddingTop: 12 }]}>
                                {category || "Select category..."}
                            </Text>
                            <Ionicons name="chevron-down" size={20} color={colors.textSecondary} style={{ marginLeft: 'auto' }} />
                        </TouchableOpacity>
                    </View>

                    {/* Event Name */}
                    <View style={styles.section}>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>Event Name</Text>
                        <TextInput
                            style={[styles.eventNameInput, { color: colors.text, borderBottomColor: colors.border }]}
                            placeholder="Enter event name"
                            placeholderTextColor={colors.textSecondary}
                            value={eventName}
                            onChangeText={setEventName}
                        />
                    </View>

                    {/* Location */}
                    <View style={styles.section}>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>Location</Text>
                        <TextInput
                            style={[styles.eventNameInput, { color: colors.text, borderBottomColor: colors.border, fontSize: 16, paddingBottom: 8 }]}
                            placeholder="Add location"
                            placeholderTextColor={colors.textSecondary}
                            value={location}
                            onChangeText={setLocation}
                        />
                    </View>


                    {/* Short Description */}
                    <View style={styles.section}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Ionicons name="information-circle-outline" size={16} color={colors.primary} style={{ marginRight: 6 }} />
                                <Text style={[styles.label, { color: colors.text, marginBottom: 0 }]}>Short Description</Text>
                            </View>
                            <Text style={{ color: shortDescription.length > 100 ? 'red' : colors.textSecondary, fontSize: 10 }}>
                                {shortDescription.length}/100
                            </Text>
                        </View>
                        <TextInput
                            style={[styles.textArea, { backgroundColor: colors.card, color: colors.text, height: 80 }]}
                            placeholder="Briefly describe what this is about..."
                            placeholderTextColor={colors.textSecondary}
                            multiline
                            maxLength={100}
                            value={shortDescription}
                            onChangeText={setShortDescription}
                        />
                    </View>

                    {/* Full Details */}
                    <View style={styles.section}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <MaterialCommunityIcons name="text" size={16} color={colors.primary} style={{ marginRight: 6 }} />
                                <Text style={[styles.label, { color: colors.text, marginBottom: 0 }]}>Full Details</Text>
                            </View>
                            <Text style={{ color: fullDetails.length > 2200 ? 'red' : colors.textSecondary, fontSize: 10 }}>
                                {fullDetails.length}/2200
                            </Text>
                        </View>
                        <TextInput
                            style={[styles.textArea, { backgroundColor: colors.card, color: colors.text, height: 120 }]}
                            placeholder="Describe the event, rules, prerequisites, itinerary, etc."
                            placeholderTextColor={colors.textSecondary}
                            multiline
                            textAlignVertical="top"
                            maxLength={2200}
                            value={fullDetails}
                            onChangeText={setFullDetails}
                        />
                    </View>

                    {/* Ticket Type */}
                    <View style={styles.section}>
                        <Text style={[styles.sectionLabel, { color: colors.primary }]}>• TICKET TYPE</Text>
                        <View style={[styles.ticketToggle, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <TouchableOpacity
                                style={[styles.toggleOption, ticketType === 'Free' && { backgroundColor: '#333' }]}
                                onPress={() => setTicketType('Free')}
                            >
                                <Text style={[styles.toggleText, { color: ticketType === 'Free' ? '#FFF' : colors.textSecondary }]}>Free</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.toggleOption, ticketType === 'Paid' && { backgroundColor: '#333' }]}
                                onPress={() => setTicketType('Paid')}
                            >
                                <Text style={[styles.toggleText, { color: ticketType === 'Paid' ? '#FFF' : colors.textSecondary }]}>Paid</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Conditional Price Input */}
                        {ticketType === 'Paid' && (
                            <View style={[styles.inputBox, { marginTop: 12, backgroundColor: colors.card, borderColor: colors.border }]}>
                                <Text style={{ color: colors.text, fontSize: 18, marginRight: 8, fontWeight: 'bold' }}>₹</Text>
                                <TextInput
                                    placeholder="0"
                                    placeholderTextColor={colors.textSecondary}
                                    style={[styles.input, { color: colors.text, fontSize: 18, fontWeight: 'bold' }]}
                                    keyboardType="numeric"
                                    value={price}
                                    onChangeText={setPrice}
                                />
                            </View>
                        )}
                        {ticketType === 'Paid' && (
                            <Text style={[styles.helperText, { marginTop: 8, color: colors.primary }]}>
                                Tip: Add the payment link in the "Ext. Link" field below.
                            </Text>
                        )}
                    </View>

                    {/* Capacity & Link Row */}
                    <View style={styles.row}>
                        <View style={[styles.section, { flex: 1, marginRight: 10 }]}>
                            <Text style={[styles.label, { color: colors.textSecondary }]}>CAPACITY</Text>
                            <View style={[styles.inputBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                <Ionicons name="people-outline" size={18} color={colors.textSecondary} style={{ marginRight: 8 }} />
                                <TextInput
                                    placeholder="Unlimited"
                                    placeholderTextColor={colors.text}
                                    style={[styles.input, { color: colors.text }]}
                                    value={capacity}
                                    onChangeText={(text) => setCapacity(text.replace(/[^0-9]/g, ''))}
                                    keyboardType="number-pad"
                                />
                            </View>
                        </View>
                        <View style={[styles.section, { flex: 1 }]}>
                            <Text style={[styles.label, { color: colors.textSecondary }]}>EXT. LINK</Text>
                            <View style={[styles.inputBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                <Ionicons name="link-outline" size={18} color={colors.textSecondary} style={{ marginRight: 8 }} />
                                <TextInput
                                    placeholder="https://"
                                    placeholderTextColor={colors.textSecondary}
                                    style={[styles.input, { color: colors.text }]}
                                    value={externalLink}
                                    onChangeText={setExternalLink}
                                />
                            </View>
                        </View>
                    </View>

                    {/* Date & Time Row */}
                    <View style={styles.row}>
                        <View style={[styles.section, { flex: 1, marginRight: 10 }]}>
                            <Text style={[styles.label, { color: colors.textSecondary }]}>DATE</Text>
                            <TouchableOpacity
                                style={[styles.inputBox, { backgroundColor: colors.card, borderColor: colors.border }]}
                                onPress={() => setShowDatePicker(true)}
                            >
                                <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} style={{ marginRight: 8 }} />
                                <Text style={{ color: colors.text }}>{date.toLocaleDateString()}</Text>
                                <Ionicons name="chevron-down" size={16} color={colors.textSecondary} style={{ marginLeft: 'auto' }} />
                            </TouchableOpacity>
                        </View>
                        <View style={[styles.section, { flex: 1 }]}>
                            <Text style={[styles.label, { color: colors.textSecondary }]}>TIME</Text>
                            <TouchableOpacity
                                style={[styles.inputBox, { backgroundColor: colors.card, borderColor: colors.border }]}
                                onPress={() => setShowTimePicker(true)}
                            >
                                <Ionicons name="time-outline" size={18} color={colors.textSecondary} style={{ marginRight: 8 }} />
                                <Text style={{ color: colors.text }}>{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                                <Ionicons name="chevron-down" size={16} color={colors.textSecondary} style={{ marginLeft: 'auto' }} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Additional Images (Gallery) */}
                    <View style={styles.section}>
                        <Text style={[styles.sectionLabel, { color: colors.primary }]}>• GALLERY (Max 4)</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                            {media.map((img, index) => (
                                <View key={index} style={{
                                    width: 80,
                                    height: 80,
                                    borderRadius: 12,
                                    overflow: 'hidden',
                                    backgroundColor: '#222',
                                    position: 'relative' // relative for absolute children
                                }}>
                                    <Image source={{ uri: img }} style={{ width: '100%', height: '100%' }} />
                                    <TouchableOpacity
                                        style={{
                                            position: 'absolute',
                                            top: 4,
                                            right: 4,
                                            backgroundColor: 'rgba(0,0,0,0.6)',
                                            borderRadius: 10,
                                            padding: 4,
                                            zIndex: 10
                                        }}
                                        onPress={() => removeMedia(index)}
                                    >
                                        <Ionicons name="close" size={12} color="white" />
                                    </TouchableOpacity>

                                    {/* Crop/Edit Button */}
                                    <TouchableOpacity
                                        style={{
                                            position: 'absolute',
                                            bottom: 5,
                                            left: 5,
                                            backgroundColor: 'rgba(0,0,0,0.6)',
                                            borderRadius: 10,
                                            padding: 4,
                                            zIndex: 10
                                        }}
                                        onPress={() => router.push({ pathname: '/post/crop', params: { uri: img, index: index.toString() } })}
                                    >
                                        <MaterialCommunityIcons name="crop" size={14} color="white" />
                                    </TouchableOpacity>

                                </View>
                            ))}
                            {media.length < 4 && (
                                <TouchableOpacity
                                    onPress={pickAdditionalImage}
                                    style={{
                                        width: 80,
                                        height: 80,
                                        borderRadius: 12,
                                        borderWidth: 1,
                                        borderStyle: 'dashed',
                                        borderColor: colors.border,
                                        justifyContent: 'center',
                                        alignItems: 'center'
                                    }}
                                >
                                    <Ionicons name="add" size={24} color={colors.textSecondary} />
                                </TouchableOpacity>
                            )}
                        </ScrollView>
                    </View>

                    {/* Category Modal */}
                    {showCategoryModal && (
                        <View style={styles.modalOverlay}>
                            <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
                                <Text style={[styles.modalTitle, { color: colors.text }]}>Select Category</Text>
                                {CATEGORIES.map(cat => (
                                    <TouchableOpacity
                                        key={cat}
                                        style={styles.modalItem}
                                        onPress={() => { setCategory(cat); setShowCategoryModal(false); }}
                                    >
                                        <Text style={{ color: colors.text, fontSize: 16 }}>{cat}</Text>
                                        {category === cat && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                                    </TouchableOpacity>
                                ))}
                                <TouchableOpacity onPress={() => setShowCategoryModal(false)} style={styles.modalClose}>
                                    <Text style={{ color: colors.textSecondary }}>Cancel</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {/* DateTime Pickers (Platform specific handling usually needed but utilizing basic View for now if standard fails) */}
                    {showDatePicker && (
                        <DateTimePicker
                            value={date}
                            mode="date"
                            display="default"
                            onChange={handleDateChange}
                            themeVariant={theme === 'dark' ? 'dark' : 'light'}
                        />
                    )}
                    {showTimePicker && (
                        <DateTimePicker
                            value={time}
                            mode="time"
                            display="default"
                            onChange={handleTimeChange}
                            themeVariant={theme === 'dark' ? 'dark' : 'light'}
                        />
                    )}

                    <View style={{ height: 100 }} />
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 15,
        borderBottomWidth: 0.5,
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    postButton: {
        paddingVertical: 6,
        paddingHorizontal: 16,
        borderRadius: 20,
    },
    postButtonText: {
        fontWeight: 'bold',
        fontSize: 14,
    },
    scrollContent: {
        padding: 20,
    },
    coverUpload: {
        width: '100%',
        aspectRatio: 0.8, // Vertical 4:5ish
        borderRadius: 20,
        borderWidth: 1,
        borderStyle: 'dashed',
        marginBottom: 24,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.03)',
    },
    coverImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    uploadPlaceholder: {
        alignItems: 'center',
    },
    uploadIconCircle: {
        width: 50, height: 50,
        borderRadius: 25,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center', alignItems: 'center',
        marginBottom: 12,
    },
    uploadText: {
        fontWeight: 'bold',
        fontSize: 16,
        marginBottom: 4,
    },
    uploadSubText: {
        color: '#666',
        fontSize: 12,
    },
    helperText: {
        fontSize: 12,
        fontStyle: 'italic',
    },
    section: {
        marginBottom: 24,
    },
    sectionLabel: {
        fontSize: 12,
        fontWeight: 'bold',
        letterSpacing: 1,
        marginBottom: 10,
    },
    label: {
        fontSize: 14,
        marginBottom: 8,
    },
    inputBox: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        height: 50,
        borderRadius: 14,
        borderWidth: 1,
    },
    input: {
        flex: 1,
        height: '100%',
        fontSize: 15,
    },
    eventNameInput: {
        fontSize: 20,
        fontWeight: 'bold',
        paddingVertical: 10,
        borderBottomWidth: 1,
    },
    textArea: {
        borderRadius: 14,
        padding: 16,
        fontSize: 15,
        lineHeight: 22,
    },
    ticketToggle: {
        flexDirection: 'row',
        borderRadius: 14,
        borderWidth: 1,
        padding: 4,
    },
    toggleOption: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 10,
    },
    toggleText: {
        fontWeight: 'bold',
        fontSize: 15,
    },
    row: {
        flexDirection: 'row',
        marginBottom: 12,
    },
    addGalleryButton: {
        width: 80, height: 80,
        borderRadius: 14,
        borderWidth: 1,
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
    },
    additionalImageContainer: {
        width: 80, height: 80,
        borderRadius: 14,
        overflow: 'hidden',
    },
    additionalImage: {
        width: '100%', height: '100%',
    },
    removeImageButton: {
        position: 'absolute', top: 2, right: 2,
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderRadius: 10, padding: 2,
    },
    modalOverlay: {
        position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center', padding: 20, zIndex: 1000
    },
    modalContent: {
        padding: 20, borderRadius: 20,
    },
    modalTitle: {
        fontSize: 18, fontWeight: 'bold', marginBottom: 15,
    },
    modalItem: {
        flexDirection: 'row', justifyContent: 'space-between',
        paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#222'
    },
    modalClose: {
        marginTop: 15, alignItems: 'center', padding: 10
    }
});
