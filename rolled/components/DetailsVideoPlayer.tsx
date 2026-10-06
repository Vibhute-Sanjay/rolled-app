import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Image, ActivityIndicator, Platform } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEvent } from 'expo';
import { useVideoStateStore } from '../stores/videoStateStore';

interface DetailsVideoPlayerProps {
    source: string;
    postId?: string;
}

export const DetailsVideoPlayer = ({ source, postId }: DetailsVideoPlayerProps) => {
    const { getSavedTime, setSavedTime } = useVideoStateStore();
    const timeRef = useRef(0);
    const [hasStarted, setHasStarted] = useState(false);

    let thumbnailUrl = source;
    if (source.includes('manifest/video.m3u8')) {
        thumbnailUrl = source.replace('manifest/video.m3u8', 'thumbnails/thumbnail.jpg');
    } else if (source.includes('playlist.m3u8')) {
        thumbnailUrl = source.replace('playlist.m3u8', 'thumbnail.jpg');
    }

    const player = useVideoPlayer(source, player => {
        player.loop = true;
        // In details view, users usually expect the video to play with sound
        player.muted = false; 
        
        if (postId) {
            const savedTime = getSavedTime(postId);
            if (savedTime > 0) {
                player.currentTime = savedTime;
            }
        }

        player.play(); 
    });

    const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
    const { status } = useEvent(player, 'statusChange', { status: player.status });

    useEffect(() => {
        if (isPlaying && !hasStarted) {
            setHasStarted(true);
        }
    }, [isPlaying]);

    useEffect(() => {
        // Silently poll the time 4 times a second. 
        // This avoids triggering React re-renders and is totally safe from native crashes.
        const interval = setInterval(() => {
            try {
                if (player && player.currentTime !== undefined) {
                    timeRef.current = player.currentTime;
                }
            } catch (e) {
                // Ignore errors if player is destroyed early
            }
        }, 250);

        return () => {
            clearInterval(interval);
            if (postId) {
                setSavedTime(postId, timeRef.current);
            }
        };
    }, [player, postId]);

    return (
        <View style={styles.container}>
            <VideoView 
                style={styles.video} 
                player={player} 
                allowsFullscreen={true} 
                allowsPictureInPicture={false} 
                nativeControls={true} 
                contentFit="contain" // Ensures the whole video fits on screen without cropping
            />
            {/* Thumbnail Overlay to hide black flash */}
            {(!hasStarted || status !== 'readyToPlay') && !isPlaying && (
                <Image 
                    source={{ uri: thumbnailUrl }} 
                    style={styles.thumbnail} 
                    resizeMode="contain" 
                />
            )}
            
            {/* Loading Spinner for iOS */}
            {Platform.OS === 'ios' && status === 'loading' && (
                <View style={styles.spinnerOverlay}>
                    <ActivityIndicator size="large" color="#ffffff" />
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        height: '100%',
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
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
    spinnerOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
    }
});
