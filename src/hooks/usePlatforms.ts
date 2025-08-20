import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface Platform {
  id: string;
  org_id: string;
  brand_name: string;
  website_url?: string;
  business_category?: string;
  description?: string;
  whatsapp_display_name: string;
  profile_photo_url?: string;
  whatsapp_number: string;
  ai_profile_id?: string; // Changed from ai_agent_id to ai_profile_id
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
  brand_name: string;
  website_url?: string;
  business_category?: string;
  description?: string;
  whatsapp_display_name: string;
  profile_photo_url?: string;
  whatsapp_number: string;
  ai_profile_id?: string; // Changed from ai_agent_id to ai_profile_id
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

      // Fetch platforms for all user's organizations
      const { data: platformsData, error: platformsError } = await supabase
        .from('platforms')
        .select(`
          *,
          orgs!inner (
            name
          )
        `)
        .in('org_id', orgIds)
        .order('created_at', { ascending: false });

      if (platformsError) {
        console.error('Error fetching platforms:', platformsError);
        setError(platformsError.message);
        return;
      }

      // For each platform, get the human agents (org members)
      const platformsWithAgents = await Promise.all(
        (platformsData || []).map(async (platform: any) => {
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
            .eq('org_id', platform.org_id);

          if (orgMembersError) {
            console.error('Error fetching org members for platform:', orgMembersError);
            return {
              ...platform,
              human_agents: []
            };
          }

          return {
            ...platform,
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

      // Create new organization
      const { data: newOrg, error: orgError } = await supabase
        .from('orgs')
        .insert({
          name: platformData.brand_name
        })
        .select()
        .single();

      if (orgError) {
        throw orgError;
      }

      const orgId = newOrg.id;

      // Add current user as owner of the new organization
      const { error: ownerError } = await supabase
        .from('org_members')
        .insert({
          org_id: orgId,
          user_id: user.id,
          role: 'owner'
        });

      if (ownerError) {
        console.error('Error adding current user as owner:', ownerError);
      }

      // Create platform
      const { data: newPlatform, error: platformError } = await supabase
        .from('platforms')
        .insert({
          org_id: orgId,
          brand_name: platformData.brand_name,
          website_url: platformData.website_url,
          business_category: platformData.business_category,
          description: platformData.description,
          whatsapp_display_name: platformData.whatsapp_display_name,
          profile_photo_url: platformData.profile_photo_url,
          whatsapp_number: platformData.whatsapp_number,
          ai_profile_id: platformData.ai_profile_id,
        })
        .select()
        .single();

      if (platformError) {
        throw platformError;
      }

      // Add selected human agents to the new organization
      if (platformData.human_agent_ids && platformData.human_agent_ids.length > 0) {
        const orgMemberData = platformData.human_agent_ids.map(userId => ({
          org_id: orgId,
          user_id: userId,
          role: 'agent'
        }));

        const { error: orgMembersError } = await supabase
          .from('org_members')
          .insert(orgMemberData);

        if (orgMembersError) {
          console.error('Error adding human agents to organization:', orgMembersError);
        }
      }

      // Refresh platforms list
      await fetchPlatforms();

      return newPlatform;
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
        .from('platforms')
        .update(updates)
        .eq('id', platformId);

      if (platformError) {
        throw platformError;
      }

      // Update human agents if provided
      if (updates.human_agent_ids !== undefined) {
        // Remove existing human agents
        const { error: deleteError } = await supabase
          .from('platform_human_agents')
          .delete()
          .eq('platform_id', platformId);

        if (deleteError) {
          console.error('Error removing human agents:', deleteError);
        }

        // Add new human agents
        if (updates.human_agent_ids.length > 0) {
          const humanAgentData = updates.human_agent_ids.map(userId => ({
            platform_id: platformId,
            user_id: userId
          }));

          const { error: insertError } = await supabase
            .from('platform_human_agents')
            .insert(humanAgentData);

          if (insertError) {
            console.error('Error adding human agents:', insertError);
          }
        }
      }

      // Refresh platforms list
      await fetchPlatforms();
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
        .from('platforms')
        .delete()
        .eq('id', platformId);

      if (error) {
        throw error;
      }

      // Refresh platforms list
      await fetchPlatforms();
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
