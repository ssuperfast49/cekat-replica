import { useState, useEffect } from 'react';
import { supabase, logAction } from '@/lib/supabase';
import { isDocumentHidden, onDocumentVisible } from '@/lib/utils';

export interface Platform {
  id: string;
  org_id: string;
  display_name?: string;
  website_url?: string;
  business_category?: string;
  description?: string;
  profile_photo_url?: string;
  ai_profile_id?: string; // Changed from ai_agent_id to ai_profile_id
  provider?: 'whatsapp' | 'web' | 'telegram';
  status: 'active' | 'inactive' | 'pending';
  created_at: string;
  updated_at: string;
}

export interface PlatformWithAgents extends Platform {
  human_agents: Array<{
    user_id: string;
    display_name?: string;
    email?: string;
  }>;
  super_agent_id?: string | null;
  credentials?: any;
}

export interface CreatePlatformData {
  display_name: string;
  website_url?: string;
  business_category?: string;
  description?: string;
  profile_photo_url?: string;
  ai_profile_id?: string; // Changed from ai_agent_id to ai_profile_id
  provider: 'whatsapp' | 'web' | 'telegram';
  human_agent_ids?: string[];
  super_agent_id?: string;
}

export const usePlatforms = () => {
  const [platforms, setPlatforms] = useState<PlatformWithAgents[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlatforms = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setPlatforms([]);
        return;
      }

      // Get all organizations the user is a member of
      const { data: userOrgs, error: userOrgsError } = await supabase
        .from('org_members')
        .select('org_id')
        .eq('user_id', user.id);

      if (userOrgsError || !userOrgs || userOrgs.length === 0) {
        setPlatforms([]);
        return;
      }

      const orgIds = userOrgs.map(org => org.org_id);

      // Determine current user's role profile
      const { data: userRoleRows } = await supabase
        .from('user_roles')
        .select('role_id')
        .eq('user_id', user.id);
      let isMaster = false, isSuper = false, isAgentOnly = false;
      if (userRoleRows && userRoleRows.length > 0) {
        const roleIds = userRoleRows.map(r => r.role_id);
        const { data: roleDefs } = await supabase
          .from('roles')
          .select('id, name')
          .in('id', roleIds);
        const names = (roleDefs || []).map(r => (r.name || '').toLowerCase());
        isMaster = names.includes('master_agent');
        isSuper = names.includes('super_agent');
        isAgentOnly = names.includes('agent') && !isMaster && !isSuper;
      }

      // If the user is a regular agent, prefetch allowed channel_ids
      let allowedChannelIds: Set<string> | null = null;
      if (isAgentOnly) {
        const { data: caMine } = await supabase
          .from('channel_agents')
          .select('channel_id')
          .eq('user_id', user.id);
        allowedChannelIds = new Set((caMine || []).map(r => r.channel_id));
      }

      // Fetch channels for all user's organizations (platforms merged into channels)
      const { data: channelsData, error: channelsError } = await supabase
        .from('channels')
        .select(`
          *
        `)
        .in('org_id', orgIds)
        .order('created_at', { ascending: false });

      if (channelsError) {
        console.error('Error fetching channels:', channelsError);
        setError(channelsError.message);
        return;
      }

      // Batch-fetch all org members once for these orgs, then map per org_id
      const { data: allMembers, error: allMembersError } = await supabase
        .from('org_members')
        .select(`
          org_id,
          user_id,
          role,
          v_users!inner (
            display_name,
            email
          )
        `)
        .in('org_id', orgIds);

      if (allMembersError) {
        console.error('Error fetching org members for platforms:', allMembersError);
      }

      const membersByOrg: Record<string, any[]> = {};
      for (const m of allMembers || []) {
        const key = m.org_id as string;
        if (!membersByOrg[key]) membersByOrg[key] = [];
        membersByOrg[key].push(m);
      }

      // Optionally restrict to assigned channels for agents
      const filteredChannels = (channelsData || []).filter((ch: any) => {
        if (!allowedChannelIds) return true; // master/super see all
        return allowedChannelIds.has(ch.id);
      });

      // Map channels and attach human agents based on channel_agents
      const platformsWithAgents = await Promise.all(filteredChannels.map(async (ch: any) => {
        try {
          const { data: ca } = await supabase
            .from('channel_agents')
            .select('user_id')
            .eq('channel_id', ch.id);
          const ids = (ca || []).map((r: any) => r.user_id);
          let profiles: any[] = [];
          if (ids.length > 0) {
            // Prefer users_profile.display_name; fall back to v_users
            const [profRes, vuserRes] = await Promise.all([
              supabase
                .from('users_profile')
                .select('user_id, display_name')
                .in('user_id', ids),
              supabase
                .from('v_users')
                .select('id, display_name, email')
                .in('id', ids)
            ]);
            const profs = profRes.data || [];
            const vus = vuserRes.data || [];
            const byId: Record<string, { display_name?: string | null; email?: string | null }> = {};
            vus.forEach((v: any) => { byId[v.id] = { display_name: v.display_name, email: v.email }; });
            profs.forEach((p: any) => { byId[p.user_id] = { display_name: p.display_name ?? byId[p.user_id]?.display_name, email: byId[p.user_id]?.email }; });
            profiles = Object.entries(byId).map(([user_id, val]) => ({ user_id, ...val }));
          }
          const humanAgents = ids.map((uid: string) => {
            const prof = profiles.find((x: any) => x.user_id === uid || x.id === uid) || {} as any;
            return { user_id: uid, display_name: prof.display_name || prof?.display_name, email: prof.email };
          });
          return {
            ...ch,
            provider: ch.provider,
            status: ch.is_active ? 'active' : 'inactive',
            human_agents: humanAgents,
            super_agent_id: ch.super_agent_id ?? null,
            credentials: ch?.credentials ?? null,
          } as PlatformWithAgents;
        } catch {
          return {
            ...ch,
            provider: ch.provider,
            status: ch.is_active ? 'active' : 'inactive',
            human_agents: [],
            super_agent_id: ch.super_agent_id ?? null,
            credentials: ch?.credentials ?? null,
          } as PlatformWithAgents;
        }
      }));

      setPlatforms(platformsWithAgents);
    } catch (error) {
      console.error('Error fetching platforms:', error);
      setError('Failed to fetch platforms');
    } finally {
      setLoading(false);
    }
  };

  const createPlatform = async (platformData: CreatePlatformData) => {
    try {
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Use existing organization of the current user
      const { data: userOrgs, error: userOrgsError } = await supabase
        .from('org_members')
        .select('org_id')
        .eq('user_id', user.id)
        .limit(1);

      if (userOrgsError) {
        throw userOrgsError;
      }
      const orgId = userOrgs?.[0]?.org_id;
      if (!orgId) {
        throw new Error('User not found in any organization');
      }

      // Create channel (formerly platform)
      const { data: newChannel, error: platformError } = await supabase
        .from('channels')
        .insert({
          org_id: orgId,
          display_name: platformData.display_name,
          credentials: {},
          provider: platformData.provider,
          type: 'inbox',
          profile_photo_url: platformData.profile_photo_url,
          ai_profile_id: platformData.ai_profile_id,
          super_agent_id: platformData.super_agent_id,
          is_active: true,
        })
        .select()
        .single();

      if (platformError) {
        throw platformError;
      }

      // Attach selected human agents to the channel
      if (platformData.human_agent_ids && platformData.human_agent_ids.length > 0) {
        const rows = platformData.human_agent_ids.map(uid => ({ channel_id: (newChannel as any).id, user_id: uid }));
        const { error: caErr } = await supabase.from('channel_agents').insert(rows);
        if (caErr) console.warn('Failed to attach channel agents on create:', caErr);
      }

      // Refresh platforms list
      await fetchPlatforms();

      try { await logAction({ action: 'channel.create', resource: 'channel', resourceId: (newChannel as any)?.id ?? null, context: platformData as any }); } catch {}

      return newChannel;
    } catch (error: any) {
      console.error('Error creating platform:', error);
      setError(error.message || 'Failed to create platform');
      throw error;
    }
  };

  const updatePlatform = async (platformId: string, updates: Partial<CreatePlatformData & { super_agent_id?: string }>) => {
    try {
      setError(null);

      // Only send defined fields to avoid unintentionally nulling columns
      const channelUpdates: Record<string, any> = {};
      if (typeof updates.display_name !== 'undefined') channelUpdates.display_name = updates.display_name;
      if (typeof updates.profile_photo_url !== 'undefined') channelUpdates.profile_photo_url = updates.profile_photo_url;
      if (typeof updates.ai_profile_id !== 'undefined') channelUpdates.ai_profile_id = updates.ai_profile_id;
      if (typeof updates.provider !== 'undefined') channelUpdates.provider = updates.provider;
      if (typeof updates.super_agent_id !== 'undefined') channelUpdates.super_agent_id = updates.super_agent_id;

      if (Object.keys(channelUpdates).length > 0) {
        const { error: platformError } = await supabase
          .from('channels')
          .update(channelUpdates)
          .eq('id', platformId);
        if (platformError) {
          throw platformError;
        }
      }


      // Update human agents if provided
      if (updates.human_agent_ids !== undefined) {
        // Remove existing human agents
        const { error: deleteError } = await supabase
          .from('channel_agents')
          .delete()
          .eq('channel_id', platformId);

        if (deleteError) {
          console.error('Error removing human agents:', deleteError);
        }

        // Add new human agents
        if (updates.human_agent_ids.length > 0) {
          const humanAgentData = updates.human_agent_ids.map(userId => ({
            channel_id: platformId,
            user_id: userId
          }));

          const { error: insertError } = await supabase
            .from('channel_agents')
            .insert(humanAgentData);

          if (insertError) {
            console.error('Error adding human agents:', insertError);
          }
        }
      }

      // Refresh platforms list
      await fetchPlatforms();

      try { await logAction({ action: 'channel.update', resource: 'channel', resourceId: platformId, context: updates as any }); } catch {}
    } catch (error: any) {
      console.error('Error updating platform:', error);
      setError(error.message || 'Failed to update platform');
      throw error;
    }
  };

  const deletePlatform = async (platformId: string) => {
    try {
      setError(null);

      const { error } = await supabase
        .from('channels')
        .delete()
        .eq('id', platformId);

      if (error) {
        throw error;
      }

      // Refresh platforms list
      await fetchPlatforms();

      try { await logAction({ action: 'channel.delete', resource: 'channel', resourceId: platformId }); } catch {}
    } catch (error: any) {
      console.error('Error deleting platform:', error);
      setError(error.message || 'Failed to delete platform');
      throw error;
    }
  };

  const uploadProfilePhoto = async (file: File): Promise<string> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `platform-photos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error: any) {
      console.error('Error uploading profile photo:', error);
      throw new Error('Failed to upload profile photo');
    }
  };

  useEffect(() => {
    const run = () => fetchPlatforms();
    run();
  }, []);

  return {
    platforms,
    loading,
    error,
    fetchPlatforms,
    createPlatform,
    updatePlatform,
    deletePlatform,
    uploadProfilePhoto
  };
};
