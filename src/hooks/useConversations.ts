import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import WEBHOOK_CONFIG from '@/config/webhook';

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
  last_message_preview: string;
  message_count: number;
  assigned: boolean;
  assigned_by_name?: string;
  assignee_name?: string;
  resolved_by_name?: string;
}

export interface MessageWithDetails extends Message {
  // Additional fields for display
  contact_name: string;
  contact_avatar: string;
}

export const useConversations = () => {
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
  const [messages, setMessages] = useState<MessageWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

  // Fetch conversations with contact and channel details
  const fetchConversations = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('threads')
        .select(`
          *,
          contacts(name, phone, email),
          channels(display_name, type)
        `)
        // .eq('org_id', '00000000-0000-0000-0000-000000000001')
        .order('last_msg_at', { ascending: false });

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
      const transformedData: ConversationWithDetails[] = (data || []).map((thread: any) => ({
        ...thread,
        contact_name: thread.contacts?.name || 'Unknown Contact',
        contact_phone: thread.contacts?.phone || '',
        contact_email: thread.contacts?.email || '',
        channel_name: thread.channels?.display_name || 'Unknown Channel',
        channel_type: thread.channels?.type || 'web',
        last_message_preview: 'Last message preview...', // This would come from messages table
        message_count: 0, // This would be calculated from messages table
        assigned: !!thread.assignee_user_id,
        assigned_by_name: thread.assigned_by_user_id ? (userIdToName[thread.assigned_by_user_id] || '—') : '—',
        assignee_name: thread.assignee_user_id ? (userIdToName[thread.assignee_user_id] || '—') : '—',
        resolved_by_name: thread.resolved_by_user_id ? (userIdToName[thread.resolved_by_user_id] || '—') : '—',
      }));

      setConversations(transformedData);

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
          contacts!inner(name, phone, email)
        `)
        .eq('id', threadId)
        .single();

      const contactName = (threadData?.contacts as any)?.name || 'Unknown Contact';

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
  const sendMessage = async (threadId: string, messageText: string, role: 'agent' | 'assistant' = 'assistant') => {
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

      // Insert message into database
      const { data, error } = await supabase
        .from('messages')
        .insert([newMessage])
        .select()
        .single();

      if (error) throw error;

      // Get contact details for webhook payload
      const { data: contactData, error: contactError } = await supabase
        .from('contacts')
        .select('phone')
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
          body: messageText,
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

      // Refresh messages
      await fetchMessages(threadId);

      return data;
    } catch (error) {
      console.error('Error sending message:', error);
      setError(error instanceof Error ? error.message : 'Failed to send message');
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

    } catch (error) {
      console.error('Error updating thread status:', error);
      setError(error instanceof Error ? error.message : 'Failed to update thread status');
      throw error;
    }
  };

  // Assign thread to current user (uses RPC to also set audit fields)
  const assignThread = async (threadId: string, _userId: string) => {
    try {
      setError(null);

      const { error } = await supabase
        .rpc('takeover_thread', { p_thread_id: threadId });

      if (error) throw error;

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

      // Refresh conversations
      await fetchConversations();
      await fetchMessages(threadId);

    } catch (error) {
      console.error('Error assigning thread:', error);
      setError(error instanceof Error ? error.message : 'Failed to assign thread');
      throw error;
    }
  };

  // Add participant to thread
  const addThreadParticipant = async (threadId: string, userId: string) => {
    try {
      setError(null);

      const { error } = await supabase
        .from('thread_participants')
        .insert([{ thread_id: threadId, user_id: userId }]);

      if (error) throw error;

    } catch (error) {
      console.error('Error adding thread participant:', error);
      setError(error instanceof Error ? error.message : 'Failed to add thread participant');
      throw error;
    }
  };

  // Remove participant from thread
  const removeThreadParticipant = async (threadId: string, userId: string) => {
    try {
      setError(null);

      const { error } = await supabase
        .from('thread_participants')
        .delete()
        .eq('thread_id', threadId)
        .eq('user_id', userId);

      if (error) throw error;

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

    } catch (error) {
      console.error('Error removing thread label:', error);
      setError(error instanceof Error ? error.message : 'Failed to remove thread label');
      throw error;
    }
  };

  // Initial fetch on mount
  useEffect(() => {
    fetchConversations();
  }, []);

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
