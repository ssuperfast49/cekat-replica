/**
 * Utility functions for checking AI message limits and auto-assigning to super agent
 */

/**
 * Check if AI message limit is exceeded for a thread
 * @param supabase - Supabase client instance (can be protected or regular)
 * @param threadId - Thread ID to check
 * @returns Object with limit info and exceeded status
 */
export async function checkAIMessageLimit(
  supabase: any, // Accept any Supabase-like client (protected or regular)
  threadId: string
): Promise<{
  currentCount: number;
  limit: number;
  isExceeded: boolean;
  superAgentId: string | null;
}> {
  try {
    // Get thread with channel and AI profile info
    const { data: threadData, error: threadError } = await supabase
      .from('threads')
      .select(`
        id,
        channel_id,
        channels!inner(
          id,
          super_agent_id,
          ai_profile_id,
          ai_profiles!inner(
            id,
            message_limit
          )
        )
      `)
      .eq('id', threadId)
      .maybeSingle();

    if (threadError) {
      throw new Error(`Failed to fetch thread data: ${threadError.message}`);
    }

    if (!threadData) {
      // Return safe defaults if thread not found
      return {
        currentCount: 0,
        limit: 1000,
        isExceeded: false,
        superAgentId: null,
      };
    }

    const channel = (threadData as any).channels;
    const aiProfile = channel?.ai_profiles;
    const messageLimit = aiProfile?.message_limit || 1000;
    const superAgentId = channel?.super_agent_id || null;

    // Count AI messages (role = 'assistant') for this thread
    const { count, error: countError } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('thread_id', threadId)
      .eq('role', 'assistant');

    if (countError) {
      throw new Error(`Failed to count AI messages: ${countError.message}`);
    }

    const currentCount = count || 0;
    const isExceeded = currentCount >= messageLimit;

    return {
      currentCount,
      limit: messageLimit,
      isExceeded,
      superAgentId,
    };
  } catch (error) {
    console.error('Error checking AI message limit:', error);
    // Return safe defaults
    return {
      currentCount: 0,
      limit: 1000,
      isExceeded: false,
      superAgentId: null,
    };
  }
}

/**
 * Auto-assign thread to super agent when AI message limit is exceeded
 * @param supabase - Supabase client instance (can be protected or regular)
 * @param threadId - Thread ID to assign
 * @param superAgentId - Super agent user ID to assign to
 * @returns Success status
 */
export async function autoAssignToSuperAgent(
  supabase: any, // Accept any Supabase-like client (protected or regular)
  threadId: string,
  superAgentId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get current user for assigned_by_user_id
    const { data: { user } } = await supabase.auth.getUser();
    const currentUserId = user?.id;

    // Update thread to assign to super agent
    const { error: updateError } = await supabase
      .from('threads')
      .update({
        assignee_user_id: superAgentId,
        assigned_by_user_id: currentUserId || null,
        assigned_at: new Date().toISOString(),
        // Disable AI access when limit exceeded
        ai_access_enabled: false,
      })
      .eq('id', threadId);

    if (updateError) {
      throw new Error(`Failed to assign thread: ${updateError.message}`);
    }

    return { success: true };
  } catch (error) {
    console.error('Error auto-assigning to super agent:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

