-- Esquema do Cuidaí Kids. Datas são epoch em milissegundos (bigint), como no app.
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

-- Foto da criança: já chega do aparelho recortada em 256×256 e comprimida (WebP ou JPEG, poucos KB).
-- photo_version muda a cada troca, para o endereço da imagem mudar e o cache do navegador não mostrar a antiga.
alter table children add column if not exists photo bytea;
alter table children add column if not exists photo_type text;
alter table children add column if not exists photo_version bigint;

-- ---------- V2: histórico de doses preservado ----------
-- Remover um remédio só o marca como removido: as doses ficam no histórico.
alter table medications add column if not exists deleted_at bigint;
-- Cada dose guarda o remédio, a dose e a criança de quando foi agendada. Editar o remédio depois
-- não reescreve o passado. (Remover a CRIANÇA ainda apaga tudo dela: é como a família exclui dados.)
alter table doses add column if not exists child_id bigint references children (id) on delete cascade;
alter table doses add column if not exists med_name text;
alter table doses add column if not exists dose_text text;
update doses d set child_id = m.child_id, med_name = m.name, dose_text = m.dose_text
from medications m where m.id = d.medication_id and d.med_name is null;
alter table doses alter column child_id set not null;
alter table doses alter column med_name set not null;
alter table doses alter column dose_text set not null;
create index if not exists doses_child_scheduled_idx on doses (child_id, scheduled_at);
