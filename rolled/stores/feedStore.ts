import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PostProps } from '../components/PostCard';

interface FeedState {
    posts: PostProps[];
    hasHydrated: boolean;
    setPosts: (posts: PostProps[]) => void;
    addPosts: (newPosts: PostProps[]) => void;
    setHasHydrated: (state: boolean) => void;
    clearFeed: () => void;
}

export const useFeedStore = create<FeedState>()(
    persist(
        (set) => ({
            posts: [],
            hasHydrated: false,
            setPosts: (posts) => set({ posts }),
            addPosts: (newPosts) => set((state) => ({
                posts: [...state.posts, ...newPosts]
            })),
            setHasHydrated: (state) => set({ hasHydrated: state }),
            clearFeed: () => set({ posts: [] }),
        }),
        {
            name: 'feed-storage',
            storage: createJSONStorage(() => AsyncStorage),
            onRehydrateStorage: () => (state) => {
                state?.setHasHydrated(true);
            },
            partialize: (state) => ({ posts: state.posts.slice(0, 20) }), // Only store top 20 posts
        }
    )
);
