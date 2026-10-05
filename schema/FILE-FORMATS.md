# Module files — `.ddata` + `.dpage`

A module, as files, is a **pair** (Procress 16 part 3a; the design is APP
`docs/DATA-PAGE.md`). Both are UTF-8 JSON. The vault file (`.ddx` /
`novel-manager.db`) stays the source of truth — these are what the Locate
folder mirrors and what "export module" writes.

| File | Holds | Shape |
|---|---|---|
| `<name>.ddata` | what the module **knows**: the module row(s) and all their data | the v2 snapshot (`format`, `version`, `modules`, `classifierObjects`, …) **with `pageBlocks: []`**, plus `file: "ddata"`, `fileVersion: 1` |
| `<name>.dpage` | how it is **shown**: its page | `{ file: "dpage", fileVersion: 1, format, modules: [{id,name,kind}], pageBlocks: [...] }` — `pageBlocks` are the snapshot's page-block rows unchanged |

Rules

- **Read** either file of the pair → join them: the `.ddata` with `pageBlocks`
  taken from the `.dpage` of the same base name. A `.dpage` without its `.ddata`
  is refused (nothing to land on). The joined object is an ordinary v2
  snapshot and imports through the one module-import path.
- **Binding**: a page block that shows another module's data names it in
  `source_key` (`module_<id>`, the id inside the snapshot — remapped on import
  like every other id). A source that no longer exists leaves the block on
  the page, saying so.
- **Kind `page`**: a module with no data of its own (`module.kind = 'page'`,
  vault.sql). Its `.ddata` is just its row; its `.dpage` is the whole page.
- `.mddx` (one file, `pageBlocks` inside) still imports. `.dxpack` is
  unchanged — its `snapshot.json` is the joined form.
- `fileVersion` changes only when this shape does.
