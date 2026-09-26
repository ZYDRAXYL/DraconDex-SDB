// ═══ Template sources — read once, the same way for build.mjs and the test ═
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
export const LOCALES = ['en', 'ja', 'ko', 'th', 'zh', 'vi', 'id', 'es', 'pt', 'fr', 'de', 'ru', 'it', 'nl', 'pl', 'uk', 'tr', 'qd'];
const read = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8').replace(/\r\n/g, '\n'));
const list = (dir) => readdirSync(join(ROOT, dir)).filter((f) => f.endsWith('.json')).sort();

export function loadSources() {
  // The kinds a template may make: exactly what module.kind's CHECK allows,
  // read from vault.sql so the two can never disagree.
  const sql = readFileSync(join(ROOT, 'schema/vault.sql'), 'utf8');
  const check = /kind TEXT NOT NULL CHECK\(kind IN \(([^)]*)\)\)/.exec(sql);
  if (!check) throw new Error('templates: could not find module.kind CHECK in vault.sql');
  const kinds = new Set([...check[1].matchAll(/'(\w+)'/g)].map((m) => m[1]));
  kinds.delete('collector'); // a template's folder is made for it, never listed
  return {
    kinds,
    locales: LOCALES,
    strings: read('templates/strings.json'),
    components: read('templates/components.json').components,
    bundles: list('templates/bundles').map((f) => ({ f, b: read(`templates/bundles/${f}`) }))
      .sort((a, b) => (a.b.order ?? 99) - (b.b.order ?? 99)), // the picker's order
    pages: list('templates/pages').map((f) => ({ f, p: read(`templates/pages/${f}`) })),
    guides: list('templates/guide').map((f) => ({ f, g: read(`templates/guide/${f}`) })),
  };
}
