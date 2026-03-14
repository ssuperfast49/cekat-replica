-- Fix cleanup_old_chat_data: only delete messages, threads, and chat-attachment storage.
-- Does NOT touch the files table (AI Agent uploads) or contacts.
-- Also adds a preview function to count what will be deleted before confirming.

-- Preview function: counts what WOULD be deleted without actually deleting
CREATE OR REPLACE FUNCTION preview_cleanup_old_chat_data(p_org_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_retention_days integer;
  v_cutoff_date timestamptz;
  v_thread_count integer := 0;
  v_message_count integer := 0;
  v_storage_count integer := 0;
BEGIN
  SELECT coalesce(retention_days, 90)
  INTO v_retention_days
  FROM org_settings
  WHERE org_id = p_org_id;

  IF v_retention_days IS NULL THEN
    v_retention_days := 90;
  END IF;

  v_cutoff_date := now() - make_interval(days => v_retention_days);

  SELECT count(*) INTO v_thread_count
  FROM threads
  WHERE org_id = p_org_id
    AND created_at < v_cutoff_date;

  SELECT count(*) INTO v_message_count
  FROM messages m
  JOIN threads t ON m.thread_id = t.id
  WHERE t.org_id = p_org_id
    AND t.created_at < v_cutoff_date;

  SELECT count(*) INTO v_storage_count
  FROM storage.objects
  WHERE bucket_id = 'chat-attachments'
    AND created_at < v_cutoff_date;

  RETURN jsonb_build_object(
    'threads_to_delete', v_thread_count,
    'messages_to_delete', v_message_count,
    'storage_files_to_delete', v_storage_count,
    'retention_days', v_retention_days,
    'cutoff_date', v_cutoff_date
  );
END;
$$;

-- Updated cleanup function: deletes threads, messages, and chat-attachment storage objects
-- Does NOT touch the files table (AI Agent uploads) or contacts
CREATE OR REPLACE FUNCTION cleanup_old_chat_data(p_org_id UUID DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_org_id uuid;
  v_retention_days integer;
  v_cutoff_date timestamptz;
  v_deleted_threads integer := 0;
  v_deleted_messages integer := 0;
  v_deleted_storage integer := 0;
  v_org_count integer := 0;
  v_total_threads integer := 0;
  v_total_messages integer := 0;
  v_total_storage integer := 0;
  v_result jsonb;
BEGIN
  IF p_org_id IS NOT NULL THEN
    v_org_id := p_org_id;

    SELECT coalesce(retention_days, 90)
    INTO v_retention_days
    FROM org_settings
    WHERE org_id = v_org_id;

    IF v_retention_days IS NULL THEN
      v_retention_days := 90;
    END IF;

    v_cutoff_date := now() - make_interval(days => v_retention_days);

    -- 1. Delete old messages first (FK constraint)
    WITH deleted AS (
      DELETE FROM public.messages m
      USING public.threads t
      WHERE m.thread_id = t.id
        AND t.org_id = v_org_id
        AND t.created_at < v_cutoff_date
      RETURNING m.id
    )
    SELECT count(*) INTO v_deleted_messages FROM deleted;

    -- 2. Delete old threads (now safe since messages are gone)
    WITH deleted AS (
      DELETE FROM public.threads t
      WHERE t.org_id = v_org_id
        AND t.created_at < v_cutoff_date
      RETURNING t.id
    )
    SELECT count(*) INTO v_deleted_threads FROM deleted;

    -- 3. Delete chat-attachment storage objects older than cutoff
    -- This ONLY touches the 'chat-attachments' bucket, never 'ai-agent-files'
    WITH deleted AS (
      DELETE FROM storage.objects
      WHERE bucket_id = 'chat-attachments'
        AND created_at < v_cutoff_date
      RETURNING id
    )
    SELECT count(*) INTO v_deleted_storage FROM deleted;

    v_org_count := 1;
    v_total_threads := v_deleted_threads;
    v_total_messages := v_deleted_messages;
    v_total_storage := v_deleted_storage;

  ELSE
    FOR v_org_id, v_retention_days IN
      SELECT os.org_id, coalesce(os.retention_days, 90)
      FROM org_settings os
    LOOP
      v_cutoff_date := now() - make_interval(days => v_retention_days);

      WITH deleted AS (
        DELETE FROM public.messages m
        USING public.threads t
        WHERE m.thread_id = t.id
          AND t.org_id = v_org_id
          AND t.created_at < v_cutoff_date
        RETURNING m.id
      )
      SELECT count(*) INTO v_deleted_messages FROM deleted;

      WITH deleted AS (
        DELETE FROM public.threads t
        WHERE t.org_id = v_org_id
          AND t.created_at < v_cutoff_date
        RETURNING t.id
      )
      SELECT count(*) INTO v_deleted_threads FROM deleted;

      WITH deleted AS (
        DELETE FROM storage.objects
        WHERE bucket_id = 'chat-attachments'
          AND created_at < v_cutoff_date
        RETURNING id
      )
      SELECT count(*) INTO v_deleted_storage FROM deleted;

      v_org_count := v_org_count + 1;
      v_total_threads := v_total_threads + v_deleted_threads;
      v_total_messages := v_total_messages + v_deleted_messages;
      v_total_storage := v_total_storage + v_deleted_storage;
    END LOOP;
  END IF;

  v_result := jsonb_build_object(
    'orgs_processed', v_org_count,
    'threads_deleted', v_total_threads,
    'messages_deleted', v_total_messages,
    'storage_files_deleted', v_total_storage,
    'cutoff_date', v_cutoff_date
  );

  RETURN v_result;
END;
$$;