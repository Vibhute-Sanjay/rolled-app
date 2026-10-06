import { create } from 'zustand';

interface VideoState {
    activeVideoId: string | null;
    isMuted: boolean;
    setActiveVideoId: (id: string | null) => void;
    toggleMute: () => void;
    handoffPlayer: any | null;
    handoffPostId: string | null;
    setHandoff: (player: any, postId: string) => void;
    clearHandoff: () => void;
}

export const useVideoStateStore = create<VideoState>((set) => ({
    activeVideoId: null,
    isMuted: true, // Default to muted for feeds
    setActiveVideoId: (id) => set({ activeVideoId: id }),
    toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
    handoffPlayer: null,
    handoffPostId: null,
    setHandoff: (player, postId) => set({ handoffPlayer: player, handoffPostId: postId }),
    clearHandoff: () => set({ handoffPlayer: null, handoffPostId: null }),
}));
