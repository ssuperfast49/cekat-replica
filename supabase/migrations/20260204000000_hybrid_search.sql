-- Add FTS column to documents table
alter table "public"."documents"
add column if not exists "fts" tsvector
generated always as (to_tsvector('simple', coalesce(content, ''))) stored;

-- Add index for FTS
create index if not exists "documents_fts_idx"
on "public"."documents" using gin (fts);

-- Update match_documents function for hybrid search
create or replace function public.match_documents(
  query_embedding vector,
  match_threshold double precision DEFAULT 0.0,
  match_count integer DEFAULT 10,
  filter jsonb DEFAULT '{}'::jsonb,
  p_file_ids uuid[] DEFAULT NULL::uuid[],
  query_text text DEFAULT ''
)
returns table(
  id bigint,
  content text,
  metadata jsonb,
  similarity double precision
)
language plpgsql
as $function$
begin
  -- Check if query_text is effectively empty
  if query_text is null or length(trim(query_text)) = 0 then
    -- Standard Vector Search
    return query
    select
      d.id,
      d.content,
      d.metadata,
      1 - (d.embedding <=> query_embedding) as similarity
    from public.documents d
    where d.metadata @> filter
    and (p_file_ids is null or d.file_id = any(p_file_ids))
    and (
      d.file_id is null
      or exists (
        select 1
        from public.files f
        where f.id = d.file_id
          and f.is_enabled = true
      )
    )
    and 1 - (d.embedding <=> query_embedding) > match_threshold
    order by d.embedding <=> query_embedding
    limit match_count;
  else
    -- Hybrid search using Reciprocal Rank Fusion (RRF)
    -- Note: match_threshold is NOT applied to RRF scores because the scale (approx 0.0-0.03) 
    -- varies significantly from cosine similarity (0.0-1.0). 
    -- Applying a vector threshold (e.g. 0.7) would likely filter out all hybrid results.
    return query
    with q as (
      select websearch_to_tsquery('simple', query_text) as tsq
    ),
    vector_results as (
      select
        d.id,
        (1.0 / (row_number() over (order by d.embedding <=> query_embedding) + 60)) as score
      from public.documents d
      where d.metadata @> filter
      and (p_file_ids is null or d.file_id = any(p_file_ids))
      and (
        d.file_id is null
        or exists (select 1 from public.files f where f.id = d.file_id and f.is_enabled = true)
      )
      order by d.embedding <=> query_embedding
      limit match_count * 2
    ),
    text_results as (
      select
        d.id,
        (1.0 / (row_number() over (order by ts_rank(d.fts, q.tsq) desc) + 60)) as score
      from public.documents d, q
      where d.fts @@ q.tsq
      and d.metadata @> filter
      and (p_file_ids is null or d.file_id = any(p_file_ids))
      and (
        d.file_id is null
        or exists (select 1 from public.files f where f.id = d.file_id and f.is_enabled = true)
      )
      order by ts_rank(d.fts, q.tsq) desc
      limit match_count * 2
    ),
    merged_scores as (
      select
        coalesce(v.id, t.id) as id,
        (coalesce(v.score, 0) + coalesce(t.score, 0))::double precision as similarity
      from vector_results v
      full outer join text_results t on v.id = t.id
      where (coalesce(v.score, 0) + coalesce(t.score, 0)) > 0
    )
    select
      d.id,
      d.content,
      d.metadata,
      m.similarity
    from merged_scores m
    join public.documents d on m.id = d.id
    order by m.similarity desc
    limit match_count;
  end if;
end;
$function$;
