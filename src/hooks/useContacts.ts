import { useState, useEffect, useRef } from 'react';
import { supabase, logAction, protectedSupabase } from '@/lib/supabase';
import { defaultFallbackHandler } from '@/lib/fallbackHandler';
import { isDocumentHidden, onDocumentVisible } from '@/lib/utils';
import { AUTHZ_CHANGED_EVENT } from '@/lib/authz';

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
  chatStatus?: 'open' | 'pending' | 'closed' | 'assigned' | '';
  handledBy?: 'assigned' | 'unassigned' | '';
  dateRange?: { from?: string; to?: string };
}

interface UseContactsOptions {
  autoFetch?: boolean;
}

export const useContacts = (options: UseContactsOptions = {}) => {
  const { autoFetch = false } = options;
  const [contacts, setContacts] = useState<ContactWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const lastQueryRef = useRef<{ page: number; limit: number; searchQuery?: string; filters?: ContactsFilter }>({
    page: 1,
    limit: 20,
    searchQuery: undefined,
    filters: undefined,
  });

  const formatChatCreatedAt = (iso?: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).replace(',', '');
  };

  const getThreadChannel = (thread: any) => {
    if (!thread?.channels) return null;
    return Array.isArray(thread.channels) ? (thread.channels[0] || null) : thread.channels;
  };

  const toContactWithDetails = (row: any, lastThread: any): ContactWithDetails => {
    const channel = getThreadChannel(lastThread);
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
      inbox: channel?.display_name || '—',
      channelProvider: channel?.provider || null,
      channelType: channel?.type || null,
      chatStatus: lastThread?.status || '—',
      chatCreatedAt: formatChatCreatedAt(lastThread?.created_at || null),
      chatCreatedAtISO: lastThread?.created_at || null,
      handledBy: lastThread?.assignee_user_id ? 'assigned' : 'unassigned',
    } as ContactWithDetails;
  };

  // Fetch contacts with pagination, search, and filters (server-side as much as possible)
  const fetchContacts = async (
    page: number = 1,
    limit: number = 20,
    searchQuery?: string,
    filters?: ContactsFilter
  ) => {
    try {
      lastQueryRef.current = { page, limit, searchQuery, filters };
      setLoading(true);
      setError(null);

      // Determine whether we need to inner-join threads based on filters
      const needsThreadInnerJoin = !!(
        filters?.chatStatus ||
        filters?.dateRange?.from ||
        filters?.dateRange?.to ||
        filters?.handledBy === 'assigned'
      );

      const searchTerm = searchQuery?.trim();
      const hasSearch = !!searchTerm;
      const countStrategy = needsThreadInnerJoin || hasSearch ? 'exact' : 'planned';

      // Apply pagination
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      // Fast path: page contacts first, then resolve latest thread for those visible contacts only.
      if (!needsThreadInnerJoin) {
        let contactsQuery = protectedSupabase
          .from('contacts')
          .select('id, org_id, name, email, phone, locale, notes, created_at', { count: countStrategy })
          .order('created_at', { ascending: false });

        if (hasSearch) {
          contactsQuery = contactsQuery.or(`name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
        }

        contactsQuery = contactsQuery.range(from, to);

        const { data: contactsData, error: contactsError, count } = await contactsQuery as any;
        if (contactsError) throw contactsError;

        const contactIds = (contactsData || []).map((row: any) => row.id).filter(Boolean);
        const latestThreadByContact = new Map<string, any>();

        if (contactIds.length > 0) {
          const { data: threadRows, error: threadError } = await protectedSupabase
            .from('threads')
            .select(`
              id, contact_id, status, created_at, assignee_user_id,
              channels(display_name, provider, type)
            `)
            .in('contact_id', contactIds)
            .order('contact_id', { ascending: true })
            .order('created_at', { ascending: false });

          if (threadError) throw threadError;

          for (const thread of (threadRows || [])) {
            if (thread?.contact_id && !latestThreadByContact.has(thread.contact_id)) {
              latestThreadByContact.set(thread.contact_id, thread);
            }
          }
        }

        let transformedData: ContactWithDetails[] = (contactsData || []).map((row: any) =>
          toContactWithDetails(row, latestThreadByContact.get(row.id) || null)
        );

        // Keep this client-side for "unassigned" so we don't force the heavy inner-join path.
        if (filters?.handledBy) {
          transformedData = transformedData.filter(contact => contact.handledBy === filters.handledBy);
        }

        setContacts(transformedData);
        setTotalCount(count || 0);
        return;
      }

      let query = protectedSupabase
        .from('contacts')
        .select(
          `
          id, org_id, name, email, phone, locale, notes, created_at,
          threads!inner(
            id, status, created_at, assignee_user_id,
            channels(display_name, provider, type)
          )
          `,
          { count: countStrategy }
        )
        .order('created_at', { ascending: false });

      // Apply search filter if provided
      if (hasSearch) {
        query = query.or(`name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
      }

      // Apply additional filters (server-side) on nested threads when possible
      if (filters) {
        if (filters.chatStatus) {
          query = query.eq('threads.status', filters.chatStatus);
        }
        if (filters.handledBy === 'assigned') {
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

      query = query.range(from, to);

      // Ensure we only fetch the latest thread per contact (order + limit on foreign table)
      query = query.order('created_at', { foreignTable: 'threads', ascending: false }).limit(1, { foreignTable: 'threads' });

      const { data, error, count } = await query as any;

      if (error) throw error;

      // Transform data to match the expected format
      let transformedData: ContactWithDetails[] = (data || []).map((row: any) => {
        const lastThread = (row.threads || [])[0] || null;
        return toContactWithDetails(row, lastThread);
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
            if (contact.handledBy !== filters.handledBy) {
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

      const { data, error } = await protectedSupabase
        .from('contacts')
        .insert([{
          ...contactData,
          org_id: '00000000-0000-0000-0000-000000000001', // Default org ID
        }])
        .select()
        .single();

      if (error) throw error;

      // Refresh contacts list with the last-used query params
      await fetchContacts(
        lastQueryRef.current.page,
        lastQueryRef.current.limit,
        lastQueryRef.current.searchQuery,
        lastQueryRef.current.filters
      );

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

      const { error } = await protectedSupabase
        .from('contacts')
        .update(updateData)
        .eq('id', contactId);

      if (error) throw error;

      // Refresh contacts list with the last-used query params
      await fetchContacts(
        lastQueryRef.current.page,
        lastQueryRef.current.limit,
        lastQueryRef.current.searchQuery,
        lastQueryRef.current.filters
      );

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

      defaultFallbackHandler.invalidatePattern('^query:contacts');

      // Refresh contacts list with the last-used query params
      await fetchContacts(
        lastQueryRef.current.page,
        lastQueryRef.current.limit,
        lastQueryRef.current.searchQuery,
        lastQueryRef.current.filters
      );

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

      defaultFallbackHandler.invalidatePattern('^query:contacts');

      // Refresh contacts list with the last-used query params
      await fetchContacts(
        lastQueryRef.current.page,
        lastQueryRef.current.limit,
        lastQueryRef.current.searchQuery,
        lastQueryRef.current.filters
      );

      try { await logAction({ action: 'contact.bulk_delete', resource: 'contact', context: { ids: contactIds } }); } catch {}

    } catch (error) {
      console.error('Error deleting contacts:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete contacts');
      throw error;
    }
  };

  // Initial fetch on mount (gate network on visibility)
  useEffect(() => {
    if (!autoFetch) return;
    const run = () => fetchContacts();
    run();
  }, [autoFetch]);

  // Authorization changes: clear current UI state and refetch with last-used query params.
  useEffect(() => {
    const handler = () => {
      try {
        setContacts([]);
        setTotalCount(0);
        setError(null);
        setLoading(true);
      } catch {}
      try {
        const { page, limit, searchQuery, filters } = lastQueryRef.current;
        fetchContacts(page, limit, searchQuery, filters);
      } catch {}
    };
    try {
      window.addEventListener(AUTHZ_CHANGED_EVENT as any, handler as any);
    } catch {}
    return () => {
      try { window.removeEventListener(AUTHZ_CHANGED_EVENT as any, handler as any); } catch {}
    };
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
