-- Esquema do Hora do Remedinho. Datas são epoch em milissegundos (bigint), como no app.
create extension if not exists pgcrypto;

create table if not exists families (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  created_at bigint not null
);

create table if not exists devices (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families (id) on delete cascade,
  token_hash text not null unique,
  label text,
  created_at bigint not null,
  last_seen_at bigint
);

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references devices (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at bigint not null
);

create table if not exists children (
  id bigserial primary key,
  family_id uuid not null references families (id) on delete cascade,
  name text not null,
  fill text not null,
  created_at bigint not null
);

create table if not exists medications (
  id bigserial primary key,
  family_id uuid not null references families (id) on delete cascade,
  child_id bigint not null references children (id) on delete cascade,
  name text not null,
  dose_text text not null default '',
  interval_minutes integer not null,
  first_dose_at bigint not null,
  days integer not null,
  created_at bigint not null
);

create table if not exists doses (
  id bigserial primary key,
  family_id uuid not null references families (id) on delete cascade,
  medication_id bigint not null references medications (id) on delete cascade,
  scheduled_at bigint not null,
  status text not null default 'pending' check (status in ('pending', 'given')),
  given_at bigint,
  given_by uuid references devices (id) on delete set null,
  -- Controle dos avisos: quantas vezes já avisamos e quando foi a última.
  notified_count integer not null default 0,
  last_notified_at bigint
);

create index if not exists doses_family_scheduled_idx on doses (family_id, scheduled_at);
create index if not exists doses_due_idx on doses (scheduled_at) where status = 'pending';
create index if not exists medications_family_idx on medications (family_id);

-- Limite de tentativas por IP (criar família, entrar com código).
create table if not exists rate_limits (
  key text primary key,
  window_start bigint not null,
  count integer not null
);
