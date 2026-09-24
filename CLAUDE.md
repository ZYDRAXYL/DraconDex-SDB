# CLAUDE.md — DraconDex-SDB

Guidance for Claude Code working in this repo. For the wider architecture read
`chain/README.md` and the `multi-repository-architecture` skill first.

## What this repo is

The **central SQLite schema** for DraconDex. Two shipping apps —
`DraconDex-EXE` (Electron) and `DraconDex-APK` (Flutter) — generate their
database layer from `schema/vault.sql` here rather than hand-writing it twice.
This repo holds no application code and builds no app.

```
schema/vault.sql        canonical — ~100 CREATE TABLE statements, 1081 lines
schema/version.json     vaultSchemaVersion (currently 6)
schema/generate.mjs     codegen: vault.sql -> generated/{electron,flutter}/
schema/README.md        the rules for changing a table — READ BEFORE EDITING vault.sql
supabase/setup/         Cloud Sync installer SQL + its own codegen
supabase/migrations/    server-side migration history
assets/{brand,flutter,fonts}/   masters both apps ship
templates/              genre bundles + strings (18 locales) + the TH/EN guide — templates/README.md
fixtures/               snapshot-v2.json, the snapshot both apps' tests import — fixtures/README.md
generated/              GENERATED + COMMITTED — never hand-edit
generated/manifest.json every artifact, its sha256, and its destination per consumer
sdb.json                this repo's release identity (sdbVersion)
```

## The two version numbers, and why they are different

| | What it means | When it moves |
|---|---|---|
| `schema/version.json` → `vaultSchemaVersion` | the number **both apps** fold into their DB init path | only when every existing install must re-run init |
| `sdb.json` → `sdbVersion` | **this repo's** release identity, and the `sdb-vX.Y.Z` tag | on any published change to `generated/` |

Confusing them is the easy mistake: a regenerated file with no schema change
bumps `sdbVersion` only.

## Working here

```bash
npm run generate   # rebuild generated/ + manifest
npm run check      # verify only — what CI runs
```

**Always commit `generated/` alongside the source change.** Consumers vendor the
committed output; they cannot run the generator (they have no `vault.sql`). CI
fails on uncommitted generator output for exactly this reason.

## Rules

- **Edit `schema/vault.sql`, never a file under `generated/`.** Both carry a
  header saying so. A hand-edit there is overwritten on the next generate and,
  worse, makes the consumer's drift check red for a reason nobody can find.
- **A new table needs no `vaultSchemaVersion` bump** — both apps run
  `CREATE TABLE IF NOT EXISTS` on every open. **Changing an existing table
  does**, plus a real migration on each app side, because SQLite cannot `ALTER`
  a column in place.
- **App-level tables stay in EXE.** `plugin`, `app_setting` and `nexus_file` are
  machine-level, meaningless to Flutter, and deliberately excluded from
  `vault.sql`.
- **`nexus.name` is `UNIQUE`** here, which the Flutter side did not historically
  enforce. Pre-existing duplicate names on an old install are a known, unmigrated
  gap — see `schema/README.md`.

## After a change

1. `npm run generate` and commit `generated/`.
2. Bump `sdb.json`; tag `sdb-vX.Y.Z` (see the `merge-release` skill for cadence).
3. Run `chained-updated` — EXE and APK need their pins moved. A schema change
   that never reaches the apps is not a finished change.
