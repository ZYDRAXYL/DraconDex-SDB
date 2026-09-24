# templates/ — the genre bundles and the in-app guide

Both apps make whole projects from these (APP `docs/V5.md` §11.7–§11.8,
`docs/APK-V3.md`). They lived in DraconDex-EXE (`hub/bundles.js`,
`electron/guide/`) until the phone needed the same ones; this repo owns them
now, and EXE and APK vendor the output like the schema.

| File | What it is |
|---|---|
| `bundles/<id>.json` | `{ id, icon, name, description, spec }` — `spec` is the shape EXE's `db/bundle.js` documents |
| `strings.json` | every string a bundle shows, in all 18 locales: `key → { en, ja, … }` |
| `guide/<locale>.json` | a `ddx-guide` in plain text. Thai and English ship in both apps; the other 16 locales are DraconDex-PKG `guide` packages |

A user-visible string in a bundle is `{ "t": "key" }`, or
`{ "t": "key", "suffix": " 1" }` for "Chapter 1". The app resolves it in its
UI language and falls back to English — so a bundle's module and field names
are the user's own words, in their language, the moment it is created.

`npm run generate` validates and writes `generated/templates/bundles.json`.
It rejects:

- a kind that `module.kind`'s CHECK in `schema/vault.sql` does not allow
- a `relTo` / `selects` that names no module in the same bundle
- a string key missing from `strings.json`, a string missing any locale,
  and a string no bundle uses
- a guide without `format: "ddx-guide"`, a matching `locale`, a name, or
  with 0 or more than 60 modules

A new or changed template is a published change to `generated/`: bump
`sdbVersion` (z), and re-vendor both apps.
