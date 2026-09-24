#!/usr/bin/env node
// ═══ Templates — the genre bundles and the in-app guide (Procress 12 part 0) ═
// Both apps make whole projects from these (APP docs/V5.md §11.7–§11.8,
// docs/APK-V3.md). They were code in DraconDex-EXE (hub/bundles.js) until
// the phone needed the same four; now this repo owns them and both apps
// vendor the output, like the schema.
//
//   templates/bundles/<id>.json  { id, order, icon, name, description, spec }
//   templates/strings.json       key -> { <18 locales> }
//   templates/guide/<loc>.json   a ddx-guide (Thai and English ship in-app;
//                                the other 16 are DraconDex-PKG packages)
//
// Every user-visible string in a bundle is { "t": key } or
// { "t": key, "suffix": " 1" }, resolved by the app in its UI language
// (English when a locale lacks it — never the raw key). A bundle's spec is
// the shape EXE's db/bundle.js documents.
//
//   node templates/build.mjs          validate, write generated/templates/bundles.json
//   node templates/build.mjs --check  validate, exit 1 on drift (CI)
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CHECK = process.argv.includes('--check');
const LOCALES = ['en', 'ja', 'ko', 'th', 'zh', 'vi', 'id', 'es', 'pt', 'fr', 'de', 'ru', 'it', 'nl', 'pl', 'uk', 'tr', 'qd'];
const read = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8').replace(/\r\n/g, '\n'));

// The kinds a template may make: exactly what module.kind's CHECK allows,
// read from vault.sql so the two can never disagree.
const sql = readFileSync(join(ROOT, 'schema/vault.sql'), 'utf8');
const check = /kind TEXT NOT NULL CHECK\(kind IN \(([^)]*)\)\)/.exec(sql);
if (!check) { console.error('templates: could not find module.kind CHECK in vault.sql'); process.exit(1); }
const KINDS = new Set([...check[1].matchAll(/'(\w+)'/g)].map((m) => m[1]));
KINDS.delete('collector'); // a template's folder is made for it, never listed

const errors = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);
const strings = read('templates/strings.json');
for (const [k, v] of Object.entries(strings)) {
  for (const l of LOCALES) if (typeof v[l] !== 'string' || !v[l].trim()) err(`strings.${k}`, `no ${l}`);
}

const isT = (v) => v && typeof v === 'object' && !Array.isArray(v) && typeof v.t === 'string'
  && Object.keys(v).every((k) => k === 't' || k === 'suffix');
const used = new Set();
function walkStrings(v, where) {
  if (isT(v)) { used.add(v.t); if (!strings[v.t]) err(where, `unknown string "${v.t}"`); return; }
  if (Array.isArray(v)) v.forEach((x, i) => walkStrings(x, `${where}[${i}]`));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walkStrings(x, `${where}.${k}`);
}
const nameOk = (v) => (typeof v === 'string' && v.trim()) || isT(v);

function checkModules(mods, where) {
  if (!Array.isArray(mods) || !mods.length || mods.length > 60) { err(where, 'needs 1–60 modules'); return; }
  const refs = new Set(mods.map((m) => m.ref).filter(Boolean));
  mods.forEach((m, i) => {
    const w = `${where}[${i}]`;
    if (!KINDS.has(m.kind)) err(w, `kind "${m.kind}" is not a module kind`);
    if (!nameOk(m.name)) err(w, 'no name');
    for (const f of m.fields || []) {
      if (!nameOk(f.name)) err(w, 'a field has no name');
      if (f.relTo && !refs.has(f.relTo)) err(w, `relTo "${f.relTo}" is not a module ref here`);
    }
    for (const r of m.selects || []) if (!refs.has(r)) err(w, `selects "${r}" is not a module ref here`);
  });
}

const bundles = readdirSync(join(ROOT, 'templates/bundles')).filter((f) => f.endsWith('.json')).sort()
  .map((f) => ({ f, b: read(`templates/bundles/${f}`) }))
  .sort((a, b) => (a.b.order ?? 99) - (b.b.order ?? 99)); // the picker's order
const ids = new Set();
for (const { f, b } of bundles) {
  const w = `bundles/${f}`;
  if (b.id !== f.replace(/\.json$/, '')) err(w, 'id does not match the file name');
  if (ids.has(b.id)) err(w, 'duplicate id');
  ids.add(b.id);
  if (!isT(b.name) || !isT(b.description)) err(w, 'name and description must be strings-table keys');
  checkModules(b.spec?.modules, `${w}.spec.modules`);
  walkStrings(b, w);
}
for (const k of Object.keys(strings)) if (!used.has(k)) err(`strings.${k}`, 'not used by any bundle');

// The guides are plain text in their own language (no string keys): the
// same rules the apps apply when a guide package is installed.
for (const f of readdirSync(join(ROOT, 'templates/guide')).filter((x) => x.endsWith('.json')).sort()) {
  const g = read(`templates/guide/${f}`), w = `guide/${f}`;
  if (g.format !== 'ddx-guide') err(w, 'not a ddx-guide');
  if (g.locale !== f.replace(/\.json$/, '')) err(w, 'locale does not match the file name');
  if (typeof g.spec?.name !== 'string' || !g.spec.name.trim()) err(w, 'spec has no name');
  checkModules(g.spec?.modules, `${w}.spec.modules`);
}

if (errors.length) { console.error(`templates: ${errors.length} error(s)\n  ${errors.join('\n  ')}`); process.exit(1); }

const out = JSON.stringify({
  format: 'ddx-bundles', version: 1, locales: LOCALES,
  bundles: bundles.map(({ b }) => b), strings,
}, null, 2) + '\n';
const dest = join(ROOT, 'generated/templates/bundles.json');
let cur = null;
try { cur = readFileSync(dest, 'utf8').replace(/\r\n/g, '\n'); } catch (_) {}
if (CHECK) {
  if (cur !== out) { console.error('templates: generated/templates/bundles.json is out of date — run: npm run generate'); process.exit(1); }
  console.log(`templates in sync (${bundles.length} bundles, ${Object.keys(strings).length} strings)`);
} else {
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, out);
  console.log(`wrote generated/templates/bundles.json (${bundles.length} bundles, ${Object.keys(strings).length} strings)`);
}
