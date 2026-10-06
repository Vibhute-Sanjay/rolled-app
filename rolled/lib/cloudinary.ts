
import { Alert } from 'react-native';

const CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

export const uploadToCloudinary = async (imageUri: string, folder: string = 'rolled_uploads') => {
    if (!CLOUD_NAME || !UPLOAD_PRESET) {
        console.error('Cloudinary Env Vars missing');
        Alert.alert('Configuration Error', 'Cloudinary configuration is missing.');
        return null;
    }

    const data = new FormData();
    // @ts-ignore: React Native FormData Append allows 3 args for files, TS standard doesn't
    data.append('file', {
        uri: imageUri,
        type: 'image/jpeg', // Adjust based on actual file type if needed
        name: imageUri.split('/').pop() || 'upload.jpg',
    });
    data.append('upload_preset', UPLOAD_PRESET);
    data.append('folder', folder);

    try {
        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
            method: 'POST',
            body: data,
        });

        const result = await response.json();
        if (result.secure_url) {
            // Optimization: Inject f_auto,q_auto for fast delivery
            // Standard Cloudinary URL: https://res.cloudinary.com/<cloud>/image/upload/v1234/<id>
            // Optimized: https://res.cloudinary.com/<cloud>/image/upload/f_auto,q_auto/v1234/<id>
            const optimizedUrl = result.secure_url.replace('/upload/', '/upload/f_auto,q_auto/');
            return optimizedUrl;
        } else {
            console.error('Cloudinary Upload Error:', result);
            throw new Error(result.error?.message || 'Upload failed');
        }
    } catch (error) {
        console.error('Upload catch error:', error);
        Alert.alert('Upload Failed', 'Could not upload image. Please try again.');
        return null;
    }
};
