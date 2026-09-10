<p align="center">
  <img src="assets/brand/DraconDex_Color.png" alt="DraconDex logo" width="140">
</p>

<h1 align="center">DraconDex-SDB</h1>

<p align="center">
  The central SQLite schema for <a href="https://github.com/ZYDRAXYL/DraconDex-APP">DraconDex</a> —
  one source of truth that both the desktop and mobile apps generate their
  database layer from.
</p>

---

## What this is

DraconDex ships as an Electron desktop app (**DraconDex-EXE**), a Flutter app
for Android and iOS (**DraconDex-APK**), and a browser build of both
(**DraconDex-PWA**). All three open the *same* SQLite vault format.

Keeping three hand-written copies of ~100 `CREATE TABLE` statements in sync was
never going to hold — and it didn't: before this was centralised, the Flutter
port had 40 of the tables the Electron app had. So the schema lives here, once,
and each app's database code is **generated** from it.

```
schema/vault.sql          ~100 CREATE TABLE statements — the canonical source
schema/version.json       vaultSchemaVersion — the number both apps fold into their init path
supabase/setup/           the idempotent installer SQL for Cloud Sync
assets/                   brand, font and app-icon masters both apps ship
generated/                the build output the apps vendor — never hand-edited
generated/manifest.json   the contract: every artifact, its hash, and where it lands downstream
sdb.json                  this repo's own release version
```

## Using it

```bash
npm run generate    # rebuild generated/ from the sources, then the manifest
npm run check       # verify only — what CI runs
```

`generated/` is **committed**. Consumers vendor what is committed here; they do
not run the generator themselves, because they do not have `vault.sql`.

## How a schema change reaches the apps

1. Edit `schema/vault.sql`. Bump `schema/version.json`'s `vaultSchemaVersion`
   if every existing install must re-run its init path.
2. `npm run generate`, then commit `generated/`.
3. Bump `sdb.json` and tag `sdb-vX.Y.Z`.
4. `chained-updated` opens a pull request on EXE and APK that re-vendors the
   artifacts and moves their `sdb.lock.json` pin.

Each consumer's CI verifies its vendored copies against this repo's manifest by
SHA-256, so a schema change cannot land on one app and silently miss the other.

> Adding a brand-new table needs no version bump — both apps run
> `CREATE TABLE IF NOT EXISTS` on every open. Changing an *existing* table needs
> a real migration on both sides as well; SQLite cannot `ALTER` a column in
> place. See [`schema/README.md`](schema/README.md) for the full rules.

## What is deliberately *not* here

The Electron app's machine-level tables — `plugin`, `app_setting`, `nexus_file`
— stay in `electron/src/db/schema/ddl.js` over in DraconDex-EXE. They have no
meaning on the Flutter side, which has no plugin system and no multi-file vault,
so folding them in would export a fiction.

## Where this sits in the chain

```
APP > SDB > EXE, APK > PKG, WEB, PWA
```

See [`chain/README.md`](chain/README.md) for the full contract, and
[`ZYDRAXYL/DraconDex-APP`](https://github.com/ZYDRAXYL/DraconDex-APP) for the
project's documentation set and history — including everything that happened
in this repo before the split.

## License

MIT — see [LICENSE](LICENSE).
