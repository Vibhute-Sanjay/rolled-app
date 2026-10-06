import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Pressable } from 'react-native';
import { Message } from '../../stores/chatStore';
import { Colors } from '../../constants/Colors';
import { format } from 'date-fns';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { FullScreenImageViewer } from '../FullScreenImageViewer';
import { useRouter } from 'expo-router';

type MessageBubbleProps = {
    message: Message;
    isMe: boolean;
    onLongPress?: () => void;
};

export const MessageBubble = ({ message, isMe, onLongPress }: MessageBubbleProps) => {
    const router = useRouter();
    const [viewerVisible, setViewerVisible] = useState(false);
    const [selectedImage, setSelectedImage] = useState('');

    const hasAttachment = message.attachments && message.attachments.length > 0;
    const attachmentUrl = hasAttachment ? message.attachments![0].url : null;

    // Check for Shared Content
    // @ts-ignore
    const sharedPost = message.post;
    // @ts-ignore
    const sharedActivity = message.activity;
    // @ts-ignore
    const sharedAnonPost = message.anon_post;

    const handleImagePress = () => {
        if (attachmentUrl) {
            setSelectedImage(attachmentUrl);
            setViewerVisible(true);
        }
    };

    const handleSharedContentPress = () => {
        if (sharedPost) {
            router.push(`/post/${sharedPost.id}`);
        } else if (sharedActivity) {
            router.push(`/activity/${sharedActivity.id}`);
        } else if (sharedAnonPost) {
            // Navigate to Unrolled Feed (Deep linking to specific anon post is tricky if it's not the main focus,
            // but we can route to feed or just show it here. For now, route to feed).
            // Ideal: router.push(`/unrolled/${sharedAnonPost.id}`); (Need to ensure this route exists or is modal)
            // For now, simple alert or feed:
            router.push('/(tabs)/unrolled' as any);
        }
    };

    return (
        <View style={[
            styles.container,
            isMe ? styles.containerMe : styles.containerOther
        ]}>
            <TouchableOpacity
                activeOpacity={0.9} // Less fade for bubble
                onLongPress={onLongPress}
                delayLongPress={300}
                style={[
                    styles.bubble,
                    isMe ? styles.bubbleMe : styles.bubbleOther
                ]}
            >
                {/* 1. Attachment Rendering */}
                {attachmentUrl && (
                    <Pressable onPress={handleImagePress}>
                        <Image
                            source={{ uri: attachmentUrl }}
                            style={styles.attachmentImage}
                        />
                    </Pressable>
                )}

                {/* 2. Shared Post Rendering */}
                {sharedPost && (
                    <TouchableOpacity style={styles.sharedContentContainer} onPress={handleSharedContentPress}>
                        {sharedPost.media_urls?.[0] ? (
                            <Image source={{ uri: sharedPost.media_urls[0] }} style={styles.sharedImage} />
                        ) : (
                            <View style={[styles.sharedImage, { backgroundColor: '#333', alignItems: 'center', justifyContent: 'center' }]}>
                                <MaterialCommunityIcons name="text-box-outline" size={24} color="#666" />
                            </View>
                        )}
                        <View style={styles.sharedTextContent}>
                            <Text style={styles.sharedTitle} numberOfLines={1}>
                                @{sharedPost.profile?.username || 'user'}
                            </Text>
                            <Text style={styles.sharedAccessory} numberOfLines={2}>
                                {sharedPost.content || "Shared a roll"}
                            </Text>
                        </View>
                    </TouchableOpacity>
                )}

                {/* 3. Shared Activity Rendering */}
                {sharedActivity && (
                    <TouchableOpacity style={styles.sharedContentContainer} onPress={handleSharedContentPress}>
                        <View style={[styles.sharedImage, { backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }]}>
                            <MaterialCommunityIcons name="calendar-star" size={24} color="#a855f7" />
                        </View>
                        <View style={styles.sharedTextContent}>
                            <Text style={styles.sharedTitle} numberOfLines={1}>
                                {sharedActivity.title}
                            </Text>
                            <Text style={styles.sharedAccessory} numberOfLines={1}>
                                Event Details
                            </Text>
                        </View>
                    </TouchableOpacity>
                )}

                {/* 4. Shared Anon Post Rendering */}
                {sharedAnonPost && (
                    <TouchableOpacity style={styles.sharedContentContainer} onPress={handleSharedContentPress}>
                        <View style={[styles.sharedImage, { backgroundColor: sharedAnonPost.identity?.avatar_color || '#333', alignItems: 'center', justifyContent: 'center' }]}>
                            <MaterialCommunityIcons name="incognito" size={28} color="#FFF" />
                        </View>
                        <View style={styles.sharedTextContent}>
                            <Text style={styles.sharedTitle} numberOfLines={1}>
                                {sharedAnonPost.identity?.anon_name || 'Anonymous'}
                            </Text>
                            <Text style={[styles.sharedAccessory, { fontStyle: 'italic' }]} numberOfLines={2}>
                                {sharedAnonPost.content}
                            </Text>
                        </View>
                    </TouchableOpacity>
                )}

                {/* 5. Text Content */}
                {/* Only show text if it's NOT just the default placeholder text for sharing, OR if user added custom text (not supported in share modal yet but nice to have logic) */}
                {(message.content !== '📷 Image' && !sharedPost && !sharedActivity && !sharedAnonPost) && (

                    <Text style={[
                        styles.text,
                        isMe ? styles.textMe : styles.textOther,
                        hasAttachment && styles.textWithAttachment
                    ]}>
                        {message.content}
                    </Text>
                )}

                {/* Metadata Row: Time + Eye Icon */}
                <View style={styles.metadataRow}>
                    <Text style={[
                        styles.time,
                        isMe ? styles.timeMe : styles.timeOther
                    ]}>
                        {format(new Date(message.created_at), 'h:mm a')}
                    </Text>

                    {/* Eye Icon for Read Receipt (Only for Me) */}
                    {isMe && (
                        <Ionicons
                            name={message.is_read ? "eye" : "eye-off"}
                            size={12}
                            color={message.is_read ? "rgba(0,0,0,0.8)" : "rgba(0,0,0,0.4)"}
                            style={{ marginLeft: 4 }}
                        />
                    )}
                </View>
            </TouchableOpacity>

            <FullScreenImageViewer
                visible={viewerVisible}
                imageUrl={selectedImage}
                onClose={() => setViewerVisible(false)}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 10,
        maxWidth: '80%',
    },
    containerMe: {
        alignSelf: 'flex-end',
        alignItems: 'flex-end',
    },
    containerOther: {
        alignSelf: 'flex-start',
        alignItems: 'flex-start',
    },
    bubble: {
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 10,
        minWidth: 80, // Ensure space for metadata
    },
    bubbleMe: {
        backgroundColor: Colors.dark.primary, // Cyan/Neon Blue
        borderBottomRightRadius: 4,
    },
    bubbleOther: {
        backgroundColor: '#1F1F1F', // Dark Gray/Black
        borderBottomLeftRadius: 4,
    },
    text: {
        fontSize: 16,
    },
    textMe: {
        color: '#000', // Black text on Cyan for contrast
    },
    textOther: {
        color: '#FFFFFF', // White text on Dark Gray
    },
    textWithAttachment: {
        marginTop: 8,
    },
    attachmentImage: {
        width: 200,
        height: 150,
        borderRadius: 12,
        backgroundColor: '#000',
    },
    metadataRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        marginTop: 4,
    },
    time: {
        fontSize: 10,
    },
    timeMe: {
        color: 'rgba(0, 0, 0, 0.6)',
    },
    timeOther: {
        color: 'rgba(255, 255, 255, 0.5)',
    },

    // Shared Content Styles
    sharedContentContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(0,0,0,0.1)',
        borderRadius: 8,
        overflow: 'hidden',
        width: 200,
        marginBottom: 4
    },
    sharedImage: {
        width: 60,
        height: 60,
        backgroundColor: '#333'
    },
    sharedTextContent: {
        flex: 1,
        padding: 8,
        justifyContent: 'center'
    },
    sharedTitle: {
        fontWeight: 'bold',
        fontSize: 13,
        color: '#FFF', // Always white/dark appropriate
        marginBottom: 2
    },
    sharedAccessory: {
        fontSize: 11,
        color: '#DDD'
    }
});
