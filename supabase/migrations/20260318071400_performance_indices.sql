-- Performance Optimization Indexes
-- These indexes drastically reduce the sorting and joining overhead for the main chat inbox queries.

-- 1. Index for sorting threads by status and last_msg_at descending (used heavily by inbox tabs)
CREATE INDEX IF NOT EXISTS idx_threads_status_last_msg 
ON public.threads USING btree (status, last_msg_at DESC);

-- 2. Covering index for the 'latest message' lateral join (fetching the most recent message per thread)
CREATE INDEX IF NOT EXISTS idx_messages_thread_idx_created_desc 
ON public.messages USING btree (thread_id, created_at DESC);

-- 3. Indexes to prevent table-scan timeouts during ON DELETE CASCADE operations
CREATE INDEX IF NOT EXISTS idx_messages_in_reply_to 
ON public.messages USING btree (in_reply_to);

CREATE INDEX IF NOT EXISTS idx_token_usage_logs_message_id 
ON public.token_usage_logs USING btree (message_id);
