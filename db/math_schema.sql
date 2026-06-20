-- ============================================================
-- Math RAG schema — pgvector + chunks from PDF ingestion
-- Paste into the Supabase SQL editor AFTER db/schema.sql.
-- Idempotent; safe to re-run.
-- ============================================================

create extension if not exists vector;

-- ---------- one row per ingested PDF ----------
create table if not exists stp_math_docs (
  id uuid primary key default gen_random_uuid(),
  filename text not null unique,
  title text,
  source_path text,
  page_count int,
  created_at timestamptz default now()
);

-- ---------- one row per chunk; embedding = voyage-3 (1024 dims) ----------
create table if not exists stp_math_chunks (
  id uuid primary key default gen_random_uuid(),
  doc_id uuid not null references stp_math_docs(id) on delete cascade,
  chunk_index int not null,
  content text not null,
  page_start int,
  page_end int,
  embedding vector(1024),
  created_at timestamptz default now(),
  unique (doc_id, chunk_index)
);

create index if not exists stp_math_chunks_doc_idx
  on stp_math_chunks (doc_id);

-- HNSW with cosine distance — good recall for ~10k chunks without
-- needing a separate index-build step on each insert.
create index if not exists stp_math_chunks_embedding_idx
  on stp_math_chunks
  using hnsw (embedding vector_cosine_ops);

-- ============================================================
-- RLS: public read (matches the rest of the v1 site, no auth)
-- ============================================================
alter table stp_math_docs   enable row level security;
alter table stp_math_chunks enable row level security;

drop policy if exists "public read math docs"   on stp_math_docs;
drop policy if exists "public read math chunks" on stp_math_chunks;

create policy "public read math docs"   on stp_math_docs   for select using (true);
create policy "public read math chunks" on stp_math_chunks for select using (true);

-- ============================================================
-- match_math_chunks RPC — called from the Netlify search function
-- with the query already embedded. Returns top-k by cosine similarity.
-- ============================================================
create or replace function match_math_chunks(
  query_embedding vector(1024),
  match_count int default 5,
  similarity_threshold float default 0.0
)
returns table (
  id uuid,
  doc_id uuid,
  doc_title text,
  doc_filename text,
  chunk_index int,
  content text,
  page_start int,
  page_end int,
  similarity float
)
language sql stable
as $$
  select
    c.id,
    c.doc_id,
    d.title       as doc_title,
    d.filename    as doc_filename,
    c.chunk_index,
    c.content,
    c.page_start,
    c.page_end,
    1 - (c.embedding <=> query_embedding) as similarity
  from stp_math_chunks c
  join stp_math_docs d on d.id = c.doc_id
  where c.embedding is not null
    and 1 - (c.embedding <=> query_embedding) >= similarity_threshold
  order by c.embedding <=> query_embedding
  limit match_count;
$$;
