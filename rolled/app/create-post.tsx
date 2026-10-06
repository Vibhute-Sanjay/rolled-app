import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Image, TouchableOpacity, ScrollView, Modal, Alert, Platform, KeyboardAvoidingView } from 'react-native';
import { ScreenWrapper } from '../components/ScreenWrapper';
import { Colors } from '../constants/Colors';
import { useAuth } from '../context/AuthContext';
import { FontAwesome5, Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { BlurView } from 'expo-blur';
import { uploadToCloudinary } from '../lib/cloudinary';
import { ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';
import { useCreatePostStore } from '../stores/createPostStore';
import { CustomToast } from '../components/CustomToast';
import { DeviceEventEmitter } from 'react-native';
import { startVideoUploadPipeline } from '../lib/videoPipeline';
import { useVideoPlayer, VideoView } from 'expo-video';

export default function CreatePostScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { user } = useAuth();

    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    // Global Store
    const { media, videoUri, videoDuration, setVideo, aspectRatio, addMedia, removeMedia, clearMedia } = useCreatePostStore();
    
    // Video Player
    const player = useVideoPlayer(videoUri, player => {
        player.loop = true;
        player.muted = true;
        player.play();
    });

    // Post State
    const [content, setContent] = useState('');
    const [location, setLocation] = useState<string | null>(null);
    const [taggedUsers, setTaggedUsers] = useState<any[]>([]);

    // Audience State
    const [audience, setAudience] = useState<'followers' | 'campus'>('campus');

    // UI State for Modals/Triggers
    const [showLocationModal, setShowLocationModal] = useState(false);
    const [showTagModal, setShowTagModal] = useState(false);

    // Toast State
    const [toastMessage, setToastMessage] = useState('');
    const [tempLocation, setTempLocation] = useState('');

    // Search State
    const [userSearchQuery, setUserSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [showInlineSuggestions, setShowInlineSuggestions] = useState(false);

    useEffect(() => {
        if (user) fetchProfile();
    }, [user]);

    // Search Users Effect
    useEffect(() => {
        // Trigger search if either Modal is open OR Inline Suggestions are active
        if (showTagModal || showInlineSuggestions) {
            const delayDebounce = setTimeout(() => {
                searchUsers(userSearchQuery);
            }, 300); // 300ms debounce
            return () => clearTimeout(delayDebounce);
        }
    }, [userSearchQuery, showTagModal, showInlineSuggestions]);

    const searchUsers = async (query: string) => {
        if (!query.trim()) {
            setSearchResults([]);
            return;
        }
        const { data } = await supabase
            .from('profiles')
            .select('id, username, full_name, avatar_url')
            .ilike('username', `%${query}%`)
            .limit(5);

        if (data) setSearchResults(data);
    };

    const fetchProfile = async () => {
        const { data } = await supabase.from('profiles').select('*').eq('id', user?.id).single();
        if (data) setProfile(data);
    };

    // --- INLINE TAGGING LOGIC ---
    const handleContentChange = (text: string) => {
        setContent(text);

        // Regex to find the LAST word being typed
        // Matches "@chars" at the end of the string
        const match = text.match(/@(\w*)$/);

        if (match) {
            const query = match[1];
            setUserSearchQuery(query);
            setShowInlineSuggestions(true);
        } else {
            setShowInlineSuggestions(false);
        }
    };

    const handleSelectInlineUser = (selectedUser: any) => {
        // Replace the partial "@query" with "@username "
        const newContent = content.replace(/@(\w*)$/, `@${selectedUser.username} `);
        setContent(newContent);

        // NOTE: We do NOT add to 'taggedUsers' array here.
        // User requested that inline mentions do NOT appear as chips below the post.
        // Only explicit tags (via icon) appear there.

        // Reset
        setShowInlineSuggestions(false);
        setUserSearchQuery('');
    };
    // ----------------------------

    const pickMedia = async () => {
        // ... (start of pickMedia function body is unchanged) ...
        try {
            // STRICT MODE: Native Editing Disabled. Multi Selection allowed.
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images', 'videos'],
                allowsMultipleSelection: true, // Allow multiple
                quality: 1, // High quality for cropping
                allowsEditing: false, // DISABLE Native Editor
            });

            if (!result.canceled && result.assets.length > 0) {
                // Check if it's a video
                if (result.assets[0].type === 'video') {
                    if (result.assets[0].duration && result.assets[0].duration > 90000) {
                        Alert.alert("Video Too Long", "Please select a video that is 90 seconds or shorter.");
                        return;
                    }
                    setVideo(result.assets[0].uri, result.assets[0].duration);
                    return;
                }

                // If 1 image, go straight to crop
                if (result.assets.length === 1) {
                    const uri = result.assets[0].uri;
                    router.push({ pathname: '/post/crop', params: { uri } });
                } else {
                    const newUris = result.assets.map(a => a.uri);
                    const startIndex = media.length; // Index where new batch starts

                    // Add all to store
                    newUris.forEach(uri => addMedia(uri));

                    // Sequence Flow: Start Cropping the FIRST item of the NEW batch
                    router.push({
                        pathname: '/post/crop',
                        params: {
                            uri: newUris[0],
                            index: startIndex,
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

    const handlePost = async () => {
        if (!content && media.length === 0 && !videoUri) return;
        setLoading(true);

        try {
            if (videoUri) {
                // Trigger background video pipeline and go back immediately
                const postData = {
                    user_id: user?.id,
                    content,
                    location,
                    tagged_users: taggedUsers.map(u => u.id),
                    audience,
                    aspect_ratio: aspectRatio.toString(),
                };
                // Fire and forget
                startVideoUploadPipeline(videoUri, videoDuration || 0, postData);
                
                setToastMessage("Video upload started!");
                setTimeout(() => {
                    setContent('');
                    clearMedia();
                    setLocation(null);
                    setTaggedUsers([]);
                    if (router.canDismiss()) {
                        router.dismissAll();
                    } else {
                        router.back();
                    }
                    setTimeout(() => {
                        router.navigate('/(tabs)/feed');
                    }, 10);
                }, 1000);
                return;
            }

            // 1. Upload Media
            const uploadedUrls: string[] = [];
            for (const uri of media) {
                // If it's already a remote URL (rare case here), skip upload
                if (uri.startsWith('http')) {
                    uploadedUrls.push(uri);
                    continue;
                }
                const folderPath = `rolled_users/${user?.id}/posts`;
                // Use existing Cloudinary helper
                const url = await uploadToCloudinary(uri, folderPath);
                if (url) uploadedUrls.push(url);
            }

            // 2. Insert into Supabase
            const postData = {
                user_id: user?.id,
                content,
                media_urls: uploadedUrls,
                location,
                tagged_users: taggedUsers.map(u => u.id),
                audience,
                aspect_ratio: aspectRatio,
            };

            const { data: insertedData, error } = await supabase.from('posts').insert(postData).select(`
                *,
                profile:profiles!posts_user_id_fkey(username, full_name, avatar_url, is_verified, is_admin, is_og),
                likes_count:likes(count),
                comments_count:comments(count)
            `).single();

            if (error) throw error;

            // [NEW] Emit event for instant feed update
            if (insertedData) {
                const formattedPost = {
                    ...insertedData,
                    likes_count: 0,
                    comments_count: 0,
                    has_liked: false,
                    has_saved: false
                };
                DeviceEventEmitter.emit('new_post_created', formattedPost);
            }

            // Show Toast, then wait briefly before navigating back
            setToastMessage("Post published!");
            setTimeout(() => {
                // Cleanup
                setContent('');
                clearMedia();
                setLocation(null);
                setTaggedUsers([]);
                if (router.canDismiss()) {
                    router.dismissAll();
                } else {
                    router.back();
                }
                setTimeout(() => {
                    router.navigate('/(tabs)/feed');
                }, 10);
            }, 1000);

        } catch (error: any) {
            Alert.alert("Error", error.message || "Failed to create post");
        } finally {
            setLoading(false);
        }
    };

    // Explicit Cancel Handler
    const handleCancel = () => {
        // Option: Show confirmation if changes made?
        if (content || media.length > 0 || videoUri) {
            Alert.alert(
                "Discard Post?",
                "You have unsaved changes.",
                [
                    { text: "Keep Editing", style: "cancel" },
                    {
                        text: "Discard",
                        style: 'destructive',
                        onPress: () => { clearMedia(); router.back(); }
                    }
                ]
            );
        } else {
            router.back();
        }
    };

    return (
        <ScreenWrapper style={{ paddingHorizontal: 0 }}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>

                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={handleCancel}>
                        <Text style={styles.cancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.postButton, ((!content && media.length === 0 && !videoUri) || loading) && styles.disabledButton]}
                        onPress={handlePost}
                        disabled={(!content && media.length === 0 && !videoUri) || loading}
                    >
                        {loading ? <ActivityIndicator size="small" color="#000" /> : <Text style={styles.postButtonText}>Post</Text>}
                    </TouchableOpacity>
                </View>

                <ScrollView style={styles.container}>
                    {/* User Row */}
                    <View style={styles.userRow}>
                        <Image
                            source={{ uri: profile?.avatar_url || 'https://via.placeholder.com/50' }}
                            style={styles.avatar}
                        />
                        <View>
                            <Text style={styles.userName}>{profile?.full_name || 'User'}</Text>
                            <Text style={styles.userHandle}>@{profile?.username || 'handle'}</Text>
                        </View>
                    </View>

                    {/* Input Area */}
                    <TextInput
                        style={styles.input}
                        placeholder="What's on your mind?"
                        placeholderTextColor={Colors.dark.textSecondary}
                        multiline
                        autoFocus
                        value={content}
                        onChangeText={handleContentChange} // Hooked up our new handler
                        textAlignVertical="top"
                        maxLength={500}
                    />
                    <Text style={{
                        alignSelf: 'flex-end',
                        color: content.length >= 500 ? Colors.dark.error : Colors.dark.textSecondary,
                        fontSize: 12,
                        marginRight: 15,
                        marginBottom: 10
                    }}>
                        {content.length}/500
                    </Text>

                    {/* Selected Media Preview */}
                    {videoUri ? (
                        <View style={styles.mediaContainer}>
                            <Text style={styles.sectionLabel}>SELECTED VIDEO</Text>
                            <View style={[styles.mediaItem, { width: 150, height: 200 }]}>
                                <VideoView player={player} style={styles.mediaImage} fullscreenOptions={{ enable: false }} />
                                <TouchableOpacity style={styles.removeMedia} onPress={() => setVideo(null)}>
                                    <Ionicons name="close" size={16} color="white" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : media.length > 0 && (
                        <View style={styles.mediaContainer}>
                            <Text style={styles.sectionLabel}>SELECTED MEDIA ({media.length}) - Tap to Crop</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                                {media.map((item, index) => (
                                    <View key={index} style={styles.mediaItem}>
                                        <TouchableOpacity onPress={() => router.push({ pathname: '/post/crop', params: { uri: item, index } })}>
                                            <Image source={{ uri: item }} style={styles.mediaImage} />
                                            {/* Edit Overlay Icon */}
                                            <View style={{
                                                position: 'absolute',
                                                bottom: 5,
                                                left: 5,
                                                backgroundColor: 'rgba(0,0,0,0.6)',
                                                borderRadius: 10,
                                                padding: 4,
                                                zIndex: 10,
                                                elevation: 5
                                            }}>
                                                <MaterialCommunityIcons name="crop" size={14} color="white" />
                                            </View>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.removeMedia} onPress={() => removeMedia(index)}>
                                            <Ionicons name="close" size={12} color="white" />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                                {/* Add More Button */}
                                <TouchableOpacity style={styles.addMoreButton} onPress={pickMedia}>
                                    <Ionicons name="add" size={24} color="white" />
                                </TouchableOpacity>
                            </ScrollView>
                        </View>
                    )}

                    {/* Metadata Chips (Location, Tags) */}
                    <View style={styles.chipsContainer}>
                        {location && (
                            <View style={styles.chip}>
                                <FontAwesome5 name="map-marker-alt" size={10} color={Colors.dark.primary} />
                                <Text style={styles.chipText}>{location}</Text>
                                <TouchableOpacity onPress={() => setLocation(null)}>
                                    <Ionicons name="close" size={12} color={Colors.dark.textSecondary} />
                                </TouchableOpacity>
                            </View>
                        )}
                        {taggedUsers.map(u => (
                            <View key={u.id} style={styles.chip}>
                                <FontAwesome5 name="user-tag" size={10} color={Colors.dark.primary} />
                                <Text style={styles.chipText}>{u.handle}</Text>
                                <TouchableOpacity onPress={() => setTaggedUsers(prev => prev.filter(t => t.id !== u.id))}>
                                    <Ionicons name="close" size={12} color={Colors.dark.textSecondary} />
                                </TouchableOpacity>
                            </View>
                        ))}
                    </View>

                </ScrollView>

                {/* --- INLINE SUGGESTIONS LIST (NEW) --- */}
                {showInlineSuggestions && (
                    <View style={styles.inlineSuggestionsContainer}>
                        <Text style={styles.suggestionsHeader}>Suggested Users</Text>
                        <ScrollView keyboardShouldPersistTaps="always" style={{ maxHeight: 200 }}>
                            {searchResults.map(u => (
                                <TouchableOpacity
                                    key={u.id}
                                    style={styles.suggestionItem}
                                    onPress={() => handleSelectInlineUser(u)}
                                >
                                    <Image
                                        source={{ uri: u.avatar_url || 'https://via.placeholder.com/30' }}
                                        style={styles.suggestionAvatar}
                                    />
                                    <View>
                                        <Text style={styles.suggestionName}>{u.full_name}</Text>
                                        <Text style={styles.suggestionHandle}>@{u.username}</Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                            {searchResults.length === 0 && (
                                <Text style={styles.noResultsText}>No results found.</Text>
                            )}
                        </ScrollView>
                    </View>
                )}
                {/* ------------------------------------- */}

                {/* Bottom Toolbar */}
                <View style={styles.toolbar}>
                    <View style={styles.tools}>
                        <TouchableOpacity style={styles.toolIcon} onPress={pickMedia}>
                            <MaterialCommunityIcons name="image-multiple" size={24} color={Colors.dark.primary} />
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.toolIcon} onPress={() => setShowLocationModal(true)}>
                            <FontAwesome5 name="map-marker-alt" size={20} color={location ? Colors.dark.success : Colors.dark.textSecondary} />
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.toolIcon} onPress={() => setShowTagModal(true)}>
                            <FontAwesome5 name="user-tag" size={20} color={taggedUsers.length > 0 ? Colors.dark.success : Colors.dark.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    {/* Audience Selector */}
                    <TouchableOpacity
                        style={styles.audienceButton}
                        onPress={() => setAudience(prev => prev === 'followers' ? 'campus' : 'followers')}
                    >
                        <FontAwesome5 name={audience === 'followers' ? "users" : "university"} size={14} color="#000" />
                        <Text style={styles.audienceText}>{audience === 'followers' ? 'Followers' : 'Campus'}</Text>
                        <FontAwesome5 name="chevron-down" size={10} color="#000" />
                    </TouchableOpacity>
                </View>

                {/* ... existing Modals ... */}

                {/* Location Modal */}
                <Modal visible={showLocationModal} transparent animationType="fade">
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <Text style={styles.modalTitle}>Add Location</Text>
                            <TextInput
                                style={styles.modalInput}
                                placeholder="Enter location..."
                                placeholderTextColor="#666"
                                value={tempLocation}
                                onChangeText={setTempLocation}
                                autoFocus
                            />
                            <View style={styles.modalActions}>
                                <TouchableOpacity onPress={() => setShowLocationModal(false)}><Text style={styles.modalCancel}>Cancel</Text></TouchableOpacity>
                                <TouchableOpacity onPress={() => { setLocation(tempLocation); setShowLocationModal(false); setTempLocation(''); }}>
                                    <Text style={styles.modalConfirm}>Set</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>

                {/* Tag Modal (With Search) */}
                <Modal visible={showTagModal} transparent animationType="slide">
                    <View style={styles.modalOverlay}>
                        <View style={[styles.modalContent, { height: 500 }]}>
                            <Text style={styles.modalTitle}>Tag People</Text>

                            <TextInput
                                style={styles.modalInput}
                                placeholder="Search users..."
                                placeholderTextColor="#666"
                                value={userSearchQuery}
                                onChangeText={setUserSearchQuery}
                            />

                            <ScrollView>
                                {searchResults.map(u => (
                                    <TouchableOpacity key={u.id} style={styles.userItem} onPress={() => {
                                        if (!taggedUsers.find(t => t.id === u.id)) {
                                            setTaggedUsers([...taggedUsers, { id: u.id, handle: u.username }]);
                                        }
                                        setShowTagModal(false);
                                        setUserSearchQuery('');
                                    }}>
                                        <View style={styles.userAvatarPlaceholder}>
                                            {/* Ideally show avatar image here */}
                                        </View>
                                        <Text style={styles.userItemName}>{u.full_name} (@{u.username})</Text>
                                    </TouchableOpacity>
                                ))}
                                {searchResults.length === 0 && userSearchQuery.length > 0 && (
                                    <Text style={{ color: '#666', textAlign: 'center', marginTop: 20 }}>No users found.</Text>
                                )}
                            </ScrollView>

                            <TouchableOpacity onPress={() => { setShowTagModal(false); setUserSearchQuery(''); }} style={{ marginTop: 20 }}>
                                <Text style={styles.modalCancel}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>

                {/* Toast Notification */}
                {toastMessage ? <CustomToast visible={!!toastMessage} message={toastMessage} onHide={() => setToastMessage('')} /> : null}

            </KeyboardAvoidingView>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#222' },
    cancelText: { color: Colors.dark.text, fontSize: 16 },
    postButton: { backgroundColor: Colors.dark.primary, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 },
    disabledButton: { opacity: 0.5 },
    postButtonText: { color: '#000', fontWeight: 'bold' },

    container: { flex: 1, padding: 20 },
    userRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 12 },
    userName: { color: Colors.dark.text, fontWeight: 'bold', fontSize: 16 },
    userHandle: { color: Colors.dark.primary, fontSize: 14 },

    input: { color: Colors.dark.text, fontSize: 18, minHeight: 100, marginBottom: 20 },

    mediaContainer: { marginBottom: 20 },
    sectionLabel: { color: Colors.dark.textSecondary, fontSize: 12, marginBottom: 10, letterSpacing: 1 },
    mediaItem: { width: 100, height: 100, borderRadius: 12, overflow: 'hidden', marginRight: 10 },
    mediaImage: { width: '100%', height: '100%' },
    removeMedia: { position: 'absolute', top: 5, right: 5, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, padding: 4 },
    addMoreButton: {
        width: 60, height: 100, borderRadius: 12, backgroundColor: '#222',
        justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#333'
    },

    chipsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A1A', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, gap: 6, borderWidth: 1, borderColor: '#333' },
    chipText: { color: Colors.dark.text, fontSize: 12 },

    toolbar: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 20, paddingVertical: 15,
        borderTopWidth: 1, borderTopColor: '#222', backgroundColor: Colors.dark.background
    },
    tools: { flexDirection: 'row', gap: 24 },
    toolIcon: { padding: 4 },

    audienceButton: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: Colors.dark.primary,
        paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20
    },
    audienceText: { color: '#000', fontWeight: 'bold', fontSize: 12 },

    // Modals
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: Colors.dark.card, padding: 24, borderRadius: 20 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.dark.text, marginBottom: 10 },
    modalSubtitle: { fontSize: 14, color: Colors.dark.textSecondary, marginBottom: 20 },
    modalInput: { backgroundColor: '#111', color: 'white', padding: 12, borderRadius: 8, marginBottom: 20 },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 20 },
    modalCancel: { color: Colors.dark.textSecondary, fontSize: 16 },
    modalConfirm: { color: Colors.dark.primary, fontSize: 16, fontWeight: 'bold' },

    userItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#333' },
    userAvatarPlaceholder: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#444', marginRight: 12 },
    userItemName: { color: 'white' },

    // Inline Suggestions
    inlineSuggestionsContainer: {
        position: 'absolute',
        bottom: 80, // Above toolbar
        left: 20,
        right: 20,
        backgroundColor: '#1A1A1A',
        borderRadius: 12,
        maxHeight: 200,
        borderWidth: 1,
        borderColor: '#333',
        zIndex: 100, // On top
        overflow: 'hidden',
    },
    suggestionsHeader: {
        fontSize: 12,
        color: Colors.dark.textSecondary,
        padding: 10,
        backgroundColor: '#222',
        fontWeight: 'bold'
    },
    suggestionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    suggestionAvatar: {
        width: 30,
        height: 30,
        borderRadius: 15,
        marginRight: 10,
        backgroundColor: '#444'
    },
    suggestionName: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14
    },
    suggestionHandle: {
        color: Colors.dark.primary,
        fontSize: 12
    },
    noResultsText: {
        color: Colors.dark.textSecondary,
        textAlign: 'center',
        padding: 20,
        fontSize: 12
    }
});
