import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, Text, ActivityIndicator, Platform } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { useEvent } from 'expo';
import { useIsFocused } from '@react-navigation/native';
import { useVideoStateStore } from '../stores/videoStateStore';

interface FeedVideoPlayerProps {
    source: string;
    aspectRatio?: number;
    onPress?: (currentTime?: number) => void;
    isVisible?: boolean;
    postId?: string;
}

export const FeedVideoPlayer = ({ source, aspectRatio = 0.8, onPress, isVisible = false, postId = '' }: FeedVideoPlayerProps) => {
    const [hasStarted, setHasStarted] = useState(false);
    const [isMuted, setIsMuted] = useState(true);
    const [showReplay, setShowReplay] = useState(false);
    
    const isFocused = useIsFocused();
    const { getSavedTime, setSavedTime } = useVideoStateStore();
    
    let thumbnailUrl = source;
    if (source.includes('manifest/video.m3u8')) {
        thumbnailUrl = source.replace('manifest/video.m3u8', 'thumbnails/thumbnail.jpg');
    } else if (source.includes('playlist.m3u8')) {
        thumbnailUrl = source.replace('playlist.m3u8', 'thumbnail.jpg');
    }

    const player = useVideoPlayer(source, player => {
        player.loop = false; // Stop looping to show replay banner
        player.muted = true;
        
        // Sync time if coming back from details
        if (postId) {
            const savedTime = getSavedTime(postId);
            if (savedTime > 0) {
                player.currentTime = savedTime;
            }
        }
    });

    const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
    const { status } = useEvent(player, 'statusChange', { status: player.status });

    // Handle Play/Pause based on Visibility and App Focus
    useEffect(() => {
        if (isVisible && isFocused) {
            // When regaining focus, check if the Details screen saved a new time
            if (postId) {
                const savedTime = getSavedTime(postId);
                try {
                    // Sync time if there's a significant difference (we just came back from details)
                    if (Math.abs(player.currentTime - savedTime) > 0.5) {
                        player.currentTime = savedTime;
                    }
                    
                    // If the newly synced time is at the end, show Replay, else hide it and play
                    if (player.duration > 0 && Math.abs(player.duration - savedTime) < 0.5) {
                        setShowReplay(true);
                        player.pause();
                    } else {
                        setShowReplay(false);
                        player.play();
                    }
                } catch (e) {
                    setShowReplay(false);
                    player.play();
                }
            } else {
                setShowReplay(false);
                player.play();
            }
        } else {
            player.pause();
        }
    }, [isVisible, isFocused]);

    // Handle "Has Started" to hide thumbnail smoothly
    useEffect(() => {
        if (isPlaying && !hasStarted) {
            setHasStarted(true);
        }
    }, [isPlaying]);

    // Detect Video End
    useEffect(() => {
        // If it was playing, then stopped, and we are near the end of the duration
        if (!isPlaying && hasStarted && isVisible && isFocused) {
            try {
                if (player.duration > 0 && Math.abs(player.duration - player.currentTime) < 0.5) {
                    setShowReplay(true);
                }
            } catch (e) {
                console.log("Error reading player properties:", e);
            }
        }
    }, [isPlaying]);

    // Save time on unmount or before navigating
    const handlePress = () => {
        if (showReplay) {
            // Reset time for Replay so Details starts from 0
            if (postId) setSavedTime(postId, 0);
            onPress?.(0); 
        } else {
            if (postId) {
                try {
                    setSavedTime(postId, player.currentTime);
                } catch(e) {}
            }
            try {
                onPress?.(player.currentTime);
            } catch(e) {
                onPress?.(0);
            }
        }
    };

    const toggleMute = () => {
        const nextMuted = !isMuted;
        player.muted = nextMuted;
        setIsMuted(nextMuted);
    };

    return (
        <View style={[styles.container, { aspectRatio }]}>
            <VideoView 
                style={styles.video} 
                player={player} 
                allowsFullscreen={false} 
                allowsPictureInPicture={false} 
                nativeControls={false} 
                contentFit="cover"
            />
            
            {/* Thumbnail Overlay */}
            {(!hasStarted || status !== 'readyToPlay') && !isPlaying && (
                <Image 
                    source={{ uri: thumbnailUrl }} 
                    style={styles.thumbnail} 
                    resizeMode="cover" 
                />
            )}
            
            {/* Loading Spinner for iOS */}
            {Platform.OS === 'ios' && status === 'loading' && (
                <View style={styles.spinnerOverlay}>
                    <ActivityIndicator size="large" color="#ffffff" />
                </View>
            )}
            
            {/* Replay Banner */}
            {showReplay && (
                <View style={styles.replayOverlay}>
                    <TouchableOpacity 
                        style={styles.replayButton}
                        activeOpacity={0.8}
                        onPress={handlePress}
                    >
                        <Ionicons name="refresh" size={24} color="white" />
                        <Text style={styles.replayText}>Replay</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Full-area Tap to Navigate */}
            {!showReplay && (
                <TouchableOpacity 
                    style={styles.overlay} 
                    activeOpacity={1} 
                    onPress={handlePress}
                />
            )}

            {/* Mute Button (Top Right) */}
            <TouchableOpacity style={styles.muteButton} onPress={toggleMute}>
                <Ionicons 
                    name={isMuted ? "volume-mute" : "volume-high"} 
                    size={16} 
                    color="white" 
                />
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        height: '100%',
        position: 'relative',
        backgroundColor: '#000',
    },
    video: {
        width: '100%',
        height: '100%',
    },
    thumbnail: {
        ...StyleSheet.absoluteFillObject,
        width: '100%',
        height: '100%',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
    spinnerOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
    },
    playIconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    replayOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 5,
    },
    replayButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 24,
        gap: 8,
    },
    replayText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    muteButton: {
        position: 'absolute',
        top: 12,
        right: 12,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    }
});
