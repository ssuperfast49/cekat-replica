-- Migration: Add chat attachments storage bucket and file_link column
-- This enables file attachments in LiveChat, ConversationPage, and ChatPreview

-- 1. Create the chat-attachments bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-attachments',
  'chat-attachments',
  true,
  10485760, -- 10MB
  ARRAY[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'video/mp4',
    'audio/mpeg', 'audio/ogg'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  allowed_mime_types = EXCLUDED.allowed_mime_types,
  file_size_limit = EXCLUDED.file_size_limit;

-- 2. Add file_link column to messages table
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS file_link TEXT;

-- Add comment for clarity
COMMENT ON COLUMN public.messages.file_link IS 'URL to attachment file in chat-attachments bucket';

-- 3. RLS policies for the bucket
-- Allow anyone to upload (for LiveChat anonymous users)
DROP POLICY IF EXISTS "Allow public uploads to chat-attachments" ON storage.objects;
CREATE POLICY "Allow public uploads to chat-attachments" ON storage.objects
  FOR INSERT TO anon, authenticated 
  WITH CHECK (bucket_id = 'chat-attachments');

-- Allow public read access
DROP POLICY IF EXISTS "Allow public read from chat-attachments" ON storage.objects;
CREATE POLICY "Allow public read from chat-attachments" ON storage.objects
  FOR SELECT TO anon, authenticated 
  USING (bucket_id = 'chat-attachments');

-- Allow delete for authenticated users (cleanup)
DROP POLICY IF EXISTS "Allow authenticated delete from chat-attachments" ON storage.objects;
CREATE POLICY "Allow authenticated delete from chat-attachments" ON storage.objects
  FOR DELETE TO authenticated 
  USING (bucket_id = 'chat-attachments');

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
