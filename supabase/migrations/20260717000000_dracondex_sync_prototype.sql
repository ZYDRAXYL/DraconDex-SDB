-- DraconDex cloud sync prototype (Nexus vault snapshot sync).
-- Access model: no Supabase Auth. Client-generated access keys
-- ("Xxxx-Xxxx-Xxxx-Xxxx", 62^16 ~ 95 bits) are the sole credential;
-- only their sha-256 hex hashes are stored. Tables are RLS-locked with
-- zero policies + revoked grants, so the SECURITY DEFINER RPCs below are
-- the only door in.

create table public.sync_vault (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  snapshot    jsonb not null,
  snapshot_at timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

create table public.sync_key (
  id           uuid primary key default gen_random_uuid(),
  vault_id     uuid not null references public.sync_vault(id) on delete cascade,
  key_hash     text not null unique,
  role         text not null check (role in ('owner','read')),
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);

create index sync_key_vault_idx on public.sync_key(vault_id);

alter table public.sync_vault enable row level security;
alter table public.sync_key   enable row level security;
revoke all on table public.sync_vault from anon, authenticated;
revoke all on table public.sync_key   from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Private helpers (no anon execute)
-- ---------------------------------------------------------------------------

create function public._sync_hash_key(p_key text) returns text
language sql immutable
set search_path = ''
as $$
  select encode(sha256(convert_to(p_key, 'UTF8')), 'hex')
$$;

-- Validates an access key, bumps last_used_at, returns its sync_key row.
-- Raises: bad_key, not_owner.
create function public._sync_auth(p_key text, p_need_owner boolean)
returns public.sync_key
language plpgsql security definer
set search_path = ''
as $$
declare
  k public.sync_key;
begin
  select * into k from public.sync_key
    where key_hash = public._sync_hash_key(p_key);
  if k.id is null then
    raise exception 'bad_key';
  end if;
  if p_need_owner and k.role <> 'owner' then
    raise exception 'not_owner';
  end if;
  update public.sync_key set last_used_at = now() where id = k.id;
  return k;
end
$$;

create function public._sync_check_size(p_snapshot jsonb) returns void
language plpgsql immutable
set search_path = ''
as $$
begin
  if octet_length(p_snapshot::text) > 10485760 then
    raise exception 'too_large';
  end if;
end
$$;

revoke execute on function public._sync_hash_key(text) from public, anon, authenticated;
revoke execute on function public._sync_auth(text, boolean) from public, anon, authenticated;
revoke execute on function public._sync_check_size(jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Public RPCs (POST /rest/v1/rpc/<fn> with the anon key)
-- ---------------------------------------------------------------------------

-- First push of a vault: the client generates the owner key locally and
-- sends the plaintext once over TLS; only its hash is stored.
create function public.sync_create_vault(p_name text, p_snapshot jsonb, p_owner_key text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v public.sync_vault;
begin
  perform public._sync_check_size(p_snapshot);
  if p_owner_key is null or length(p_owner_key) < 19 then
    raise exception 'bad_key';
  end if;
  insert into public.sync_vault (name, snapshot)
    values (coalesce(p_name, 'vault'), p_snapshot)
    returning * into v;
  insert into public.sync_key (vault_id, key_hash, role)
    values (v.id, public._sync_hash_key(p_owner_key), 'owner');
  return jsonb_build_object('vault_id', v.id, 'snapshot_at', v.snapshot_at);
end
$$;

create function public.sync_push_vault(p_key text, p_name text, p_snapshot jsonb)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  k public.sync_key;
  v public.sync_vault;
begin
  perform public._sync_check_size(p_snapshot);
  k := public._sync_auth(p_key, true);
  update public.sync_vault
    set name = coalesce(p_name, name), snapshot = p_snapshot, snapshot_at = now()
    where id = k.vault_id
    returning * into v;
  return jsonb_build_object('vault_id', v.id, 'snapshot_at', v.snapshot_at);
end
$$;

create function public.sync_pull_vault(p_key text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  k public.sync_key;
  v public.sync_vault;
begin
  k := public._sync_auth(p_key, false);
  select * into v from public.sync_vault where id = k.vault_id;
  return jsonb_build_object(
    'vault_id', v.id, 'name', v.name, 'snapshot', v.snapshot,
    'snapshot_at', v.snapshot_at, 'role', k.role);
end
$$;

-- Owner mints a read-only key (generated client-side, shown once there).
create function public.sync_create_read_key(p_owner_key text, p_new_key text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  k public.sync_key;
  nk uuid;
begin
  k := public._sync_auth(p_owner_key, true);
  if p_new_key is null or length(p_new_key) < 19 then
    raise exception 'bad_key';
  end if;
  insert into public.sync_key (vault_id, key_hash, role)
    values (k.vault_id, public._sync_hash_key(p_new_key), 'read')
    returning id into nk;
  return jsonb_build_object('key_id', nk);
end
$$;

-- Status without downloading the snapshot (modal status line / link check).
create function public.sync_vault_status(p_key text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  k public.sync_key;
  v public.sync_vault;
  n bigint;
begin
  k := public._sync_auth(p_key, false);
  select * into v from public.sync_vault where id = k.vault_id;
  select count(*) into n from public.sync_key where vault_id = k.vault_id;
  return jsonb_build_object(
    'vault_id', v.id, 'name', v.name, 'snapshot_at', v.snapshot_at,
    'role', k.role, 'key_count', n);
end
$$;

grant execute on function
  public.sync_create_vault(text, jsonb, text),
  public.sync_push_vault(text, text, jsonb),
  public.sync_pull_vault(text),
  public.sync_create_read_key(text, text),
  public.sync_vault_status(text)
to anon;
