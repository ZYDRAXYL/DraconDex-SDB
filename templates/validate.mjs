// ═══ Template validation — pure, so a test can feed it broken input ═══════
// build.mjs reads the files and calls validate(); test/templates.test.mjs
// calls it with a copy of the real sources, broken one way at a time.
//
//   input = { kinds, locales, strings, components, bundles: [{f, b}],
//             pages: [{f, p}], guides: [{f, g}] }
//   → { errors: [string], used: Set<stringKey> }
//
// What a block, a page template and a v2 bundle may say is APP
// docs/TEMPLATES.md §3.1 and §4.1. Fields are referred to by `key` (the
// user's decision on §4.5's open question), never by position.

// A classifier field's type: EXE mod/cls-field-types.js CLS_FIELD_TYPES.
export const FIELD_TYPES = new Set(['text', 'textarea', 'number', 'date', 'select', 'multi', 'checkbox', 'url', 'relation', 'formula']);
// page_block.block_type (vault.sql page_block CHECK).
export const BLOCK_TYPES = new Set(['component', 'text', 'heading', 'divider', 'image', 'property', 'columns']);
export const CAT_TYPES = new Set(['object', 'element', 'character']);
// The per-module collections a bundle can fill (EXE db/bundle.js).
export const COLLECTIONS = ['objects', 'events', 'chapters', 'dialogues', 'sessions', 'nodes', 'pages', 'tables'];
export const MAX_SAMPLES = 3;
const KEY_RE = /^[a-z][a-zA-Z0-9]*$/;
const TPL_ID_RE = /^([a-z]+)\.([a-z][a-zA-Z0-9]*)$/;

export const isT = (v) => v && typeof v === 'object' && !Array.isArray(v) && typeof v.t === 'string'
  && Object.keys(v).every((k) => k === 't' || k === 'suffix');
const nameOk = (v) => (typeof v === 'string' && v.trim()) || isT(v);
const arr = (v) => (Array.isArray(v) ? v : []);

