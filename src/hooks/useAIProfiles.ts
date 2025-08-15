import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface AIProfile {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  system_prompt: string;
  welcome_message: string;
  transfer_conditions: string;
  stop_ai_after_handoff: boolean;
  model: string;
  temperature: number;
  created_at: string;
}

export const useAIProfiles = (profileId?: string) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<AIProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch AI profile data
  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (profileId) {
        // Fetch specific profile by ID
        const { data, error } = await supabase
          .from('ai_profiles')
          .select('*')
          .eq('id', profileId)
          .single();
          
        if (error) throw error;
        if (data) {
          setProfile(data);
        }
      } else {
        // Fetch first available profile
        const { data, error } = await supabase
          .from('ai_profiles')
          .select('*')
          .limit(1)
          .single();
          
        if (error) throw error;
        if (data) {
          setProfile(data);
        }
      }
    } catch (error) {
      console.error('Error fetching AI profile:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch profile');
    } finally {
      setLoading(false);
    }
  };

  // Save AI profile
  const saveProfile = async (updateData: Partial<AIProfile>) => {
    try {
      setSaving(true);
      setError(null);
      
      if (profile?.id) {
        // Update existing profile
        const { error } = await supabase
          .from('ai_profiles')
          .update(updateData)
          .eq('id', profile.id);
          
        if (error) throw error;
      } else {
        // Create new profile
        const { data, error } = await supabase
          .from('ai_profiles')
          .insert([{
            ...updateData,
            org_id: '00000000-0000-0000-0000-000000000001', // Default org ID
          }])
          .select()
          .single();
          
        if (error) throw error;
        if (data) {
          setProfile(data);
        }
      }
      
      // Refresh profile data
      await fetchProfile();
      
    } catch (error) {
      console.error('Error saving AI profile:', error);
      setError(error instanceof Error ? error.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  // Fetch all profiles for an organization
  const fetchAllProfiles = async (orgId?: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('ai_profiles')
        .select('*')
        .eq('org_id', orgId || '00000000-0000-0000-0000-000000000001')
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching AI profiles:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch profiles');
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Delete AI profile
  const deleteProfile = async (profileId: string) => {
    try {
      setSaving(true);
      setError(null);
      
      const { error } = await supabase
        .from('ai_profiles')
        .delete()
        .eq('id', profileId);
        
      if (error) throw error;
      
    } catch (error) {
      console.error('Error deleting AI profile:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete profile');
      throw error;
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [profileId]);

  return {
    profile,
    loading,
    saving,
    error,
    fetchProfile,
    saveProfile,
    fetchAllProfiles,
    deleteProfile,
  };
};
