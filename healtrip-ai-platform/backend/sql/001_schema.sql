create extension if not exists "uuid-ossp";
-- pgvector is optional. The stack ships the pgvector image, but the schema must
-- also apply on a plain PostgreSQL, so retrieval can be added later instead of
-- blocking the first boot.
do $$
begin
  create extension if not exists vector;
exception when others then
  raise notice 'pgvector not available: evidence_chunks will be created without an embedding column';
end $$;

create table if not exists users (
  id uuid primary key default uuid_generate_v4(), email text unique not null, password_hash text not null,
  role text not null default 'patient' check (role in ('patient','doctor','admin')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists patient_profiles (
  user_id uuid primary key references users(id) on delete cascade, full_name text, date_of_birth date,
  sex text, country text, city text, preferred_language text not null default 'en', phone text,
  emergency_contact jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists patient_records (
  id uuid primary key default uuid_generate_v4(), user_id uuid not null references users(id) on delete cascade,
  record_type text not null, title text, content jsonb not null default '{}'::jsonb, source text not null default 'patient',
  verified boolean not null default false, recorded_at timestamptz not null default now()
);
create table if not exists assessments (
  id uuid primary key, user_id uuid references users(id) on delete set null, lang text not null default 'en',
  state jsonb not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists assessments_user_idx on assessments(user_id, updated_at desc);
create table if not exists conversations (
  id uuid primary key default uuid_generate_v4(), user_id uuid references users(id) on delete cascade,
  title text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists conversation_messages (
  id bigserial primary key, conversation_id uuid not null references conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant','system','tool')), content text not null,
  provider text, verified boolean, created_at timestamptz not null default now()
);
create index if not exists conversation_messages_idx on conversation_messages(conversation_id, created_at);
create table if not exists medical_documents (
  id uuid primary key default uuid_generate_v4(), user_id uuid not null references users(id) on delete cascade,
  filename text not null, mime_type text not null, size_bytes bigint not null, storage_key text not null,
  extracted_text text, extraction_status text not null default 'pending', created_at timestamptz not null default now()
);
create table if not exists doctors (
  id text primary key, full_name text not null, specialty text not null, subspecialty text, qualifications text,
  licensing_authority text, license_number text, license_status text not null default 'unverified', country text not null,
  city text, languages text[] not null default '{}', telemedicine boolean not null default false, organization text,
  email text, image_url text, profile_url text, source text not null default 'Demo registry', source_url text,
  verified_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists doctors_search_idx on doctors(lower(specialty), lower(country), lower(city));
create table if not exists hospitals (
  id text primary key, name text not null, city text, country text not null, emergency boolean not null default false,
  specialties text[] not null default '{}', lat double precision, lng double precision, source text not null default 'Demo registry', source_url text, created_at timestamptz not null default now()
);
create table if not exists provider_sources (
  id text primary key, authority text not null, country text not null, register_url text not null,
  bulk_license_required boolean not null default true, terms_url text, importer_status text not null default 'manual', last_import_at timestamptz
);
create table if not exists evidence_sources (
  id text primary key, title text not null, publisher text not null, url text not null, source_type text not null,
  tier int not null default 4, license_note text, version text, license_url text, reviewed_at timestamptz
);
create table if not exists evidence_documents (
  id uuid primary key default uuid_generate_v4(), source_id text not null references evidence_sources(id) on delete cascade,
  title text not null, version text, publication_date date, content_hash text, retrieval_url text, license text,
  created_at timestamptz not null default now()
);
create table if not exists evidence_chunks (
  id uuid primary key default uuid_generate_v4(), document_id uuid not null references evidence_documents(id) on delete cascade,
  chunk_text text not null, citation_label text
);
create index if not exists evidence_chunks_document_idx on evidence_chunks(document_id);
create table if not exists consents (
  id uuid primary key default uuid_generate_v4(), user_id uuid not null references users(id) on delete cascade,
  consent_type text not null, version text not null, granted boolean not null, granted_at timestamptz not null default now()
);
create table if not exists audit_events (
  id bigserial primary key, event text not null, user_id uuid, session_id uuid, detail jsonb not null default '{}'::jsonb,
  at timestamptz not null default now()
);
create index if not exists audit_event_idx on audit_events(event, at desc);
create table if not exists ai_tool_calls (
  id bigserial primary key, user_id uuid, conversation_id uuid, tool_name text not null, arguments jsonb not null default '{}',
  result_summary jsonb not null default '{}', created_at timestamptz not null default now()
);

-- Add the embedding column only where pgvector actually installed.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'vector') then
    execute 'alter table evidence_chunks add column if not exists embedding vector(768)';
    execute 'create index if not exists evidence_chunks_embedding_idx on evidence_chunks using ivfflat (embedding vector_cosine_ops)';
  end if;
end $$;
