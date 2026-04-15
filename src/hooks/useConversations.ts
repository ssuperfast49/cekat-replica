import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, logAction, protectedSupabase } from '@/lib/supabase';
import { defaultFallbackHandler } from '@/lib/fallbackHandler';
import { waitForAuthReady } from '@/lib/authReady';
import WEBHOOK_CONFIG from '@/config/webhook';
import { callWebhook } from '@/lib/webhookClient';
import { resolveSendMessageEndpoint } from '@/config/webhook';
import { isDocumentHidden } from '@/lib/utils';
import { startOfDay, endOfDay } from 'date-fns';
import { AUTHZ_CHANGED_EVENT } from '@/lib/authz';
import { SUPABASE_URL } from '@/config/supabase';
import { getCachedThread } from '@/lib/threadCache';

// Audio notification system moved to GlobalMessageListener


export interface Thread {
  id: string;
  org_id: string;
  contact_id: string;
  channel_id: string;
  account_id?: string | null;
  status: 'open' | 'pending' | 'closed' | 'assigned';
  assignee_user_id: string | null;
  collaborator_user_id?: string | null;
  assigned_by_user_id?: string | null;
  resolved_by_user_id?: string | null;
  ai_handoff_at?: string | null;
  assigned_at?: string | null;
  resolved_at?: string | null;
  is_blocked?: boolean;
  ai_access_enabled?: boolean;
  notes?: string | null;
  additional_data?: any;
  last_msg_at: string;
  created_at: string;
  handover_reason?: string | null;
  blocked_until?: string | null;
}

export interface Message {
  id: string;
  thread_id: string;
  direction: 'in' | 'out' | null;
  role: 'user' | 'assistant' | 'agent' | 'system';
  type: 'text' | 'image' | 'video' | 'file' | 'voice' | 'event' | 'note';
  body: string | null;
  payload: any | null;
  actor_kind: 'customer' | 'agent' | 'ai' | 'system' | null;
  actor_id: string | null;
  seq: number;
  in_reply_to: string | null;
  edited_at: string | null;
  edit_reason: string | null;
  created_at: string;
}

export interface ConversationWithDetails extends Thread {
  // Additional fields for display
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  channel_name: string;
  channel_type: string;
  channel_provider?: string;
  channel?: {
    provider?: string;
    type?: string;
    display_name?: string;
    external_id?: string;
    logo_url?: string | null;
    profile_photo_url?: string | null;
    super_agent_id?: string | null;
  };
  channel_logo_url?: string | null;
  last_message_preview: string;
  last_message_direction?: 'in' | 'out' | null;
  last_message_role?: 'user' | 'assistant' | 'agent' | 'system' | null;
  message_count: number;
  assigned: boolean;
  assigned_by_name?: string;
  assignee_name?: string;
  resolved_by_name?: string;
  unreplied?: boolean;
  unread_count?: number;
  super_agent_id?: string | null;
  super_agent_name?: string | null;
  assignee_last_seen_at?: string | null;
  super_agent_last_seen_at?: string | null;
}

export interface MessageWithDetails extends Message {
  // Additional fields for display
  contact_name: string;
  contact_avatar: string;
  // UI-only status flag for optimistic updates
  _status?: 'pending' | 'sent' | 'error';
}

export interface ThreadFilters {
  dateRange?: {
    from?: Date;
    to?: Date;
  };
  inbox?: string;
  label?: string[];
  agent?: string;
  status?: string;
  resolvedBy?: string;
  platformId?: string;
  channelType?: string;
  search?: string;
}

export type ConversationStatusScope = 'assigned' | 'unassigned' | 'done' | 'all';

