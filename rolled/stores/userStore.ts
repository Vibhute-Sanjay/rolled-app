import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface UserProfile {
    id: string;
    username: string;
    full_name: string;
    avatar_url: string | null;
    bg_image_url: string | null;
    bio: string | null;
    major: string | null;
    year: string | null;
    karma: number;
    is_verified?: boolean;
    is_admin?: boolean;
    is_og?: boolean;
}

interface UserStats {
    followers: number;
    following: number;
}

interface UserState {
    profile: UserProfile | null;
    stats: UserStats;
    setProfile: (profile: UserProfile) => void;
    setStats: (stats: UserStats) => void;

    // [NEW]
    followingIds: string[];
    setFollowingList: (ids: string[]) => void;
    toggleFollowing: (id: string) => void;

    clearUser: () => void;
    hasHydrated: boolean;
    setHasHydrated: (state: boolean) => void;
}

export const useUserStore = create<UserState>()(
    persist(
        (set) => ({
            profile: null,
            profile: null,
            stats: { followers: 0, following: 0 },
            followingIds: [], // [NEW]
            hasHydrated: false,
            hasNextPage: false,
            // [NEW] Global Following List
            followingIds: [],
            setProfile: (profile) => set({ profile }),
            setStats: (stats) => set({ stats }),
            clearUser: () => set({ profile: null, stats: { followers: 0, following: 0 }, followingIds: [] }),
            setHasHydrated: (state) => set({ hasHydrated: state }),

            setFollowingList: (ids) => set({ followingIds: ids }),
            toggleFollowing: (id) => set((state) => {
                const isFollowing = state.followingIds.includes(id);
                return {
                    followingIds: isFollowing
                        ? state.followingIds.filter(fid => fid !== id)
                        : [...state.followingIds, id]
                };
            }),
        }),
        {
            name: 'user-profile-storage',
            storage: createJSONStorage(() => AsyncStorage),
            onRehydrateStorage: () => (state) => {
                state?.setHasHydrated(true);
            },
        }
    )
);
