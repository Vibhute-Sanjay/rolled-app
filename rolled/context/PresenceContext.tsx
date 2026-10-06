import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { AppState, AppStateStatus } from 'react-native';

interface PresenceContextType {
    onlineUsers: Set<string>;
}

const PresenceContext = createContext<PresenceContextType>({ onlineUsers: new Set() });

export const usePresence = () => useContext(PresenceContext);

export const PresenceProvider = ({ children }: { children: React.ReactNode }) => {
    const { user } = useAuth();
    const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
    const channelRef = useRef<any>(null);



    useEffect(() => {
        if (!user) return;

        // Function to update last_seen in DB
        const updateLastSeen = async () => {
            try {
                await supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', user.id);
            } catch (error) {
                console.error('Error updating last_seen:', error);
            }
        };

        // 1. Update on mount (Initial Online)
        updateLastSeen();

        // 2. Update periodically (Heartbeat - every 5 mins)
        const heartbeat = setInterval(updateLastSeen, 5 * 60 * 1000);

        // 3. Update on App State Change (Background/Foreground)
        const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
            if (nextAppState === 'active') {
                updateLastSeen();
            } else if (nextAppState === 'background') {
                updateLastSeen();
            }
        });

        // Join global presence channel
        const channel = supabase.channel('global_presence', {
            config: {
                presence: {
                    key: user.id,
                },
            },
        });

        channel
            .on('presence', { event: 'sync' }, () => {
                const newState = channel.presenceState();
                const users = new Set(Object.keys(newState));
                setOnlineUsers(users);
            })
            .on('presence', { event: 'join' }, ({ key, newPresences }) => {
                setOnlineUsers((prev) => {
                    const next = new Set(prev);
                    next.add(key);
                    return next;
                });
            })
            .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
                setOnlineUsers((prev) => {
                    const next = new Set(prev);
                    next.delete(key);
                    return next;
                });
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel.track({ online_at: new Date().toISOString() });
                }
            });

        channelRef.current = channel;

        return () => {
            clearInterval(heartbeat);
            subscription.remove();
            supabase.removeChannel(channel);
            // Optional: update last_seen on unmount one last time?
            // updateLastSeen(); 
        };
    }, [user]);

    return (
        <PresenceContext.Provider value={{ onlineUsers }}>
            {children}
        </PresenceContext.Provider>
    );
};
