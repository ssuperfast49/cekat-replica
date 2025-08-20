import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface Thread {
  id: string;
  org_id: string;
  contact_id: string;
  channel_id: string;
  status: 'open' | 'pending' | 'closed';
  assignee_user_id: string | null;
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
        assigned: !!thread.assignee_user_id
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
        .order('seq', { ascending: true });

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
        payload: {},
        actor_kind: 'agent' as const,
        actor_id: null
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

  // Assign thread to user
  const assignThread = async (threadId: string, userId: string) => {
    try {
      setError(null);

      const { error } = await supabase
        .from('threads')
        .update({ assignee_user_id: userId })
        .eq('id', threadId);

      if (error) throw error;

      // Refresh conversations
      await fetchConversations();

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
