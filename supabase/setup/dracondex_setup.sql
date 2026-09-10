-- =============================================================================
-- DraconDex — "bring your own Supabase project" installer.
--
-- ONE idempotent script that brings an empty (or partially set-up) Supabase
-- project to the schema DraconDex's Cloud Sync expects. Running it twice is a
-- no-op; running it on a project that still carries the 20260717 access-key
-- prototype upgrades it in place. It is the same object set as
-- ../migrations/20260717000000_dracondex_sync_prototype.sql +
-- ../migrations/20260730000000_dracondex_token_sync.sql, rewritten in
-- create-if-not-exists / create-or-replace form, PLUS the two things the
-- in-app setup flow needs that the migrations never had:
--
--   * public.dracondex_meta          — records which schema version is installed
--   * public.dracondex_schema_status — anon-callable probe the app uses to
--                                      "check tables" without any elevated key
--
-- The probe is what makes automatic checking possible at all: sync_vault and
-- sync_account are RLS-locked with every grant revoked, so PostgREST does not
-- expose them in its OpenAPI document and a publishable key can never see
-- them. A SECURITY DEFINER function that reports nothing but "does object X
-- exist" is the smallest hole that answers the question.
--
-- Generated artifacts (do not hand-edit — run `node src/supabase/setup/gen.mjs`):
--   electron/src/db/supabase-schema.js
--   flutter/lib/data/services/supabase_schema.dart
-- DRACONDEX_SCHEMA_VERSION: 2
-- =============================================================================

create extension if not exists pgcrypto; -- crypt()/gen_salt() for slot passwords

