-- DraconDex Token Sync (replaces the 20260717 access-key prototype).
-- Access model: Supabase Auth (Google provider) identifies the caller via
-- auth.uid(). Each account gets N upload slots (sync_vault rows) per its
-- tier — free: 1 slot / 10MB, pro: 3 slots / 20MB (public.sync_account.tier;
-- no billing integration here, tier is a plain data flag set some other way
-- until a real billing feature exists). A 16-digit token
-- ("1234-5678-9012-3456") is (re)generated on every push and is the sole
-- credential a DIFFERENT account needs to pull a slot's snapshot; the
-- owner's own account can always pull/delete its own slots without a token.
-- An optional per-slot password (hashed, never stored/compared in the
-- clear) additionally gates cross-account pulls. Rows expire 72h after the
-- last push (checked on every read, no pg_cron dependency).

create extension if not exists pgcrypto; -- crypt()/gen_salt() for password hashing

-- ---------------------------------------------------------------------------
-- Drop the prototype's owner/read-key model entirely — see plan doc for why
-- this is a replace, not an additive migration, on this server-side table.
-- ---------------------------------------------------------------------------
drop function if exists public.sync_create_read_key(text, text);
drop function if exists public.sync_create_vault(text, jsonb, text);
drop function if exists public.sync_push_vault(text, text, jsonb);
drop function if exists public.sync_pull_vault(text);
drop function if exists public.sync_vault_status(text);
drop function if exists public._sync_auth(text, boolean);
drop table if exists public.sync_key;

-- ---------------------------------------------------------------------------
-- Account tier — free (default) vs pro. No billing wiring in this repo yet;
-- a row is created lazily on first push, tier flipped by hand for now.
-- ---------------------------------------------------------------------------
create table public.sync_account (
  owner_id   uuid primary key references auth.users(id) on delete cascade,
  tier       text not null default 'free' check (tier in ('free', 'pro')),
  created_at timestamptz not null default now()
);

create function public._sync_tier(p_owner uuid) returns text
language sql stable set search_path = '' as $$
  select coalesce((select tier from public.sync_account where owner_id = p_owner), 'free')
$$;

create function public._sync_max_bytes(p_owner uuid) returns bigint
language sql stable set search_path = '' as $$
  select case when public._sync_tier(p_owner) = 'pro' then 20971520 else 10485760 end -- pro 20MB / free 10MB
$$;

create function public._sync_max_slots(p_owner uuid) returns int
language sql stable set search_path = '' as $$
  select case when public._sync_tier(p_owner) = 'pro' then 3 else 1 end -- pro 3 slots / free 1 slot
$$;

revoke execute on function public._sync_tier(uuid) from public, anon, authenticated;
revoke execute on function public._sync_max_bytes(uuid) from public, anon, authenticated;
revoke execute on function public._sync_max_slots(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- sync_vault: multiple rows per owner now allowed (up to their slot quota),
-- so owner_id is indexed but no longer globally unique — token_hash is the
-- only per-row uniqueness constraint.
-- ---------------------------------------------------------------------------
alter table public.sync_vault
  add column owner_id          uuid references auth.users(id) on delete cascade,
  add column token_hash        text,
  add column password_hash     text,
  add column expires_at        timestamptz,
  add column pull_fail_count   integer not null default 0,
  add column pull_locked_until timestamptz;

-- Prototype rows have no owner/token and become unreachable once the old
-- RPCs are gone above — clear them so the NOT NULL constraints below hold.
delete from public.sync_vault;

alter table public.sync_vault
  alter column owner_id   set not null,
  alter column token_hash set not null,
  alter column expires_at set not null;

create index        sync_vault_owner_idx  on public.sync_vault(owner_id);
create unique index sync_vault_token_idx  on public.sync_vault(token_hash);
create index        sync_vault_expiry_idx on public.sync_vault(expires_at);

-- ---------------------------------------------------------------------------
-- Private helper — _sync_hash_key(text) from the prototype migration is
-- reused unchanged for tokens. Size cap is now per-tier (see _sync_max_bytes).
-- ---------------------------------------------------------------------------
create or replace function public._sync_check_size(p_snapshot jsonb, p_owner uuid) returns void
language plpgsql stable set search_path = '' as $$
begin
  if octet_length(p_snapshot::text) > public._sync_max_bytes(p_owner) then
    raise exception 'too_large';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Public RPCs (POST /rest/v1/rpc/<fn>) — all require an authenticated caller
-- except pull_by_token, which is the one cross-account/cross-device door.
-- ---------------------------------------------------------------------------

-- Push. p_vault_id targets an existing slot owned by the caller to overwrite
-- it in place (rotating its token); omitted/null requests a NEW slot, which
-- is rejected with quota_exceeded once the caller's tier limit is reached.
-- p_token is generated client-side each call; a collision with someone
-- ELSE's live token surfaces as token_collision so the client retries fresh.
create function public.token_sync_push(
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
create function public.token_sync_status()
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
create function public.token_sync_delete(p_vault_id uuid)
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

-- Auth'd caller pulls one of their OWN live slots — no token required, this
-- is the "same account, sync down immediately" path.
create function public.token_sync_pull_own(p_vault_id uuid)
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

-- Cross-account/cross-device entry point. Same-account callers (auth.uid()
-- = owner) skip the password check entirely; everyone else must supply the
-- correct password if the uploader set one. 8 wrong attempts locks the
-- slot for 15 minutes.
create function public.token_sync_pull_by_token(p_token text, p_password text default null)
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

grant execute on function
  public.token_sync_push(jsonb, text, text, text, uuid),
  public.token_sync_status(),
  public.token_sync_delete(uuid),
  public.token_sync_pull_own(uuid),
  public.token_sync_pull_by_token(text, text)
to anon, authenticated;
