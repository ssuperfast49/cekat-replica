import { useState, useEffect, useRef } from 'react';
import { supabase, logAction } from '@/lib/supabase';
import { waitForAuthReady } from '@/lib/authReady';
import WEBHOOK_CONFIG from '@/config/webhook';
import { isDocumentHidden, onDocumentVisible } from '@/lib/utils';

export interface Thread {
  id: string;
  org_id: string;
  contact_id: string;
  channel_id: string;
  status: 'open' | 'pending' | 'closed';
  assignee_user_id: string | null;
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
}

export interface Message {
  id: string;
  thread_id: string;
  direction: 'in' | 'out' | null;
  role: 'user' | 'assistant' | 'agent' | 'system';
  type: 'text' | 'image' | 'file' | 'voice' | 'event' | 'note';
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
  };
  last_message_preview: string;
  last_message_direction?: 'in' | 'out' | null;
  last_message_role?: 'user' | 'assistant' | 'agent' | 'system' | null;
  message_count: number;
  assigned: boolean;
  assigned_by_name?: string;
  assignee_name?: string;
  resolved_by_name?: string;
  unreplied?: boolean;
}

export interface MessageWithDetails extends Message {
  // Additional fields for display
  contact_name: string;
  contact_avatar: string;
  // UI-only status flag for optimistic updates
  _status?: 'pending' | 'sent' | 'error';
}

