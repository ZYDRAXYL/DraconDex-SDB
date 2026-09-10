import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Moved here from DraconDex-APP's electron/test/supabase-setup.test.mjs in the
// multi-repo split. These were always invariants of the GENERATOR, not of the
// Electron app: they assert that the SQL, the generated JS and the generated
// Dart agree. This is now the only tree where all three exist together, so it
// is the only place the assertion can still be made.

// Same CRLF guard the generators use — `.gitattributes` sets `* text=auto`, so
// a Windows checkout has CRLF and `\n`-anchored regexes stop matching.
const readSource = (relPath) =>
  readFileSync(new URL(relPath, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

const SQL = readSource('../supabase/setup/dracondex_setup.sql');

// The one thing the generator exists to prevent: the SQL the two apps ship and
// the SQL in src/supabase/setup/ drifting apart. Both constants are checked
// against the file byte-for-byte, so an edit to the .sql that never ran
// `npm run generate` fails here instead of in production.
test('the embedded setup SQL matches supabase/setup/dracondex_setup.sql', async () => {
  const js = await import('../generated/electron/supabase-schema.js');
  assert.equal(js.default.SUPABASE_SETUP_SQL, SQL, 'generated/electron/supabase-schema.js is stale — run gen.mjs');

  const dart = readSource('../generated/flutter/supabase_schema.dart');
  const lit = /const String kSupabaseSetupSql = ([\s\S]*);\n$/.exec(dart);
  assert.ok(lit, 'kSupabaseSetupSql literal not found in the generated Dart');
  // Dart reads a bare `$` as interpolation and this SQL is full of `$$`-quoted
  // function bodies, so gen.mjs escapes them; undo that to compare.
  assert.equal(JSON.parse(lit[1].replace(/\\\$/g, '$')), SQL, 'generated/flutter/supabase_schema.dart is stale — run gen.mjs');
});

// A `$` that reached the Dart constant unescaped compiles as interpolation —
// either a build error or, worse, silently different SQL sent to the user's
// database. Checked directly rather than only through the round-trip above.
test('every $ in the generated Dart SQL constant is escaped', () => {
  const dart = readSource('../generated/flutter/supabase_schema.dart');
  const lit = /const String kSupabaseSetupSql = ([\s\S]*);\n$/.exec(dart)[1];
  assert.equal(lit.match(/(?<!\\)\$/g), null, 'unescaped $ in kSupabaseSetupSql — Dart would interpolate it');
});

// Re-running the installer on a project that already has the schema must be a
// no-op, because that is exactly what the "Auto setup" button does every time
// the user presses it. Anything that would fail or destroy data on a second run
// (a bare CREATE TABLE, a DROP of a table this app owns) is a regression.
test('the setup SQL is idempotent — no bare CREATE/DROP of the app tables', () => {
  const stripped = SQL.replace(/^\s*--.*$/gm, '');
  for (const m of stripped.matchAll(/^\s*create table (?!if not exists)(\S+)/gim)) {
    assert.fail(`bare "create table ${m[1]}" — must be "create table if not exists"`);
  }
  for (const m of stripped.matchAll(/^\s*create (unique )?index (?!if not exists)(\S+)/gim)) {
    assert.fail(`bare "create index ${m[2]}" — must be "create index if not exists"`);
  }
  for (const m of stripped.matchAll(/^\s*create function\s/gim)) {
    assert.fail('bare "create function" — must be "create or replace function"');
  }
  // The only table this script may drop is the 20260717 prototype's sync_key,
  // which the token-sync model replaced outright.
  for (const m of stripped.matchAll(/^\s*drop table if exists (\S+);/gim)) {
    assert.equal(m[1], 'public.sync_key', `unexpected DROP TABLE ${m[1]} in an installer that reruns`);
  }
});

// The probe is what makes "check tables" possible with nothing but a
// publishable key: sync_vault/sync_account are RLS-locked with every grant
// revoked, so PostgREST never exposes them. If the grant is lost, checking
// silently reports "nothing installed" on a fully-installed project.
test('dracondex_schema_status is created and granted to anon', () => {
  assert.match(SQL, /create or replace function public\.dracondex_schema_status\(\)/);
  const grant = /grant execute on function([\s\S]*?)to anon, authenticated;/.exec(SQL);
  assert.ok(grant, 'no grant block found');
  assert.match(grant[1], /public\.dracondex_schema_status\(\)/);
  for (const fn of ['token_sync_push', 'token_sync_status', 'token_sync_delete',
    'token_sync_pull_own', 'token_sync_pull_by_token']) {
    assert.match(grant[1], new RegExp(`public\\.${fn}\\(`), `${fn} is not granted to anon`);
  }
});

// The private helpers must NOT be reachable from a publishable key — they read
// and hash other accounts' data. Every one of them has to be revoked.
test('the _sync_* helpers stay revoked from anon/authenticated', () => {
  for (const fn of ['_sync_hash_key', '_sync_tier', '_sync_max_bytes', '_sync_max_slots', '_sync_check_size']) {
    assert.match(SQL, new RegExp(`revoke execute on function public\\.${fn}\\([^)]*\\) from public, anon, authenticated;`),
      `${fn} is not revoked from anon`);
  }
  for (const tbl of ['sync_vault', 'sync_account', 'dracondex_meta']) {
    assert.match(SQL, new RegExp(`alter table public\\.${tbl}\\s+enable row level security;`), `${tbl} has no RLS`);
    assert.match(SQL, new RegExp(`revoke all on table public\\.${tbl}\\s+from anon, authenticated;`), `${tbl} keeps its grants`);
  }
});
