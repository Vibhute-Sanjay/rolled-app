import { differenceInHours } from 'date-fns';

export interface ScorablePost {
    upvotes: number;
    downvotes: number;
    replies_count: number;
    created_at: string;
}

export const calculateFireScore = (post: ScorablePost): number => {
    // Ensure accurate parsing. Post dates are typically UTC.
    const postDate = new Date(post.created_at);
    const now = new Date();

    // Use Math.abs to handle any potential future-dated posts or timezone drifts safely for dev
    const hoursAgo = Math.abs(differenceInHours(now, postDate));

    // Formula: (Upvotes * 2) + (Replies * 3) - (Downvotes * 1) - (Hours * 3)
    const score = (post.upvotes * 2) + (post.replies_count * 3) - (post.downvotes * 1) - (hoursAgo * 3);

    // console.log(`[FireScore] ID: ${post.created_at} | Score: ${score} | Hours: ${hoursAgo} | Active: ${score > 50}`); // Debug

    return Math.max(0, score); // Floor at 0 
};

export const isPostFire = (post: ScorablePost, threshold: number = 50, hoursCutoff: number = 24): boolean => {
    const postDate = new Date(post.created_at);
    const now = new Date();
    const hoursAgo = differenceInHours(now, postDate);

    // If it's older than cutoff, never fire.
    if (hoursAgo > hoursCutoff) return false;

    const score = calculateFireScore(post);
    return score > threshold;
};