export const useConversations = () => {
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
  const [messages, setMessages] = useState<MessageWithDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const conversationsRefreshTimer = useRef<number | null>(null);

  const scheduleConversationsRefresh = (delayMs: number = 400) => {
    try { if (conversationsRefreshTimer.current) { clearTimeout(conversationsRefreshTimer.current); conversationsRefreshTimer.current = null; } } catch {}
    conversationsRefreshTimer.current = window.setTimeout(() => {
      fetchConversations();
    }, delayMs) as unknown as number;
  };

  // LocalStorage hydrated snapshot to avoid empty UI during refresh
  const hydrateFromCache = () => {
    try {
      const raw = localStorage.getItem('app.cachedConversations');
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length >= 0) {
        setConversations(parsed);
        setHydrated(true);
        setLoading(false);
        return true;
      }
    } catch {}
    return false;
  };

  // Fetch conversations with contact and channel details
  const fetchConversations = async () => {
    try {
      if (!hydrated) setLoading(true);
      setError(null);
      // Ensure auth restoration completed on hard refresh before querying
      await waitForAuthReady();

      const selectPromise = supabase
        .from('threads')
        .select(`
          *,
          contacts(name, phone, email),
          channels(display_name, type, provider, external_id),
          messages(id, body, role, direction, created_at, seq)
        `)
        .order('last_msg_at', { ascending: false })
        .order('created_at', { foreignTable: 'messages', ascending: false })
        .limit(1, { foreignTable: 'messages' });

      const timeoutPromise = new Promise<never>((_, reject) => {
        const id = setTimeout(() => { clearTimeout(id); reject(new Error('timeout')); }, 8000);
      });

      const { data, error } = await Promise.race([selectPromise as any, timeoutPromise]) as any;

      if (error) throw error;

      // Build user map for display names
      const userIds: string[] = Array.from(new Set(
        (data || []).flatMap((t: any) => [t.assigned_by_user_id, t.assignee_user_id, t.resolved_by_user_id]).filter(Boolean)
      ));

      let userIdToName: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles, error: profileErr } = await supabase
          .from('users_profile')
          .select('user_id, display_name')
          .in('user_id', userIds);
        if (profileErr) throw profileErr;
        userIdToName = Object.fromEntries((profiles || []).map((p: any) => [p.user_id, p.display_name || '—']));
      }

      // Transform data to match the expected format
      const transformedData: ConversationWithDetails[] = (data || []).map((thread: any) => {
        const last = Array.isArray(thread.messages) && thread.messages.length > 0 ? thread.messages[0] : null;
        const lastPreview = (last?.body || '').toString().replace(/\s+/g, ' ').trim();
        const lastDir = last?.direction ?? null;
        const lastRole = last?.role ?? null;
        const unreplied = lastDir === 'in' || lastRole === 'user';
        return {
          ...thread,
          contact_name: thread.contacts?.name || 'Unknown Contact',
          contact_phone: thread.contacts?.phone || '',
          contact_email: thread.contacts?.email || '',
          channel_name: thread.channels?.display_name || 'Unknown Channel',
          channel_type: thread.channels?.type || 'web',
          channel_provider: thread.channels?.provider || undefined,
          channel: {
            provider: thread.channels?.provider,
            type: thread.channels?.type,
            display_name: thread.channels?.display_name,
            external_id: thread.channels?.external_id,
          },
          last_message_preview: lastPreview || '—',
          last_message_direction: lastDir,
          last_message_role: lastRole as any,
          message_count: 0,
          assigned: !!thread.assignee_user_id,
          assigned_by_name: thread.assigned_by_user_id ? (userIdToName[thread.assigned_by_user_id] || '—') : '—',
          assignee_name: thread.assignee_user_id ? (userIdToName[thread.assignee_user_id] || '—') : '—',
          resolved_by_name: thread.resolved_by_user_id ? (userIdToName[thread.resolved_by_user_id] || '—') : '—',
          unreplied,
        } as ConversationWithDetails;
      });

      setConversations(transformedData);
      // Cache for next refresh
      try { localStorage.setItem('app.cachedConversations', JSON.stringify(transformedData)); } catch {}

    } catch (error) {
      console.error('Error fetching conversations:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch conversations');
    } finally {
      setLoading(false);
    }
  };

  // Fetch messages for a specific thread
  const fetchMessages = async (threadId: string) => {
    try {
      setError(null);

      const { data, error } = await supabase
        .from('messages')
        .select(`
          id,
          thread_id,
          direction,
          role,
          type,
          body,
          payload,
          actor_kind,
          actor_id,
          seq,
          in_reply_to,
          edited_at,
          edit_reason,
          created_at
        `)
        .eq('thread_id', threadId)
        .order('seq', { ascending: true });

      if (error) throw error;

      // Get contact info from thread
      const { data: threadData } = await supabase
        .from('threads')
        .select(`
          contacts(name, phone, email)
        `)
        .eq('id', threadId)
        .maybeSingle();

      const contactName = (threadData as any)?.contacts?.name || 'Unknown Contact';

      // Transform data to match the expected format
      const transformedData: MessageWithDetails[] = (data || []).map((message: any) => ({
        ...message,
        contact_name: contactName,
        contact_avatar: contactName[0]?.toUpperCase() || 'U'
      }));

      setMessages(transformedData);
      setSelectedThreadId(threadId);

    } catch (error) {
      console.error('Error fetching messages:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch messages');
    }
  };

  // Send a new message
  const sendMessage = async (
    threadId: string,
    messageText: string,
    role: 'agent' | 'assistant' = 'assistant'
  ) => {
    try {
      setError(null);

      // First, get the thread details to extract channel_id and contact_id
      const { data: threadData, error: threadError } = await supabase
        .from('threads')
        .select('channel_id, contact_id')
        .eq('id', threadId)
        .single();

      if (threadError) throw threadError;

      const newMessage = {
        thread_id: threadId,
        direction: 'out' as const,
        role: role,
        type: 'text' as const,
        body: messageText,
        payload: {},
        actor_kind: 'agent' as const,
        actor_id: null
      };

      // Optimistically push a pending message to UI
      const optimisticId = `tmp_${Math.random().toString(36).slice(2)}`;
      const optimistic: MessageWithDetails = {
        id: optimisticId,
        thread_id: threadId,
        direction: 'out',
        role,
        type: 'text',
        body: messageText,
        payload: {},
        actor_kind: 'agent',
        actor_id: null,
        seq: 0,
        in_reply_to: null,
        edited_at: null,
        edit_reason: null,
        created_at: new Date().toISOString(),
        contact_name: '',
        contact_avatar: 'A',
        _status: 'pending'
      };
      setMessages(prev => [...prev, optimistic]);

      // Insert message into database (authoritative)
      const { data, error } = await supabase
        .from('messages')
        .insert([newMessage])
        .select()
        .single();

      if (error) throw error;

      // Get contact details for webhook payload
      const { data: contactData, error: contactError } = await supabase
        .from('contacts')
        .select('phone, external_id')
        .eq('id', threadData.contact_id)
        .single();

      if (contactError) {
        console.warn('Error fetching contact details:', contactError);
      }

      // Send webhook to external service
      try {
        const webhookPayload = {
          channel_id: threadData.channel_id,
          contact_id: threadData.contact_id,
          contact_phone: contactData?.phone || null,
          external_id: contactData?.external_id || null,
          text: messageText,
          type: 'text',
          direction: 'out',
          role: role
        };

        const webhookResponse = await fetch(WEBHOOK_CONFIG.buildUrl(WEBHOOK_CONFIG.ENDPOINTS.MESSAGE.SEND_MESSAGE), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(webhookPayload)
        });

        if (!webhookResponse.ok) {
          console.warn('Webhook call failed:', webhookResponse.status, webhookResponse.statusText);
        }
      } catch (webhookError) {
        console.error('Error calling webhook:', webhookError);
        // Don't throw here - we still want to save the message locally even if webhook fails
      }

      // Replace optimistic pending with fresh list including the inserted message
      await fetchMessages(threadId);

      // Audit log
      try {
        await logAction({
          action: 'message.send',
          resource: 'message',
          resourceId: (data as any)?.id ?? null,
          context: { thread_id: threadId, role }
        });
      } catch {}

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
      await fetchConversations();

      // Audit log
      try {
        await logAction({ action: 'thread.create', resource: 'thread', resourceId: (data as any)?.id ?? null, context: { contact_id: contactId, channel_id: channelId } });
      } catch {}

      return data;
    } catch (error) {
      console.error('Error creating conversation:', error);
      setError(error instanceof Error ? error.message : 'Failed to create conversation');
      throw error;
    }
  };

  // Update thread status
  const updateThreadStatus = async (threadId: string, status: 'open' | 'pending' | 'closed') => {
    try {
      setError(null);

      const { error } = await supabase
        .from('threads')
        .update({ status })
        .eq('id', threadId);

      if (error) throw error;

      // Refresh conversations
      await fetchConversations();

      // Audit log
      try { await logAction({ action: 'thread.update_status', resource: 'thread', resourceId: threadId, context: { status } }); } catch {}

    } catch (error) {
      console.error('Error updating thread status:', error);
      setError(error instanceof Error ? error.message : 'Failed to update thread status');
      throw error;
    }
  };

  // Assign thread to current user (ensures DB assignment and audit fields)
  const assignThread = async (threadId: string, _userId: string) => {
    try {
      setError(null);

      // Try RPC first (preferred path)
      const { error: rpcError } = await supabase
        .rpc('takeover_thread', { p_thread_id: threadId });

      if (rpcError) {
        console.warn('takeover_thread RPC failed; will attempt direct update', rpcError);
      }

      // Ensure the thread is actually assigned to current user
      const { data: authData } = await supabase.auth.getUser();
      const currentUserId = authData?.user?.id || null;

      try {
        const { data: threadAfterRpc } = await supabase
          .from('threads')
          .select('assignee_user_id')
          .eq('id', threadId)
          .single();

        const alreadyAssigned = !!threadAfterRpc?.assignee_user_id;
        if (!alreadyAssigned && currentUserId) {
          const { error: updateErr } = await supabase
            .from('threads')
            .update({
              assignee_user_id: currentUserId,
              assigned_by_user_id: currentUserId,
              assigned_at: new Date().toISOString(),
              handover_reason: 'other:manual_takeover'
            })
            .eq('id', threadId);
          if (updateErr) {
            console.warn('Fallback assignment update failed', updateErr);
          }
        }
      } catch (verifyErr) {
        console.warn('Failed verifying assignment state', verifyErr);
      }

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

        await supabase.from('messages').insert([{
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
      await fetchConversations();
      await fetchMessages(threadId);

      // Audit log
      try { await logAction({ action: 'thread.assign', resource: 'thread', resourceId: threadId, context: { assignee_user_id: _userId } }); } catch {}

    } catch (error) {
      console.error('Error assigning thread:', error);
      setError(error instanceof Error ? error.message : 'Failed to assign thread');
      throw error;
    }
  };

  // Add collaborator to thread
  const addThreadParticipant = async (threadId: string, userId: string) => {
    try {
      setError(null);

      const { error } = await supabase
        .from('thread_collaborators')
        .insert([{ thread_id: threadId, user_id: userId }]);

      if (error) throw error;

      try { await logAction({ action: 'thread.add_participant', resource: 'thread', resourceId: threadId, context: { user_id: userId } }); } catch {}

    } catch (error) {
      console.error('Error adding thread participant:', error);
      setError(error instanceof Error ? error.message : 'Failed to add thread participant');
      throw error;
    }
  };

  // Remove collaborator from thread
  const removeThreadParticipant = async (threadId: string, userId: string) => {
    try {
      setError(null);

      const { error } = await supabase
        .from('thread_collaborators')
        .delete()
        .eq('thread_id', threadId)
        .eq('user_id', userId);

      if (error) throw error;

      try { await logAction({ action: 'thread.remove_participant', resource: 'thread', resourceId: threadId, context: { user_id: userId } }); } catch {}

    } catch (error) {
      console.error('Error removing thread participant:', error);
      setError(error instanceof Error ? error.message : 'Failed to remove thread participant');
      throw error;
    }
  };

  // Add label to thread
  const addThreadLabel = async (threadId: string, labelId: string) => {
    try {
      setError(null);

      const { error } = await supabase
        .from('thread_labels')
        .insert([{ thread_id: threadId, label_id: labelId }]);

      if (error) throw error;

      try { await logAction({ action: 'thread.add_label', resource: 'thread', resourceId: threadId, context: { label_id: labelId } }); } catch {}

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
        .from('thread_labels')
        .delete()
        .eq('thread_id', threadId)
        .eq('label_id', labelId);

      if (error) throw error;

      try { await logAction({ action: 'thread.remove_label', resource: 'thread', resourceId: threadId, context: { label_id: labelId } }); } catch {}

    } catch (error) {
      console.error('Error removing thread label:', error);
      setError(error instanceof Error ? error.message : 'Failed to remove thread label');
      throw error;
    }
  };

  // Initial fetch on mount (gate on visibility to avoid background fetch on tab-restore)
  useEffect(() => {
    // Hydrate from cache for instant UI; fetch fresh data when visible
    hydrateFromCache();
    if (isDocumentHidden()) {
      onDocumentVisible(() => { fetchConversations(); });
    } else {
      fetchConversations();
    }
  }, []);

  // Realtime: keep conversations list in sync with DB (subscribe only when visible)
  useEffect(() => {
    if (isDocumentHidden()) {
      let unsub: (() => void) | null = null;
      onDocumentVisible(() => {
        const channel = supabase
          .channel('threads-realtime')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'threads' }, () => {
            fetchConversations();
          })
          .subscribe();
        unsub = () => { try { supabase.removeChannel(channel); } catch {} };
      });
      return () => { if (unsub) unsub(); };
    }
    const channel = supabase
      .channel('threads-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'threads' }, () => {
        scheduleConversationsRefresh(200);
      })
      .subscribe();

    return () => {
      try { supabase.removeChannel(channel); } catch {}
    };
  }, []);

  // Realtime: refresh conversation list when any message changes (affects ordering/preview)
  useEffect(() => {
    const channel = supabase
      .channel('messages-realtime-for-convlist')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => scheduleConversationsRefresh(300))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, () => scheduleConversationsRefresh(300))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, () => scheduleConversationsRefresh(300))
      .subscribe();

    return () => {
      try { supabase.removeChannel(channel); } catch {}
      try { if (conversationsRefreshTimer.current) { clearTimeout(conversationsRefreshTimer.current); conversationsRefreshTimer.current = null; } } catch {}
    };
  }, []);

  // Realtime: keep messages in sync for the selected thread (subscribe only when visible)
  useEffect(() => {
    if (!selectedThreadId) return;
    if (isDocumentHidden()) {
      let unsub: (() => void) | null = null;
      onDocumentVisible(() => {
        const channel = supabase
          .channel(`messages-${selectedThreadId}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `thread_id=eq.${selectedThreadId}` }, () => {
            fetchMessages(selectedThreadId);
          })
          .subscribe();
        unsub = () => { try { supabase.removeChannel(channel); } catch {} };
      });
      return () => { if (unsub) unsub(); };
    }
    const channel = supabase
      .channel(`messages-${selectedThreadId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `thread_id=eq.${selectedThreadId}` }, () => {
        fetchMessages(selectedThreadId);
      })
      .subscribe();
    return () => {
      try { supabase.removeChannel(channel); } catch {}
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
    createConversation,
    updateThreadStatus,
    assignThread,
    addThreadParticipant,
    removeThreadParticipant,
    addThreadLabel,
    removeThreadLabel,
  };
};
