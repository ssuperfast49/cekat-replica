import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface AIAgent {
  id: string;
  org_id: string;
  name: string;
  description?: string;
  system_prompt?: string;
  welcome_message?: string;
  transfer_conditions?: string;
  stop_ai_after_handoff?: boolean;
  model: string;
  temperature?: number;
  created_at: string;
}

export const useAIAgents = () => {
  const [aiAgents, setAIAgents] = useState<AIAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAIAgents = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setAIAgents([]);
        return;
      }

      // Get user's organization
      const { data: userOrgMember, error: userOrgError } = await supabase
        .from('org_members')
        .select('org_id')
        .eq('user_id', user.id)
        .single();

      if (userOrgError || !userOrgMember) {
        setAIAgents([]);
        return;
      }

      const orgId = userOrgMember.org_id;

      // Fetch AI agents from ai_profiles table
      const { data: aiAgentsData, error: aiAgentsError } = await supabase
        .from('ai_profiles')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false });

      if (aiAgentsError) {
        console.error('Error fetching AI agents:', aiAgentsError);
        setError(aiAgentsError.message);
        return;
      }

      setAIAgents(aiAgentsData || []);
    } catch (error) {
      console.error('Error fetching AI agents:', error);
      setError('Failed to fetch AI agents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAIAgents();
  }, []);

  return {
    aiAgents,
    loading,
    error,
    fetchAIAgents
  };
};
