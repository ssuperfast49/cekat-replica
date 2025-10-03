import { useState, useEffect } from 'react';
import { supabase, logAction } from '@/lib/supabase';
import { generateUuid } from '@/lib/utils';
import { waitForAuthReady } from '@/lib/authReady';
import { isDocumentHidden, onDocumentVisible } from '@/lib/utils';

// New interface for v_users view
export interface VUser {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  timezone: string | null;
  created_at: string;
  roles: (string | null)[];
}

export interface AgentWithDetails {
  user_id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  timezone: string | null;
  created_at: string;
  roles: string[];
  primaryRole: 'master_agent' | 'super_agent' | 'agent' | null;
  status: 'Active' | 'Inactive';
  super_agent_id?: string | null;
}

export const useHumanAgents = () => {
  const [agents, setAgents] = useState<AgentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // local flag to enable 2FA on create; setter will be passed from component
  let enable2FAFlagForCreate = false;
  const setEnable2FAFlagForCreate = (v: boolean) => { enable2FAFlagForCreate = v; };

  const hydrateFromCache = () => {
    try {
      const raw = localStorage.getItem('app.cachedAgents');
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setAgents(parsed);
        return true;
      }
    } catch {}
    return false;
  };

  // Helper function to get primary role from roles array
  const getPrimaryRole = (roles: (string | null)[]): 'master_agent' | 'super_agent' | 'agent' | null => {
    // Filter out null values and get valid roles
    const validRoles = roles?.filter((role): role is string => role !== null && role !== undefined) || [];
    
    if (validRoles.includes('master_agent')) return 'master_agent';
    if (validRoles.includes('super_agent')) return 'super_agent';
    if (validRoles.includes('agent')) return 'agent';
    return null;
  };

  // Module-scoped cache and in-flight promise to dedupe concurrent calls across components
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // Using module-level state ensures only one network call even if multiple hook instances mount.
  // TTL keeps data reasonably fresh without spamming the server on route transitions.
  const AGENTS_CACHE_TTL_MS = 60_000;
  // @ts-ignore - hoisted singletons shared by module
  if (!(globalThis as any).__agentsCache) {
    (globalThis as any).__agentsCache = { data: null as AgentWithDetails[] | null, ts: 0, inFlight: null as Promise<AgentWithDetails[]> | null };
  }
  // @ts-ignore - read shared cache
  const shared = (globalThis as any).__agentsCache as { data: AgentWithDetails[] | null; ts: number; inFlight: Promise<AgentWithDetails[]> | null };

  const transformVUsers = (usersData: any[]): AgentWithDetails[] => {
    return (usersData || []).map((user: any) => {
      const validRoles = user.roles?.filter((role: unknown): role is string => role !== null && role !== undefined) || [];
      const primaryRole = getPrimaryRole(user.roles || []);
      return {
        user_id: user.id,
        email: user.email,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        timezone: user.timezone,
        created_at: user.created_at,
        roles: validRoles,
        primaryRole: primaryRole,
        status: 'Active' as const,
        super_agent_id: null
      };
    });
  };

  const fetchAgentsOnce = async (): Promise<AgentWithDetails[]> => {
    if (shared.inFlight) return shared.inFlight;
    shared.inFlight = (async () => {
      await waitForAuthReady();
      const { data: usersData, error: usersError } = await supabase
        .from('v_users')
        .select('*')
        .order('created_at', { ascending: false });
      if (usersError) throw usersError;
      let transformed = transformVUsers(usersData || []);
      // Attach super_agent mapping for agents
      try {
        const { data: mappings } = await supabase
          .from('super_agent_members')
          .select('agent_user_id, super_agent_id');
        if (mappings && Array.isArray(mappings)) {
          const byId: Record<string, string> = {};
          mappings.forEach((m: any) => { byId[m.agent_user_id] = m.super_agent_id; });
          transformed = transformed.map(a => a.primaryRole === 'agent' ? { ...a, super_agent_id: byId[a.user_id] || null } : a);
        }
      } catch {}
      shared.data = transformed;
      shared.ts = Date.now();
      shared.inFlight = null;
      try { localStorage.setItem('app.cachedAgents', JSON.stringify(transformed)); } catch {}
      return transformed;
    })().catch((e) => { shared.inFlight = null; throw e; });
    return shared.inFlight;
  };

  const getAgentsCachedOrLoad = async (): Promise<AgentWithDetails[]> => {
    const fresh = shared.data && (Date.now() - shared.ts) < AGENTS_CACHE_TTL_MS;
    if (fresh) return shared.data as AgentWithDetails[];
    return await fetchAgentsOnce();
  };

  // Fetch all agents using the v_users view with de-duplication and caching
  const fetchAgents = async (opts?: { force?: boolean }) => {
    try {
      setLoading(true);
      setError(null);
      if (opts?.force) { shared.ts = 0; }
      const data = await getAgentsCachedOrLoad();
      setAgents(data);
    } catch (error) {
      console.error('Error fetching human agents:', error);
      setError('Failed to fetch human agents');
      setAgents([]);
    } finally {
      setLoading(false);
    }
  };

  // Create a new agent
  const createAgent = async (agentData: {
    full_name: string;
    email: string;
    role: 'master_agent' | 'super_agent' | 'agent';
  }) => {
    try {
      setError(null);
      // Call edge function to create auth user + profile + role
      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        headers: {
          // Allow CORS when running from Netlify/localhost
          'x-client-origin': typeof window !== 'undefined' ? window.location.origin : ''
        },
        body: { email: agentData.email, full_name: agentData.full_name, role: agentData.role },
      });
      if (error) throw error;

      // Do not send a separate reset email here; the admin invite email is enough

      // If 2FA requested, enable it on the profile we just created
      if (enable2FAFlagForCreate) {
        try {
          await supabase
            .from('users_profile')
            .update({ is_2fa_email_enabled: true })
            .eq('user_id', data?.id);
        } catch {}
      }

      await fetchAgents({ force: true });
      try { await logAction({ action: 'user.create', resource: 'user', resourceId: data?.id || null, context: agentData as any }); } catch {}

      return { id: data?.id } as any;
    } catch (error) {
      console.error('Error creating agent:', error);
      setError(error instanceof Error ? error.message : 'Failed to create agent');
      throw error;
    }
  };

  // Update agent role
  const updateAgentRole = async (agentId: string, role: 'master_agent' | 'super_agent' | 'agent') => {
    try {
      setError(null);

      // Get the role ID for the new role
      const { data: roleData, error: roleError } = await supabase
        .from('roles')
        .select('id')
        .eq('name', role)
        .single();

      if (roleError) throw roleError;

      // First, remove existing role assignments for this user
      const { error: deleteError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', agentId);

      if (deleteError) throw deleteError;

      // Then add the new role assignment
      const { error: insertError } = await supabase
        .from('user_roles')
        .insert([{
          user_id: agentId,
          role_id: roleData.id
        }]);

      if (insertError) throw insertError;

      // Refresh the agents list to get updated data from v_users
      await fetchAgents({ force: true });

      try { await logAction({ action: 'user.update_role', resource: 'user', resourceId: agentId, context: { role } }); } catch {}
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

      // Call admin function to hard delete auth user and related rows
      const { error: fnErr } = await supabase.functions.invoke('admin-delete-user', {
        body: { user_id: agentId },
      });
      if (fnErr) throw fnErr;

      // Refresh the agents list
      await fetchAgents({ force: true });

      try { await logAction({ action: 'user.delete', resource: 'user', resourceId: agentId }); } catch {}
    } catch (error) {
      console.error('Error deleting agent:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete agent');
      throw error;
    }
  };

  // Initialize data on mount (gate network on visibility)
  useEffect(() => {
    const hadCache = hydrateFromCache();
    if (hadCache) {
      setLoading(false);
    }
    const run = () => fetchAgents();
    run();
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
    removeAgentFromTeam: () => Promise.resolve(), // No-op since we don't have teams
    setEnable2FAFlagForCreate,
  };
};

