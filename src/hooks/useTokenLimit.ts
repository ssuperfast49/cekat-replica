import { useState, useEffect } from 'react';
import { supabase, protectedSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useRBAC } from '@/contexts/RBACContext';
import { ROLES } from '@/types/rbac';

export interface TokenLimitData {
  user_id: string;
  display_name: string;
  email: string;
  token_limit_enabled: boolean;
  daily_used_tokens: number;
  max_tokens_per_day: number;
  monthly_used_tokens: number;
  max_tokens_per_month: number;
}

export const useTokenLimit = () => {
  const { user } = useAuth();
  const { hasRole, loading: rbacLoading } = useRBAC();
  const [limits, setLimits] = useState<TokenLimitData[]>([]);
  const [loading, setLoading] = useState(true);

  const isMasterAgent = hasRole(ROLES.MASTER_AGENT);
  const isSuperAgent = hasRole(ROLES.SUPER_AGENT);

  useEffect(() => {
    if (!user || rbacLoading) return;

    let isMounted = true;
    let fallbackInterval: NodeJS.Timeout;

    const fetchTokenLimits = async () => {
      try {
        if (isMasterAgent) {
          // Fetch super agents IDs
          const { data: superAgents, error: saError } = await protectedSupabase
            .from('v_human_agents')
            .select('user_id')
            .ilike('role_name', '%super%');

          if (saError) throw saError;

          const superAgentIds = superAgents?.map((sa: any) => sa.user_id) || [];

          if (superAgentIds.length === 0) {
            if (isMounted) setLimits([]);
            return;
          }

          const { data, error } = await protectedSupabase
            .from('users_profile')
            .select('user_id, display_name, email, token_limit_enabled, daily_used_tokens, max_tokens_per_day, monthly_used_tokens, max_tokens_per_month')
            .in('user_id', superAgentIds)
            .eq('token_limit_enabled', true)
            .order('display_name', { ascending: true });

          if (error) throw error;
          if (isMounted) setLimits(data as TokenLimitData[] || []);
        } else if (isSuperAgent) {
          // Fetch own token limits
          const { data, error } = await protectedSupabase
            .from('users_profile')
            .select('user_id, display_name, email, token_limit_enabled, daily_used_tokens, max_tokens_per_day, monthly_used_tokens, max_tokens_per_month')
            .eq('user_id', user.id)
            .single();

          if (error) throw error;
          if (isMounted && data && (data as any).token_limit_enabled) {
            setLimits([data as TokenLimitData]);
          } else if (isMounted) {
            setLimits([]);
          }
        } else {
          // Basic Agent - fetch parent super agent limit
          const { data: parentData, error: parentError } = await protectedSupabase
            .from('super_agent_members')
            .select('super_agent_id')
            .eq('agent_user_id', user.id)
            .maybeSingle();

          if (parentError) throw parentError;

          const parentId = parentData?.super_agent_id;
          if (parentId) {
            const { data, error } = await protectedSupabase
              .from('users_profile')
              .select('user_id, display_name, email, token_limit_enabled, daily_used_tokens, max_tokens_per_day, monthly_used_tokens, max_tokens_per_month')
              .eq('user_id', parentId)
              .single();

            if (error) throw error;
            if (isMounted && data && (data as any).token_limit_enabled) {
              setLimits([data as TokenLimitData]);
            } else if (isMounted) {
              setLimits([]);
            }
          } else {
            if (isMounted) setLimits([]);
          }
        }
      } catch (error) {
        console.error('Error fetching token limits:', error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchTokenLimits();

    // Set up realtime subscription
    const channel = supabase.channel('users_profile_token_limits')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'users_profile'
      }, () => {
        fetchTokenLimits();
      })
      .subscribe();

    // Fallback polling every 60 seconds (visibility-guarded; realtime handles live updates)
    fallbackInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchTokenLimits();
      }
    }, 60000);

    return () => {
      isMounted = false;
      clearInterval(fallbackInterval);
      try {
        supabase.removeChannel(channel);
      } catch { }
    };
  }, [user, isMasterAgent, isSuperAgent, rbacLoading]);

  return { limits, loading, isMasterAgent, isSuperAgent };
};
