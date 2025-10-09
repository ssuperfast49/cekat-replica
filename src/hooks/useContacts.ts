import { useState, useEffect } from 'react';
import { supabase, logAction } from '@/lib/supabase';
import { isDocumentHidden, onDocumentVisible } from '@/lib/utils';

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
  channelProvider?: string | null;
  channelType?: string | null;
  chatStatus?: string;
  chatCreatedAt?: string;
  chatCreatedAtISO?: string | null;
  handledBy?: string;
}

export interface ContactsFilter {
  chatStatus?: 'open' | 'pending' | 'closed' | '';
  handledBy?: 'assigned' | 'unassigned' | '';
  dateRange?: { from?: string; to?: string };
}

export const useContacts = () => {
  const [contacts, setContacts] = useState<ContactWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  // Fetch contacts with pagination, search, and filters (server-side as much as possible)
  const fetchContacts = async (
    page: number = 1,
    limit: number = 100,
    searchQuery?: string,
    filters?: ContactsFilter
  ) => {
    try {
      setLoading(true);
      setError(null);

      // Determine whether we need to inner-join threads based on filters
      const needsThreadInnerJoin = !!(filters?.chatStatus || filters?.handledBy || filters?.dateRange?.from || filters?.dateRange?.to);

      let query = supabase
        .from('contacts')
        .select(
          `
          id, org_id, name, email, phone, locale, notes, created_at,
          threads${needsThreadInnerJoin ? '!inner' : ''}(
            status, created_at, assignee_user_id,
            channels(display_name, provider, type)
          )
          `,
          { count: 'exact' }
        )
        .order('created_at', { ascending: false });

      // Apply search filter if provided
      if (searchQuery) {
        query = query.or(`name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`);
      }

      // Apply additional filters (server-side) on nested threads when possible
      if (filters) {
        if (filters.chatStatus) {
          query = query.eq('threads.status', filters.chatStatus);
        }
        if (filters.handledBy === 'unassigned') {
          // contacts whose latest thread has no assignee
          query = query.is('threads.assignee_user_id', null);
        } else if (filters.handledBy === 'assigned') {
          query = query.not('threads.assignee_user_id', 'is', null as any);
        }
        if (filters.dateRange?.from) {
          query = query.gte('threads.created_at', filters.dateRange.from);
        }
        if (filters.dateRange?.to) {
          // Add end-of-day to include the entire 'to' date if only a date string is provided
          const toIso = filters.dateRange.to.length > 10
            ? filters.dateRange.to
            : `${filters.dateRange.to}T23:59:59.999Z`;
          query = query.lte('threads.created_at', toIso);
        }
      }

      // Apply pagination
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to);

      // Ensure we only fetch the latest thread per contact (order + limit on foreign table)
      query = query.order('created_at', { foreignTable: 'threads', ascending: false }).limit(1, { foreignTable: 'threads' });

      const { data, error, count } = await query as any;

      if (error) throw error;

      // Transform data to match the expected format
      let transformedData: ContactWithDetails[] = (data || []).map((row: any) => {
        const lastThread = (row.threads || [])[0] || null;
        const inboxName = lastThread?.channels?.display_name || '—';
        const chatCreated = lastThread?.created_at
          ? new Date(lastThread.created_at).toLocaleString('en-US', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: false,
            }).replace(',', '')
          : '—';

        return {
          id: row.id,
          org_id: row.org_id,
          name: row.name,
          email: row.email,
          phone: row.phone,
          locale: row.locale,
          notes: row.notes,
          created_at: row.created_at,
          labelNames: '',
          inbox: inboxName,
          channelProvider: lastThread?.channels?.provider || null,
          channelType: lastThread?.channels?.type || null,
          chatStatus: lastThread?.status || '—',
          chatCreatedAt: chatCreated,
          chatCreatedAtISO: lastThread?.created_at || null,
          handledBy: lastThread?.assignee_user_id ? 'assigned' : 'unassigned',
        } as ContactWithDetails;
      });

      // Apply client-side filtering
      if (filters) {
        transformedData = transformedData.filter(contact => {
          // Chat Status filter
          if (filters.chatStatus && contact.chatStatus !== filters.chatStatus) {
            return false;
          }

          // Handled By filter
          if (filters.handledBy) {
            if (filters.handledBy === 'unassigned' && contact.handledBy !== '') {
              return false;
            }
            if (filters.handledBy !== 'unassigned' && contact.handledBy !== filters.handledBy) {
              return false;
            }
          }

          // Date Range filter
          if (filters.dateRange?.from || filters.dateRange?.to) {
            const contactDate = new Date(contact.created_at);
            const fromDate = filters.dateRange.from ? new Date(filters.dateRange.from) : null;
            const toDate = filters.dateRange.to ? new Date(filters.dateRange.to) : null;

            if (fromDate && contactDate < fromDate) {
              return false;
            }
            if (toDate && contactDate > toDate) {
              return false;
            }
          }

          return true;
        });
      }

      setContacts(transformedData);
      // Use server count which accounts for applied filters
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

      try { await logAction({ action: 'contact.create', resource: 'contact', resourceId: (data as any)?.id ?? null, context: contactData as any }); } catch {}

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

      try { await logAction({ action: 'contact.update', resource: 'contact', resourceId: contactId, context: updateData as any }); } catch {}

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

      try { await logAction({ action: 'contact.delete', resource: 'contact', resourceId: contactId }); } catch {}

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

      try { await logAction({ action: 'contact.bulk_delete', resource: 'contact', context: { ids: contactIds } }); } catch {}

    } catch (error) {
      console.error('Error deleting contacts:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete contacts');
      throw error;
    }
  };

  // Initial fetch on mount (gate network on visibility)
  useEffect(() => {
    const run = () => fetchContacts();
    run();
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
