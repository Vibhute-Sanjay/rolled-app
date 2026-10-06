import { useInteractionStore } from '../store/interactionStore';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { PostProps } from '../components/PostCard';

export const usePostInteraction = (post: PostProps) => {
    const { user } = useAuth();
    const { interactions, updateInteraction } = useInteractionStore();

    // Get current state from store, falling back to initial props
    const storeState = interactions[post.id];

    const hasLiked = storeState?.has_liked ?? post.has_liked;
    const hasSaved = storeState?.has_saved ?? post.has_saved;
    const likesCount = storeState?.likes_count ?? post.likes_count;

    const toggleLike = async () => {
        if (!user) return;

        const newLiked = !hasLiked;
        const newCount = newLiked ? likesCount + 1 : likesCount - 1;

        // Optimistic Update
        updateInteraction(post.id, {
            has_liked: newLiked,
            likes_count: newCount
        });

        try {
            if (newLiked) {
                const { error } = await supabase.from('likes').insert({ post_id: post.id, user_id: user.id });
                if (error) throw error;
            } else {
                const { error } = await supabase.from('likes').delete().eq('post_id', post.id).eq('user_id', user.id);
                if (error) throw error;
            }
        } catch (error) {
            console.error("Like failed, reverting:", error);
            // Revert
            updateInteraction(post.id, {
                has_liked: !newLiked,
                likes_count: likesCount // revert to old count
            });
        }
    };

    const toggleSave = async () => {
        if (!user) return;

        const newSaved = !hasSaved;

        // Optimistic Update
        updateInteraction(post.id, {
            has_saved: newSaved
        });

        try {
            if (newSaved) {
                const { error } = await supabase.from('saved_posts').insert({ post_id: post.id, user_id: user.id });
                if (error) throw error;
            } else {
                const { error } = await supabase.from('saved_posts').delete().eq('post_id', post.id).eq('user_id', user.id);
                if (error) throw error;
            }
        } catch (error) {
            console.error("Save failed, reverting:", error);
            // Revert
            updateInteraction(post.id, {
                has_saved: !newSaved
            });
        }
    };

    return {
        hasLiked,
        hasSaved,
        likesCount,
        toggleLike,
        toggleSave
    };
};
