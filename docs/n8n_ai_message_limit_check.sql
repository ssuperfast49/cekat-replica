-- SQL Query for n8n to check if AI Message Limit is exceeded
-- This query counts AI messages for a specific thread and compares with the limit

-- Option 1: Get total AI messages for a specific thread
-- Replace '{{$json.thread_id}}' with your thread_id variable from n8n
SELECT 
  COUNT(*) as ai_message_count
FROM public.messages
WHERE thread_id = '{{$json.thread_id}}'  -- Replace with your thread_id variable
  AND role = 'assistant';  -- 'assistant' role = AI messages

-- Option 2: Get AI message count with the limit for a thread
-- This includes the message_limit from ai_profiles
SELECT 
  m.thread_id,
  COUNT(*) FILTER (WHERE m.role = 'assistant') as ai_message_count,
  ap.message_limit,
  COUNT(*) FILTER (WHERE m.role = 'assistant') >= ap.message_limit as is_limit_exceeded
FROM public.messages m
JOIN public.threads t ON t.id = m.thread_id
JOIN public.channels c ON c.id = t.channel_id
JOIN public.ai_profiles ap ON ap.id = c.ai_profile_id
WHERE m.thread_id = '{{$json.thread_id}}'  -- Replace with your thread_id variable
GROUP BY m.thread_id, ap.message_limit;

-- Option 3: Simple check - just return boolean if exceeded
-- Replace '{{$json.thread_id}}' with your thread_id variable
SELECT 
  (COUNT(*) FILTER (WHERE m.role = 'assistant') >= ap.message_limit) as limit_exceeded,
  COUNT(*) FILTER (WHERE m.role = 'assistant') as current_count,
  ap.message_limit as limit_value
FROM public.messages m
JOIN public.threads t ON t.id = m.thread_id
JOIN public.channels c ON c.id = t.channel_id
JOIN public.ai_profiles ap ON ap.id = c.ai_profile_id
WHERE m.thread_id = '{{$json.thread_id}}'  -- Replace with your thread_id variable
GROUP BY ap.message_limit;

-- Option 4: Get AI message count for all active threads (for monitoring)
SELECT 
  t.id as thread_id,
  t.contact_id,
  ap.id as ai_profile_id,
  ap.name as ai_profile_name,
  COUNT(*) FILTER (WHERE m.role = 'assistant') as ai_message_count,
  ap.message_limit,
  COUNT(*) FILTER (WHERE m.role = 'assistant') >= ap.message_limit as is_limit_exceeded,
  t.status as thread_status
FROM public.threads t
JOIN public.channels c ON c.id = t.channel_id
JOIN public.ai_profiles ap ON ap.id = c.ai_profile_id
LEFT JOIN public.messages m ON m.thread_id = t.id
WHERE t.status = 'open'  -- Only active/open threads
GROUP BY t.id, t.contact_id, ap.id, ap.name, ap.message_limit, t.status
HAVING COUNT(*) FILTER (WHERE m.role = 'assistant') >= ap.message_limit  -- Only show exceeded ones
ORDER BY ai_message_count DESC;

