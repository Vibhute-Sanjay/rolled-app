import { create } from 'zustand';

export type UploadStatus = 'idle' | 'processing' | 'uploading' | 'success' | 'error';

interface UploadState {
    status: UploadStatus;
    progress: number; // 0 to 100
    errorMessage: string | null;
    uploadedPostData: any | null; // Data to show on success (e.g. the db record)

    // Actions
    setStatus: (status: UploadStatus) => void;
    setProgress: (progress: number) => void;
    setError: (message: string) => void;
    setSuccess: (postData: any) => void;
    reset: () => void;
}

export const useUploadStore = create<UploadState>((set) => ({
    status: 'idle',
    progress: 0,
    errorMessage: null,
    uploadedPostData: null,

    setStatus: (status) => set({ status, errorMessage: null }),
    setProgress: (progress) => set({ progress }),
    setError: (errorMessage) => set({ status: 'error', errorMessage, progress: 0 }),
    setSuccess: (uploadedPostData) => set({ status: 'success', uploadedPostData, progress: 100 }),
    reset: () => set({ status: 'idle', progress: 0, errorMessage: null, uploadedPostData: null }),
}));
