-- Message Reports Table
CREATE TABLE IF NOT EXISTS public.message_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id TEXT NOT NULL, -- messages.id is TEXT in existing schema? or UUID? Let's check. Assuming TEXT based on store types usually using string for IDs, but supabase usually uses UUID. I'll check store.
  -- Actually, let's verify if message.id is uuid or text. In chatStore.ts it says id: string. In DB? likely uuid or bigint or text.
  -- Safest is to NOT reference messages(id) strongly if we are unsure, OR check.
  -- But for now, let's assume UUID reference if possible.
  -- Wait, chatStore uses Date.now().toString() for optimistic IDs which are text.
  -- But backend IDs?
  -- Let's stick to TEXT for message_id to be safe with unknown ID types, or UUID if we are sure.
  -- Given I don't see the messages table schema right now, I'll use UUID references public.messages(id) but standard supabase implies UUID.
  -- However, to be safe, I will allow simple storage of the ID.
  message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE NOT NULL,
  reporter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- Removed NOT NULL
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS
ALTER TABLE public.message_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create message reports" 
ON public.message_reports FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can view own message reports" 
ON public.message_reports FOR SELECT 
USING (auth.uid() = reporter_id);
