# templates/ — bundles, page templates and the in-app guide

Both apps make whole projects from these (APP `docs/V5.md` §11.7–§11.8,
`docs/APK-V3.md`, `docs/TEMPLATES.md` §3–§4). They lived in DraconDex-EXE
(`hub/bundles.js`, `electron/guide/`) until the phone needed the same ones;
this repo owns them now, and EXE and APK vendor the output like the schema.

| File | What it is |
|---|---|
| `bundles/<id>.json` | a bundle: `{ id, order, icon, group, name, description, spec }` — `order` is the picker's order, `group` is `classic` or `genre` |
| `pages/<kind>.json` | a kind's page templates (`{ kind, templates: [...] }`) — one `default` ★ per kind, per catType for Classifier |
| `components.json` | the page components a template may use: id, presets, `once`, `borrowable`, `container`, and `since` (`exe` = registered in EXE today, `planned` = specified, not built yet) |
| `strings.json` | every string a bundle or template shows, in all 18 locales: `key → { en, ja, … }` |
| `guide/<locale>.json` | a `ddx-guide` in plain text. Thai and English ship in both apps; the other 16 locales are DraconDex-PKG `guide` packages |
| `validate.mjs` | every rule below, as a pure function (`test/templates.test.mjs` feeds it broken copies) |

A user-visible string is `{ "t": "key" }`, or `{ "t": "key", "suffix": " 1" }`
for "Chapter 1". The app resolves it in its UI language and falls back to
English. Sample proper names (Arin, Tarven) are plain strings on purpose.

## Bundle v2 (TEMPLATES.md §4)

- `spec.folders: [{ ref, name, parent? }]` — nested Collectors, exactly one root
- `spec.home` — the module that opens after creation
- `module.folder` — which folder it goes in
- `module.page` / `module.itemPage` — a page template id (`"classifier.characterWiki"`) or inline blocks
- `module.uses` — the modules a Wanderer draws on (its Locator and Chronicler)
- `sample: true` on an object/event/chapter/…, or `samples: true` on a module — left out when the user unticks "include sample data"; at most 3 per module
- **Every field has a `key`** (`^[a-z][a-zA-Z0-9]*$`, unique in its module). `values`, `links`, `config.field` and `config.fields` name fields by key — never by position, never by name (a name is translated, a key is not).

Guides keep naming fields in their own language, because a guide package from PKG does the same.

## Blocks (TEMPLATES.md §3.1)

`{ type?, component?, config?, children?, borrow? }` — `type` is a
`page_block.block_type`, and defaults to `component`. `columns` and container
components (`core.tabs`, `core.toggle`) hold `children`: a list of columns,
each a list of blocks. `config.preset` picks a view preset. A kind's
component on another kind's page must `borrow` — in a bundle, a module ref of
that kind; in a standalone template, `true` (unbound: the app asks when the
template is used).

## What `npm run generate` rejects

- a kind that `module.kind`'s CHECK in `schema/vault.sql` does not allow
- a `relTo` / `selects` / `uses` / `home` / `folder` that names nothing in the same bundle; a folder cycle
- a component not in `components.json`, a preset it does not have, a `once` component twice on one page, children where none are held, a borrow of the wrong kind or of something not borrowable
- a page template whose id is not `<kind>.<name>`, a duplicate id, not exactly one ★ per kind (per catType for Classifier)
- a missing or duplicate field key; `values`/`links`/`config.field` naming a key that does not exist; `links` on a field that is not a relation, or pointing outside its `relTo`
- more than 3 samples in one collection of one module
- a string key missing from `strings.json`, a string missing any locale, and a string nothing uses
- a guide without `format: "ddx-guide"`, a matching `locale`, a name, or with 0 or more than 60 modules

`generated/templates/bundles.json` (`ddx-bundles`, version 2) and
`generated/templates/pages.json` (`ddx-pages`, version 1) each carry the
strings they use.

A new or changed template is a published change to `generated/`: bump
`sdbVersion` (z), and re-vendor both apps. **v2 needs the app side first**
(Procress 14 part 2 in EXE, part 3 in APK): today's `db/bundle.js` ignores
folders and pages and resolves `values` by field name, so re-pinning an app
before it reads keys would create the bundles flat, without sample values.
