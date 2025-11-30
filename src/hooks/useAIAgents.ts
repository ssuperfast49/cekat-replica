import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { waitForAuthReady } from '@/lib/authReady';
import { useAuth } from '@/contexts/AuthContext';
import { useSuperAgentScope } from './useSuperAgentScope';

export interface AIAgent {
  id: string;
  org_id: string;
  name: string;
  description?: string;
  super_agent_id?: string | null;
  system_prompt?: string;
  welcome_message?: string;
  transfer_conditions?: string;
  stop_ai_after_handoff?: boolean;
  model?: string;
  response_temperature?: string | null;
  created_at: string;
  auto_resolve_after_minutes?: number;
  enable_resolve?: boolean;
}

export const useAIAgents = () => {
  const [aiAgents, setAIAgents] = useState<AIAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const inFlightKeyRef = useState<{ current: string | null }>({ current: null })[0];
  const { user } = useAuth();
  const { mode: scopeMode, superAgentId, loading: scopeLoading, error: scopeError } = useSuperAgentScope();

  const cacheKey = useMemo(() => {
    const uid = user?.id ?? 'anon';
    if (scopeMode === 'all') {
      return `app.cachedAIAgents:${uid}:all`;
    }
    if (scopeMode === 'none') {
      return `app.cachedAIAgents:${uid}:none`;
    }
    return `app.cachedAIAgents:${uid}:${superAgentId ?? 'none'}`;
  }, [scopeMode, superAgentId, user?.id]);

  const fetchAIAgents = async () => {
    if (scopeLoading) return;
    try {
      const scopeSignature = `${scopeMode}:${superAgentId ?? 'null'}`;
      if (inFlightKeyRef.current === scopeSignature) return; // de-dupe concurrent/strict-mode fetches
      inFlightKeyRef.current = scopeSignature;
      setLoading(true);
      setError(scopeError ?? null);

      if (scopeMode === 'none') {
        setAIAgents([]);
        try { localStorage.setItem(cacheKey, JSON.stringify([])); } catch {}
        return;
      }

      // Fetch all AI profiles for selection
      await waitForAuthReady();
      const SELECT_COLUMNS = 'id, org_id, name, description, system_prompt, welcome_message, transfer_conditions, stop_ai_after_handoff, response_temperature, created_at, auto_resolve_after_minutes, enable_resolve';

      // Attempt filtered query first (if supported); gracefully fall back if column is missing
      let aiAgentsData: any[] | null = null;
      let aiAgentsError: any = null;

      if ((scopeMode === 'super' || scopeMode === 'agent')) {
        if (!superAgentId) {
          setAIAgents([]);
          try { localStorage.setItem(cacheKey, JSON.stringify([])); } catch {}
          return;
        }
        const { data, error } = await supabase
          .from('ai_profiles')
          .select(SELECT_COLUMNS)
          .eq('super_agent_id', superAgentId as any) // may fail if column doesn't exist
          .order('created_at', { ascending: false });
        aiAgentsData = data;
        aiAgentsError = error;

        // If column does not exist in this environment, fall back to unfiltered fetch
        if (aiAgentsError?.code === '42703') {
          const fallback = await supabase
            .from('ai_profiles')
            .select(SELECT_COLUMNS)
            .order('created_at', { ascending: false });
          aiAgentsData = fallback.data;
          aiAgentsError = fallback.error;
        }
      } else {
        const { data, error } = await supabase
          .from('ai_profiles')
          .select(SELECT_COLUMNS)
          .order('created_at', { ascending: false });
        aiAgentsData = data;
        aiAgentsError = error;
      }
      if (aiAgentsError) {
        console.error('Error fetching AI agents:', aiAgentsError);
        setError(aiAgentsError.message);
        setAIAgents([]);
        return;
      }

      setAIAgents(aiAgentsData || []);
      try { localStorage.setItem(cacheKey, JSON.stringify(aiAgentsData || [])); } catch {}
    } catch (error) {
      console.error('Error fetching AI agents:', error);
      setError('Failed to fetch AI agents');
      setAIAgents([]);
    } finally {
      inFlightKeyRef.current = null;
      setLoading(false);
    }
  };

  // Hydrate from cache, then always fetch from network
  useEffect(() => {
    if (scopeLoading) {
      setLoading(true);
      return;
    }

    if (scopeMode === 'none') {
      setAIAgents([]);
      setError(scopeError ?? 'Tidak ada agen AI yang tersedia untuk akun ini.');
      setLoading(false);
      return;
    }

    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setAIAgents(parsed);
        }
      }
    } catch {}
    const run = () => fetchAIAgents();
    // Slight debounce to coalesce StrictMode double-invocation
    const t = setTimeout(run, 50);
    return () => clearTimeout(t);
  }, [scopeLoading, scopeMode, scopeError, cacheKey]);

  return {
    aiAgents,
    loading: loading || scopeLoading,
    error,
    fetchAIAgents,
    scopeMode,
    superAgentId
  };
};
