import { create } from 'zustand';

interface CreatePostState {
    media: string[];
    videoUri: string | null;
    videoDuration: number | null;
    aspectRatio: number;
    addMedia: (uri: string) => void;
    setMedia: (uris: string[]) => void;
    setVideo: (uri: string | null, duration?: number | null) => void;
    setAspectRatio: (ratio: number) => void;
    updateMedia: (index: number, uri: string) => void;
    removeMedia: (index: number) => void;
    clearMedia: () => void;
    croppedCoverImage: string | null;
    setCroppedCoverImage: (uri: string | null) => void;
}

export const useCreatePostStore = create<CreatePostState>((set) => ({
    media: [],
    videoUri: null,
    videoDuration: null,
    aspectRatio: 0.8, // Default to 4:5
    croppedCoverImage: null,
    addMedia: (uri) => set((state) => ({ media: [...state.media, uri], videoUri: null, videoDuration: null })),
    setMedia: (uris) => set({ media: uris, videoUri: null, videoDuration: null }),
    setVideo: (uri, duration) => set({ videoUri: uri, videoDuration: duration || null, media: [] }),
    setAspectRatio: (ratio) => set({ aspectRatio: ratio }),
    updateMedia: (index, uri) => set((state) => {
        const newMedia = [...state.media];
        if (index >= 0 && index < newMedia.length) {
            newMedia[index] = uri;
        }
        return { media: newMedia };
    }),
    removeMedia: (index) => set((state) => ({ media: state.media.filter((_, i) => i !== index) })),
    clearMedia: () => set({ media: [], videoUri: null, videoDuration: null, aspectRatio: 0.8, croppedCoverImage: null }),
    setCroppedCoverImage: (uri) => set({ croppedCoverImage: uri }),
}));
