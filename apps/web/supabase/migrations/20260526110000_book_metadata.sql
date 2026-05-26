create table if not exists public.book_metadata (
  id uuid primary key default gen_random_uuid(),
  source_document_id uuid not null unique references public.source_documents(id) on delete cascade,
  book_title text not null,
  author text,
  publisher text,
  publication_year integer,
  isbn text,
  file_name text not null,
  file_type text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0),
  file_hash text not null,
  page_count integer check (page_count is null or page_count > 0),
  ocr_engine text,
  ocr_status text not null default 'not_started'
    check (ocr_status in ('not_started', 'sampled', 'needs_review', 'ready_for_ingestion', 'failed')),
  authorization_status text not null default 'user_provided_full_authorization',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists book_metadata_file_hash_idx
  on public.book_metadata(file_hash);

create index if not exists book_metadata_title_idx
  on public.book_metadata(book_title);

create index if not exists book_metadata_ocr_status_idx
  on public.book_metadata(ocr_status);

alter table public.source_chunks
  add column if not exists book_title text,
  add column if not exists chapter_title text,
  add column if not exists page_start integer,
  add column if not exists page_end integer,
  add column if not exists location text,
  add column if not exists ocr_confidence numeric;

create index if not exists source_chunks_book_title_idx
  on public.source_chunks(book_title);

create index if not exists source_chunks_book_page_idx
  on public.source_chunks(book_title, page_start, page_end);
