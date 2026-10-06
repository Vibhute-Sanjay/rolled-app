import { supabase } from './supabase';
import { Alert } from 'react-native';
import * as tus from 'tus-js-client';

/**
 * Uploads a raw video file from the device to Bunny.net Stream using Direct TUS Upload.
 * 
 * Flow:
 * 1. Call Supabase Edge Function to securely generate a Video ID and an Authorization Signature.
 * 2. Use `tus-js-client` to directly upload the file from the client to Bunny.net without passing through Supabase.
 * 3. Return the formatted HLS playlist URL (.m3u8) when the direct upload finishes.
 * 
 * @param uri Local file URI of the video
 * @param title Optional title for the video
 * @returns The Bunny.net HLS playlist URL, or null if failed.
 */
export const uploadVideoToBunny = async (
    uri: string, 
    title?: string, 
    onProgress?: (bytesUploaded: number, bytesTotal: number) => void
): Promise<string | null> => {
    try {
        // 1. Call Edge Function to generate the secure signature
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';

        const response = await fetch(`${supabaseUrl}/functions/v1/bunny-video-upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ title: title || 'Rolled Video Post' }),
        });

        if (!response.ok) {
            console.error('Edge Function Error:', await response.text());
            throw new Error('Upload initialization failed');
        }

        const data = await response.json();
        
        if (!data || !data.signature || !data.videoId) {
            throw new Error('Invalid signature response from edge function');
        }

        // 2. Perform Direct TUS Upload using the signature
        return new Promise((resolve, reject) => {
            // React Native format for tus-js-client
            const file = {
                uri,
                type: 'video/mp4', // Fallback type
                name: `${data.videoId}.mp4`
            } as any;

            const upload = new tus.Upload(file, {
                endpoint: "https://video.bunnycdn.com/tusupload",
                retryDelays: [0, 3000, 5000, 10000, 20000],
                headers: {
                    AuthorizationSignature: data.signature,
                    AuthorizationExpire: data.expirationTime.toString(),
                    VideoId: data.videoId,
                    LibraryId: data.libraryId.toString(),
                },
                metadata: {
                    filetype: "video/mp4",
                    title: title || "Video Post",
                },
                onError: (error) => {
                    console.error("TUS Upload Failed:", error);
                    reject(error);
                },
                onProgress: (bytesUploaded, bytesTotal) => {
                    if (onProgress) {
                        onProgress(bytesUploaded, bytesTotal);
                    }
                },
                onSuccess: () => {
                    console.log("TUS Upload Successful! Video ID:", data.videoId);
                    resolve(data.hlsUrl);
                }
            });

            upload.start();
        });

    } catch (error) {
        console.error('uploadVideoToBunny error:', error);
        Alert.alert('Upload Failed', 'Could not upload video. Please try again.');
        return null;
    }
};

