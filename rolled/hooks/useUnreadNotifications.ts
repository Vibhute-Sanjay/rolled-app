import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export function useUnreadNotifications() {
    const { user } = useAuth();
    const [hasUnread, setHasUnread] = useState(false);

    useEffect(() => {
        if (!user) return;

        // Initial fetch
        fetchUnreadCount();

        // Subscribe to changes
        const subscription = supabase
            .channel(`notifications:unread:${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${user.id}`
                },
                (payload) => {
                    // Refetch on any change (insert new, or update read status)
                    fetchUnreadCount();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, [user]);

    const fetchUnreadCount = async () => {
        if (!user) return;
        try {
            const { count, error } = await supabase
                .from('notifications')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id)
                .eq('is_read', false)
                .neq('type', 'message'); // Exclude Chat Messages (Handled by separate hook)

            if (!error && count !== null) {
                setHasUnread(count > 0);
            } else if (error) {
                console.error('🔔 Error Fetching Count:', error);
            }
        } catch (err) {
            console.error('Error fetching unread count:', err);
        }
    };

    return { hasUnread };
}
