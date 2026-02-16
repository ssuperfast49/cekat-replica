-- 1. [REMOVED] knowledge_sources table - Simplified to use files table directly
-- 2. [REMOVED] knowledge_source_files table - Simplified to use files table directly


-- 3. Add is_enabled to files table to support simple toggling
alter table public.files
add column if not exists is_enabled boolean default true;



-- 4. Update documents table
-- Add file_id to link chunks back to specific files
alter table public.documents
add column if not exists file_id uuid;

-- Index for performance
create index if not exists idx_documents_file_id on public.documents(file_id);
create index if not exists idx_documents_metadata_gin on public.documents using gin (metadata);

-- Trigger to sync file_id from metadata (for n8n compatibility)
create or replace function public.sync_document_file_id()
returns trigger as $$
begin
  -- If file_id column is null, try to extract it from metadata
  if new.file_id is null and new.metadata ? 'file_id' then
    begin
      new.file_id := (new.metadata->>'file_id')::uuid;
    exception when others then
      null;
    end;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists tr_sync_document_file_id on public.documents;
create trigger tr_sync_document_file_id
before insert or update on public.documents
for each row
execute function public.sync_document_file_id();



-- 5. Enhanced Retrieval Function
-- Supports filtering by a specific list of file_ids (OR logic) in addition to metadata filters
create or replace function match_documents(
  query_embedding vector(1536),
  match_threshold float default 0.0,
  match_count int default 10,
  filter jsonb default '{}'::jsonb,
  p_file_ids uuid[] default null
)
returns table (
  id bigint,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    documents.id,
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  where documents.metadata @> filter
  and documents.file_id = any(p_file_ids)

  -- Enforce is_enabled check for linked files
  and (
    documents.file_id is null 
    or exists (
      select 1 from public.files f 
      where f.id = documents.file_id 
      and f.is_enabled = true
    )
  )
  and 1 - (documents.embedding <=> query_embedding) > match_threshold
  order by documents.embedding <=> query_embedding
  limit match_count;
end;
$$;


-- 6. High-level Knowledge Search RPC
-- Automatically resolves enabled file IDs for an AI Profile using the simple 'files' table
create or replace function search_knowledge(
  ai_profile_id uuid,
  query_embedding vector(1536),
  match_threshold float default 0.7,
  match_count int default 5
)
returns table (
  id bigint,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
declare
  v_file_ids uuid[];
begin
  -- 1. Get all file_ids from ENABLED files for this profile directly
  select array_agg(id)
  into v_file_ids
  from public.files
  where files.ai_profile_id = search_knowledge.ai_profile_id
  and files.is_enabled = true;

  -- 2. If no files are enabled, return empty to respect the "disabled" intent
  if v_file_ids is null then
     return;
  end if;

  -- 3. Call match_documents with specific file IDs
  return query
  select * from match_documents(
    query_embedding,
    match_threshold,
    match_count,
    '{}'::jsonb, 
    v_file_ids
  );
end;
$$;

-- 7. Enforce RLS on public.files (Security & API Exposure)
alter table public.files enable row level security;

drop policy if exists "Enable all access for org members" on public.files;
create policy "Enable all access for org members"
on public.files for all
to authenticated
using (
  org_id in (
    select org_id from public.org_members 
    where user_id = auth.uid()
  )
)
with check (
  org_id in (
    select org_id from public.org_members 
    where user_id = auth.uid()
  )
);

grant all on public.files to authenticated;