-- ---------------------------------------------------------------------------
-- Drop the 20260717 access-key prototype if this project still has it. These
-- objects are unreachable once the token RPCs below exist, and _sync_check_size
-- has to go regardless because its signature changed (jsonb) -> (jsonb, uuid),
-- which `create or replace` cannot do.
-- ---------------------------------------------------------------------------
drop function if exists public.sync_create_read_key(text, text);
drop function if exists public.sync_create_vault(text, jsonb, text);
drop function if exists public.sync_push_vault(text, text, jsonb);
drop function if exists public.sync_pull_vault(text);
drop function if exists public.sync_vault_status(text);
drop function if exists public._sync_auth(text, boolean);
drop function if exists public._sync_check_size(jsonb);
drop table if exists public.sync_key;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.sync_vault (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  snapshot    jsonb not null,
  snapshot_at timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

-- Columns the token-sync layer added on top of the prototype table. Separate
-- statements (not part of the create above) so an existing prototype table is
-- upgraded rather than skipped.
alter table public.sync_vault add column if not exists owner_id          uuid references auth.users(id) on delete cascade;
alter table public.sync_vault add column if not exists token_hash        text;
alter table public.sync_vault add column if not exists password_hash     text;
alter table public.sync_vault add column if not exists expires_at        timestamptz;
alter table public.sync_vault add column if not exists pull_fail_count   integer not null default 0;
alter table public.sync_vault add column if not exists pull_locked_until timestamptz;

-- Prototype rows have no owner and no token, so nothing can ever read them
-- again once the old RPCs are gone. Clearing them is what lets the NOT NULLs
-- below hold. On a fresh project this deletes nothing.
delete from public.sync_vault where owner_id is null or token_hash is null or expires_at is null;

alter table public.sync_vault alter column owner_id   set not null;
alter table public.sync_vault alter column token_hash set not null;
alter table public.sync_vault alter column expires_at set not null;

create table if not exists public.sync_account (
  owner_id   uuid primary key references auth.users(id) on delete cascade,
  tier       text not null default 'free' check (tier in ('free', 'pro')),
  created_at timestamptz not null default now()
);

-- Installed-schema bookkeeping. Read back through dracondex_schema_status()
-- so the app can tell "never installed" from "installed but out of date".
create table if not exists public.dracondex_meta (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

create index if not exists sync_vault_owner_idx  on public.sync_vault(owner_id);
create unique index if not exists sync_vault_token_idx on public.sync_vault(token_hash);
create index if not exists sync_vault_expiry_idx on public.sync_vault(expires_at);

-- RLS on with zero policies + revoked grants: the SECURITY DEFINER RPCs below
-- are the only door in. Re-running these is harmless.
alter table public.sync_vault     enable row level security;
alter table public.sync_account   enable row level security;
alter table public.dracondex_meta enable row level security;
revoke all on table public.sync_vault     from anon, authenticated;
revoke all on table public.sync_account   from anon, authenticated;
revoke all on table public.dracondex_meta from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Private helpers (never granted to anon/authenticated)
-- ---------------------------------------------------------------------------
create or replace function public._sync_hash_key(p_key text) returns text
language sql immutable set search_path = '' as $$
  select encode(sha256(convert_to(p_key, 'UTF8')), 'hex')
$$;

create or replace function public._sync_tier(p_owner uuid) returns text
language sql stable set search_path = '' as $$
  select coalesce((select tier from public.sync_account where owner_id = p_owner), 'free')
$$;

create or replace function public._sync_max_bytes(p_owner uuid) returns bigint
language sql stable set search_path = '' as $$
  select case when public._sync_tier(p_owner) = 'pro' then 20971520 else 10485760 end -- pro 20MB / free 10MB
$$;

create or replace function public._sync_max_slots(p_owner uuid) returns int
language sql stable set search_path = '' as $$
  select case when public._sync_tier(p_owner) = 'pro' then 3 else 1 end -- pro 3 slots / free 1 slot
$$;

create or replace function public._sync_check_size(p_snapshot jsonb, p_owner uuid) returns void
language plpgsql stable set search_path = '' as $$
begin
  if octet_length(p_snapshot::text) > public._sync_max_bytes(p_owner) then
    raise exception 'too_large';
  end if;
end
$$;

revoke execute on function public._sync_hash_key(text) from public, anon, authenticated;
revoke execute on function public._sync_tier(uuid) from public, anon, authenticated;
revoke execute on function public._sync_max_bytes(uuid) from public, anon, authenticated;
revoke execute on function public._sync_max_slots(uuid) from public, anon, authenticated;
revoke execute on function public._sync_check_size(jsonb, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Public RPCs (POST /rest/v1/rpc/<fn>)
-- ---------------------------------------------------------------------------

-- Push. p_vault_id targets an existing slot owned by the caller to overwrite
-- it in place (rotating its token); omitted/null requests a NEW slot, which is
-- rejected with quota_exceeded once the caller's tier limit is reached.
create or replace function public.token_sync_push(
  p_snapshot jsonb, p_name text, p_token text, p_password text default null, p_vault_id uuid default null
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  v public.sync_vault;
  n_slots int;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  perform public._sync_check_size(p_snapshot, uid);
  if p_token is null or p_token !~ '^[0-9]{16}$' then
    raise exception 'bad_token';
  end if;

  if p_vault_id is not null and not exists (
    select 1 from public.sync_vault where id = p_vault_id and owner_id = uid
  ) then
    raise exception 'not_owner';
  end if;

  if p_vault_id is null then
    select count(*) into n_slots from public.sync_vault where owner_id = uid;
    if n_slots >= public._sync_max_slots(uid) then
      raise exception 'quota_exceeded';
    end if;
  end if;

  begin
    if p_vault_id is null then
      insert into public.sync_vault (owner_id, name, snapshot, token_hash, password_hash, expires_at)
        values (
          uid, coalesce(p_name, 'vault'), p_snapshot, public._sync_hash_key(p_token),
          case when p_password is not null and p_password <> '' then crypt(p_password, gen_salt('bf')) else null end,
          now() + interval '72 hours'
        )
        returning * into v;
    else
      update public.sync_vault
        set name = coalesce(p_name, name),
            snapshot = p_snapshot,
            snapshot_at = now(),
            token_hash = public._sync_hash_key(p_token),
            password_hash = case when p_password is not null and p_password <> '' then crypt(p_password, gen_salt('bf')) else null end,
            expires_at = now() + interval '72 hours',
            pull_fail_count = 0,
            pull_locked_until = null
        where id = p_vault_id and owner_id = uid
        returning * into v;
    end if;
  exception when unique_violation then
    raise exception 'token_collision';
  end;
  return jsonb_build_object('vault_id', v.id, 'snapshot_at', v.snapshot_at, 'expires_at', v.expires_at);
end
$$;

-- Auth'd caller's own upload slots + quota (no token needed).
create or replace function public.token_sync_status()
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  delete from public.sync_vault where owner_id = uid and expires_at < now();
  return jsonb_build_object(
    'tier', public._sync_tier(uid),
    'max_slots', public._sync_max_slots(uid),
    'max_bytes', public._sync_max_bytes(uid),
    'uploads', coalesce((
      select jsonb_agg(jsonb_build_object(
        'vault_id', id, 'name', name, 'snapshot_at', snapshot_at, 'expires_at', expires_at,
        'size_bytes', octet_length(snapshot::text), 'has_password', password_hash is not null
      ) order by snapshot_at desc)
      from public.sync_vault where owner_id = uid
    ), '[]'::jsonb)
  );
end
$$;

-- Auth'd caller deletes one of their own slots.
create or replace function public.token_sync_delete(p_vault_id uuid)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  delete from public.sync_vault where id = p_vault_id and owner_id = auth.uid();
  return jsonb_build_object('ok', true);
end
$$;

-- Auth'd caller pulls one of their OWN live slots — no token required.
create or replace function public.token_sync_pull_own(p_vault_id uuid)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v public.sync_vault;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  select * into v from public.sync_vault
    where id = p_vault_id and owner_id = auth.uid() and expires_at >= now();
  if v.id is null then
    raise exception 'no_upload';
  end if;
  return jsonb_build_object('name', v.name, 'snapshot', v.snapshot, 'snapshot_at', v.snapshot_at);
end
$$;

-- Cross-account/cross-device entry point. 8 wrong passwords lock the slot for
-- 15 minutes; the owner's own account skips the password check entirely.
create or replace function public.token_sync_pull_by_token(p_token text, p_password text default null)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v public.sync_vault;
begin
  select * into v from public.sync_vault where token_hash = public._sync_hash_key(p_token);
  if v.id is null then
    raise exception 'bad_token';
  end if;
  if v.expires_at < now() then
    delete from public.sync_vault where id = v.id;
    raise exception 'bad_token';
  end if;
  if v.pull_locked_until is not null and v.pull_locked_until > now() then
    raise exception 'locked';
  end if;
  if auth.uid() is not null and auth.uid() = v.owner_id then
    return jsonb_build_object('vault_id', v.id, 'name', v.name, 'snapshot', v.snapshot, 'snapshot_at', v.snapshot_at);
  end if;
  if v.password_hash is not null then
    if p_password is null or crypt(p_password, v.password_hash) <> v.password_hash then
      update public.sync_vault
        set pull_fail_count = pull_fail_count + 1,
            pull_locked_until = case when pull_fail_count + 1 >= 8 then now() + interval '15 minutes' else pull_locked_until end
        where id = v.id;
      raise exception 'bad_password';
    end if;
  end if;
  update public.sync_vault set pull_fail_count = 0, pull_locked_until = null where id = v.id;
  return jsonb_build_object('vault_id', v.id, 'name', v.name, 'snapshot', v.snapshot, 'snapshot_at', v.snapshot_at);
end
$$;

-- ---------------------------------------------------------------------------
-- Setup probe. Deliberately the ONLY thing in this schema an unauthenticated
-- publishable key may call: it reports object presence and the installed
-- schema version, and nothing else — no row data, no counts, no names beyond
-- the fixed list this app owns.
-- ---------------------------------------------------------------------------
create or replace function public.dracondex_schema_status()
returns jsonb
language sql security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'app', 'dracondex',
    'schema_version', coalesce((select value from public.dracondex_meta where key = 'schema_version'), '0'),
    'tables', (
      select jsonb_object_agg(name, to_regclass('public.' || name) is not null)
      from unnest(array['sync_vault', 'sync_account', 'dracondex_meta']) as name
    ),
    'functions', (
      select jsonb_object_agg(name, exists (
        select 1 from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = name
      ))
      from unnest(array[
        'token_sync_push', 'token_sync_status', 'token_sync_delete',
        'token_sync_pull_own', 'token_sync_pull_by_token'
      ]) as name
    )
  )
$$;

grant execute on function
  public.token_sync_push(jsonb, text, text, text, uuid),
  public.token_sync_status(),
  public.token_sync_delete(uuid),
  public.token_sync_pull_own(uuid),
  public.token_sync_pull_by_token(text, text),
  public.dracondex_schema_status()
to anon, authenticated;

-- Stamp last: if anything above failed the whole script rolls back and the
-- version never moves, so a partial install still reports its old version.
insert into public.dracondex_meta (key, value)
  values ('schema_version', '2')
  on conflict (key) do update set value = excluded.value, updated_at = now();
