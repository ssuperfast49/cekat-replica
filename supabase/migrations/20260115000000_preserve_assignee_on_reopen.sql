-- Fix: Preserve assignee_user_id when reopening threads
-- When a user sends a message to a closed thread, the thread should reopen
-- but preserve the "handled by" (assignee_user_id) value instead of clearing it.

CREATE OR REPLACE FUNCTION "public"."reopen_thread_on_user_message"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  -- Only react to inbound/user messages
  if (new.role = 'user' or new.direction = 'in') then
    update public.threads
       set status = 'open',
           resolved_at = null,
           resolved_by_user_id = null
           -- Removed: assignee_user_id = null, assigned_at = null, assigned_by_user_id = null
           -- This preserves the "handled by" value when reopening threads
     where id = new.thread_id
       and status = 'closed';
  end if;
  return new;
end
$$;


ALTER FUNCTION "public"."reopen_thread_on_user_message"() OWNER TO "postgres";
