import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface UnrolledState {
    blockedIdentityIds: string[];
    isLoadingBlocks: boolean;

    fetchBlockedIdentities: () => Promise<void>;
    blockIdentity: (identityId: string) => Promise<void>;
    unblockIdentity: (identityId: string) => Promise<void>;
}

export const useUnrolledStore = create<UnrolledState>()(
    persist(
        (set, get) => ({
            blockedIdentityIds: [],
            isLoadingBlocks: false,

            fetchBlockedIdentities: async () => {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                set({ isLoadingBlocks: true });
                try {
                    const { data, error } = await supabase
                        .from('unrolled_blocks')
                        .select('blocked_identity_id')
                        .eq('blocker_id', user.id);

                    if (error) throw error;

                    const blockedIds = data.map(b => b.blocked_identity_id);
                    set({ blockedIdentityIds: blockedIds });
                } catch (error) {
                    console.error('Error fetching unrolled blocked identities:', error);
                } finally {
                    set({ isLoadingBlocks: false });
                }
            },

            blockIdentity: async (identityId: string) => {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                // Optimistic update
                set((state) => ({
                    blockedIdentityIds: [...new Set([...state.blockedIdentityIds, identityId])]
                }));

                try {
                    const { error } = await supabase
                        .from('unrolled_blocks')
                        .insert({
                            blocker_id: user.id,
                            blocked_identity_id: identityId
                        });

                    if (error && error.code !== '23505') { // Ignore unique violation
                        throw error;
                    }
                } catch (error) {
                    console.error('Error blocking anon identity:', error);
                    // Revert on failure
                    get().fetchBlockedIdentities();
                }
            },

            unblockIdentity: async (identityId: string) => {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                // Optimistic update
                set((state) => ({
                    blockedIdentityIds: state.blockedIdentityIds.filter(id => id !== identityId)
                }));

                try {
                    const { error } = await supabase
                        .from('unrolled_blocks')
                        .delete()
                        .match({
                            blocker_id: user.id,
                            blocked_identity_id: identityId
                        });

                    if (error) throw error;
                } catch (error) {
                    console.error('Error unblocking anon identity:', error);
                    // Revert on failure
                    get().fetchBlockedIdentities();
                }
            }
        }),
        {
            name: 'unrolled-storage',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
