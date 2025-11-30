import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { waitForAuthReady } from '@/lib/authReady';
import { useAuth } from '@/contexts/AuthContext';
import { useRBAC } from '@/contexts/RBACContext';

export type SuperAgentScopeMode = 'all' | 'super' | 'agent' | 'none';

interface SuperAgentScopeState {
  mode: SuperAgentScopeMode;
  superAgentId: string | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<string | null>;
}

/**
 * Determines how the current user should be scoped when reading AI agents.
 * - Master agents (and any non-agent roles) see everything (`mode = 'all'`).
 * - Super agents see only the agents they own (`mode = 'super'`).
 * - Agents are limited to the super agent they report to (`mode = 'agent'`).
 * - Unassigned agents are effectively locked out (`mode = 'none'`).
 */
export const useSuperAgentScope = (): SuperAgentScopeState => {
  const { user } = useAuth();
  const { userRoles, loading: rbacLoading } = useRBAC();

  const [mode, setMode] = useState<SuperAgentScopeMode>('none');
  const [superAgentId, setSuperAgentId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const roleNames = useMemo(
    () => userRoles.map(role => (role?.name ?? '').toLowerCase()),
    [userRoles],
  );

  const isMasterAgent = roleNames.includes('master_agent');
  const isSuperAgent = roleNames.includes('super_agent');
  const isAgent = roleNames.includes('agent');

  useEffect(() => {
    let active = true;

    const setState = (nextMode: SuperAgentScopeMode, nextSuperId: string | null, opts?: { loading?: boolean; error?: string | null }) => {
      if (!active) return;
      if (opts?.loading !== undefined) {
        setLoading(opts.loading);
      }
      if (opts?.error !== undefined) {
        setError(opts.error);
      }
      setMode(nextMode);
      setSuperAgentId(nextSuperId);
    };

    if (!user?.id) {
      setState('none', null, { loading: false, error: null });
      return () => { active = false; };
    }

    if (rbacLoading) {
      setLoading(true);
      return () => { active = false; };
    }

    if (isMasterAgent) {
      setState('all', null, { loading: false, error: null });
      return () => { active = false; };
    }

    if (isSuperAgent) {
      setState('super', user.id, { loading: false, error: null });
      return () => { active = false; };
    }

    if (isAgent) {
      setLoading(true);
      setError(null);

      (async () => {
        try {
          await waitForAuthReady();
          const { data, error: queryError } = await supabase
            .from('super_agent_members')
            .select('super_agent_id')
            .eq('agent_user_id', user.id)
            .maybeSingle();

          if (!active) return;
          if (queryError) throw queryError;

          const assignedSuper = data?.super_agent_id ?? null;

          if (assignedSuper) {
            setState('agent', assignedSuper, { loading: false, error: null });
          } else {
            // Agent exists but has no supervising cluster yet – treat as no access.
            setState('none', null, { loading: false, error: 'Agent belum memiliki Super Agent penanggung jawab.' });
          }
        } catch (err) {
          if (!active) return;
          console.error('Failed to resolve agent super scope', err);
          setState('none', null, {
            loading: false,
            error: err instanceof Error ? err.message : 'Gagal memuat cakupan agen AI.',
          });
        }
      })();

      return () => {
        active = false;
      };
    }

    // For authenticated roles that are not part of the agent hierarchy, allow full access.
    if (roleNames.length > 0) {
      setState('all', null, { loading: false, error: null });
    } else {
      setLoading(true);
    }

    return () => { active = false; };
  }, [user?.id, rbacLoading, isMasterAgent, isSuperAgent, isAgent, roleNames]);

  const refresh = async () => {
    if (!user?.id || !isAgent) {
      return superAgentId;
    }

    setLoading(true);
    setError(null);

    try {
      await waitForAuthReady();
      const { data, error: queryError } = await supabase
        .from('super_agent_members')
        .select('super_agent_id')
        .eq('agent_user_id', user.id)
        .maybeSingle();

      if (queryError) throw queryError;

      const assignedSuper = data?.super_agent_id ?? null;

      if (assignedSuper) {
        setMode('agent');
        setSuperAgentId(assignedSuper);
      } else {
        setMode('none');
        setSuperAgentId(null);
        setError('Agent belum memiliki Super Agent penanggung jawab.');
      }

      return assignedSuper;
    } catch (err) {
      console.error('Failed to refresh agent super scope', err);
      setMode('none');
      setSuperAgentId(null);
      setError(err instanceof Error ? err.message : 'Gagal memuat cakupan agen AI.');
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    mode,
    superAgentId,
    loading,
    error,
    refresh,
  };
};