export const useConversations = (options?: {
  unreadEnabled?: boolean;
  statusScope?: ConversationStatusScope;
  pageSize?: number;
}) => {
  const unreadEnabled = options?.unreadEnabled ?? true;
  const defaultPageSize = Math.max(1, Math.min(200, options?.pageSize ?? 10));
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
  const [messages, setMessages] = useState<MessageWithDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const filtersRef = useRef<ThreadFilters>({});
  const statusScopeRef = useRef<ConversationStatusScope>(options?.statusScope ?? 'all');
  const statusScopePrevRef = useRef<ConversationStatusScope>(statusScopeRef.current);
  const paginationRef = useRef({ page: 1, pageSize: defaultPageSize });
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: defaultPageSize,
    total: 0,
    totalPages: 1,
  });
  const [tabCounts, setTabCounts] = useState({
    assigned: 0,
    unassigned: 0,
    done: 0,
  });

  // Refs for accessing latest state in realtime callbacks
  const conversationsRef = useRef<ConversationWithDetails[]>([]);
  const userRef = useRef<string | null>(null);
  const selectedThreadIdRef = useRef<string | null>(null);
  const unreadCountsRef = useRef<Record<string, number>>({});
  const unreadEnabledRef = useRef<boolean>(unreadEnabled);

  // --- Realtime & Caching Refs ---
  const messagesCacheRef = useRef<Record<string, MessageWithDetails[]>>({});
  const hasMoreMessagesRef = useRef<Record<string, boolean>>({});
  const initialConversationsFetchDoneRef = useRef(false);
  const initialTabCountsFetchDoneRef = useRef(false);
  const realtimeMessageBufferRef = useRef<any[]>([]);

  // Sync refs
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  // Sync options to refs (Initial/Tab changes only)
  useEffect(() => {
    // We update the "Base" part of filtersRef.current with new options (like statusScope)
    filtersRef.current = {
      ...filtersRef.current,
      ...options
    };
  }, [options]);

  useEffect(() => {
    selectedThreadIdRef.current = selectedThreadId;
  }, [selectedThreadId]);

  useEffect(() => {
    unreadEnabledRef.current = unreadEnabled;
  }, [unreadEnabled]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      userRef.current = data.user?.id || null;
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      userRef.current = session?.user?.id || null;
    });
    return () => subscription.unsubscribe();
  }, []);

  const [activeFilters, setActiveFilters] = useState<ThreadFilters>({});
  const conversationsRefreshTimer = useRef<number | null>(null);

  const scheduleConversationsRefresh = (delayMs: number = 400, jitter: boolean = false) => {
    try { if (conversationsRefreshTimer.current) { clearTimeout(conversationsRefreshTimer.current); conversationsRefreshTimer.current = null; } } catch { }
    const finalDelay = delayMs + (jitter ? Math.floor(Math.random() * 3000) : 0);
    conversationsRefreshTimer.current = window.setTimeout(() => {
      fetchConversations(undefined, { silent: true });
      fetchTabCountsV2();
    }, finalDelay) as unknown as number;
  };

  useEffect(() => {
    const nextScope = options?.statusScope ?? 'all';
    if (statusScopePrevRef.current !== nextScope) {
      statusScopePrevRef.current = nextScope;
      statusScopeRef.current = nextScope;
      paginationRef.current.page = 1;
      setPagination((prev) => ({ ...prev, page: 1 }));
      setConversations([]);
      setLoading(true);
      if (conversationsRefreshTimer.current) { clearTimeout(conversationsRefreshTimer.current); }
      fetchConversations(undefined, { silent: false });
      // Removed redundant fetchTabCounts() on tab switch to prevent fetch loops
    } else {
      statusScopeRef.current = nextScope;
    }
  }, [options?.statusScope]);



  const applyUnreadCounts = useCallback((
    counts: Array<{ thread_id: string; unread_count: number }>
  ) => {
    if (!unreadEnabledRef.current) return;
    const map = new Map<string, number>((counts || []).map((c) => [String(c.thread_id), Number(c.unread_count || 0)]));
    map.forEach((value, key) => {
      unreadCountsRef.current[key] = value;
    });
    setConversations((prev) => prev.map((conv) => {
      const nextUnread = map.get(conv.id);
      if (nextUnread === undefined || nextUnread === conv.unread_count) return conv;
      return { ...conv, unread_count: nextUnread };
    }));
  }, []);

  const setThreadUnread = useCallback((threadId: string, unreadCount: number) => {
    if (!threadId) return;
    unreadCountsRef.current[threadId] = Math.max(0, unreadCount);
    setConversations((prev) => prev.map((conv) => (
      conv.id === threadId ? { ...conv, unread_count: Math.max(0, unreadCount) } : conv
    )));
  }, []);

  const incrementThreadUnread = useCallback((threadId: string, delta: number = 1) => {
    if (!threadId) return;
    if (!unreadEnabledRef.current) return;
    // Update the ref immediately so subsequent renders/fetches can use it
    const nextValue = Math.max(0, (unreadCountsRef.current[threadId] ?? 0) + delta);
    unreadCountsRef.current[threadId] = nextValue;

    // Update state for UI re-render (only if the thread is currently in view)
    setConversations((prev) => prev.map((conv) => (
      conv.id === threadId
        ? { ...conv, unread_count: nextValue }
        : conv
    )));
  }, []);

  const fetchUnreadCounts = useCallback(async (threadIds: string[], threadsOverride?: ConversationWithDetails[]) => {
    if (!threadIds || threadIds.length === 0) return;
    if (!unreadEnabledRef.current) return;
    if (isDocumentHidden()) return;
    try {
      // Use provided threads or ref as fallback for filtering
      const threadsToFilter = threadsOverride || conversationsRef.current || [];
      const assignedSet = new Set(
        threadsToFilter.filter((c) => c.assigned).map((c) => c.id)
      );

      // We only fetch unread counts for threads considered "assigned" in the UI logic
      // to reduce RPC load, but we ensure we are using the most current list available.
      const scopedIds = threadIds.filter((id) => threadsOverride ? true : assignedSet.has(id));

      if (scopedIds.length === 0) return;
      const { data, error } = await protectedSupabase.rpc('get_unread_counts', { p_thread_ids: scopedIds });
      if (error) throw error;
      if (!data || data.length === 0) return;
      applyUnreadCounts((data || []) as any);
    } catch (err) {
      console.warn('[useConversations] Failed to fetch unread counts', err);
    }
  }, [applyUnreadCounts]);

  const markThreadRead = useCallback(async (threadId: string, lastReadSeq?: number | null) => {
    if (!threadId || lastReadSeq == null) return;
    if (isDocumentHidden()) return;
    try {
      const { error } = await protectedSupabase.rpc('mark_thread_read', {
        p_thread_id: threadId,
        p_last_read_seq: lastReadSeq,
      });
      if (error) throw error;
    } catch (err) {
      console.warn('[useConversations] Failed to mark thread read', err);
    }
  }, []);

  // More targeted refresh for specific thread updates
  const updateConversationPreview = async (threadId: string, lastMessage: any) => {
    // 1. Check if the thread is currently visible in our loaded segment
    const isCurrentlyVisible = conversationsRef.current.some(c => c.id === threadId);

    if (!isCurrentlyVisible) {
      // Relevance Check: If it's not visible, evaluate if it BELONGS in the current tab.
      // E.g., if a customer messages an "Unassigned" thread, but agent is looking at "Assigned",
      // we DO NOT need to refresh the list, only the tab counts.
      let cached = getCachedThread(threadId);

      // Give GlobalMessageListener 150ms to fetch and cache the thread if it's missing (it usually does instantly)
      if (!cached) {
        await new Promise(r => setTimeout(r, 150));
        cached = getCachedThread(threadId);
      }

      if (cached) {
        const isClosed = cached.status === 'closed' || cached.status === 'done' || cached.status === 'resolved' || cached.status === 'spam';
        const assignedFromSignals = cached.status === 'pending' || cached.status === 'assigned';
        const isAssigned = !isClosed && assignedFromSignals;

        const activeScope = statusScopeRef.current;

        let shouldRefreshList = true;
        if (activeScope === 'assigned' && !isAssigned) shouldRefreshList = false;
        if (activeScope === 'unassigned' && (isAssigned || isClosed)) shouldRefreshList = false;
        if (activeScope === 'done' && !isClosed) shouldRefreshList = false;

        if (!shouldRefreshList) {
          // Silently bump tab counts only - completely avoids Thundering Herd
          void fetchTabCountsV2();
          return;
        }
      }

      // If it belongs in the active tab (or we don't know), schedule a refresh with Jitter
      // Jitter (true) distributes N agents across 3000ms instead of firing simultaneously
      scheduleConversationsRefresh(100, true);
      return;
    }

    // 2. The thread IS visible. Perform a fast synchronous state mutation.
    setConversations(prev => {
      const updated = prev.map(conv => {
        if (conv.id === threadId) {
          const channelSuperAgentId = conv.channel?.super_agent_id ?? conv.super_agent_id ?? null;
          const isClosed = conv.status === 'closed';
          const assignedFromSignals = conv.status === 'pending' || conv.status === 'assigned';
          const isAssigned = !isClosed && assignedFromSignals;

          const assigneeName =
            conv.assignee_user_id
              ? conv.assignee_user_id === channelSuperAgentId
                ? conv.super_agent_name || conv.assignee_name || '—'
                : conv.assignee_name || '—'
              : '—';
          return {
            ...conv,
            last_message_preview: (lastMessage?.body || '').toString().replace(/\s+/g, ' ').trim() || '—',
            last_message_direction: lastMessage?.direction ?? null,
            last_message_role: lastMessage?.role ?? null,
            last_msg_at: lastMessage?.created_at || conv.last_msg_at,
            unreplied: lastMessage?.direction === 'in' || lastMessage?.role === 'user',
            assigned: isAssigned,
            assignee_user_id: conv.assignee_user_id,
            assignee_name: assigneeName,
            status: conv.status,
          };
        }
        return conv;
      });

      // Re-sort conversations after update so newest activity is always first
      return updated.sort((a, b) => {
        const aTime = new Date(a.last_msg_at ?? a.created_at ?? 0).getTime();
        const bTime = new Date(b.last_msg_at ?? b.created_at ?? 0).getTime();
        return bTime - aTime;
      });
    });

    // Always refresh counts when messages arrive to keep indicators fresh
    void fetchTabCountsV2();
  };

  // --- Throttling Refs ---
  const tabCountsTimeoutRef = useRef<number | null>(null);
  const tabCountsPendingRef = useRef<boolean>(false);

  const fetchTabCountsV2 = useCallback(async (overrideFilters?: ThreadFilters) => {
    if (overrideFilters) {
      filtersRef.current = { ...overrideFilters };
      setActiveFilters(filtersRef.current);
    }

    // Execution lock: don't start a new request if one is currently in-flight
    if (tabCountsPendingRef.current) {
      return null as any;
    }

    // Throttle lock: don't start a new request if we recently finished one (unless forced)
    if (tabCountsTimeoutRef.current) {
      return null as any;
    }

    tabCountsPendingRef.current = true;

    try {
      const filters = filtersRef.current;
      const pFilters: any = {};

      if (filters.search?.trim()) pFilters.search = filters.search.trim();
      if (filters.agent) pFilters.agent = filters.agent;
      if (filters.resolvedBy) pFilters.resolvedBy = filters.resolvedBy;
      if (filters.platformId) pFilters.platformId = filters.platformId;
      if (filters.inbox && filters.inbox !== 'all') pFilters.inbox = filters.inbox;

      if (filters.dateRange?.from || filters.dateRange?.to) {
        pFilters.dateRange = {
          from: filters.dateRange.from ? startOfDay(new Date(filters.dateRange.from)).toISOString() : null,
          to: filters.dateRange.to ? endOfDay(new Date(filters.dateRange.to)).toISOString() : null
        };
      }

      const { data, error } = await protectedSupabase.rpc('get_tab_counts_v3', {
        p_filters: pFilters
      });

      if (error) throw error;

      let assignedCount = 0;
      let unassignedCount = 0;
      let doneCount = 0;

      (data || []).forEach((row: any) => {
        if (row.status_category === 'assigned') assignedCount = Number(row.total_count || 0);
        if (row.status_category === 'unassigned') unassignedCount = Number(row.total_count || 0);
        if (row.status_category === 'done') doneCount = Number(row.total_count || 0);
      });

      const nextCounts = {
        assigned: assignedCount,
        unassigned: unassignedCount,
        done: doneCount,
      };

      setTabCounts(nextCounts);
    } catch (err) {
      console.warn('[useConversations] Failed to fetch tab counts', err);
    } finally {
      tabCountsPendingRef.current = false;
      const jitter = Math.floor(Math.random() * 2000); // 1-3s minimum between requests
      tabCountsTimeoutRef.current = window.setTimeout(() => {
        tabCountsTimeoutRef.current = null;
      }, 1000 + jitter) as unknown as number;
    }

    return null;
  }, []);

  const fetchConversationsPendingRef = useRef<boolean>(false);
  const currentFetchIdRef = useRef<number>(0);

  // Fetch conversations with batching/debouncing to prevent rapid duplicate multi-requests
  const fetchConversations = async (
    overrideFilters?: ThreadFilters,
    fetchOptions: { silent?: boolean; page?: number; pageSize?: number } = {}
  ) => {
    // Drop execution completely if we are already in-flight doing an exact match request,
    // but the 15+ concurrent requests on mount issue is best solved by a slight debouncing.
    // However, since `useEffect` chains can happen, we use a fetchId check instead to drop stale results,
    // and an execution lock for duplicate parameters.

    const fetchId = ++currentFetchIdRef.current;

    // We queue the actual execution 25ms later to catch synchronous cascading effects
    await new Promise(r => setTimeout(r, 25));
    if (fetchId !== currentFetchIdRef.current) return; // Superceded by a newer request

    try {
      if (!fetchOptions.silent) {
        setLoading(true);
      }
      setError(null);
      await waitForAuthReady();

      if (fetchId !== currentFetchIdRef.current) return; // Re-check after auth wait

      if (!fetchOptions.silent) {
        void fetchTabCountsV2(overrideFilters);
      }

      if (overrideFilters) {
        filtersRef.current = { ...overrideFilters };
        setActiveFilters(filtersRef.current);
        paginationRef.current.page = 1;
        setPagination((prev) => ({ ...prev, page: 1 }));
      }
      if (fetchOptions.pageSize != null && Number.isFinite(fetchOptions.pageSize)) {
        const nextSize = Math.max(1, Math.min(200, Number(fetchOptions.pageSize)));
        paginationRef.current.pageSize = nextSize;
        paginationRef.current.page = 1;
        setPagination((prev) => ({ ...prev, page: 1, pageSize: nextSize }));
      }
      if (fetchOptions.page != null && Number.isFinite(fetchOptions.page)) {
        const nextPage = Math.max(1, Math.floor(Number(fetchOptions.page)));
        paginationRef.current.page = nextPage;
        setPagination((prev) => ({ ...prev, page: nextPage }));
      }

      const filtersToUse = overrideFilters ?? filtersRef.current;

      const pFilters: any = {};
      if (filtersToUse.search?.trim()) pFilters.search = filtersToUse.search.trim();
      if (filtersToUse.agent && filtersToUse.agent !== 'all') pFilters.agent = filtersToUse.agent;
      if (filtersToUse.resolvedBy && filtersToUse.resolvedBy !== 'all') pFilters.resolvedBy = filtersToUse.resolvedBy;
      if (filtersToUse.platformId && filtersToUse.platformId !== 'all') pFilters.platformId = filtersToUse.platformId;
      if (filtersToUse.inbox && filtersToUse.inbox !== 'all') pFilters.inbox = filtersToUse.inbox;
      if (filtersToUse.channelType && filtersToUse.channelType !== 'all') pFilters.channelType = filtersToUse.channelType;
      if (filtersToUse.status && filtersToUse.status !== 'all') pFilters.status = filtersToUse.status;

      if (filtersToUse.dateRange?.from || filtersToUse.dateRange?.to) {
        pFilters.dateRange = {
          from: filtersToUse.dateRange.from ? startOfDay(new Date(filtersToUse.dateRange.from)).toISOString() : null,
          to: filtersToUse.dateRange.to ? endOfDay(new Date(filtersToUse.dateRange.to)).toISOString() : null
        };
      }

      let page = fetchOptions.page ?? paginationRef.current.page;
      let pageSize = fetchOptions.pageSize ?? paginationRef.current.pageSize;
      const statusScope = statusScopeRef.current;

      if (statusScope === 'assigned' || statusScope === 'unassigned') {
        page = fetchOptions.page ?? paginationRef.current.page;
        pageSize = fetchOptions.pageSize ?? 10;
        if (statusScope === 'assigned') pFilters.status = 'pending';
        if (statusScope === 'unassigned') pFilters.status = 'open';
      } else if (statusScope === 'done') {
        if (!pFilters.status) pFilters.status = 'closed';
      }

      const offset = Math.max(0, (page - 1) * pageSize);

      const timeoutPromise = new Promise<never>((_, reject) => {
        const id = setTimeout(() => { clearTimeout(id); reject(new Error('timeout')); }, 30000);
      });

      const { data, error } = await Promise.race([
        protectedSupabase.rpc('get_threads_with_details', {
          p_filters: pFilters,
          p_limit: pageSize,
          p_offset: offset
        }),
        timeoutPromise,
      ]) as any;

      if (fetchId !== currentFetchIdRef.current) return; // Superceded during network flight

      if (error) throw error;

      const hasMore = (data && data.length === pageSize) ? true : false;
      const totalPages = Math.max(1, page + (hasMore ? 1 : 0));

      setPagination({ page, pageSize, total: 0, totalPages });

      const prevUnreadMap = new Map(Object.entries(unreadCountsRef.current || {}));
      const prevById = new Map((conversationsRef.current || []).map((c) => [c.id, c]));

      const transformedData: ConversationWithDetails[] = (data || []).map((thread: any) => {
        const last = thread.last_message;
        let lastPreview = (last?.body || '').toString().replace(/\s+/g, ' ').trim();
        let lastDir = last?.direction ?? null;
        let lastRole = last?.role ?? null;
        let unreplied = lastDir === 'in' || lastRole === 'user';
        let lastMsgAt = last?.created_at || thread.last_msg_at;

        const prev = prevById.get(thread.id);
        if (prev) {
          const prevTime = new Date(prev.last_msg_at ?? prev.created_at ?? 0).getTime();
          const nextTime = new Date(lastMsgAt ?? 0).getTime();
          if (prevTime > nextTime) {
            lastMsgAt = prev.last_msg_at;
            lastPreview = prev.last_message_preview || lastPreview;
            lastDir = prev.last_message_direction ?? lastDir;
            lastRole = prev.last_message_role ?? lastRole;
            unreplied = prev.unreplied ?? unreplied;
          }
        }

        return {
          ...thread,
          contact_name: thread.contact_name || 'Unknown Contact',
          contact_phone: thread.contact_phone || '',
          contact_email: thread.contact_email || '',
          channel_name: thread.channel_display_name || 'Unknown Channel',
          channel_type: thread.channel_type || 'web',
          channel_provider: thread.channel_provider || undefined,
          channel: {
            provider: thread.channel_provider,
            type: thread.channel_type,
            display_name: thread.channel_display_name,
            external_id: thread.channel_external_id,
            logo_url: thread.channel_logo_url || null,
            profile_photo_url: thread.channel_profile_photo_url || null,
            super_agent_id: thread.channel_super_agent_id,
          },
          channel_logo_url: thread.channel_logo_url || thread.channel_profile_photo_url || null,
          last_message_preview: lastPreview || '—',
          last_message_direction: lastDir,
          last_message_role: lastRole as any,
          last_msg_at: lastMsgAt,
          message_count: 0,
          assigned: thread.is_assigned,
          assigned_by_name: thread.assigned_by_name || '—',
          assignee_name: thread.assignee_name || '—',
          assignee_user_id: thread.assignee_user_id,
          resolved_by_name: thread.resolved_by_name || '—',
          ai_access_enabled: thread.ai_access_enabled ?? false,
          super_agent_id: thread.channel_super_agent_id,
          super_agent_name: thread.super_agent_name || '—',
          assignee_last_seen_at: thread.assignee_last_seen_at || null,
          super_agent_last_seen_at: thread.super_agent_last_seen_at || null,
          status: thread.status || 'open',
          unreplied,
          unread_count: prevUnreadMap.get(thread.id),
        } as ConversationWithDetails;
      });

      const sortedData = transformedData.sort((a, b) => {
        const aTime = new Date(a.last_msg_at ?? a.created_at ?? 0).getTime();
        const bTime = new Date(b.last_msg_at ?? b.created_at ?? 0).getTime();
        return bTime - aTime;
      });

      setConversations(sortedData);
      void fetchUnreadCounts(sortedData.map((t) => t.id), sortedData);

    } catch (error) {
      if (fetchId !== currentFetchIdRef.current) return;
      console.error('Error fetching conversations:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch conversations');
    } finally {
      if (fetchId === currentFetchIdRef.current) {
        setLoading(false);
      }
    }
  };

  // Light-weight realtime patch when a thread updates (e.g., status/assignee changes)
  const applyThreadRealtimePatch = useCallback((row: any) => {
    if (!row?.id) return;

    // Always refresh tab counts when a thread's properties change (status/assignment)
    void fetchTabCountsV2();

    setConversations((prev) => {
      const idx = prev.findIndex((c) => c.id === row.id);

      if (idx === -1) {
        // If it's a completely new thread or one that just entered our visibility,
        // trigger a background refresh of the list.
        scheduleConversationsRefresh(100);
        return prev;
      }

      const current = prev[idx];

      // If status changed, check if it still belongs in the current tab/scope
      const statusScope = statusScopeRef.current;
      const nextStatus = row.status ?? current.status;
      let shouldRemove = false;
      if (statusScope === 'assigned' && nextStatus !== 'pending') shouldRemove = true;
      else if (statusScope === 'unassigned' && nextStatus !== 'open') shouldRemove = true;
      else if (statusScope === 'done' && nextStatus !== 'closed') shouldRemove = true;

      if (shouldRemove) {
        return prev.filter(c => c.id !== row.id);
      }

      const isClosed = nextStatus === 'closed';
      const assignedFromSignals = nextStatus === 'pending' || nextStatus === 'assigned';
      const isAssigned = !isClosed && assignedFromSignals;

      const patched = {
        ...current,
        status: (row.status ?? current.status) as any,
        assignee_user_id: row.assignee_user_id ?? current.assignee_user_id,
        collaborator_user_id: row.collaborator_user_id ?? current.collaborator_user_id,
        assigned_at: row.assigned_at ?? current.assigned_at,
        resolved_at: row.resolved_at ?? current.resolved_at,
        resolved_by_user_id: row.resolved_by_user_id ?? current.resolved_by_user_id,
        ai_access_enabled: row.ai_access_enabled ?? current.ai_access_enabled,
        last_msg_at: row.last_msg_at ?? current.last_msg_at,
        assigned: isAssigned,
        account_id: row.account_id ?? current.account_id ?? null,
      };

      // Only re-sort if the timestamp changed
      if (patched.last_msg_at === current.last_msg_at) {
        const next = [...prev];
        next[idx] = patched;
        return next;
      } else {
        const next = [...prev];
        next[idx] = patched;
        next.sort((a, b) => {
          const aTime = new Date(a.last_msg_at ?? a.created_at ?? 0).getTime();
          const bTime = new Date(b.last_msg_at ?? b.created_at ?? 0).getTime();
          return bTime - aTime;
        });
        return next;
      }
    });
  }, []); // empty deps: all internals use refs or stable setters — stale closure is safe

  // Fetch messages for a specific thread
  const fetchMessages = useCallback(async (threadId: string, options?: { loadMore?: boolean; skipCache?: boolean }) => {
    try {
      const skipCache = options?.skipCache ?? false;
      const loadMore = options?.loadMore ?? false;

      // Fast-path SWR Cache — show cached data immediately, then revalidate
      const hasCachedData = !skipCache && !loadMore && messagesCacheRef.current[threadId];
      if (hasCachedData) {
        setMessages(messagesCacheRef.current[threadId]);
        setSelectedThreadId(threadId);
        // Don't return — fall through to do a silent background refresh
      }

      setError(null);

      const limit = 50;
      const currentCache = messagesCacheRef.current[threadId] || [];
      const offset = loadMore ? currentCache.length : 0;

      const { data, error } = await supabase
        .from('messages')
        .select(`
          id, thread_id, direction, role, type, body, payload,
          actor_kind, actor_id, seq, in_reply_to, edited_at, edit_reason, created_at
        `)
        .eq('thread_id', threadId)
        .order('seq', { ascending: false }) // Fetch newest backwards
        .range(offset, offset + limit - 1);

      if (error) throw error;

      // Get contact info from thread (we really only need this once, but lightweight)
      const { data: threadData } = await supabase
        .from('threads')
        .select('contacts(name)')
        .eq('id', threadId)
        .maybeSingle();

      const contactName = (threadData as any)?.contacts?.name || 'Unknown Contact';

      // Transform raw data
      const newMessages: MessageWithDetails[] = (data || []).map((message: any) => ({
        ...message,
        contact_name: contactName,
        contact_avatar: contactName[0]?.toUpperCase() || 'U'
      }));

      // Because we fetched DESC to get the newest, we must reverse to ASC for display
      newMessages.reverse();

      // Update cache
      let finalMessages: MessageWithDetails[];
      if (loadMore) {
        // Prepend older messages
        finalMessages = [...newMessages, ...currentCache];
      } else {
        finalMessages = newMessages;
      }

      messagesCacheRef.current[threadId] = finalMessages;
      hasMoreMessagesRef.current[threadId] = newMessages.length === limit;

      setMessages(finalMessages);
      setSelectedThreadId(threadId);

      // Handle unread clearing
      const latestSeq = finalMessages.length > 0 ? finalMessages[finalMessages.length - 1].seq : null;
      if (latestSeq != null && !isDocumentHidden()) {
        void markThreadRead(threadId, latestSeq);
        setThreadUnread(threadId, 0);
      }

    } catch (error) {
      console.error('Error fetching messages:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch messages');
    }
  }, []);

  // Send a new message
  // Send a new message
  const sendMessage = async (
    threadId: string,
    messageText: string,
    role: 'agent' | 'assistant' = 'assistant',
    attachment?: { url: string; type: 'image' | 'video' | 'file' | 'voice' }
  ) => {
    try {
      setError(null);

      // First, get the thread details to extract channel_id, contact_id, and provider
      const { data: threadData, error: threadError } = await supabase
        .from('threads')
        .select('channel_id, contact_id, ai_access_enabled, channels(provider)')
        .eq('id', threadId)
        .single();

      if (threadError) throw threadError;

      // Determine if the channel is an external provider (telegram/whatsapp)
      // For external channels, we skip the DB insert and let n8n handle it
      const channelProvider = ((threadData as any)?.channels?.provider as string || '').toLowerCase();
      const isExternalChannel = ['telegram', 'whatsapp'].includes(channelProvider);
      const isWebChannel = channelProvider === 'web';

      // Get current logged-in admin user ID (needed for both DB insert & webhook)
      const { data: authData } = await supabase.auth.getUser();
      const currentUserId = authData?.user?.id || null;

      const hasAttachment = !!attachment;
      const hasCaption = messageText.trim().length > 0;

      // Prepare messages to insert
      const messagesToInsert: any[] = [];
      const optimisticMessages: MessageWithDetails[] = [];

      const baseMessage = {
        thread_id: threadId,
        direction: 'out' as const,
        role: role,
        payload: {},
        actor_kind: 'agent' as const,
        actor_id: currentUserId,
        created_at: new Date().toISOString(),
      };

      if (hasAttachment) {
        // Row 1: The attachment (image/video/etc URL in body)
        const attachId = `tmp_${Math.random().toString(36).slice(2)}`;
        const attachMsg = {
          ...baseMessage,
          type: attachment.type,
          body: attachment.url,
        };
        messagesToInsert.push(attachMsg);
        optimisticMessages.push({
          ...attachMsg,
          id: attachId,
          seq: 0,
          in_reply_to: null,
          edited_at: null,
          edit_reason: null,
          contact_name: '',
          contact_avatar: 'A',
          _status: 'pending',
        } as MessageWithDetails);

        // Row 2: The caption (if any)
        if (hasCaption) {
          const captionId = `tmp_${Math.random().toString(36).slice(2)}`;
          const captionMsg = {
            ...baseMessage,
            type: 'text' as const,
            body: messageText,
            created_at: new Date(Date.now() + 1).toISOString(), // Ensure order
          };
          messagesToInsert.push(captionMsg);
          optimisticMessages.push({
            ...captionMsg,
            id: captionId,
            seq: 0,
            in_reply_to: null,
            edited_at: null,
            edit_reason: null,
            contact_name: '',
            contact_avatar: 'A',
            _status: 'pending',
          } as MessageWithDetails);
        }
      } else {
        // Regular text message
        const textId = `tmp_${Math.random().toString(36).slice(2)}`;
        const textMsg = {
          ...baseMessage,
          type: 'text' as const,
          body: messageText,
        };
        messagesToInsert.push(textMsg);
        optimisticMessages.push({
          ...textMsg,
          id: textId,
          seq: 0,
          in_reply_to: null,
          edited_at: null,
          edit_reason: null,
          contact_name: '',
          contact_avatar: 'A',
          _status: 'pending',
        } as MessageWithDetails);
      }

      // Optimistically push messages to UI
      setMessages(prev => [...prev, ...optimisticMessages]);

      // For external channels (telegram/whatsapp), skip DB insert;
      // the n8n workflow will insert the message after sending it.
      let data: any = null;
      if (!isExternalChannel) {
        const { data: insertedData, error } = await supabase
          .from('messages')
          .insert(messagesToInsert.map(({ thread_id, direction, role, type, body, payload, actor_kind, actor_id }) => ({
            thread_id, direction, role, type, body, payload, actor_kind, actor_id
          })))
          .select();

        if (error) throw error;
        data = insertedData?.[0]; // return first one or handle array? Usually one if no caption, two if caption.
      }

      // Get contact details for webhook payload
      const { data: contactData, error: contactError } = await supabase
        .from('contacts')
        .select('phone, external_id')
        .eq('id', threadData.contact_id)
        .single();

      if (contactError) {
        console.warn('Error fetching contact details:', contactError);
      }

      // Resolve endpoint by provider (avoid relying on global mutable state)
      try {
        // Prefer provider from our in-memory conversations list to avoid extra DB calls
        const conv = conversations.find(c => c.id === threadId);
        const provider = (conv?.channel?.provider || (threadData as any)?.channels?.provider) as string | undefined;

        if (provider && provider.toLowerCase() !== 'web') {
          const endpoint = resolveSendMessageEndpoint(provider);

          const webhookPayload = {
            thread_id: threadId,
            channel_id: threadData.channel_id,
            actor_id: currentUserId,
            contact_phone: contactData?.phone || null,
            external_id: contactData?.external_id || null,
            text: messageText,
            type: attachment ? attachment.type : 'text',
            direction: 'out',
            role: role,
            file_url: attachment?.url || null,
            is_assigned: threadData.ai_access_enabled === false
          };

          const webhookResponse = await callWebhook(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(webhookPayload)
          });

          if (!webhookResponse.ok) {
            console.warn('Webhook call failed:', webhookResponse.status, webhookResponse.statusText);
          }
        }
      } catch (webhookError) {
        console.error('Error calling webhook:', webhookError);
        // Don't throw here - we still want to save the message locally even if webhook fails
      }

      if (isExternalChannel) {
        // For external channels, keep the optimistic messages visible
        // and mark them as 'sent'. Realtime will replace them once n8n inserts the real messages.
        const optimisticIds = new Set(optimisticMessages.map(m => m.id));
        setMessages(prev =>
          prev.map(m =>
            optimisticIds.has(m.id) ? { ...m, _status: 'sent' as const } : m
          )
        );
      } else {
        // Replace optimistic pending with fresh list including the inserted message
        // skipCache: true ensures we don't flash the old cached payload over the optimistic messages
        await fetchMessages(threadId, { skipCache: true });
      }

      // Update conversation preview locally to avoid unnecessary refresh
      updateConversationPreview(threadId, {
        body: messageText,
        direction: 'out',
        role: role,
        created_at: new Date().toISOString()
      });

      // Audit log
      try {
        await logAction({
          action: 'message.send',
          resource: 'message',
          resourceId: (data as any)?.id ?? null,
          context: { thread_id: threadId, role }
        });
      } catch { }

      return data;
    } catch (error) {
      console.error('Error sending message:', error);
      setError(error instanceof Error ? error.message : 'Failed to send message');
      // Mark last optimistic message as error if present
      setMessages(prev => {
        const next = [...prev];
        for (let i = next.length - 1; i >= 0; i--) {
          if ((next[i] as any)._status === 'pending') {
            (next[i] as any)._status = 'error';
            break;
          }
        }
        return next;
      });
      throw error;
    }
  };

  // Create a new conversation/thread
  const createConversation = async (contactId: string, channelId: string) => {
    try {
      setError(null);

      const newThread = {
        // org_id is enforced by RLS via WITH CHECK using org membership
        org_id: (await supabase.auth.getUser()).data.user?.id || '00000000-0000-0000-0000-000000000001',
        contact_id: contactId,
        channel_id: channelId,
        status: 'open' as const,
        assignee_user_id: null
      } as any;

      const { data, error } = await supabase
        .from('threads')
        .insert([newThread])
        .select()
        .single();

      if (error) throw error;

      // Refresh conversations
      await fetchConversations(undefined, { silent: true });

      // Audit log
      try {
        await logAction({ action: 'thread.create', resource: 'thread', resourceId: (data as any)?.id ?? null, context: { contact_id: contactId, channel_id: channelId } });
      } catch { }

      return data;
    } catch (error) {
      console.error('Error creating conversation:', error);
      setError(error instanceof Error ? error.message : 'Failed to create conversation');
      throw error;
    }
  };

  // Update thread status
  // Assign thread to current user (ensures DB assignment and audit fields)
  const assignThread = async (threadId: string, _userId: string, options?: { setAssignee?: boolean }) => {
    try {
      setError(null);

      const { data: authData } = await supabase.auth.getUser();
      const currentUserId = authData?.user?.id || null;
      // FE uses "pending" as the assigned state
      const assignedStatusValue: Thread['status'] = 'pending';
      const shouldSetAssignee = options?.setAssignee ?? true;

      if (shouldSetAssignee) {
        // Try RPC first (preferred path)
        const { error: rpcError } = await (supabase.rpc as any)('takeover_thread', { p_thread_id: threadId });

        if (rpcError) {
          console.warn('takeover_thread RPC failed; will attempt direct update', rpcError);
        }

        try {
          const { data: threadAfterRpc } = await supabase
            .from('threads')
            .select('assignee_user_id, status')
            .eq('id', threadId)
            .single();

          const alreadyAssigned = !!threadAfterRpc?.assignee_user_id;
          const statusNeedsUpdate = (threadAfterRpc?.status || '').toLowerCase() !== assignedStatusValue;
          if ((statusNeedsUpdate || !alreadyAssigned) && currentUserId) {
            const updatePayload: Record<string, any> = {
              assigned_at: new Date().toISOString(),
              handover_reason: 'other:manual_takeover',
              ai_access_enabled: false,
              status: assignedStatusValue as any,
            };
            if (!alreadyAssigned) {
              updatePayload.assignee_user_id = currentUserId;
              updatePayload.assigned_by_user_id = currentUserId;
            }

            const { error: updateErr } = await supabase
              .from('threads')
              .update(updatePayload)
              .eq('id', threadId);
            if (updateErr) {
              console.warn('Fallback assignment/status update failed', updateErr);
            }
          }
        } catch (verifyErr) {
          console.warn('Failed verifying assignment state', verifyErr);
        }
      } else {
        // Regular agent takeover: only flip status/AI flags, leave assignee untouched
        const nowIso = new Date().toISOString();
        const { error: statusErr } = await supabase
          .from('threads')
          .update({
            collaborator_user_id: currentUserId,
            status: assignedStatusValue as any,
            ai_access_enabled: false,
            ai_handoff_at: nowIso,
          })
          .eq('id', threadId);
        if (statusErr) {
          throw statusErr;
        }
      }

      // Ensure AI access is disabled
      try { await protectedSupabase.from('threads').update({ ai_access_enabled: false }).eq('id', threadId); } catch { }

      // Create a system event message noting the takeover
      try {
        const { data: userRes } = await supabase.auth.getUser();
        const currentUserId = userRes?.user?.id || null;

        let displayName: string | null = null;
        if (currentUserId) {
          const { data: profile } = await supabase
            .from('users_profile')
            .select('display_name')
            .eq('user_id', currentUserId)
            .single();
          displayName = profile?.display_name || null;
        }

        await protectedSupabase.from('messages').insert([{
          thread_id: threadId,
          direction: null,
          role: 'system',
          type: 'event',
          body: `Conversation taken over by ${displayName || userRes?.user?.email || 'agent'}.`,
          payload: { event: 'takeover', user_id: currentUserId }
        }]);
      } catch (e) {
        // Non-fatal; continue even if event message insert fails
        console.warn('Failed to insert takeover event message', e);
      }

      // Refresh conversations/messages to reflect new assignment
      await fetchConversations(undefined, { silent: true });
      await fetchMessages(threadId);

      // Audit log
      try { await logAction({ action: 'thread.assign', resource: 'thread', resourceId: threadId, context: { assignee_user_id: _userId } }); } catch { }

    } catch (error) {
      console.error('Error assigning thread:', error);
      setError(error instanceof Error ? error.message : 'Failed to assign thread');
      throw error;
    }
  };

  // Clear collaborator without touching handled-by assignee
  const clearCollaborator = async (threadId: string) => {
    try {
      setError(null);
      const { error: updateErr } = await supabase
        .from('threads')
        .update({
          collaborator_user_id: null,
          status: 'open', // move to Unassigned tab without clearing handled-by
          ai_access_enabled: true,
          ai_handoff_at: null,
        })
        .eq('id', threadId);
      if (updateErr) throw updateErr;
      await fetchConversations(undefined, { silent: true });
      await fetchMessages(threadId);
    } catch (err) {
      console.error('Error clearing collaborator:', err);
      setError(err instanceof Error ? err.message : 'Failed to clear collaborator');
      throw err;
    }
  };

  // Assign thread to a specific user (not a takeover). Used by supervisors to reassign.
  const assignThreadToUser = async (threadId: string, assigneeUserId: string | null) => {
    try {
      setError(null);

      const { data: authData } = await supabase.auth.getUser();
      const currentUserId = authData?.user?.id || null;

      const nowIso = new Date().toISOString();
      // FE uses:
      // - "pending" = Assigned
      // - "open"    = Unassigned
      const assignedStatusValue: Thread['status'] = 'pending';
      const updatePayload: Record<string, any> = {
        assignee_user_id: assigneeUserId,
        handover_reason: assigneeUserId ? 'other:manual_assign' : 'other:manual_unassign',
        ai_access_enabled: assigneeUserId ? false : true,
        ai_handoff_at: assigneeUserId ? nowIso : null,
        status: assigneeUserId ? assignedStatusValue : 'open',
      };

      if (assigneeUserId) {
        updatePayload.assigned_by_user_id = currentUserId;
        updatePayload.assigned_at = nowIso;
      } else {
        updatePayload.assigned_by_user_id = null;
        updatePayload.assigned_at = null;
        updatePayload.collaborator_user_id = null; // clear collaborator when unassigning
      }

      const { error: updateErr } = await supabase
        .from('threads')
        .update(updatePayload)
        .eq('id', threadId);

      if (updateErr) throw updateErr;

      // Insert system event message: "Conversation assigned to X by Y"
      try {
        const ids = [currentUserId, assigneeUserId].filter(Boolean) as string[];
        let nameMap: Record<string, string> = {};
        if (ids.length > 0) {
          const { data: profiles } = await supabase
            .from('users_profile')
            .select('user_id, display_name')
            .in('user_id', ids);
          nameMap = Object.fromEntries((profiles || []).map((p: any) => [String(p.user_id), String(p.display_name || '—')]));
        }

        const assignedByName = (currentUserId && (nameMap[currentUserId] || authData?.user?.email)) || 'agent';
        const assignedToName = assigneeUserId ? (nameMap[assigneeUserId] || 'agent') : '—';
        const eventEntry = {
          thread_id: threadId,
          direction: null,
          role: 'system' as const,
          type: 'event' as const,
          body: '',
          payload: {} as Record<string, any>,
        };

        if (assigneeUserId) {
          eventEntry.body = `Conversation assigned to ${assignedToName} by ${assignedByName}.`;
          eventEntry.payload = { event: 'assign', assigned_to: assigneeUserId, assigned_by: currentUserId };
        } else {
          eventEntry.body = `Conversation unassigned by ${assignedByName}.`;
          eventEntry.payload = { event: 'unassign', assigned_by: currentUserId };
        }

        await protectedSupabase.from('messages').insert([eventEntry]);
      } catch (e) {
        console.warn('Failed to insert assign event message', e);
      }

      // Refresh conversations/messages to reflect new assignment
      await fetchConversations(undefined, { silent: true });
      await fetchMessages(threadId);

      // Audit Log
      try { await logAction({ action: 'thread.assign', resource: 'thread', resourceId: threadId, context: { assignee_user_id: assigneeUserId } }); } catch { }
    } catch (error) {
      console.error('Error assigning thread to user:', error);
      setError(error instanceof Error ? error.message : 'Failed to assign thread');
      throw error;
    }
  };

  // Takeover: set collaborator to current user, status -> pending, do NOT touch assignee_user_id
  const takeoverThread = async (threadId: string) => {
    const { error: rpcError, data: rpcData } = await (protectedSupabase.rpc as any)('takeover_thread', { p_thread_id: threadId });
    if (rpcError) {
      console.warn('takeover_thread RPC failed, falling back to direct update', rpcError);
      const { data: authData } = await supabase.auth.getUser();
      const currentUserId = authData?.user?.id || null;
      if (!currentUserId) throw rpcError;
      const nowIso = new Date().toISOString();
      const { error: updErr } = await protectedSupabase
        .from('threads')
        .update({
          collaborator_user_id: currentUserId,
          status: 'pending',
          assigned_at: nowIso,
          ai_access_enabled: false,
        })
        .eq('id', threadId);
      if (updErr) throw updErr;
    }

    // Log system event for takeover
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const currentUserId = userRes?.user?.id || null;

      let displayName: string | null = null;
      if (currentUserId) {
        const { data: profile } = await supabase
          .from('users_profile')
          .select('display_name')
          .eq('user_id', currentUserId)
          .single();
        displayName = profile?.display_name || null;
      }

      await protectedSupabase.from('messages').insert([{
        thread_id: threadId,
        direction: null,
        role: 'system',
        type: 'event',
        body: `Conversation taken over by ${displayName || userRes?.user?.email || 'agent'}.`,
        payload: { event: 'takeover', user_id: currentUserId },
      }]);
    } catch (eventErr) {
      console.warn('Failed to insert takeover event message', eventErr);
    }

    await fetchConversations(undefined, { silent: true });
    await fetchMessages(threadId);
    return rpcData as any;
  };

  // Unassign: clear collaborator, status -> open, leave assignee_user_id alone
  const unassignThread = async (threadId: string) => {
    const { data, error } = await protectedSupabase.rpc('unassign_thread', { p_thread_id: threadId });
    if (error) throw error;

    // Guarantee AI access is re-enabled and collaborator cleared when thread goes back to Unassigned,
    // regardless of what the RPC does internally.
    try {
      await protectedSupabase
        .from('threads')
        .update({ ai_access_enabled: true, ai_handoff_at: null, handover_reason: null, collaborator_user_id: null })
        .eq('id', threadId);
    } catch (aiErr) {
      console.warn('[useConversations] Failed to restore ai_access_enabled on unassign', aiErr);
    }

    // Log system event for unassign action
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const currentUserId = userRes?.user?.id || null;

      let displayName: string | null = null;
      if (currentUserId) {
        const { data: profile } = await supabase
          .from('users_profile')
          .select('display_name')
          .eq('user_id', currentUserId)
          .single();
        displayName = profile?.display_name || null;
      }

      await protectedSupabase.from('messages').insert([{
        thread_id: threadId,
        direction: null,
        role: 'system',
        type: 'event',
        body: `Conversation moved to Unassigned by ${displayName || userRes?.user?.email || 'agent'}.`,
        payload: { event: 'unassign', user_id: currentUserId },
      }]);
    } catch (eventErr) {
      console.warn('Failed to insert unassign event message', eventErr);
    }

    await fetchConversations(undefined, { silent: true });
    await fetchMessages(threadId);
    return data as any;
  };

  // Set collaborator on a thread (single value stored on threads)
  const setThreadCollaborator = async (threadId: string, userId: string | null) => {
    try {
      setError(null);
      const { error } = await supabase
        .from('threads')
        .update({ collaborator_user_id: userId })
        .eq('id', threadId);

      if (error) throw error;

      setConversations(prev =>
        prev.map(conv => (conv.id === threadId ? { ...conv, collaborator_user_id: userId } : conv))
      );

      try {
        await logAction({
          action: userId ? 'thread.set_collaborator' : 'thread.clear_collaborator',
          resource: 'thread',
          resourceId: threadId,
          context: { collaborator_user_id: userId },
        });
      } catch { }
    } catch (error) {
      console.error('Error updating thread collaborator:', error);
      setError(error instanceof Error ? error.message : 'Failed to update collaborator');
      throw error;
    }
  };

  // Add label to thread
  const addThreadLabel = async (threadId: string, labelId: string) => {
    try {
      setError(null);

      const { error } = await supabase
        .from('thread_labels' as any)
        .insert([{ thread_id: threadId, label_id: labelId }]);

      if (error) throw error;

      try { await logAction({ action: 'thread.add_label', resource: 'thread', resourceId: threadId, context: { label_id: labelId } }); } catch { }

    } catch (error) {
      console.error('Error adding thread label:', error);
      setError(error instanceof Error ? error.message : 'Failed to add thread label');
      throw error;
    }
  };

  // Remove label from thread
  const removeThreadLabel = async (threadId: string, labelId: string) => {
    try {
      setError(null);

      const { error } = await supabase
        .from('thread_labels' as any)
        .delete()
        .eq('thread_id', threadId)
        .eq('label_id', labelId);

      if (error) throw error;

      try { await logAction({ action: 'thread.remove_label', resource: 'thread', resourceId: threadId, context: { label_id: labelId } }); } catch { }

    } catch (error) {
      console.error('Error removing thread label:', error);
      setError(error instanceof Error ? error.message : 'Failed to remove thread label');
      throw error;
    }
  };

  const deleteThread = async (threadId: string) => {
    try {
      setError(null);

      const { error } = await supabase
        .from('threads')
        .delete()
        .eq('id', threadId);

      if (error) throw error;

      defaultFallbackHandler.invalidatePattern('^query:threads');

      setConversations(prev => {
        const next = prev.filter(conv => conv.id !== threadId);
        return next;
      });

      if (selectedThreadId === threadId) {
        setSelectedThreadId(null);
        setMessages([]);
      }

      try { await logAction({ action: 'thread.delete', resource: 'thread', resourceId: threadId }); } catch { }

      await fetchConversations(undefined, { silent: true });

    } catch (error) {
      console.error('Error deleting thread:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete conversation');
      throw error;
    }
  };

  // Initial fetch on mount - disabled to prevent duplicate calls
  useEffect(() => {
    // We no longer trigger an initial fetch here because ConversationPage's 
    // URL hydration effect now centrally handles the first load to prevent StrictMode duplication.
    // scheduleConversationsRefresh(10);
  }, []);

  // Authorization changes: clear any in-memory UI state and refetch.
  useEffect(() => {
    const handler = () => {
      try {
        setConversations([]);
        setMessages([]);
        setSelectedThreadId(null);
        setError(null);
      } catch { }
      try {
        // Force a refresh using the currently active filters
        scheduleConversationsRefresh(50);
      } catch { }
    };
    try {
      window.addEventListener(AUTHZ_CHANGED_EVENT as any, handler as any);
    } catch { }
    return () => {
      try { window.removeEventListener(AUTHZ_CHANGED_EVENT as any, handler as any); } catch { }
    };
  }, []);

  // Auto-resolve is handled by a server-side pg_cron job (auto_close_due_threads) 
  // running every minute. We no longer trigger check_and_auto_resolve_threads 
  // from the frontend to prevent rate limit storms.
  const checkAutoResolve = useCallback(async () => { }, []);

  // Visibility Sync (Alt-Tab Fallback)
  // Ensures any messages or state changes that occurred while the browser tab was asleep get synced
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // The user just alt-tabbed back. Sync immediately.
        fetchConversations(undefined, { silent: true });
        fetchTabCountsV2();
        if (selectedThreadIdRef.current) {
          fetchMessages(selectedThreadIdRef.current, { skipCache: true }); // force refresh
        }
      }
    };

    // NOTE: Removed the brutal 5-second `setInterval` that blindly re-fetched everything constantly.
    // Realtime mutations + visibility sync fully cover all state changes with zero latency.

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Ensure unread counts are fetched once for freshly loaded threads
  useEffect(() => {
    if (!unreadEnabledRef.current) return;
    if (isDocumentHidden()) return;
    const missing = conversations.filter((c) => c.unread_count === undefined && c.assigned).map((c) => c.id);
    if (missing.length > 0) {
      void fetchUnreadCounts(missing);
    }
  }, [conversations, fetchUnreadCounts]);

  // Periodic unread count refresh (when visible)
  useEffect(() => {
    const interval = setInterval(() => {
      if (!unreadEnabledRef.current) return;
      if (isDocumentHidden()) return;
      const ids = conversationsRef.current.filter((c) => c.assigned).map((c) => c.id);
      if (ids.length > 0) {
        void fetchUnreadCounts(ids);
      }
    }, 45000);

    return () => clearInterval(interval);
  }, [fetchUnreadCounts]);

  // Refresh unread counts and mark selected thread read when tab becomes visible
  useEffect(() => {
    const handler = () => {
      if (isDocumentHidden()) return;
      const ids = conversationsRef.current.filter((c) => c.assigned).map((c) => c.id);
      if (ids.length > 0) {
        void fetchUnreadCounts(ids);
      }
      const currentThreadId = selectedThreadIdRef.current;
      if (currentThreadId && messages.length > 0) {
        const latestSeq = messages[messages.length - 1].seq;
        if (latestSeq != null) {
          void markThreadRead(currentThreadId, latestSeq);
          setThreadUnread(currentThreadId, 0);
        }
      }
    };
    try { document.addEventListener('visibilitychange', handler); } catch { }
    return () => {
      try { document.removeEventListener('visibilitychange', handler); } catch { }
    };
  }, [fetchUnreadCounts, markThreadRead, setThreadUnread, messages]);

  // Realtime Broadcast: keep conversations list in sync with DB (zero refetch)
  // Uses Broadcast from Database triggers instead of postgres_changes
  useEffect(() => {
    void supabase.realtime.setAuth(); // Required for Broadcast authorization
    const channel = supabase
      .channel('threads:all', { config: { private: true } })
      .on('broadcast', { event: 'UPDATE' }, (payload) => {
        const record = payload.payload?.record || payload.payload?.new;
        if (record) applyThreadRealtimePatch(record);
      })
      .on('broadcast', { event: 'INSERT' }, (_payload) => {
        // Thread inserts come from n8n/widget — the subsequent messages:all INSERT
        // will trigger updateConversationPreview which handles new threads.
      })
      .on('broadcast', { event: 'DELETE' }, (payload) => {
        const old = payload.payload?.old_record || payload.payload?.old;
        if (old?.id) {
          setConversations(prev => prev.filter(c => c.id !== old.id));
          void fetchTabCountsV2();
        }
      })
      .subscribe();

    return () => {
      try { supabase.removeChannel(channel); } catch { }
    };
  }, [applyThreadRealtimePatch]);

  // Realtime Broadcast: update conversation list when any message is inserted
  useEffect(() => {
    const channel = supabase
      .channel('messages:all', { config: { private: true } })
      .on('broadcast', { event: 'INSERT' }, (payload) => {
        const message = payload.payload?.record || payload.payload?.new;
        if (!message) return;
        if (message.direction === 'in') {
          updateConversationPreview(message.thread_id, message);

          const currentSelected = selectedThreadIdRef.current;
          if (currentSelected && message.thread_id === currentSelected) {
            if (!isDocumentHidden()) {
              void markThreadRead(message.thread_id, message.seq);
              setThreadUnread(message.thread_id, 0);
            }
          } else {
            incrementThreadUnread(message.thread_id, 1);
          }
        } else if (message.role === 'system' || message.type === 'event') {
          updateConversationPreview(message.thread_id, message);
        } else if (
          message.direction === 'out' &&
          (message.role === 'agent' || message.role === 'assistant')
        ) {
          updateConversationPreview(message.thread_id, message);
        }
      })
      .subscribe();

    return () => {
      try { supabase.removeChannel(channel); } catch { }
      try { if (conversationsRefreshTimer.current) { clearTimeout(conversationsRefreshTimer.current); conversationsRefreshTimer.current = null; } } catch { }
    };
  }, []);

  // Realtime Broadcast: keep messages in sync for the selected thread (zero polling)
  useEffect(() => {
    if (!selectedThreadId) return;

    const channel = supabase
      .channel(`messages:${selectedThreadId}`, { config: { private: true } })
      .on('broadcast', { event: 'INSERT' }, (payload) => {
        const message = payload.payload?.record || payload.payload?.new;
        if (!message) return;
        // Apply broadcast payload to state AND cache — pure mutation, no refetch
        setMessages(prev => {
          const exists = prev.some(m => m.id === message?.id);
          if (exists) return prev;
          const contactName = prev[0]?.contact_name || '';
          const contactAvatar = prev[0]?.contact_avatar || (contactName?.[0]?.toUpperCase?.() ?? 'U');
          const next: MessageWithDetails = {
            ...(message || {}),
            contact_name: contactName,
            contact_avatar: contactAvatar,
          };
          const merged = [...prev, next];
          merged.sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
          // Sync cache ref so switching threads and back preserves realtime messages
          if (message.thread_id) {
            messagesCacheRef.current[message.thread_id] = merged;
          }
          return merged;
        });
      })
      .subscribe();

    return () => {
      try { supabase.removeChannel(channel); } catch { }
    };
  }, [selectedThreadId]);

  // Realtime Broadcast: thread detail changes (status, assignment, etc.) — pure state mutation
  useEffect(() => {
    if (!selectedThreadId) return;
    const channel = supabase
      .channel(`threads:${selectedThreadId}`, { config: { private: true } })
      .on('broadcast', { event: 'UPDATE' }, (payload) => {
        const record = payload.payload?.record || payload.payload?.new;
        if (record) applyThreadRealtimePatch(record);
      })
      .subscribe();

    return () => {
      try { supabase.removeChannel(channel); } catch { }
    };
  }, [selectedThreadId]);

  return {
    conversations,
    messages,
    loading,
    error,
    selectedThreadId,
    fetchConversations,
    fetchMessages,
    sendMessage,
    refreshMessages: () => { if (selectedThreadId) { fetchMessages(selectedThreadId); } },
    // Audio notification controls
    enableAudioNotifications: () => { localStorage.setItem('audioNotifications', 'true'); },
    disableAudioNotifications: () => { localStorage.setItem('audioNotifications', 'false'); },
    testAudioNotification: () => { console.log('Audio test not implemented in hook'); },
    createConversation,
    assignThread,
    assignThreadToUser,
    takeoverThread,
    unassignThread,
    clearCollaborator,
    setThreadCollaborator,
    addThreadLabel,
    removeThreadLabel,
    deleteThread,
    // Auto-resolve functionality
    checkAutoResolve,
    activeFilters,
    pagination,
    tabCounts,
    fetchTabCounts: fetchTabCountsV2,
    setConversationPage: (page: number) => fetchConversations(undefined, { page }),
    setConversationPageSize: (pageSize: number) => fetchConversations(undefined, { pageSize }),
  };
};
