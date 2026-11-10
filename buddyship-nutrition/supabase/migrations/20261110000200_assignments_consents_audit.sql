-- Sprint 1 / 02: 担当割当・同意・監査ログ・利用量
-- 設計: docs/DATABASE.md §3.3, §3.8

-- ---------------------------------------------------------------------------
-- 担当割当
-- ---------------------------------------------------------------------------
create table public.staff_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  staff_id uuid not null references public.profiles(user_id) on delete cascade,
  member_id uuid not null references public.profiles(user_id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_by uuid references public.profiles(user_id) on delete set null,
  ended_by uuid references public.profiles(user_id) on delete set null,
  check (staff_id <> member_id),
  -- 管理者が自分自身を担当に割り当てることを禁止(DECISIONS §3-9)
  check (created_by is null or created_by <> staff_id),
  check (ended_at is null or ended_at >= started_at)
);
create unique index staff_assignments_active_uq
  on public.staff_assignments(staff_id, member_id) where ended_at is null;
create index staff_assignments_member_idx on public.staff_assignments(member_id);

-- ---------------------------------------------------------------------------
-- 同意文書(規約・プライバシー・AI 外部送信・スタッフ共有)。版ごとに 1 行
-- ---------------------------------------------------------------------------
create table public.consent_documents (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('terms', 'privacy', 'ai_processing', 'staff_sharing')),
  version text not null check (char_length(version) between 1 and 20),
  title text not null,
  body text not null,
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  published_at timestamptz not null default now(),
  unique (kind, version)
);

-- 本文と content_sha256 の一致を強制
create function private.consent_documents_check_hash() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.content_sha256 <> encode(extensions.digest(convert_to(new.body, 'UTF8'), 'sha256'), 'hex') then
    raise exception 'content_sha256 does not match body' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger consent_documents_check_hash before insert or update on public.consent_documents
  for each row execute function private.consent_documents_check_hash();

-- 版は書き換えない(新しい版を追加する)
create function private.forbid_update() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = '42501';
end;
$$;
create trigger consent_documents_no_update before update or delete on public.consent_documents
  for each row execute function private.forbid_update();

create table public.user_agreements (
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  document_id uuid not null references public.consent_documents(id),
  agreed_at timestamptz not null default now(),
  primary key (user_id, document_id)
);

-- ---------------------------------------------------------------------------
-- スタッフへの共有の同意(利用者 × スタッフ × スコープ)
-- ---------------------------------------------------------------------------
create table public.staff_access_consents (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles(user_id) on delete cascade,
  staff_id uuid not null references public.profiles(user_id) on delete cascade,
  scope public.consent_scope not null,
  document_id uuid not null references public.consent_documents(id),
  granted_at timestamptz not null default now(),
  -- 紙の同意書の取込は D-26 で不採用。アプリ上で本人が付与したものだけ
  granted_via text not null default 'member_app' check (granted_via in ('member_app')),
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(user_id) on delete set null,
  revoke_reason text check (revoke_reason in ('member', 'assignment_ended', 'account_deleted', 'admin_emergency')),
  check (member_id <> staff_id),
  check (revoked_at is null or revoked_at >= granted_at),
  check ((revoked_at is null) = (revoke_reason is null))
);
create unique index staff_access_consents_active_uq
  on public.staff_access_consents(member_id, staff_id, scope) where revoked_at is null;
create index staff_access_consents_staff_idx on public.staff_access_consents(staff_id, member_id);

-- ---------------------------------------------------------------------------
-- 監査ログ(追記専用・PII を入れない)
-- ---------------------------------------------------------------------------
create table audit.logs (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id uuid,
  actor_roles text[] not null default '{}',
  action text not null check (action ~ '^[a-z_]+(\.[a-z_]+)+$'),
  subject_member_id uuid,
  resource_type text,
  resource_id uuid,
  result text not null check (result in ('allowed', 'denied', 'error')),
  request_id text check (char_length(request_id) <= 100),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object')
);
create index audit_logs_occurred_idx on audit.logs(occurred_at desc);
create index audit_logs_actor_idx on audit.logs(actor_id, occurred_at desc);
create index audit_logs_subject_idx on audit.logs(subject_member_id, occurred_at desc);
alter table audit.logs enable row level security;  -- ポリシーなし = 直接アクセスは全拒否

create trigger audit_logs_no_update before update or delete on audit.logs
  for each row execute function private.forbid_update();
-- TRUNCATE も禁止
create trigger audit_logs_no_truncate before truncate on audit.logs
  for each statement execute function private.forbid_update();

-- ---------------------------------------------------------------------------
-- 利用量カウンタと設定
-- ---------------------------------------------------------------------------
create table private.usage_counters (
  counter text not null check (counter in ('ai_actor_minute', 'ai_member_day', 'ai_staff_day', 'ai_org_month', 'export_member_day')),
  subject_id uuid not null,
  period_start timestamp not null, -- Asia/Tokyo の区切りの開始時刻
  count integer not null default 0 check (count >= 0),
  primary key (counter, subject_id, period_start)
);
alter table private.usage_counters enable row level security;

create table private.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table private.settings enable row level security;

insert into private.settings(key, value) values
  ('ai_enabled', 'true'::jsonb),
  ('ai_actor_minute_limit', '3'::jsonb),
  ('ai_member_day_limit', '10'::jsonb),
  ('ai_staff_day_limit', '60'::jsonb),
  ('ai_org_month_limit', '3000'::jsonb),
  ('export_member_day_limit', '5'::jsonb);

alter table public.staff_assignments enable row level security;
alter table public.consent_documents enable row level security;
alter table public.user_agreements enable row level security;
alter table public.staff_access_consents enable row level security;
