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

      // First try to fetch all AI profiles to see what's available
      const { data: allAiAgentsData, error: allAiAgentsError } = await supabase
        .from('ai_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      console.log('All AI agents data:', allAiAgentsData);
      console.log('All AI agents error:', allAiAgentsError);

      if (allAiAgentsError) {
        console.error('Error fetching all AI agents:', allAiAgentsError);
        // Try with organization-specific query as fallback
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.log('No authenticated user');
          setAIAgents([]);
          return;
        }

        // Get user's organization
        const { data: userOrgMember, error: userOrgError } = await supabase
          .from('org_members')
          .select('org_id')
          .eq('user_id', user.id)
          .maybeSingle();

        console.log('User org member:', userOrgMember);
        console.log('User org error:', userOrgError);

        if (userOrgError || !userOrgMember) {
          console.log('No org membership found, using default org');
          // Try with default org
          const { data: defaultOrgData, error: defaultOrgError } = await supabase
            .from('ai_profiles')
            .select('*')
            .eq('org_id', '00000000-0000-0000-0000-000000000001')
            .order('created_at', { ascending: false });

          console.log('Default org AI agents:', defaultOrgData);
          setAIAgents(defaultOrgData || []);
          return;
        }

        const orgId = userOrgMember.org_id;

        // Fetch AI agents from ai_profiles table for user's org
        const { data: aiAgentsData, error: aiAgentsError } = await supabase
          .from('ai_profiles')
          .select('*')
          .eq('org_id', orgId)
          .order('created_at', { ascending: false });

        console.log('Org-specific AI agents:', aiAgentsData);
        if (aiAgentsError) {
          console.error('Error fetching org AI agents:', aiAgentsError);
          setError(aiAgentsError.message);
          return;
        }

        setAIAgents(aiAgentsData || []);
      } else {
        // If we got all agents successfully, use them
        console.log('Successfully fetched all AI agents:', allAiAgentsData);
        setAIAgents(allAiAgentsData || []);
      }
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
