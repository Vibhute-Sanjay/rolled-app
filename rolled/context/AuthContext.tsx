
import { Session, User } from '@supabase/supabase-js';
import { useRouter, useSegments } from 'expo-router';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type AuthContextType = {
    session: Session | null;
    user: User | null;
    isLoading: boolean;
    signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
    session: null,
    user: null,
    isLoading: true,
    signOut: async () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();
    const segments = useSegments() as string[];

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            setIsLoading(false);
        });

        const { data } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            setIsLoading(false);
        });

        return () => {
            data.subscription.unsubscribe();
        };
    }, []);

    const signOut = async () => {
        // 1. Clear Global State (ALL Stores)
        try {
            const { useUserStore } = require('../stores/userStore');
            const { useChatStore } = require('../stores/chatStore');
            const { useFeedStore } = require('../stores/feedStore');
            const { useCreatePostStore } = require('../stores/createPostStore');

            useUserStore.getState().clearUser();
            useChatStore.getState().clearChat();
            useFeedStore.getState().clearFeed();
            useCreatePostStore.getState().clearMedia();
        } catch (e) {
            console.error("Error clearing stores:", e);
        }

        // 2. Sign Out
        await supabase.auth.signOut();
        router.replace('/(auth)/welcome');
    };

    // Protected Routes Logic with Onboarding Gate
    useEffect(() => {
        if (isLoading) return;

        const inAuthGroup = segments[0] === '(auth)';
        const inTabsGroup = segments[0] === '(tabs)';
        const inSignupFlow = segments[1] === 'signup';
        const inProfileSetup = segments[2] === 'profile' || segments[1] === 'welcome-splash';

        // If user is NOT logged in and trying to access tabs
        if (!session && inTabsGroup) {
            router.replace('/(auth)/welcome');
            return;
        }

        // If user IS logged in, check onboarding status
        if (session) {
            // Allow users in signup flow to continue without interruption
            if (inSignupFlow || inProfileSetup) {
                return;
            }

            // Check if user has completed onboarding
            const checkOnboarding = async () => {
                try {
                    const { data: profile, error } = await supabase
                        .from('profiles')
                        .select('is_onboarded')
                        .eq('id', session.user.id)
                        .single();

                    if (error) {
                        console.error('Error checking onboarding:', error);
                        return;
                    }

                    // If profile doesn't exist or is_onboarded is false, redirect to profile setup
                    if (!profile || !profile.is_onboarded) {
                        router.replace('/(auth)/signup/profile' as any);
                        return;
                    }

                    // If onboarded and on welcome/login page, go to feed
                    const isWelcomeOrLogin = segments[1] === 'welcome' || segments[1] === 'login' || segments[1] === undefined;
                    if (isWelcomeOrLogin && inAuthGroup) {
                        router.replace('/(tabs)/feed' as any);
                    }
                } catch (e) {
                    console.error('Onboarding check failed:', e);
                }
            };

            checkOnboarding();
        }
    }, [session, segments, isLoading]);

    return (
        <AuthContext.Provider value={{ session, user, isLoading, signOut }}>
            {children}
        </AuthContext.Provider>
    );
};