export function validate({ kinds, locales, strings, components, bundles = [], pages = [], guides = [] }) {
  const errors = [];
  const err = (where, msg) => errors.push(`${where}: ${msg}`);
  const used = new Set();

  for (const [k, v] of Object.entries(strings)) {
    for (const l of locales) if (typeof v?.[l] !== 'string' || !v[l].trim()) err(`strings.${k}`, `no ${l}`);
  }
  function walkStrings(v, where) {
    if (isT(v)) { used.add(v.t); if (!strings[v.t]) err(where, `unknown string "${v.t}"`); return; }
    if (Array.isArray(v)) v.forEach((x, i) => walkStrings(x, `${where}[${i}]`));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walkStrings(x, `${where}.${k}`);
  }

  const comps = new Map();
  for (const c of components) {
    if (comps.has(c.id)) err(`components.${c.id}`, 'duplicate id');
    comps.set(c.id, c);
  }

  // Fields of one module or one template preset: named, typed, keyed.
  // requireKeys: bundles and templates key every field; a guide (plain text,
  // also installed from PKG) may not.
  function checkFields(fields, where, modRefs, requireKeys = true) {
    const keys = new Map();
    arr(fields).forEach((f, i) => {
      const w = `${where}.fields[${i}]`;
      if (!nameOk(f.name)) err(w, 'no name');
      if (f.key === undefined && !requireKeys) {
        // A guide names its fields in its own language and its objects' values
        // use those names (db/bundle.js resolves by name).
        if (typeof f.name === 'string') keys.set(f.name, f);
      }
      else if (typeof f.key !== 'string' || !KEY_RE.test(f.key)) err(w, `key "${f.key}" must match ${KEY_RE}`);
      else if (keys.has(f.key)) err(w, `duplicate field key "${f.key}"`);
      else keys.set(f.key, f);
      if (f.type && !FIELD_TYPES.has(f.type)) err(w, `type "${f.type}" is not a field type`);
      if (f.relTo && modRefs && !modRefs.has(f.relTo)) err(w, `relTo "${f.relTo}" is not a module ref here`);
      if (f.relTo && f.type !== 'relation') err(w, 'relTo on a field that is not a relation');
    });
    return keys;
  }

  // A page's blocks. ctx: { kind, fieldKeys (Map|null), mods (Map ref->module|null, null = a
  // standalone template, where a borrow is unbound: `borrow: true`) }.
  function checkBlocks(blocks, where, ctx) {
    if (!Array.isArray(blocks)) { err(where, 'must be a list of blocks'); return; }
    const onceSeen = new Set();
    const field = (k, w) => {
      if (!ctx.fieldKeys || !ctx.fieldKeys.has(k)) err(w, `field "${k}" is not a field key of this module`);
    };
    const walk = (list, w0) => arr(list).forEach((b, i) => {
      const w = `${w0}[${i}]`;
      if (!b || typeof b !== 'object' || Array.isArray(b)) { err(w, 'a block must be an object'); return; }
      const type = b.type ?? (b.component ? 'component' : null);
      if (!type || !BLOCK_TYPES.has(type)) { err(w, `type "${b.type}" is not a block type`); return; }
      const c = b.component ? comps.get(b.component) : null;
      if (type === 'component') {
        if (!b.component) { err(w, 'a component block names no component'); return; }
        if (!c) { err(w, `component "${b.component}" is not in components.json`); return; }
        if (c.once) { if (onceSeen.has(c.id)) err(w, `"${c.id}" can appear once per page`); onceSeen.add(c.id); }
        const pre = b.config?.preset;
        if (pre !== undefined && !arr(c.presets).includes(pre)) err(w, `preset "${pre}" is not one of ${c.id}'s`);
        const own = c.kind === 'core' || c.kind === 'item' || c.kind === ctx.kind;
        if (b.borrow !== undefined) {
          if (!c.borrowable) err(w, `"${c.id}" cannot be borrowed`);
          if (ctx.mods) {
            const src = ctx.mods.get(b.borrow);
            if (!src) err(w, `borrow "${b.borrow}" is not a module ref in this bundle`);
            else if (src.kind !== c.kind) err(w, `borrow "${b.borrow}" is a ${src.kind}, "${c.id}" needs a ${c.kind}`);
          } else if (b.borrow !== true) err(w, 'a standalone template borrows unbound: "borrow": true');
        } else if (!own) err(w, `"${c.id}" belongs to another kind — it must borrow`);
      } else if (b.component) err(w, `a ${type} block cannot name a component`);
      if (b.config?.field !== undefined) field(b.config.field, `${w}.config.field`);
      for (const k of arr(b.config?.fields)) field(k, `${w}.config.fields`);
      if (b.children !== undefined) {
        if (type !== 'columns' && !c?.container) err(w, 'only columns and container components hold children');
        else if (!Array.isArray(b.children) || !b.children.every(Array.isArray)) err(w, 'children must be a list of columns (lists of blocks)');
        else b.children.forEach((col, j) => walk(col, `${w}.children[${j}]`));
      } else if (type === 'columns') err(w, 'a columns block has no children');
    });
    walk(blocks, where);
  }

  // ── page templates ───────────────────────────────────────────────────
  const templates = new Map();
  for (const { f, p } of pages) {
    const w0 = `pages/${f}`;
    const kind = f.replace(/\.json$/, '');
    if (p.kind !== kind) err(w0, 'kind does not match the file name');
    if (!kinds.has(kind)) err(w0, `"${kind}" is not a module kind`);
    const defaults = new Map(); // for-group -> count
    arr(p.templates).forEach((t, i) => {
      const w = `${w0}.templates[${i}]`;
      const m = TPL_ID_RE.exec(t.id || '');
      if (!m || m[1] !== kind) { err(w, `id "${t.id}" must be ${kind}.<name>`); return; }
      if (templates.has(t.id)) err(w, `duplicate template id "${t.id}"`);
      templates.set(t.id, { ...t, kind });
      if (!isT(t.name) || !isT(t.description)) err(w, 'name and description must be strings-table keys');
      for (const c of arr(t.for)) if (!CAT_TYPES.has(c)) err(w, `for "${c}" is not a catType`);
      if (t.preset?.catType && !CAT_TYPES.has(t.preset.catType)) err(w, `preset.catType "${t.preset.catType}" is not a catType`);
      const fieldKeys = checkFields(t.preset?.fields, `${w}.preset`, null);
      if (!t.page && !t.itemPage) err(w, 'a template needs a page or an itemPage');
      if (t.page) checkBlocks(t.page, `${w}.page`, { kind, fieldKeys, mods: null });
      if (t.itemPage) checkBlocks(t.itemPage, `${w}.itemPage`, { kind, fieldKeys, mods: null });
      if (t.default) for (const g of (t.for?.length ? t.for : ['*'])) defaults.set(g, (defaults.get(g) || 0) + 1);
      walkStrings(t, w);
    });
    const groups = new Set(arr(p.templates).flatMap((t) => (t.for?.length ? t.for : ['*'])));
    for (const g of groups) {
      const n = defaults.get(g) || 0;
      if (n !== 1) err(w0, `${n} default templates${g === '*' ? '' : ` for "${g}"`} — exactly one is ★`);
    }
  }

  // ── bundles and guides ───────────────────────────────────────────────
  function checkModules(mods, where, spec, requireKeys = true) {
    if (!Array.isArray(mods) || !mods.length || mods.length > 60) { err(where, 'needs 1–60 modules'); return; }
    const byRef = new Map();
    for (const m of mods) if (m.ref) { if (byRef.has(m.ref)) err(where, `duplicate module ref "${m.ref}"`); byRef.set(m.ref, m); }
    const folders = new Map(arr(spec?.folders).map((x) => [x.ref, x]));
    // object refs are bundle-wide (db/bundle.js links resolve across modules)
    const objRefs = new Map();
    mods.forEach((m, i) => arr(m.objects).forEach((o, j) => {
      if (!o.ref) return;
      if (objRefs.has(o.ref)) err(`${where}[${i}].objects[${j}]`, `duplicate object ref "${o.ref}"`);
      objRefs.set(o.ref, m.ref);
    }));
    mods.forEach((m, i) => {
      const w = `${where}[${i}]`;
      if (!kinds.has(m.kind)) err(w, `kind "${m.kind}" is not a module kind`);
      if (!nameOk(m.name)) err(w, 'no name');
      if (m.catType && !CAT_TYPES.has(m.catType)) err(w, `catType "${m.catType}" is not a catType`);
      const fields = checkFields(m.fields, w, new Set(byRef.keys()), requireKeys);
      for (const r of arr(m.selects)) if (!byRef.has(r)) err(w, `selects "${r}" is not a module ref here`);
      // a Wanderer draws on a Locator and a Chronicler (§4.2 Classic Navigator)
      for (const r of arr(m.uses)) if (!byRef.has(r)) err(w, `uses "${r}" is not a module ref here`);
      if (m.folder !== undefined && !folders.has(m.folder)) err(w, `folder "${m.folder}" is not a folder ref`);
      for (const which of ['page', 'itemPage']) {
        const pg = m[which];
        if (pg === undefined) continue;
        if (typeof pg === 'string') {
          const t = templates.get(pg);
          if (!t) err(w, `${which} "${pg}" is not a page template`);
          else if (t.kind !== m.kind) err(w, `${which} "${pg}" is a ${t.kind} template, this is a ${m.kind}`);
          else if (which === 'itemPage' && !t.itemPage) err(w, `"${pg}" has no itemPage`);
        } else checkBlocks(pg, `${w}.${which}`, { kind: m.kind, fieldKeys: fields, mods: byRef });
      }
      for (const col of COLLECTIONS) {
        const items = arr(m[col]);
        const n = m.samples ? items.length : items.filter((x) => x && x.sample).length;
        if (n > MAX_SAMPLES) err(w, `${n} samples in ${col} — at most ${MAX_SAMPLES}`);
      }
      arr(m.objects).forEach((o, j) => {
        const ow = `${w}.objects[${j}]`;
        for (const k of Object.keys(o.values || {})) {
          const f = fields.get(k);
          if (!f) err(ow, `values."${k}" is not a field key`);
          else if (f.type === 'relation') err(ow, `values."${k}" is a relation — use links`);
        }
        for (const [k, refs] of Object.entries(o.links || {})) {
          const f = fields.get(k);
          if (!f) { err(ow, `links."${k}" is not a field key`); continue; }
          if (f.type !== 'relation') { err(ow, `links."${k}" is not a relation field`); continue; }
          for (const r of arr(refs)) {
            if (!objRefs.has(r)) err(ow, `links."${k}" → "${r}" is not an object ref`);
            else if (f.relTo && objRefs.get(r) !== f.relTo) err(ow, `links."${k}" → "${r}" is not in "${f.relTo}"`);
          }
        }
      });
    });
    if (spec) {
      const fl = arr(spec.folders);
      if (fl.length) {
        if (fl.filter((x) => !x.parent).length !== 1) err(where, 'folders need exactly one root (no parent)');
        for (const x of fl) {
          if (!x.ref || !nameOk(x.name)) err(where, 'a folder needs a ref and a name');
          if (x.parent && !folders.has(x.parent)) err(where, `folder "${x.ref}" parent "${x.parent}" is not a folder`);
          const seen = new Set();
          for (let cur = x; cur?.parent; cur = folders.get(cur.parent)) {
            if (seen.has(cur.ref)) { err(where, `folder "${x.ref}" is in a cycle`); break; }
            seen.add(cur.ref);
          }
        }
        if (new Set(fl.map((x) => x.ref)).size !== fl.length) err(where, 'duplicate folder ref');
      }
      if (spec.home !== undefined && !byRef.has(spec.home)) err(where, `home "${spec.home}" is not a module ref`);
    }
  }

  const ids = new Set();
  for (const { f, b } of bundles) {
    const w = `bundles/${f}`;
    if (b.id !== f.replace(/\.json$/, '')) err(w, 'id does not match the file name');
    if (ids.has(b.id)) err(w, 'duplicate id');
    ids.add(b.id);
    if (!isT(b.name) || !isT(b.description)) err(w, 'name and description must be strings-table keys');
    if (b.group !== undefined && b.group !== 'classic' && b.group !== 'genre') err(w, `group "${b.group}" is not classic or genre`);
    checkModules(b.spec?.modules, `${w}.spec.modules`, b.spec);
    walkStrings(b, w);
  }
  for (const k of Object.keys(strings)) if (!used.has(k)) err(`strings.${k}`, 'not used by any bundle or page template');

  // The guides are plain text in their own language (no string keys): the
  // same rules the apps apply when a guide package is installed.
  for (const { f, g } of guides) {
    const w = `guide/${f}`;
    if (g.format !== 'ddx-guide') err(w, 'not a ddx-guide');
    if (g.locale !== f.replace(/\.json$/, '')) err(w, 'locale does not match the file name');
    if (typeof g.spec?.name !== 'string' || !g.spec.name.trim()) err(w, 'spec has no name');
    checkModules(g.spec?.modules, `${w}.spec.modules`, null, false);
  }
  return { errors, used, templates };
}
