# Human Agents Integration Setup Guide

## Overview
The HumanAgents component has been integrated with Supabase to use real data from the `users_profile`, `org_members`, `teams`, and `team_members` tables.

## Database Tables Used
- `users_profile` - Agent profile information
- `org_members` - Organization membership and roles
- `teams` - Team definitions
- `team_members` - Team assignments

## Setup Instructions

### 1. Create Database Tables
Run the SQL commands in `human_agents_setup.sql` in your Supabase SQL editor to create the required tables and sample data.

### 2. Database Schema
The integration expects the following table structure:

#### users_profile
- `id` (uuid, primary key)
- `user_id` (uuid, references auth.users)
- `org_id` (uuid)
- `full_name` (text, nullable)
- `email` (text, required)
- `avatar_url` (text, nullable)
- `phone` (text, nullable)
- `role` (text) - 'Agent' or 'Super Agent'
- `status` (text) - 'Online' or 'Offline'
- `is_active` (boolean)
- `created_at` (timestamp)
- `updated_at` (timestamp)

#### org_members
- `id` (uuid, primary key)
- `org_id` (uuid)
- `user_id` (uuid, references auth.users)
- `user_profile_id` (uuid, references users_profile)
- `role` (text) - 'owner', 'admin', or 'member'
- `permissions` (jsonb)
- `joined_at` (timestamp)
- `created_at` (timestamp)

#### teams
- `id` (uuid, primary key)
- `org_id` (uuid)
- `name` (text, required)
- `description` (text, nullable)
- `created_by` (uuid, references auth.users)
- `created_at` (timestamp)
- `updated_at` (timestamp)

#### team_members
- `id` (uuid, primary key)
- `team_id` (uuid, references teams)
- `user_profile_id` (uuid, references users_profile)
- `role` (text) - 'leader' or 'member'
- `joined_at` (timestamp)
- `created_at` (timestamp)

## Features Implemented

### 1. Agent Management
- **Create Agents**: Add new agents with name, email, phone, and role
- **Update Status**: Toggle agent status between Online/Offline
- **Update Role**: Change agent role between Agent/Super Agent
- **Delete Agents**: Remove agents from the system
- **Real-time Updates**: Changes are immediately reflected in the UI

### 2. Team Management
- **Create Teams**: Add new teams with name and description
- **View Team Members**: See which agents belong to each team
- **Team Roles**: Agents can be team leaders or members
- **Team Organization**: Organize agents into logical groups

### 3. Organization Structure
- **Role-based Access**: Different permission levels (owner, admin, member)
- **Multi-tenant Support**: Agents belong to specific organizations
- **Hierarchical Management**: Super Agents can manage regular Agents

### 4. UI Enhancements
- **Loading States**: Show loading indicators during data operations
- **Error Handling**: Display error messages for failed operations
- **Empty States**: Show helpful messages when no data exists
- **Responsive Design**: Works on desktop and mobile devices
- **Real-time Feedback**: Toast notifications for all operations

## Security Features

### Row Level Security (RLS)
All tables have RLS enabled with appropriate policies:

- **users_profile**: Users can view their own profile, admins can view all profiles in their org
- **org_members**: Users can view members in their org, owners can manage members
- **teams**: Users can view teams in their org, admins can manage teams
- **team_members**: Users can view team members in their org, team leaders can manage members

### Data Validation
- Email format validation
- Required field validation
- Role and status constraints
- Unique constraints on team memberships

## Usage

### 1. Managing Agents
1. **View Agents**: The agents tab shows all agents in your organization
2. **Create Agent**: Click "Create Agent" to add a new agent
3. **Update Status**: Use the status dropdown to change agent availability
4. **Change Role**: Use the role dropdown to promote/demote agents
5. **Delete Agent**: Click the trash icon to remove an agent

### 2. Managing Teams
1. **View Teams**: The teams tab shows all teams in your organization
2. **Create Team**: Click "Create Team" to add a new team
3. **View Members**: Each team shows its current members
4. **Team Roles**: Members can be leaders or regular members

### 3. Organization Management
- **Owner**: Can manage all aspects of the organization
- **Admin**: Can manage agents and teams
- **Member**: Can view organization data

## Customization

### Adding New Agent Fields
To add new fields to agents (e.g., department, skills), update the `users_profile` table and the `UserProfile` interface in `useHumanAgents.ts`.

### Adding New Team Features
To add new team features (e.g., team permissions, team settings), update the `teams` table and the `Team` interface.

### Custom Roles
To add custom roles, update the role constraints in the database and the TypeScript interfaces.

## Integration with Other Components

The human agents data can be integrated with other components:

- **Chat Assignment**: Use agent IDs to assign conversations
- **Analytics**: Track agent performance and team metrics
- **Notifications**: Send notifications to specific agents or teams
- **Permissions**: Use org member roles for feature access control

## Testing

### Sample Data
The setup script includes sample data for testing:
- 5 sample agents with different roles and statuses
- 2 sample teams (Customer Support, Sales Team)
- Team assignments for testing team management

### Manual Testing
1. Create a new agent and verify it appears in the list
2. Change agent status and verify the UI updates
3. Create a new team and verify it appears
4. Test error handling by trying invalid operations

## Troubleshooting

### Common Issues
1. **RLS Policy Errors**: Ensure the current user has appropriate permissions
2. **Foreign Key Errors**: Make sure referenced records exist
3. **Validation Errors**: Check that required fields are provided
4. **Network Errors**: Verify Supabase connection and API keys

### Debugging
- Check browser console for error messages
- Verify database table structure matches the schema
- Test database queries directly in Supabase SQL editor
- Check RLS policies are correctly configured

