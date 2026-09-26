#!/usr/bin/env node
// ═══ Templates — the genre bundles and the in-app guide (Procress 12 part 0) ═
// Both apps make whole projects from these (APP docs/V5.md §11.7–§11.8,
// docs/APK-V3.md). They were code in DraconDex-EXE (hub/bundles.js) until
// the phone needed the same four; now this repo owns them and both apps
// vendor the output, like the schema.
//
//   templates/bundles/<id>.json  { id, order, icon, group?, name, description, spec }
//                                (bundle v2: folders, home, module.folder,
//                                module.page/itemPage, samples — TEMPLATES.md §4)
//   templates/pages/<kind>.json  a kind's page templates (TEMPLATES.md §3)
//   templates/components.json    the page components a template may use
//   templates/strings.json       key -> { <18 locales> }
//   templates/guide/<loc>.json   a ddx-guide (Thai and English ship in-app;
//                                the other 16 are DraconDex-PKG packages)
//
// Every user-visible string in a bundle is { "t": key } or
// { "t": key, "suffix": " 1" }, resolved by the app in its UI language
// (English when a locale lacks it — never the raw key). A bundle's spec is
// the shape EXE's db/bundle.js documents.
//
// The rules live in validate.mjs (pure — test/templates.test.mjs feeds it
// broken copies).
//
//   node templates/build.mjs          validate, write generated/templates/{bundles,pages}.json
//   node templates/build.mjs --check  validate, exit 1 on drift (CI)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { validate, isT } from './validate.mjs';
import { ROOT, loadSources } from './sources.mjs';

const CHECK = process.argv.includes('--check');
const src = loadSources();
const { strings, components, bundles, pages, locales: LOCALES } = src;
const { errors } = validate(src);
if (errors.length) { console.error(`templates: ${errors.length} error(s)\n  ${errors.join('\n  ')}`); process.exit(1); }

// Each output carries the strings it uses, so an app reads one file.
function stringsOf(v, out = new Set()) {
  if (isT(v)) out.add(v.t);
  else if (Array.isArray(v)) v.forEach((x) => stringsOf(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => stringsOf(x, out));
  return out;
}
const pick = (keys) => Object.fromEntries([...keys].sort().map((k) => [k, strings[k]]));
const bundleList = bundles.map(({ b }) => b);
const templates = pages.flatMap(({ p }) => p.templates.map((t) => ({ kind: p.kind, ...t })));
const outputs = {
  'generated/templates/bundles.json': {
    format: 'ddx-bundles', version: 2, locales: LOCALES, bundles: bundleList, strings: pick(stringsOf(bundleList)),
  },
  'generated/templates/pages.json': {
    format: 'ddx-pages', version: 1, locales: LOCALES,
    components: components.map(({ id, kind, presets, once, borrowable, container, since }) =>
      ({ id, kind, since, borrowable, ...(presets ? { presets } : {}), ...(once ? { once } : {}), ...(container ? { container } : {}) })),
    templates, strings: pick(stringsOf(templates)),
  },
};
let drift = 0;
for (const [rel, obj] of Object.entries(outputs)) {
  const out = JSON.stringify(obj, null, 2) + '\n';
  const dest = join(ROOT, rel);
  let cur = null;
  try { cur = readFileSync(dest, 'utf8').replace(/\r\n/g, '\n'); } catch (_) {}
  if (CHECK) { if (cur !== out) { console.error(`templates: ${rel} is out of date — run: npm run generate`); drift++; } }
  else { mkdirSync(dirname(dest), { recursive: true }); writeFileSync(dest, out); }
}
if (drift) process.exit(1);
const summary = `${bundles.length} bundles, ${templates.length} page templates, ${components.length} components, ${Object.keys(strings).length} strings`;
console.log(CHECK ? `templates in sync (${summary})` : `wrote generated/templates/{bundles,pages}.json (${summary})`);
