import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

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
  direction: 'in' | 'out';
  role: 'user' | 'assistant' | 'agent' | 'system';
  type: 'text' | 'image' | 'video' | 'audio' | 'file' | 'sticker' | 'location';
  body: string | null;
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
        .eq('org_id', '00000000-0000-0000-0000-000000000001')
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
          *,
          threads!inner(
            contacts!inner(name, phone, email)
          )
        `)
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Transform data to match the expected format
      const transformedData: MessageWithDetails[] = (data || []).map((message: any) => ({
        ...message,
        contact_name: message.threads?.contacts?.name || 'Unknown Contact',
        contact_avatar: (message.threads?.contacts?.name || 'U')[0].toUpperCase()
      }));

      setMessages(transformedData);
      setSelectedThreadId(threadId);

    } catch (error) {
      console.error('Error fetching messages:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch messages');
    }
  };

  // Send a new message
  const sendMessage = async (threadId: string, messageText: string) => {
    try {
      setError(null);

      const newMessage = {
        thread_id: threadId,
        direction: 'out' as const,
        role: 'assistant' as const,
        type: 'text' as const,
        body: messageText,
        topic: 'chat',
        extension: 'text',
        payload: {},
        event: null,
        private: false
      };

      const { data, error } = await supabase
        .from('messages')
        .insert([newMessage])
        .select()
        .single();

      if (error) throw error;

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
        org_id: '00000000-0000-0000-0000-000000000001',
        contact_id: contactId,
        channel_id: channelId,
        status: 'open' as const,
        assignee_user_id: null
      };

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

      // Refresh conversations
      await fetchConversations();

    } catch (error) {
      console.error('Error assigning thread:', error);
      setError(error instanceof Error ? error.message : 'Failed to assign thread');
      throw error;
    }
  };

  // Toggle conversation access (block/unblock)
  const setConversationBlocked = async (threadId: string, blocked: boolean) => {
    try {
      setError(null);
      const { error } = await supabase
        .from('threads')
        .update({ is_blocked: blocked })
        .eq('id', threadId);
      if (error) throw error;
      await fetchConversations();
    } catch (error) {
      console.error('Error updating conversation access:', error);
      setError(error instanceof Error ? error.message : 'Failed to update conversation access');
      throw error;
    }
  };

  // Toggle AI access on a conversation
  const setAIAccessEnabled = async (threadId: string, enabled: boolean) => {
    try {
      setError(null);
      const { error } = await supabase
        .from('threads')
        .update({ ai_access_enabled: enabled })
        .eq('id', threadId);
      if (error) throw error;
      await fetchConversations();
    } catch (error) {
      console.error('Error updating AI access:', error);
      setError(error instanceof Error ? error.message : 'Failed to update AI access');
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
    setConversationBlocked,
    setAIAccessEnabled,
  };
};
