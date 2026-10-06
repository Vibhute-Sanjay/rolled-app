import { create } from 'zustand';

interface InteractionData {
    has_liked?: boolean;
    likes_count?: number;
    has_saved?: boolean;
    comments_count?: number;
}

interface InteractionState {
    interactions: Record<string, InteractionData>;
    setInteraction: (postId: string, update: InteractionData) => void;
    updateInteraction: (postId: string, update: Partial<InteractionData>) => void;
}

export const useInteractionStore = create<InteractionState>((set) => ({
    interactions: {},
    setInteraction: (postId, update) =>
        set((state) => ({
            interactions: {
                ...state.interactions,
                [postId]: update,
            },
        })),
    updateInteraction: (postId, update) =>
        set((state) => ({
            interactions: {
                ...state.interactions,
                [postId]: {
                    ...state.interactions[postId],
                    ...update,
                },
            },
        })),
}));
