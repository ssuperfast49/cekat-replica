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

      console.log('Fetching AI agents...');

      // Fetch all AI profiles for selection
      const { data: aiAgentsData, error: aiAgentsError } = await supabase
        .from('ai_profiles')
        .select('*')
        .order('created_at', { ascending: false });

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
    } catch (error) {
      console.error('Error fetching AI agents:', error);
      setError('Failed to fetch AI agents');
      setAIAgents([]);
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
