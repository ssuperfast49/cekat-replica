import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type ChannelProvider = 'whatsapp' | 'web' | 'telegram';

export interface Channel {
  id: string;
  org_id: string;
  type: string;
  provider: ChannelProvider;
  credentials?: Record<string, unknown> | null;
  display_name?: string | null;
  is_active?: boolean | null;
  created_at?: string;
}

export const useChannels = () => {
  const [channelsByOrg, setChannelsByOrg] = useState<Record<string, Channel[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchByOrgId = useCallback(async (orgId: string) => {
    if (!orgId) return [] as Channel[];
    try {
      setLoading(true);
      setError(null);
      const { data, error: err } = await supabase
        .from('channels')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false });
      if (err) {
        setError(err.message);
        return [] as Channel[];
      }
      const list = (data || []) as Channel[];
      setChannelsByOrg(prev => ({ ...prev, [orgId]: list }));
      return list;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch channels');
      return [] as Channel[];
    } finally {
      setLoading(false);
    }
  }, []);

  return { channelsByOrg, loading, error, fetchByOrgId };
};


