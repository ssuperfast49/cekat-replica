import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface UserProfile {
  id: string;
  user_id: string;
  org_id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  phone: string | null;
  role: 'Agent' | 'Super Agent';
  status: 'Online' | 'Offline';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrgMember {
  id: string;
  org_id: string;
  user_id: string;
  user_profile_id: string;
  role: 'owner' | 'admin' | 'member';
  permissions: any;
  joined_at: string;
  created_at: string;
}

export interface Team {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_profile_id: string;
  role: 'leader' | 'member';
  joined_at: string;
  created_at: string;
}

export interface AgentWithDetails extends UserProfile {
  org_member?: OrgMember;
  teams?: (Team & { team_member: TeamMember })[];
}

export const useHumanAgents = () => {
  const [agents, setAgents] = useState<AgentWithDetails[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all agents for the organization
  const fetchAgents = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('users_profile')
        .select(`
          *,
          org_members!inner(*)
        `)
        .eq('org_id', '00000000-0000-0000-0000-000000000001')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch teams for each agent
      const agentsWithTeams = await Promise.all(
        (data || []).map(async (agent) => {
          const { data: teamData } = await supabase
            .from('team_members')
            .select(`
              *,
              teams(*)
            `)
            .eq('user_profile_id', agent.id);

          return {
            ...agent,
            teams: teamData || []
          };
        })
      );

      setAgents(agentsWithTeams);
    } catch (error) {
      console.error('Error fetching agents:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch agents');
    } finally {
      setLoading(false);
    }
  };

  // Fetch all teams
  const fetchTeams = async () => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .eq('org_id', '00000000-0000-0000-0000-000000000001')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTeams(data || []);
    } catch (error) {
      console.error('Error fetching teams:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch teams');
    }
  };

  // Create a new agent
  const createAgent = async (agentData: {
    full_name: string;
    email: string;
    role: 'Agent' | 'Super Agent';
    phone?: string;
  }) => {
    try {
      setError(null);

      // First, create a user profile
      const { data: profileData, error: profileError } = await supabase
        .from('users_profile')
        .insert([{
          user_id: `00000000-0000-0000-0000-${Date.now().toString().padStart(12, '0')}`, // Generate a temporary user_id
          org_id: '00000000-0000-0000-0000-000000000001',
          full_name: agentData.full_name,
          email: agentData.email,
          role: agentData.role,
          phone: agentData.phone,
          status: 'Offline',
          is_active: true
        }])
        .select()
        .single();

      if (profileError) throw profileError;

      // Then, create an org member record
      const { error: memberError } = await supabase
        .from('org_members')
        .insert([{
          org_id: '00000000-0000-0000-0000-000000000001',
          user_id: profileData.user_id,
          user_profile_id: profileData.id,
          role: 'member'
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

  // Update agent status
  const updateAgentStatus = async (agentId: string, status: 'Online' | 'Offline') => {
    try {
      setError(null);

      const { error } = await supabase
        .from('users_profile')
        .update({ status })
        .eq('id', agentId);

      if (error) throw error;

      // Update local state
      setAgents(prev => prev.map(agent => 
        agent.id === agentId ? { ...agent, status } : agent
      ));
    } catch (error) {
      console.error('Error updating agent status:', error);
      setError(error instanceof Error ? error.message : 'Failed to update agent status');
      throw error;
    }
  };

  // Update agent role
  const updateAgentRole = async (agentId: string, role: 'Agent' | 'Super Agent') => {
    try {
      setError(null);

      const { error } = await supabase
        .from('users_profile')
        .update({ role })
        .eq('id', agentId);

      if (error) throw error;

      // Update local state
      setAgents(prev => prev.map(agent => 
        agent.id === agentId ? { ...agent, role } : agent
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

      // First, delete org member record
      const { error: memberError } = await supabase
        .from('org_members')
        .delete()
        .eq('user_profile_id', agentId);

      if (memberError) throw memberError;

      // Then, delete team memberships
      const { error: teamMemberError } = await supabase
        .from('team_members')
        .delete()
        .eq('user_profile_id', agentId);

      if (teamMemberError) throw teamMemberError;

      // Finally, delete the user profile
      const { error: profileError } = await supabase
        .from('users_profile')
        .delete()
        .eq('id', agentId);

      if (profileError) throw profileError;

      // Update local state
      setAgents(prev => prev.filter(agent => agent.id !== agentId));
    } catch (error) {
      console.error('Error deleting agent:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete agent');
      throw error;
    }
  };

  // Create a new team
  const createTeam = async (teamData: {
    name: string;
    description?: string;
  }) => {
    try {
      setError(null);

      const { data, error } = await supabase
        .from('teams')
        .insert([{
          org_id: '00000000-0000-0000-0000-000000000001',
          name: teamData.name,
          description: teamData.description,
          created_by: '00000000-0000-0000-0000-000000000005' // Default creator
        }])
        .select()
        .single();

      if (error) throw error;

      // Refresh teams list
      await fetchTeams();

      return data;
    } catch (error) {
      console.error('Error creating team:', error);
      setError(error instanceof Error ? error.message : 'Failed to create team');
      throw error;
    }
  };

  // Add agent to team
  const addAgentToTeam = async (agentId: string, teamId: string, role: 'leader' | 'member' = 'member') => {
    try {
      setError(null);

      const { error } = await supabase
        .from('team_members')
        .insert([{
          team_id: teamId,
          user_profile_id: agentId,
          role
        }]);

      if (error) throw error;

      // Refresh agents to get updated team information
      await fetchAgents();
    } catch (error) {
      console.error('Error adding agent to team:', error);
      setError(error instanceof Error ? error.message : 'Failed to add agent to team');
      throw error;
    }
  };

  // Remove agent from team
  const removeAgentFromTeam = async (agentId: string, teamId: string) => {
    try {
      setError(null);

      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('team_id', teamId)
        .eq('user_profile_id', agentId);

      if (error) throw error;

      // Refresh agents to get updated team information
      await fetchAgents();
    } catch (error) {
      console.error('Error removing agent from team:', error);
      setError(error instanceof Error ? error.message : 'Failed to remove agent from team');
      throw error;
    }
  };

  // Initialize data on mount
  useEffect(() => {
    fetchAgents();
    fetchTeams();
  }, []);

  return {
    agents,
    teams,
    loading,
    error,
    fetchAgents,
    fetchTeams,
    createAgent,
    updateAgentStatus,
    updateAgentRole,
    deleteAgent,
    createTeam,
    addAgentToTeam,
    removeAgentFromTeam
  };
};

