import { useState, useEffect, useRef } from 'react';
import { supabase, logAction, protectedSupabase } from '@/lib/supabase';
import { defaultFallbackHandler } from '@/lib/fallbackHandler';
import { waitForAuthReady } from '@/lib/authReady';
import WEBHOOK_CONFIG from '@/config/webhook';
import { callWebhook } from '@/lib/webhookClient';
import { resolveSendMessageEndpoint } from '@/config/webhook';
import { isDocumentHidden, onDocumentVisible } from '@/lib/utils';
import { startOfDay, endOfDay } from 'date-fns';
import { AUTHZ_CHANGED_EVENT } from '@/lib/authz';

// Audio notification system with debouncing
let lastNotificationTime = 0;
const NOTIFICATION_DEBOUNCE_MS = 1000; // Prevent duplicate sounds within 1 second

const playNotificationSound = (type: 'incoming' | 'outgoing' = 'incoming') => {
  try {
    // Check if audio is enabled
    const audioEnabled = localStorage.getItem('audioNotifications') !== 'false';
    if (!audioEnabled) return;

    // Only play sounds when the tab is visible
    if (document.visibilityState !== 'visible') {

      return;
    }

    // Debounce notifications to prevent duplicate sounds
    const now = Date.now();
    if (now - lastNotificationTime < NOTIFICATION_DEBOUNCE_MS) {

      return;
    }
    lastNotificationTime = now;

    const audio = new Audio();

    if (type === 'incoming') {
      // Use the message pop alert for incoming messages
      audio.src = '/tones/mixkit-message-pop-alert-2354.mp3';
    } else {
      // Use the long pop for outgoing messages (optional)
      audio.src = '/tones/mixkit-long-pop-2358.wav';
    }

    audio.volume = 0.7; // Set a reasonable volume
    audio.play().catch(() => { });
  } catch { }
};

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
    logo_url?: string | null;
    profile_photo_url?: string | null;
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
}

