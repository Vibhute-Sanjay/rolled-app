-- Enable realtime for anon_posts table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'anon_posts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.anon_posts;
  END IF;
END $$;
