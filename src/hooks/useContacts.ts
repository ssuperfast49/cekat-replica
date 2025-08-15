import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface Contact {
  id: string;
  org_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  locale: string | null;
  stage_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface ContactWithDetails extends Contact {
  // Additional fields for display
  labelNames?: string;
  inbox?: string;
  pipelineStatus?: string;
  chatStatus?: string;
  chatCreatedAt?: string;
  handledBy?: string;
}

export const useContacts = () => {
  const [contacts, setContacts] = useState<ContactWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  // Fetch contacts with pagination and search
  const fetchContacts = async (page: number = 1, limit: number = 100, searchQuery?: string) => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('contacts')
        .select('*', { count: 'exact' })
        .eq('org_id', '00000000-0000-0000-0000-000000000001') // Default org ID
        .order('created_at', { ascending: false });

      // Apply search filter if provided
      if (searchQuery) {
        query = query.or(`name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`);
      }

      // Apply pagination
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      // Transform data to match the expected format
      const transformedData: ContactWithDetails[] = (data || []).map((contact: Contact) => ({
        ...contact,
        labelNames: '', // Will be populated from contact_labels table if needed
        inbox: 'OKBANG TOP UP CENTER', // Default value
        pipelineStatus: '', // Will be populated from crm_stages table if needed
        chatStatus: 'resolved', // Default value
        chatCreatedAt: new Date(contact.created_at).toLocaleString('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }).replace(',', ''),
        handledBy: ''
      }));

      setContacts(transformedData);
      setTotalCount(count || 0);

    } catch (error) {
      console.error('Error fetching contacts:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch contacts');
    } finally {
      setLoading(false);
    }
  };

  // Create new contact
  const createContact = async (contactData: Partial<Contact>) => {
    try {
      setError(null);

      const { data, error } = await supabase
        .from('contacts')
        .insert([{
          ...contactData,
          org_id: '00000000-0000-0000-0000-000000000001', // Default org ID
        }])
        .select()
        .single();

      if (error) throw error;

      // Refresh contacts list
      await fetchContacts();

      return data;
    } catch (error) {
      console.error('Error creating contact:', error);
      setError(error instanceof Error ? error.message : 'Failed to create contact');
      throw error;
    }
  };

  // Update contact
  const updateContact = async (contactId: string, updateData: Partial<Contact>) => {
    try {
      setError(null);

      const { error } = await supabase
        .from('contacts')
        .update(updateData)
        .eq('id', contactId);

      if (error) throw error;

      // Refresh contacts list
      await fetchContacts();

    } catch (error) {
      console.error('Error updating contact:', error);
      setError(error instanceof Error ? error.message : 'Failed to update contact');
      throw error;
    }
  };

  // Delete contact
  const deleteContact = async (contactId: string) => {
    try {
      setError(null);

      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', contactId);

      if (error) throw error;

      // Refresh contacts list
      await fetchContacts();

    } catch (error) {
      console.error('Error deleting contact:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete contact');
      throw error;
    }
  };

  // Delete multiple contacts
  const deleteMultipleContacts = async (contactIds: string[]) => {
    try {
      setError(null);

      const { error } = await supabase
        .from('contacts')
        .delete()
        .in('id', contactIds);

      if (error) throw error;

      // Refresh contacts list
      await fetchContacts();

    } catch (error) {
      console.error('Error deleting contacts:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete contacts');
      throw error;
    }
  };

  // Initial fetch on mount
  useEffect(() => {
    fetchContacts();
  }, []);

  return {
    contacts,
    loading,
    error,
    totalCount,
    fetchContacts,
    createContact,
    updateContact,
    deleteContact,
    deleteMultipleContacts,
  };
};
