-- Supabase Permissions Fix for Live Chat
-- Run this in the Supabase SQL Editor to fix permission issues

-- 1. Enable RLS on all tables
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- 2. Create policies for anonymous access to channels table
CREATE POLICY "Allow anonymous read access to channels" ON channels
    FOR SELECT USING (true);

-- 3. Create policies for anonymous access to messages table
CREATE POLICY "Allow anonymous read access to messages" ON messages
    FOR SELECT USING (true);

CREATE POLICY "Allow anonymous insert to messages" ON messages
    FOR INSERT WITH CHECK (true);

-- 4. Create policies for anonymous access to threads table
CREATE POLICY "Allow anonymous read access to threads" ON threads
    FOR SELECT USING (true);

CREATE POLICY "Allow anonymous insert to threads" ON threads
    FOR INSERT WITH CHECK (true);

-- 5. Create policies for anonymous access to contacts table
CREATE POLICY "Allow anonymous read access to contacts" ON contacts
    FOR SELECT USING (true);

CREATE POLICY "Allow anonymous insert to contacts" ON contacts
    FOR INSERT WITH CHECK (true);

-- 6. Grant necessary permissions to anon role
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON channels TO anon;
GRANT SELECT ON messages TO anon;
GRANT SELECT ON threads TO anon;
GRANT SELECT ON contacts TO anon;
GRANT INSERT ON messages TO anon;
GRANT INSERT ON threads TO anon;
GRANT INSERT ON contacts TO anon;

-- 7. Grant permissions for realtime subscriptions
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON messages TO anon;
GRANT SELECT ON threads TO anon;

-- 8. Check if realtime is already enabled (optional - skip if you get errors)
-- The tables might already be in the realtime publication
-- You can check with: SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';

-- If you need to add tables to realtime manually, run these commands separately:
-- ALTER PUBLICATION supabase_realtime ADD TABLE messages;
-- ALTER PUBLICATION supabase_realtime ADD TABLE threads;
