-- Add aspect_ratio to posts table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'aspect_ratio') THEN
        ALTER TABLE public.posts ADD COLUMN aspect_ratio float DEFAULT 0.8;
    END IF;
END $$;
