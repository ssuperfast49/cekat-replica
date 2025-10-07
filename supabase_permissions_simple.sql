-- Simplified Supabase Permissions Fix
-- Run this in the Supabase SQL Editor

-- 1. Enable RLS on all tables
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- 2. Create policies for anonymous access
CREATE POLICY "Allow anonymous read access to channels" ON channels
    FOR SELECT USING (true);

CREATE POLICY "Allow anonymous read access to messages" ON messages
    FOR SELECT USING (true);

CREATE POLICY "Allow anonymous insert to messages" ON messages
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anonymous read access to threads" ON threads
    FOR SELECT USING (true);

CREATE POLICY "Allow anonymous insert to threads" ON threads
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anonymous read access to contacts" ON contacts
    FOR SELECT USING (true);

CREATE POLICY "Allow anonymous insert to contacts" ON contacts
    FOR INSERT WITH CHECK (true);

-- 3. Grant necessary permissions to anon role
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON channels TO anon;
GRANT SELECT ON messages TO anon;
GRANT SELECT ON threads TO anon;
GRANT SELECT ON contacts TO anon;
GRANT INSERT ON messages TO anon;
GRANT INSERT ON threads TO anon;
GRANT INSERT ON contacts TO anon;