export const useConversations = () => {
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
  const [messages, setMessages] = useState<MessageWithDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const filtersRef = useRef<ThreadFilters>({});
  const [activeFilters, setActiveFilters] = useState<ThreadFilters>({});
  const conversationsRefreshTimer = useRef<number | null>(null);

  const scheduleConversationsRefresh = (delayMs: number = 400) => {
    try { if (conversationsRefreshTimer.current) { clearTimeout(conversationsRefreshTimer.current); conversationsRefreshTimer.current = null; } } catch { }
    conversationsRefreshTimer.current = window.setTimeout(() => {
      // Only refresh if the document is visible to prevent unnecessary fetches when tab is hidden
      if (document.visibilityState === 'visible') {
        // Prevent parallel fetches
        if (!loading) {
          fetchConversations();
        }
      }
    }, delayMs) as unknown as number;
  };

  // More targeted refresh for specific thread updates
  const updateConversationPreview = (threadId: string, lastMessage: any) => {
    setConversations(prev => {
      const updated = prev.map(conv => {
        if (conv.id === threadId) {
          return {
            ...conv,
            last_message_preview: (lastMessage?.body || '').toString().replace(/\s+/g, ' ').trim() || '—',
            last_message_direction: lastMessage?.direction ?? null,
            last_message_role: lastMessage?.role ?? null,
            last_msg_at: lastMessage?.created_at || conv.last_msg_at,
            unreplied: lastMessage?.direction === 'in' || lastMessage?.role === 'user'
          };
        }
        return conv;
      });

      // Re-sort conversations after update so newest activity is always first
      const sorted = updated.sort((a, b) => {
        const aTime = new Date(a.last_msg_at ?? a.created_at ?? 0).getTime();
        const bTime = new Date(b.last_msg_at ?? b.created_at ?? 0).getTime();
        return bTime - aTime;
      });

      console.log('Re-sorted conversations after message update');
      return sorted;
    });
  };

  // Fetch conversations with contact and channel details
  const fetchConversations = async (overrideFilters?: ThreadFilters) => {
    try {
      setLoading(true);
      setError(null);
      // Ensure auth restoration completed on hard refresh before querying
      await waitForAuthReady();

      const filtersToUse = overrideFilters ?? filtersRef.current;
      if (overrideFilters) {
        filtersRef.current = overrideFilters;
        setActiveFilters(overrideFilters);
      }

      let query = protectedSupabase
        .from('threads')
        .select(`
          *,
          contacts(name, phone, email),
          channels!inner(display_name, type, provider, external_id, logo_url, profile_photo_url),
          messages(id, body, role, direction, created_at, seq)
        `)
        .order('last_msg_at', { ascending: false })
        .order('created_at', { foreignTable: 'messages', ascending: false })
        .limit(1, { foreignTable: 'messages' });

      const { dateRange, status, agent, resolvedBy, inbox, channelType, platformId } = filtersToUse;

      /* Client-side filtering implemented below for consistency
      if (dateRange?.from) {
        const fromIso = startOfDay(dateRange.from).toISOString();
        query = query.gte('last_msg_at', fromIso);
      }
      if (dateRange?.to) {
        const toIso = endOfDay(dateRange.to).toISOString();
        query = query.lte('last_msg_at', toIso);
      }
      */
      if (status && status !== 'all' && status !== '') {
        query = query.eq('status', status);
      }
      if (agent && agent !== 'all' && agent !== '') {
        query = query.eq('assignee_user_id', agent);
      }
      if (resolvedBy && resolvedBy !== 'all' && resolvedBy !== '') {
        query = query.eq('resolved_by_user_id', resolvedBy);
      }
      if (inbox && inbox !== 'all' && inbox !== '') {
        query = query.eq('channels.provider', inbox);
      }
      if (channelType && channelType !== 'all' && channelType !== '') {
        // In this schema, channels.provider is the transport (telegram/web/whatsapp).
        // channels.type is typically 'bot' / 'inbox' etc.
        query = query.eq('channels.provider', channelType);
      }
      if (platformId && platformId !== 'all' && platformId !== '') {
        query = query.eq('channel_id', platformId);
      }

      const timeoutPromise = new Promise<never>((_, reject) => {
        const id = setTimeout(() => { clearTimeout(id); reject(new Error('timeout')); }, 8000);
      });

      const { data, error } = await Promise.race([
        query as any,
        timeoutPromise,
      ]) as any;

      if (error) throw error;

      // Build user map for display names
      const userIds: string[] = Array.from(new Set(
        (data || []).flatMap((t: any) => [t.assigned_by_user_id, t.assignee_user_id, t.resolved_by_user_id]).filter(Boolean)
      ));

      let userIdToName: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles, error: profileErr } = await protectedSupabase
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

        // Log to verify we're getting the latest message timestamp

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
            logo_url: thread.channels?.logo_url || null,
            profile_photo_url: thread.channels?.profile_photo_url || null,
          },
          channel_logo_url: thread.channels?.logo_url || thread.channels?.profile_photo_url || null,
          last_message_preview: lastPreview || '—',
          last_message_direction: lastDir,
          last_message_role: lastRole as any,
          // Use the timestamp from the latest message instead of the database's last_msg_at
          last_msg_at: last?.created_at || thread.last_msg_at,
          message_count: 0,
          assigned: !!thread.assignee_user_id,
          assigned_by_name: thread.assigned_by_user_id ? (userIdToName[thread.assigned_by_user_id] || '—') : '—',
          assignee_name: thread.assignee_user_id ? (userIdToName[thread.assignee_user_id] || '—') : '—',
          resolved_by_name: thread.resolved_by_user_id ? (userIdToName[thread.resolved_by_user_id] || '—') : '—',
          unreplied,
        } as ConversationWithDetails;
      });

      // Filter data client-side for consistent date handling
      let filteredData = transformedData;
      if (dateRange?.from) {
        const fromTime = startOfDay(dateRange.from).getTime();
        filteredData = filteredData.filter(t => new Date(t.last_msg_at).getTime() >= fromTime);
      }
      if (dateRange?.to) {
        const toTime = endOfDay(dateRange.to).getTime();
        filteredData = filteredData.filter(t => new Date(t.last_msg_at).getTime() <= toTime);
      }
      // Defensive client-side filters (in case PostgREST join filters are bypassed)
      if (inbox && inbox !== 'all' && inbox !== '') {
        filteredData = filteredData.filter(t => String(t.channel_provider || t.channel?.provider || '').toLowerCase() === String(inbox).toLowerCase());
      }
      if (channelType && channelType !== 'all' && channelType !== '') {
        filteredData = filteredData.filter(t => String(t.channel_provider || t.channel?.provider || '').toLowerCase() === String(channelType).toLowerCase());
      }
      if (platformId && platformId !== 'all' && platformId !== '') {
        filteredData = filteredData.filter(t => String((t as any).channel_id || '') === String(platformId));
      }

      // Sort conversations by most recent activity so outbound replies bubble to the top
      const sortedData = filteredData.sort((a, b) => {
        const aTime = new Date(a.last_msg_at ?? a.created_at ?? 0).getTime();
        const bTime = new Date(b.last_msg_at ?? b.created_at ?? 0).getTime();
        return bTime - aTime;
      });


      setConversations(sortedData);

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

      // First, get the thread details to extract channel_id, contact_id, and provider
      const { data: threadData, error: threadError } = await supabase
        .from('threads')
        .select('channel_id, contact_id, channels(provider)')
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

      // Resolve endpoint by provider (avoid relying on global mutable state)
      try {
        // Prefer provider from our in-memory conversations list to avoid extra DB calls
        const conv = conversations.find(c => c.id === threadId);
        const provider = (conv?.channel?.provider || (threadData as any)?.channels?.provider) as string | undefined;
        const endpoint = resolveSendMessageEndpoint(provider);

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
      } catch (webhookError) {
        console.error('Error calling webhook:', webhookError);
        // Don't throw here - we still want to save the message locally even if webhook fails
      }

      // Replace optimistic pending with fresh list including the inserted message
      await fetchMessages(threadId);

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
      await fetchConversations();

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
      try { await logAction({ action: 'thread.update_status', resource: 'thread', resourceId: threadId, context: { status } }); } catch { }

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
              handover_reason: 'other:manual_takeover',
              ai_access_enabled: false
            })
            .eq('id', threadId);
          if (updateErr) {
            console.warn('Fallback assignment update failed', updateErr);
          }
        }
      } catch (verifyErr) {
        console.warn('Failed verifying assignment state', verifyErr);
      }

      // Ensure AI access is disabled even if already assigned
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
      await fetchConversations();
      await fetchMessages(threadId);

      // Audit log
      try { await logAction({ action: 'thread.assign', resource: 'thread', resourceId: threadId, context: { assignee_user_id: _userId } }); } catch { }

    } catch (error) {
      console.error('Error assigning thread:', error);
      setError(error instanceof Error ? error.message : 'Failed to assign thread');
      throw error;
    }
  };

  // Assign thread to a specific user (not a takeover). Used by supervisors to reassign.
  const assignThreadToUser = async (threadId: string, assigneeUserId: string | null) => {
    try {
      setError(null);

      const { data: authData } = await supabase.auth.getUser();
      const currentUserId = authData?.user?.id || null;

      const nowIso = new Date().toISOString();
      const updatePayload: Record<string, any> = {
        assignee_user_id: assigneeUserId,
        handover_reason: assigneeUserId ? 'other:manual_assign' : 'other:manual_unassign',
        ai_access_enabled: false,
      };

      if (assigneeUserId) {
        updatePayload.assigned_by_user_id = currentUserId;
        updatePayload.assigned_at = nowIso;
      } else {
        updatePayload.assigned_by_user_id = null;
        updatePayload.assigned_at = null;
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
        const eventEntry = {
          thread_id: threadId,
          direction: null,
          role: 'system' as const,
          type: 'event' as const,
          body: '',
          payload: {} as Record<string, any>,
        };

        if (assigneeUserId) {
          const assignedToName = nameMap[assigneeUserId] || 'agent';
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
      await fetchConversations();
      await fetchMessages(threadId);

      // Audit log
      try { await logAction({ action: 'thread.assign', resource: 'thread', resourceId: threadId, context: { assignee_user_id: assigneeUserId } }); } catch { }
    } catch (error) {
      console.error('Error assigning thread to user:', error);
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

      try { await logAction({ action: 'thread.add_participant', resource: 'thread', resourceId: threadId, context: { user_id: userId } }); } catch { }

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

      try { await logAction({ action: 'thread.remove_participant', resource: 'thread', resourceId: threadId, context: { user_id: userId } }); } catch { }

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
        .from('thread_labels')
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

      await fetchConversations();

    } catch (error) {
      console.error('Error deleting thread:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete conversation');
      throw error;
    }
  };

  // Initial fetch on mount - guard against duplicate calls
  useEffect(() => {
    // Avoid overlapping with other triggers by scheduling slightly
    scheduleConversationsRefresh(10);
  }, []);

  // Authorization changes: clear any in-memory UI state and refetch.
  useEffect(() => {
    const handler = () => {
      try {
        setConversations([]);
        setMessages([]);
        setSelectedThreadId(null);
        setError(null);
      } catch {}
      try {
        // Force a refresh using the currently active filters
        scheduleConversationsRefresh(50);
      } catch {}
    };
    try {
      window.addEventListener(AUTHZ_CHANGED_EVENT as any, handler as any);
    } catch {}
    return () => {
      try { window.removeEventListener(AUTHZ_CHANGED_EVENT as any, handler as any); } catch {}
    };
  }, []);

  // Auto-resolve check function
  const checkAutoResolve = async () => {
    try {
      const { data, error } = await protectedSupabase.rpc('check_and_auto_resolve_threads');
      if (error) {
        console.error('Auto-resolve check failed:', error);
        return;
      }

      if (data && data.length > 0) {

        // Refresh conversations to show updated status
        fetchConversations();
      }
    } catch (error) {
      console.error('Auto-resolve check error:', error);
    }
  };

  // Set up periodic auto-resolve check (every 30 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        checkAutoResolve();
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, []);

  // Realtime: keep conversations list in sync with DB
  useEffect(() => {
    const channel = supabase
      .channel('threads-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'threads' }, () => {
        if (document.visibilityState === 'visible') {
          scheduleConversationsRefresh(200);
        }
      })
      .subscribe();

    return () => {
      try { supabase.removeChannel(channel); } catch { }
    };
  }, []);

  // Realtime: refresh conversation list when any message changes (affects ordering/preview)
  // But only for incoming messages, not outgoing ones to avoid refresh when sending
  useEffect(() => {
    const channel = supabase
      .channel('messages-realtime-for-convlist')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages'
      }, (payload) => {
        // Only refresh for incoming messages or system messages
        // Skip outgoing messages (direction: 'out') to avoid refresh when sending
        const message = payload.new;
        if (message && message.direction === 'in' && document.visibilityState === 'visible') {
          // Play notification sound for incoming messages
          playNotificationSound('incoming');
          // Immediately update the conversation preview and re-sort
          updateConversationPreview(message.thread_id, message);
          scheduleConversationsRefresh(100); // Also do a full refresh for consistency
          // Check auto-resolve after user message (cancels auto-resolve)
          checkAutoResolve();
        } else if (message && (message.role === 'system' || message.type === 'event') && document.visibilityState === 'visible') {
          // Play notification sound for system messages
          playNotificationSound('incoming');
          // Immediately update the conversation preview and re-sort
          updateConversationPreview(message.thread_id, message);
          scheduleConversationsRefresh(200); // Also do a full refresh for consistency
        } else if (
          // Also react to outgoing agent/assistant messages created outside this client
          // so newly created/AI-started conversations bubble to the top
          message &&
          message.direction === 'out' &&
          (message.role === 'agent' || message.role === 'assistant') &&
          document.visibilityState === 'visible'
        ) {
          // No sound for outgoing
          updateConversationPreview(message.thread_id, message);
          // Light refresh to keep ordering accurate
          scheduleConversationsRefresh(200);
        } else if (message && message.role === 'agent' && message.direction === 'out' && document.visibilityState === 'visible') {
          // AI responded, auto-resolve timer will be set by database trigger
          // Check for any threads that might be ready for auto-resolve
          checkAutoResolve();
        }
        // Skip outgoing messages (direction: 'out') - these are handled by the sendMessage function
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages'
      }, () => {
        // Only refresh on message updates that might affect conversation preview
        if (document.visibilityState === 'visible') {
          scheduleConversationsRefresh(500);
        }
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'messages'
      }, () => {
        // Refresh on message deletion as it affects conversation state
        if (document.visibilityState === 'visible') {
          scheduleConversationsRefresh(300);
        }
      })
      .subscribe();

    return () => {
      try { supabase.removeChannel(channel); } catch { }
      try { if (conversationsRefreshTimer.current) { clearTimeout(conversationsRefreshTimer.current); conversationsRefreshTimer.current = null; } } catch { }
    };
  }, []);

  // Realtime: keep messages in sync for the selected thread
  useEffect(() => {
    if (!selectedThreadId) return;

    // Set up a periodic refresh as a fallback (every 30 seconds)
    const refreshInterval = setInterval(() => { fetchMessages(selectedThreadId); }, 30000);

    const channel = supabase
      .channel(`messages-${selectedThreadId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `thread_id=eq.${selectedThreadId}`
      }, (payload) => {
        const message = payload.new as any;
        // Play notification sound for incoming messages
        if (message && message.direction === 'in') {
          playNotificationSound('incoming');
        }
        // Apply realtime payload to state to avoid full refresh jumps
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
          return merged;
        });
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `thread_id=eq.${selectedThreadId}`
      }, (payload) => {
        const message = payload.new as any;
        setMessages(prev => {
          const idx = prev.findIndex(m => m.id === message?.id);
          if (idx < 0) return prev;
          const updated: MessageWithDetails = { ...prev[idx], ...(message || {}) };
          const next = [...prev];
          next[idx] = updated;
          next.sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
          return next;
        });
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'messages',
        filter: `thread_id=eq.${selectedThreadId}`
      }, (payload) => {
        const message = (payload.old || payload.new) as any;
        const id = message?.id;
        if (!id) return;
        setMessages(prev => prev.filter(m => m.id !== id));
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('Error subscribing to messages for thread:', selectedThreadId);
          setTimeout(() => { fetchMessages(selectedThreadId); }, 1000);
        }
      });

    return () => {
      clearInterval(refreshInterval);
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
    testAudioNotification: () => { playNotificationSound('incoming'); },
    createConversation,
    updateThreadStatus,
    assignThread,
    assignThreadToUser,
    addThreadParticipant,
    removeThreadParticipant,
    addThreadLabel,
    removeThreadLabel,
    deleteThread,
    // Auto-resolve functionality
    checkAutoResolve,
    activeFilters,
  };
};
