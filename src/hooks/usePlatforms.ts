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

      // Get user's organization
      const { data: userOrgMember, error: userOrgError } = await supabase
        .from('org_members')
        .select('org_id')
        .eq('user_id', user.id)
        .single();

      if (userOrgError || !userOrgMember) {
        setPlatforms([]);
        return;
      }

      const orgId = userOrgMember.org_id;

      // Fetch platforms with human agents
      const { data: platformsData, error: platformsError } = await supabase
        .from('platforms')
        .select(`
          *,
          platform_human_agents (
            user_id,
            users_profile!inner (
              display_name,
              email
            )
          )
        `)
        .eq('org_id', orgId)
        .order('created_at', { ascending: false });

      if (platformsError) {
        console.error('Error fetching platforms:', platformsError);
        setError(platformsError.message);
        return;
      }

      // Transform the data to match our interface
      const transformedPlatforms: PlatformWithAgents[] = (platformsData || []).map((platform: any) => ({
        ...platform,
        human_agents: (platform.platform_human_agents || []).map((pa: any) => ({
          user_id: pa.user_id,
          display_name: pa.users_profile?.display_name,
          email: pa.users_profile?.email
        }))
      }));

      setPlatforms(transformedPlatforms);
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

      // Get user's organization
      const { data: userOrgMember, error: userOrgError } = await supabase
        .from('org_members')
        .select('org_id')
        .eq('user_id', user.id)
        .single();

      if (userOrgError || !userOrgMember) {
        throw new Error('User not found in any organization');
      }

      const orgId = userOrgMember.org_id;

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
           ai_profile_id: platformData.ai_agent_id, // Changed from ai_agent_id to ai_profile_id
         })
         .select()
         .single();

      if (platformError) {
        throw platformError;
      }

      // Add human agents if provided
      if (platformData.human_agent_ids && platformData.human_agent_ids.length > 0) {
        const humanAgentData = platformData.human_agent_ids.map(userId => ({
          platform_id: newPlatform.id,
          user_id: userId
        }));

        const { error: humanAgentsError } = await supabase
          .from('platform_human_agents')
          .insert(humanAgentData);

        if (humanAgentsError) {
          console.error('Error adding human agents:', humanAgentsError);
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
