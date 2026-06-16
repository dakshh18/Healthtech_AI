create extension if not exists "pgcrypto";

create schema if not exists charted;

do $$
declare
  t text;
begin
  foreach t in array array['visits','transcripts','note_versions','audit_log']
  loop
    if exists (
         select 1 from information_schema.tables
         where table_schema = 'public' and table_name = t
       )
       and not exists (
         select 1 from information_schema.tables
         where table_schema = 'charted' and table_name = t
       )
    then
      execute format('alter table public.%I set schema charted', t);
    end if;
  end loop;
end $$;

create table if not exists charted.visits (
  id            uuid primary key default gen_random_uuid(),
  patient_ref   text not null,
  status        text not null default 'draft',  -- 'draft' | 'approved'
  audio_seconds int,
  created_at    timestamptz not null default now()
);

-- Deterministically extracted patient demographics (synthetic data only).
-- Stored separately from the de-identified note pipeline.
alter table charted.visits add column if not exists demographics jsonb;

create table if not exists charted.transcripts (
  id            uuid primary key default gen_random_uuid(),
  visit_id      uuid not null references charted.visits(id) on delete cascade,
  raw_text      text not null,
  redacted_text text not null,
  created_at    timestamptz not null default now()
);

create table if not exists charted.note_versions (
  id           uuid primary key default gen_random_uuid(),
  visit_id     uuid not null references charted.visits(id) on delete cascade,
  version_no   int  not null,
  soap         jsonb not null,
  source       text not null,             -- 'ai' | 'clinician'
  author       text not null default 'system',
  created_at   timestamptz not null default now(),
  unique (visit_id, version_no)
);

create table if not exists charted.audit_log (
  id         bigserial primary key,
  visit_id   uuid references charted.visits(id) on delete cascade,
  action     text not null,               -- 'transcribed' | 'structured' | 'edited' | 'approved'
  actor      text not null,
  detail     jsonb,
  created_at timestamptz not null default now()
);

create index if not exists note_versions_visit_idx on charted.note_versions (visit_id, version_no desc);
create index if not exists audit_log_visit_idx on charted.audit_log (visit_id, created_at desc);

-- Phase 1: identity & access. Users authenticate with email + password and act
-- under a role. Patient/doctor profiles and appointments build on this later.
create table if not exists charted.users (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  email         text not null unique,
  password_hash text not null,
  role          text not null default 'PATIENT' check (role in ('PATIENT','DOCTOR','ADMIN')),
  phone         text,
  gender        text check (gender in ('Male','Female','Other')),
  age           int,
  created_at    timestamptz not null default now()
);

create unique index if not exists users_email_lower_idx on charted.users (lower(email));

-- Phase 6: admins can deactivate accounts. Enforced at login.
alter table charted.users add column if not exists is_active boolean not null default true;

-- Phase 2: doctor profiles, 1:1 with a DOCTOR user. Patients are simply users
-- with role PATIENT (their demographics live on the users row).
create table if not exists charted.doctors (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null unique references charted.users(id) on delete cascade,
  specialization   text not null,
  experience_years int  not null default 0,
  qualification    text,
  bio              text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Phase 2: tie visits to the real patient + doctor users. Nullable so the
-- original synthetic visits (which only have patient_ref) keep working.
alter table charted.visits add column if not exists patient_id uuid references charted.users(id);
alter table charted.visits add column if not exists doctor_id  uuid references charted.users(id);

-- Phase 3: appointments are the bridge between the clinic workflow and the
-- scribe. A patient books (PENDING); the doctor confirms/rejects; starting a
-- CONFIRMED appointment creates a Visit, runs the pipeline, and marks it
-- COMPLETED with visit_id set. visit_id is the link into the AI pipeline.
create table if not exists charted.appointments (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid not null references charted.users(id) on delete cascade,
  doctor_id    uuid not null references charted.users(id) on delete cascade,
  scheduled_at timestamptz not null,
  reason       text,
  status       text not null default 'PENDING'
               check (status in ('PENDING','CONFIRMED','REJECTED','CANCELLED','COMPLETED')),
  visit_id     uuid references charted.visits(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists appointments_patient_idx on charted.appointments (patient_id, scheduled_at desc);
create index if not exists appointments_doctor_idx  on charted.appointments (doctor_id, scheduled_at desc);

-- Phase 4: prescriptions are issued from an APPROVED visit. Items default to the
-- approved SOAP note's medications (the AI draft feeding a real artifact) but the
-- doctor can override with dosage/frequency/duration. patient_id/doctor_id are
-- denormalized from the visit for easy role-aware listing.
create table if not exists charted.prescriptions (
  id          uuid primary key default gen_random_uuid(),
  visit_id    uuid not null references charted.visits(id) on delete cascade,
  patient_id  uuid references charted.users(id),
  doctor_id   uuid references charted.users(id),
  items       jsonb not null,   -- [{ name, dosage, frequency, duration, instructions }]
  notes       text,
  created_at  timestamptz not null default now()
);

create index if not exists prescriptions_visit_idx   on charted.prescriptions (visit_id);
create index if not exists prescriptions_patient_idx on charted.prescriptions (patient_id, created_at desc);
create index if not exists prescriptions_doctor_idx  on charted.prescriptions (doctor_id, created_at desc);