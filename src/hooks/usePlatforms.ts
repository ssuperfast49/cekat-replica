import { useState, useEffect } from 'react';
import { supabase, logAction } from '@/lib/supabase';

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

      // Map channels to platform-like objects and attach human agents (org members)
      const platformsWithAgents = await Promise.all(
        (channelsData || []).map(async (ch: any) => {
          const { data: orgMembers, error: orgMembersError } = await supabase
            .from('org_members')
            .select(`
              user_id,
              role,
              users_profile!inner (
                display_name,
                email
              )
            `)
            .eq('org_id', ch.org_id);

          if (orgMembersError) {
            console.error('Error fetching org members for platform:', orgMembersError);
            return {
              ...ch,
              provider: ch.provider,
              status: ch.is_active ? 'active' : 'inactive',
              human_agents: []
            };
          }

          return {
            ...ch,
            provider: ch.provider,
            status: ch.is_active ? 'active' : 'inactive',
            human_agents: (orgMembers || []).map((member: any) => ({
              user_id: member.user_id,
              display_name: member.users_profile?.display_name,
              email: member.users_profile?.email,
              role: member.role
            }))
          };
        })
      );

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
          is_active: true,
        })
        .select()
        .single();

      if (platformError) {
        throw platformError;
      }

      // Do not modify org_members on platform creation

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

  const updatePlatform = async (platformId: string, updates: Partial<CreatePlatformData>) => {
    try {
      setError(null);

      const { error: platformError } = await supabase
        .from('channels')
        .update({
          display_name: updates.display_name,
          profile_photo_url: updates.profile_photo_url,
          ai_profile_id: updates.ai_profile_id,
          provider: updates.provider,
        })
        .eq('id', platformId);

      if (platformError) {
        throw platformError;
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
    fetchPlatforms();
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
