import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export function useUnreadMessages() {
    const { user } = useAuth();
    const [hasUnreadMessages, setHasUnreadMessages] = useState(false);

    useEffect(() => {
        if (!user) return;

        // Initial fetch
        fetchUnreadMessageCount();

        // Subscribe to changes
        const subscription = supabase
            .channel(`notifications:messages:${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${user.id}`
                },
                (payload) => {
                    // Refetch on specific changes (optimization: check if payload is message type?)
                    // For safety/simplicity, just refetch.
                    fetchUnreadMessageCount();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, [user]);

    const fetchUnreadMessageCount = async () => {
        if (!user) return;
        try {
            const { count, error } = await supabase
                .from('notifications')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id)
                .eq('is_read', false)
                .eq('type', 'message'); // ONLY Chat Messages

            if (!error && count !== null) {
                setHasUnreadMessages(count > 0);
            } else if (error) {
                console.error('🔔 Error Fetching Message Count:', error);
            }
        } catch (err) {
            console.error('Error fetching unread message count:', err);
        }
    };

    return { hasUnreadMessages };
}
