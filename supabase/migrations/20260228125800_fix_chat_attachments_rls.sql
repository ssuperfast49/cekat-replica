-- Drop the old policy so we can recreate it properly
DROP POLICY IF EXISTS "Allow public uploads to chat-attachments" ON storage.objects;

-- Create a more permissive INSERT policy for anon and authenticated users
CREATE POLICY "Allow public uploads to chat-attachments" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'chat-attachments');

-- We also need UPDATE policy if they try to upsert/replace a file (though upsert is false in code)
DROP POLICY IF EXISTS "Allow public updates to chat-attachments" ON storage.objects;
CREATE POLICY "Allow public updates to chat-attachments" ON storage.objects
  FOR UPDATE TO anon, authenticated
  USING (bucket_id = 'chat-attachments');
