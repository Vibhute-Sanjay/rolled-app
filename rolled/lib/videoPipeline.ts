import { supabase } from './supabase';
import { useUploadStore } from '../stores/uploadStore';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { DeviceEventEmitter } from 'react-native';

interface PostData {
    user_id: string;
    content: string;
    location: string | null;
    tagged_users: string[];
    audience: string;
    aspect_ratio: string;
}

import * as ImageManipulator from 'expo-image-manipulator';

export const startVideoUploadPipeline = async (localUri: string, durationMillis: number, postData: PostData) => {
    const store = useUploadStore.getState();
    store.setStatus('processing');
    store.setProgress(0);

    try {
        // 1. Extract 4 frames evenly spaced
        const frames: string[] = [];
        const interval = Math.floor(durationMillis / 5);
        
        for (let i = 1; i <= 4; i++) {
            const time = i * interval;
            try {
                // Get raw high-res thumbnail
                const { uri } = await VideoThumbnails.getThumbnailAsync(localUri, {
                    time,
                    quality: 0.5,
                });
                
                // CRITICAL: Downscale to 300px width to avoid 413 Payload Too Large on Edge Functions
                // and grab the base64 string natively, which is much faster than JS blobs.
                const manipResult = await ImageManipulator.manipulateAsync(
                    uri,
                    [{ resize: { width: 300 } }],
                    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
                );
                
                if (manipResult.base64) {
                    frames.push(manipResult.base64);
                }
            } catch (e) {
                console.warn(`Failed to extract or manipulate frame at ${time}ms`, e);
            }
        }

        if (frames.length === 0) {
            throw new Error("Could not extract frames for moderation.");
        }

        // 2. Concurrent Verification & Provisioning
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;
        if (!token) throw new Error("Not authenticated");

        // We use fetch directly to our Edge Functions to capture exact error messages
        const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;

        const modReq = fetch(`${supabaseUrl}/functions/v1/moderate-video`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ frames })
        });

        const cfReq = fetch(`${supabaseUrl}/functions/v1/get-cloudflare-upload-url`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        });

        const [modRes, cfRes] = await Promise.all([modReq, cfReq]);

        if (!modRes.ok) {
            const errText = await modRes.text();
            throw new Error(`Moderate Error HTTP ${modRes.status}: ${errText}`);
        }
        if (!cfRes.ok) {
            const errText = await cfRes.text();
            throw new Error(`Cloudflare Error HTTP ${cfRes.status}: ${errText}`);
        }

        const modData = await modRes.json();
        const cfData = await cfRes.json();

        if (!modData.isSafe) {
            throw new Error(`Content moderation failed: ${modData.violations.join(', ')}`);
        }

        const { uploadURL, uid } = cfData;

        // 3. Upload to Cloudflare via XMLHttpRequest for progress tracking
        store.setStatus('uploading');
        
        const cloudflareUid = await new Promise<string>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            
            xhr.upload.addEventListener('progress', (event) => {
                if (event.lengthComputable) {
                    const total = event.total > 0 ? event.total : Math.max(event.loaded, 1);
                    const progress = Math.min(100, Math.round((event.loaded * 100) / total));
                    store.setProgress(progress);
                }
            });

            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve(uid);
                } else {
                    reject(new Error(`Upload failed with status ${xhr.status}`));
                }
            });

            xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
            xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));

            xhr.open('POST', uploadURL);
            // We need to append the file. For RN, passing FormData with { uri, type, name } works.
            const formData = new FormData();
            formData.append('file', {
                uri: localUri,
                type: 'video/mp4',
                name: 'video.mp4',
            } as any);

            xhr.send(formData);
        });

        store.setStatus('processing'); // Finalizing DB insert

        // 4. Construct Cloudflare HLS Streaming URL from the returned UID
        // We assume the user has configured their account ID in the .env or backend. 
        // For the client, we just need the customer subdomain, but actually Cloudflare provides standard URLs.
        // The standard delivery URL is: https://customer-<ID>.cloudflarestream.com/<uid>/manifest/video.m3u8
        // However, a simpler universal one is: https://videodelivery.net/<uid>/manifest/video.m3u8
        const streamUrl = `https://videodelivery.net/${cloudflareUid}/manifest/video.m3u8`;

        // 5. Insert to Database (Processing State)
        const dbPayload = {
            ...postData,
            media_urls: [streamUrl],
            media_type: 'video',
            status: 'processing',
            cloudflare_video_id: cloudflareUid
        };

        const { data: insertedData, error: dbError } = await supabase.from('posts').insert(dbPayload).select().single();

        if (dbError) throw dbError;

        // 6. Listen for Realtime Update
        // The Cloudflare webhook will change this post to 'published', triggering this listener instantly.
        const channel = supabase.channel(`public:posts:${insertedData.id}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'posts', filter: `id=eq.${insertedData.id}` }, async (payload) => {
                if (payload.new.status === 'published') {
                    supabase.removeChannel(channel);
                    
                    // Fetch full post with relations for feed injection
                    const { data: fullPost } = await supabase.from('posts').select(`
                        *,
                        profile:profiles!posts_user_id_fkey(username, full_name, avatar_url, is_verified, is_admin, is_og),
                        likes_count:likes(count),
                        comments_count:comments(count)
                    `).eq('id', insertedData.id).single();

                    if (fullPost) {
                        const flattenedPost = {
                            ...fullPost,
                            likes_count: fullPost.likes_count?.[0]?.count || 0,
                            comments_count: fullPost.comments_count?.[0]?.count || 0,
                            has_liked: false,
                            has_saved: false
                        };

                        store.setSuccess(flattenedPost);
                        DeviceEventEmitter.emit('new_post_created', flattenedPost);
                    }
                }
            })
            .subscribe();

        // Note: We deliberately do NOT call store.setSuccess here. 
        // The store stays in 'processing' state until the webhook fires.

    } catch (error: any) {
        console.error("Upload pipeline error:", error);
        store.setError(error.message || "An unknown error occurred during upload.");
    }
};
