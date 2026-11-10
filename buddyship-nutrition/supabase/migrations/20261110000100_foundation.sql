-- Sprint 1 / 01: 基盤(スキーマ・既定権限・列挙型・組織・利用者・ロール)
-- 設計: docs/DATABASE.md §1〜§3.2

-- ---------------------------------------------------------------------------
-- スキーマ。authz / audit / private は PostgREST に公開しない(config.toml の api.schemas に含めない)
-- ---------------------------------------------------------------------------
create schema if not exists authz;
create schema if not exists audit;
create schema if not exists private;

revoke all on schema authz, audit, private from public, anon, authenticated;
-- RLS ポリシー内から判定関数を呼ぶため、authz の USAGE だけは authenticated に与える
grant usage on schema authz to authenticated;

-- 関数は既定で PUBLIC に EXECUTE が付くため、すべてのスキーマで既定権限を取り消す
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema authz revoke execute on functions from public;
alter default privileges in schema audit revoke execute on functions from public;
alter default privileges in schema private revoke execute on functions from public;
-- テーブルも既定では誰にも見せない(明示的に GRANT したものだけ API から触れる)
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 列挙型
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('member', 'staff', 'admin');
-- 同意スコープ:データ種別ごとに閲覧(read)と代理入力(write)を分ける
create type public.consent_scope as enum ('meals:read', 'meals:write', 'body:read', 'body:write');

-- ---------------------------------------------------------------------------
-- 共通トリガー:updated_at
-- ---------------------------------------------------------------------------
create function private.touch_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 組織・拠点
-- ---------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  created_at timestamptz not null default now()
);

create table public.facilities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  name text not null check (char_length(name) between 1 and 100),
  created_at timestamptz not null default now(),
  unique (id, organization_id)
);

-- ---------------------------------------------------------------------------
-- 利用者プロフィール(最小収集:表示名のみ。D-28)
-- ---------------------------------------------------------------------------
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id),
  facility_id uuid,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 50),
  timezone text not null default 'Asia/Tokyo' check (timezone = 'Asia/Tokyo'), -- Phase 1 は国内のみ
  font_scale smallint not null default 0 check (font_scale between 0 and 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (facility_id, organization_id) references public.facilities(id, organization_id)
);
create index profiles_org_idx on public.profiles(organization_id);
create trigger profiles_touch before update on public.profiles
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- ロール(user_metadata は利用者が書き換えられるため使わない)
-- ---------------------------------------------------------------------------
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  organization_id uuid not null references public.organizations(id),
  role public.app_role not null,
  granted_by uuid references public.profiles(user_id) on delete set null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(user_id) on delete set null,
  check (revoked_at is null or revoked_at >= granted_at)
);
create unique index user_roles_active_uq on public.user_roles(user_id, role) where revoked_at is null;
create index user_roles_user_idx on public.user_roles(user_id);

-- ロールの組織は本人の組織と一致させる
create function private.user_roles_check_org() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.organization_id is distinct from
     (select p.organization_id from public.profiles p where p.user_id = new.user_id) then
    raise exception 'user_roles.organization_id must match profile organization'
      using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger user_roles_check_org before insert or update on public.user_roles
  for each row execute function private.user_roles_check_org();

-- ---------------------------------------------------------------------------
-- RLS を有効化(ポリシーは認可関数の定義後に 03 で作成)
-- ---------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.facilities enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
