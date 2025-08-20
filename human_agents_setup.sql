-- Human Agents Database Setup
-- Run these commands in your Supabase SQL editor

-- Create users_profile table
CREATE TABLE IF NOT EXISTS users_profile (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    org_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
    full_name TEXT,
    email TEXT NOT NULL,
    avatar_url TEXT,
    phone TEXT,
    role TEXT DEFAULT 'Agent' CHECK (role IN ('Agent', 'Super Agent')),
    status TEXT DEFAULT 'Offline' CHECK (status IN ('Online', 'Offline')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create org_members table for team management
CREATE TABLE IF NOT EXISTS org_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    user_profile_id UUID REFERENCES users_profile(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    permissions JSONB DEFAULT '{}',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create teams table for team management
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
    name TEXT NOT NULL,
    description TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create team_members table for team assignments
CREATE TABLE IF NOT EXISTS team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    user_profile_id UUID REFERENCES users_profile(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member' CHECK (role IN ('leader', 'member')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(team_id, user_profile_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_profile_org_id ON users_profile(org_id);
CREATE INDEX IF NOT EXISTS idx_users_profile_user_id ON users_profile(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON org_members(org_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON org_members(user_id);
CREATE INDEX IF NOT EXISTS idx_teams_org_id ON teams(org_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);

-- Enable Row Level Security (RLS)
ALTER TABLE users_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for users_profile
CREATE POLICY "Users can view their own profile" ON users_profile
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON users_profile
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Org admins can view all profiles in their org" ON users_profile
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM org_members 
            WHERE org_members.org_id = users_profile.org_id 
            AND org_members.user_id = auth.uid() 
            AND org_members.role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Org admins can manage profiles in their org" ON users_profile
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM org_members 
            WHERE org_members.org_id = users_profile.org_id 
            AND org_members.user_id = auth.uid() 
            AND org_members.role IN ('owner', 'admin')
        )
    );

-- Create RLS policies for org_members
CREATE POLICY "Users can view org members in their org" ON org_members
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM org_members om2 
            WHERE om2.org_id = org_members.org_id 
            AND om2.user_id = auth.uid()
        )
    );

CREATE POLICY "Org owners can manage members" ON org_members
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM org_members om2 
            WHERE om2.org_id = org_members.org_id 
            AND om2.user_id = auth.uid() 
            AND om2.role = 'owner'
        )
    );

-- Create RLS policies for teams
CREATE POLICY "Users can view teams in their org" ON teams
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM org_members 
            WHERE org_members.org_id = teams.org_id 
            AND org_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Org admins can manage teams" ON teams
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM org_members 
            WHERE org_members.org_id = teams.org_id 
            AND org_members.user_id = auth.uid() 
            AND org_members.role IN ('owner', 'admin')
        )
    );

-- Create RLS policies for team_members
CREATE POLICY "Users can view team members in their org" ON team_members
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM org_members om
            JOIN teams t ON om.org_id = t.org_id
            WHERE t.id = team_members.team_id 
            AND om.user_id = auth.uid()
        )
    );

CREATE POLICY "Team leaders can manage team members" ON team_members
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM team_members tm2
            WHERE tm2.team_id = team_members.team_id 
            AND tm2.user_profile_id IN (
                SELECT id FROM users_profile WHERE user_id = auth.uid()
            )
            AND tm2.role = 'leader'
        )
    );

-- Insert sample data for users_profile
INSERT INTO users_profile (user_id, org_id, full_name, email, role, status) VALUES 
-- Note: These are sample data. In production, user_id should reference real auth.users
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Agent 03', 'agent03aog@gmail.com', 'Agent', 'Offline'),
('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Agent 02', 'agent02aog@gmail.com', 'Agent', 'Offline'),
('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Agent 01', 'agent01aog@gmail.com', 'Agent', 'Offline'),
('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Audit 4', 'audit4@gmail.com', 'Super Agent', 'Online'),
('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'Julian', 'fom4dgroup@gmail.com', 'Super Agent', 'Online')
ON CONFLICT DO NOTHING;

-- Insert sample data for org_members
INSERT INTO org_members (org_id, user_id, user_profile_id, role) VALUES 
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 
 (SELECT id FROM users_profile WHERE email = 'agent03aog@gmail.com' LIMIT 1), 'member'),
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 
 (SELECT id FROM users_profile WHERE email = 'agent02aog@gmail.com' LIMIT 1), 'member'),
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 
 (SELECT id FROM users_profile WHERE email = 'agent01aog@gmail.com' LIMIT 1), 'member'),
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', 
 (SELECT id FROM users_profile WHERE email = 'audit4@gmail.com' LIMIT 1), 'admin'),
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000005', 
 (SELECT id FROM users_profile WHERE email = 'fom4dgroup@gmail.com' LIMIT 1), 'owner')
ON CONFLICT DO NOTHING;

-- Insert sample teams
INSERT INTO teams (org_id, name, description, created_by) VALUES 
('00000000-0000-0000-0000-000000000001', 'Customer Support', 'Primary customer support team', '00000000-0000-0000-0000-000000000005'),
('00000000-0000-0000-0000-000000000001', 'Sales Team', 'Sales and business development team', '00000000-0000-0000-0000-000000000005')
ON CONFLICT DO NOTHING;

-- Insert sample team members
INSERT INTO team_members (team_id, user_profile_id, role) VALUES 
-- Customer Support Team
((SELECT id FROM teams WHERE name = 'Customer Support' LIMIT 1), 
 (SELECT id FROM users_profile WHERE email = 'agent01aog@gmail.com' LIMIT 1), 'leader'),
((SELECT id FROM teams WHERE name = 'Customer Support' LIMIT 1), 
 (SELECT id FROM users_profile WHERE email = 'agent02aog@gmail.com' LIMIT 1), 'member'),
((SELECT id FROM teams WHERE name = 'Customer Support' LIMIT 1), 
 (SELECT id FROM users_profile WHERE email = 'agent03aog@gmail.com' LIMIT 1), 'member'),
-- Sales Team
((SELECT id FROM teams WHERE name = 'Sales Team' LIMIT 1), 
 (SELECT id FROM users_profile WHERE email = 'audit4@gmail.com' LIMIT 1), 'leader')
ON CONFLICT DO NOTHING;

