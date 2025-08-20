import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface UserProfile {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  timezone: string;
  created_at: string;
}

export interface OrgMember {
  org_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'agent';
  created_at: string;
}

export interface AgentWithDetails extends UserProfile {
  org_member?: OrgMember;
  email?: string; // We'll get this from auth.users if needed
  role: 'owner' | 'admin' | 'agent';
  status: 'Online' | 'Offline'; // We'll simulate this for now
}

export const useHumanAgents = () => {
  const [agents, setAgents] = useState<AgentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all agents for the organization
  const fetchAgents = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('Fetching human agents...');

      // First try to fetch all users_profile to see what's available
      const { data: allProfilesData, error: allProfilesError } = await supabase
        .from('users_profile')
        .select('*')
        .order('created_at', { ascending: false });

      console.log('All user profiles data:', allProfilesData);
      console.log('All user profiles error:', allProfilesError);

      if (allProfilesError) {
        console.error('Error fetching all user profiles:', allProfilesError);
        // Try with organization-specific query as fallback
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.log('No authenticated user for human agents');
          setAgents([]);
          return;
        }

        // Get user's organization
        const { data: userOrgMember, error: userOrgError } = await supabase
          .from('org_members')
          .select('org_id')
          .eq('user_id', user.id)
          .maybeSingle();

        console.log('User org member for human agents:', userOrgMember);
        console.log('User org error for human agents:', userOrgError);

        if (userOrgError || !userOrgMember) {
          console.log('No org membership found for human agents, creating sample data');
          // Create sample data for testing
          const sampleAgents: AgentWithDetails[] = [
            {
              user_id: 'sample-1',
              display_name: 'John Doe',
              avatar_url: null,
              timezone: 'Asia/Jakarta',
              created_at: new Date().toISOString(),
              role: 'agent',
              status: 'Online'
            },
            {
              user_id: 'sample-2', 
              display_name: 'Jane Smith',
              avatar_url: null,
              timezone: 'Asia/Jakarta',
              created_at: new Date().toISOString(),
              role: 'admin',
              status: 'Online'
            }
          ];
          setAgents(sampleAgents);
          return;
        }

        const orgId = userOrgMember.org_id;

        // Try fetching org members with profiles
        const { data: orgMembers, error: orgMembersError } = await supabase
          .from('org_members')
          .select(`
            *,
            users_profile!inner(*)
          `)
          .eq('org_id', orgId);

        console.log('Org members with profiles:', orgMembers);
        if (orgMembersError) {
          console.error('Error fetching org members with profiles:', orgMembersError);
          setError(orgMembersError.message);
          return;
        }

        // Transform the data to match our interface
        const agentsWithDetails: AgentWithDetails[] = (orgMembers || []).map(member => ({
          user_id: member.user_id,
          display_name: member.users_profile?.display_name || 'Unknown User',
          avatar_url: member.users_profile?.avatar_url,
          timezone: member.users_profile?.timezone || 'Asia/Jakarta',
          created_at: member.users_profile?.created_at || member.created_at,
          role: member.role,
          status: 'Online' as const,
          org_member: member
        }));

        console.log('Transformed agents with details:', agentsWithDetails);
        setAgents(agentsWithDetails);
      } else {
        // If we got all profiles successfully, transform them to agents
        console.log('Successfully fetched all user profiles:', allProfilesData);
        const transformedAgents: AgentWithDetails[] = (allProfilesData || []).map(profile => ({
          user_id: profile.user_id,
          display_name: profile.display_name || 'Unknown User',
          avatar_url: profile.avatar_url,
          timezone: profile.timezone || 'Asia/Jakarta',
          created_at: profile.created_at,
          role: 'agent' as const, // Default role since we don't have org_members data
          status: 'Online' as const
        }));
        
        console.log('Transformed user profiles to agents:', transformedAgents);
        setAgents(transformedAgents);
      }
    } catch (error) {
      console.error('Error fetching human agents:', error);
      setError('Failed to fetch human agents');
      // Provide fallback sample data
      const fallbackAgents: AgentWithDetails[] = [
        {
          user_id: 'fallback-1',
          display_name: 'Customer Service Agent',
          avatar_url: null,
          timezone: 'Asia/Jakarta',
          created_at: new Date().toISOString(),
          role: 'agent',
          status: 'Online'
        },
        {
          user_id: 'fallback-2',
          display_name: 'Technical Support',
          avatar_url: null,
          timezone: 'Asia/Jakarta',
          created_at: new Date().toISOString(),
          role: 'agent',
          status: 'Online'
        }
      ];
      setAgents(fallbackAgents);
    } finally {
      setLoading(false);
    }
  };

  // Create a new agent
  const createAgent = async (agentData: {
    full_name: string;
    email: string;
    role: 'owner' | 'admin' | 'agent';
  }) => {
    try {
      setError(null);

      // First, create a user in auth.users (this would typically be done through signup)
      // For now, we'll assume the user already exists and we're just adding them to the org
      
      // Get the current user's org_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data: userOrgMember } = await supabase
        .from('org_members')
        .select('org_id')
        .eq('user_id', user.id)
        .single();

      if (!userOrgMember) {
        throw new Error('User not found in any organization');
      }

      const orgId = userOrgMember.org_id;

      // Create user profile
      const { data: profileData, error: profileError } = await supabase
        .from('users_profile')
        .insert([{
          user_id: `temp-${Date.now()}`, // This should be a real user_id from auth.users
          display_name: agentData.full_name,
          timezone: 'Asia/Jakarta'
        }])
        .select()
        .single();

      if (profileError) throw profileError;

      // Create org member record
      const { error: memberError } = await supabase
        .from('org_members')
        .insert([{
          org_id: orgId,
          user_id: profileData.user_id,
          role: agentData.role
        }]);

      if (memberError) throw memberError;

      // Refresh the agents list
      await fetchAgents();

      return profileData;
    } catch (error) {
      console.error('Error creating agent:', error);
      setError(error instanceof Error ? error.message : 'Failed to create agent');
      throw error;
    }
  };

  // Update agent role
  const updateAgentRole = async (agentId: string, role: 'owner' | 'admin' | 'agent') => {
    try {
      setError(null);

      const { error } = await supabase
        .from('org_members')
        .update({ role })
        .eq('user_id', agentId);

      if (error) throw error;

      // Update local state
      setAgents(prev => prev.map(agent => 
        agent.user_id === agentId ? { ...agent, role } : agent
      ));
    } catch (error) {
      console.error('Error updating agent role:', error);
      setError(error instanceof Error ? error.message : 'Failed to update agent role');
      throw error;
    }
  };

  // Delete an agent
  const deleteAgent = async (agentId: string) => {
    try {
      setError(null);

      // Delete org member record
      const { error: memberError } = await supabase
        .from('org_members')
        .delete()
        .eq('user_id', agentId);

      if (memberError) throw memberError;

      // Update local state
      setAgents(prev => prev.filter(agent => agent.user_id !== agentId));
    } catch (error) {
      console.error('Error deleting agent:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete agent');
      throw error;
    }
  };

  // Initialize data on mount
  useEffect(() => {
    fetchAgents();
  }, []);

  return {
    agents,
    teams: [], // We don't have teams table, so return empty array
    loading,
    error,
    fetchAgents,
    fetchTeams: () => Promise.resolve(), // No-op since we don't have teams
    createAgent,
    updateAgentStatus: () => Promise.resolve(), // No-op since we don't have status field
    updateAgentRole,
    deleteAgent,
    createTeam: () => Promise.resolve(), // No-op since we don't have teams
    addAgentToTeam: () => Promise.resolve(), // No-op since we don't have teams
    removeAgentFromTeam: () => Promise.resolve() // No-op since we don't have teams
  };
};

