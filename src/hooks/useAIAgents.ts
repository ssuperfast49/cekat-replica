import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { waitForAuthReady } from '@/lib/authReady';
import { isDocumentHidden, onDocumentVisible } from '@/lib/utils';

export interface AIAgent {
  id: string;
  org_id: string;
  name: string;
  description?: string;
  system_prompt?: string;
  welcome_message?: string;
  transfer_conditions?: string;
  stop_ai_after_handoff?: boolean;
  model?: string;
  temperature?: number;
  created_at: string;
  super_agent_id?: string;
  auto_resolve_after_minutes?: number;
  enable_resolve?: boolean;
}

export const useAIAgents = () => {
  const [aiAgents, setAIAgents] = useState<AIAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterBySuper, setFilterBySuper] = useState<string | null>(null);
  const inFlightKeyRef = useState<{ current: string | null }>({ current: null })[0];

  const fetchAIAgents = async () => {
    try {
      const key = String(filterBySuper || '__ALL__');
      if (inFlightKeyRef.current === key) return; // de-dupe concurrent/strict-mode fetches
      inFlightKeyRef.current = key;
      setLoading(true);
      setError(null);

      console.log('Fetching AI agents...');

      // Fetch all AI profiles for selection
      await waitForAuthReady();
      let query = supabase
        .from('ai_profiles')
        .select('id, org_id, name, description, system_prompt, welcome_message, transfer_conditions, stop_ai_after_handoff, temperature, created_at, super_agent_id, auto_resolve_after_minutes, enable_resolve')
        .order('created_at', { ascending: false }) as any;
      if (filterBySuper) query = query.eq('super_agent_id', filterBySuper);
      const { data: aiAgentsData, error: aiAgentsError } = await query;

      console.log('AI agents data:', aiAgentsData);
      console.log('AI agents error:', aiAgentsError);

      if (aiAgentsError) {
        console.error('Error fetching AI agents:', aiAgentsError);
        setError(aiAgentsError.message);
        setAIAgents([]);
        return;
      }

      console.log('Successfully fetched AI agents:', aiAgentsData);
      setAIAgents(aiAgentsData || []);
      try { localStorage.setItem('app.cachedAIAgents', JSON.stringify(aiAgentsData || [])); } catch {}
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
    try {
      const raw = localStorage.getItem('app.cachedAIAgents');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setAIAgents(parsed);
          // do not early-return; continue to fetch fresh below
        }
      }
    } catch {}
    const run = () => fetchAIAgents();
    // Slight debounce to coalesce StrictMode double-invocation
    const t = setTimeout(() => {
      if (isDocumentHidden()) onDocumentVisible(run); else run();
    }, 50);
    return () => clearTimeout(t);
  }, [filterBySuper]);

  return {
    aiAgents,
    loading,
    error,
    fetchAIAgents,
    setFilterBySuper
  };
};
