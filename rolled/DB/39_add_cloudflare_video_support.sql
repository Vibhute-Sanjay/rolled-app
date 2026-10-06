-- Add media_type to explicitly define the kind of media attached to a post
ALTER TABLE public.posts
ADD COLUMN IF NOT EXISTS media_type TEXT DEFAULT 'image';

-- Update existing posts to explicitly be 'image' type if they have media_urls
UPDATE public.posts 
SET media_type = 'image' 
WHERE media_urls IS NOT NULL AND array_length(media_urls, 1) > 0;
