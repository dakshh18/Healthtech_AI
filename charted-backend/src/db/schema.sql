create extension if not exists "pgcrypto";

create table if not exists visits (
  id            uuid primary key default gen_random_uuid(),
  patient_ref   text not null,
  status        text not null default 'draft',  -- 'draft' | 'approved'
  audio_seconds int,
  created_at    timestamptz not null default now()
);

create table if not exists transcripts (
  id            uuid primary key default gen_random_uuid(),
  visit_id      uuid not null references visits(id) on delete cascade,
  raw_text      text not null,
  redacted_text text not null,
  created_at    timestamptz not null default now()
);

create table if not exists note_versions (
  id           uuid primary key default gen_random_uuid(),
  visit_id     uuid not null references visits(id) on delete cascade,
  version_no   int  not null,
  soap         jsonb not null,
  source       text not null,             -- 'ai' | 'clinician'
  author       text not null default 'system',
  created_at   timestamptz not null default now(),
  unique (visit_id, version_no)
);

create table if not exists audit_log (
  id         bigserial primary key,
  visit_id   uuid references visits(id) on delete cascade,
  action     text not null,               -- 'transcribed' | 'structured' | 'edited' | 'approved'
  actor      text not null,
  detail     jsonb,
  created_at timestamptz not null default now()
);

create index if not exists note_versions_visit_idx on note_versions (visit_id, version_no desc);
create index if not exists audit_log_visit_idx on audit_log (visit_id, created_at desc);
