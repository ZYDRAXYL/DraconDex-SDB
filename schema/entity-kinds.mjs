#!/usr/bin/env node
// schema/entity-kinds.json → generated/electron/entity-kinds.json +
// generated/flutter/entity_kinds.g.dart (APP docs/APK-V3.md §9.1).
//
// Every entity-key family and every column that stores a key, declared once.
// The two apps' snapshot importers remap keys from this list; when each app
// kept its own hand-written copy, one of them forgot tlev/sdlg (the §11.1
// bug). Before writing anything this checks the declaration against
// vault.sql, so a family naming a table or column that does not exist fails
// here rather than in an import on somebody's phone.
//
//   node schema/entity-kinds.mjs          write
//   node schema/entity-kinds.mjs --check  fail if the outputs are stale

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const check = process.argv.includes('--check');
const src = JSON.parse(fs.readFileSync(path.join(root, 'schema/entity-kinds.json'), 'utf8'));
const vaultSql = fs.readFileSync(path.join(root, 'schema/vault.sql'), 'utf8').replace(/\r\n/g, '\n');

// ── validate ───────────────────────────────────────────────────────────
// The column names of one CREATE TABLE in vault.sql (paren-matched, the same
// way schema/generate.mjs extracts statements).
const columnsOf = (table) => {
  const m = new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\(`).exec(vaultSql);
  if (!m) return null;
  let depth = 0;
  let i = m.index + m[0].length - 1;
  for (; i < vaultSql.length; i++) {
    if (vaultSql[i] === '(') depth++;
    else if (vaultSql[i] === ')' && --depth === 0) break;
  }
  const body = vaultSql.slice(m.index + m[0].length, i);
  return new Set(body.split('\n').map((l) => l.trim()).filter((l) => /^[a-z_]+\s/.test(l)).map((l) => l.split(/\s/)[0]));
};
const errors = [];
const prefixes = new Set();
const maps = new Set();
for (const f of src.families) {
  if (!/^[a-z]+$/.test(f.prefix)) errors.push(`bad prefix ${f.prefix}`);
  if (prefixes.has(f.prefix)) errors.push(`duplicate prefix ${f.prefix}`);
  prefixes.add(f.prefix);
  if (!columnsOf(f.table)) errors.push(`${f.prefix}: no table ${f.table} in vault.sql`);
  if (!/WHERE id=\?$/.test(f.lookup.sql)) errors.push(`${f.prefix}: lookup must end in WHERE id=?`);
  if (f.sync && maps.has(f.sync)) errors.push(`${f.prefix}: sync map ${f.sync} used twice`);
  if (f.sync) maps.add(f.sync);
  // An absent facet must say why — "left out on purpose" has to look
  // different from "forgotten" (the lesson of §11.1).
  for (const facet of ['owner', 'wiki', 'sync', 'index', 'search']) {
    if (f[facet] == null && !f.why?.[facet]) errors.push(`${f.prefix}: ${facet} is null with no why.${facet}`);
  }
  for (const c of f.search || []) if (!columnsOf(f.table)?.has(c)) errors.push(`${f.prefix}: search column ${f.table}.${c} missing`);
}
const wikiOrder = src.families.filter((f) => f.wiki).map((f) => f.prefix);
if (wikiOrder.includes('file') && wikiOrder[wikiOrder.length - 1] !== 'file') errors.push('file must resolve last');
for (const k of src.keyColumns) {
  const cols = columnsOf(k.table);
  if (!cols) { errors.push(`keyColumns: no table ${k.table}`); continue; }
  for (const c of k.cols) if (!cols.has(c)) errors.push(`keyColumns: no column ${k.table}.${c}`);
  if (k.only) try { new RegExp(k.only); } catch (e) { errors.push(`keyColumns: bad regex ${k.only}`); }
}
// idRefs — every id stored without an FK or an entity key (Procress 32 9.0).
const SHAPES = new Set(['id', 'prefixedKey', 'jsonIdList', 'jsonObjectIdLists']);
for (const r of src.idRefs || []) {
  const cols = columnsOf(r.table);
  if (!cols) { errors.push(`idRefs: no table ${r.table}`); continue; }
  if (!cols.has(r.col)) errors.push(`idRefs: no column ${r.table}.${r.col}`);
  if (!SHAPES.has(r.shape)) errors.push(`idRefs: ${r.table}.${r.col} has unknown shape ${r.shape}`);
  if (r.shape === 'prefixedKey' ? !r.prefix : !columnsOf(r.to)) errors.push(`idRefs: ${r.table}.${r.col} needs ${r.shape === 'prefixedKey' ? 'a prefix' : `a table in to (${r.to})`}`);
  if (r.shape === 'jsonObjectIdLists' && !(Array.isArray(r.keys) && r.keys.length)) errors.push(`idRefs: ${r.table}.${r.col} needs keys`);
  if (r.when && (!cols.has(r.when.col) || !Array.isArray(r.when.in))) errors.push(`idRefs: ${r.table}.${r.col} has a bad when`);
  if (!r.why) errors.push(`idRefs: ${r.table}.${r.col} needs a why`);
}
// Completeness: an INTEGER *_ref / *_id column with no REFERENCES is a row id
// nothing remaps unless it is declared here. Found by reading vault.sql, so a
// column added there later without an FK fails this check, not a merge.
for (const m of vaultSql.matchAll(/CREATE TABLE IF NOT EXISTS (\w+) \(/g)) {
  const t = m[1];
  const start = m.index + m[0].length;
  let depth = 1, i = start;
  for (; i < vaultSql.length && depth; i++) { if (vaultSql[i] === '(') depth++; else if (vaultSql[i] === ')') depth--; }
  for (const line of vaultSql.slice(start, i).split('\n')) {
    const l = line.split('--')[0].trim();
    const c = /^([a-z_]+)\s+INTEGER\b(.*)$/.exec(l);
    if (!c || c[1] === 'id' || !/_(ref|id)$/.test(c[1]) || /REFERENCES/.test(c[2])) continue;
    if (!(src.idRefs || []).some((r) => r.table === t && r.col === c[1])) errors.push(`idRefs: ${t}.${c[1]} stores an id with no FK — declare it in idRefs`);
  }
}
if (errors.length) {
  console.error(`entity-kinds.json is invalid:\n  ${errors.join('\n  ')}`);
  process.exit(1);
}

// ── outputs ────────────────────────────────────────────────────────────
const BANNER = 'GENERATED by DraconDex-SDB schema/entity-kinds.mjs from schema/entity-kinds.json — do not edit. Edit the JSON in DraconDex-SDB and re-vendor.';
const electronOut = JSON.stringify({ _generated: BANNER, ...src }, null, 2) + '\n';

const dq = (s) => (s == null ? 'null' : `r'''${s}'''`);
const dlist = (xs) => (xs == null ? 'null' : `[${xs.map((x) => `'${x}'`).join(', ')}]`);
const famDart = src.families.map((f) => `  EntityFamily(
    prefix: '${f.prefix}',
    table: '${f.table}',
    owner: ${dq(f.owner)},
    lookupSql: ${dq(f.lookup.sql)},
    lookupType: '${f.lookup.type}',
    lookupModule: '${f.lookup.module}',
    wiki: ${dq(f.wiki)},
    sync: ${f.sync ? `'${f.sync}'` : 'null'},
    indexKind: ${f.index ? `'${f.index.kind}'` : 'null'},
    search: ${dlist(f.search)},
  ),`).join('\n');
const kcDart = src.keyColumns.map((k) => `  KeyColumn(table: '${k.table}', cols: ${dlist(k.cols)}, json: ${!!k.json}, only: ${k.only ? `r'${k.only}'` : 'null'}),`).join('\n');
const dWhen = (w) => (w ? `IdRefWhen(col: '${w.col}', values: ${dlist(w.in)})` : 'null');
const irDart = (src.idRefs || []).map((r) => `  IdRef(table: '${r.table}', col: '${r.col}', shape: '${r.shape}', to: ${r.to ? `'${r.to}'` : 'null'}, prefix: ${r.prefix ? `'${r.prefix}'` : 'null'}, keys: ${dlist(r.keys ?? null)}, when: ${dWhen(r.when)}),`).join('\n');
const flutterOut = `// ${BANNER}
// ignore_for_file: lines_longer_than_80_chars

/// One entity-key family: keys look like \`<prefix>_<id>\`.
class EntityFamily {
  final String prefix;
  final String table;

  /// SQL giving this family's ids inside one module (takes the module id);
  /// null for a family that lives outside modules.
  final String? owner;

  /// key → name. Takes an id; ends in \`WHERE id=?\`.
  final String lookupSql;
  final String lookupType;
  final String lookupModule;

  /// [[Name]] → id. Takes (nexus, nexus, name); null when a name is not an
  /// identity for this family.
  final String? wiki;

  /// The id map a snapshot import fills for this family; null when the
  /// family does not travel in snapshots.
  final String? sync;
  final String? indexKind;
  final List<String>? search;

  const EntityFamily({
    required this.prefix,
    required this.table,
    required this.owner,
    required this.lookupSql,
    required this.lookupType,
    required this.lookupModule,
    required this.wiki,
    required this.sync,
    required this.indexKind,
    required this.search,
  });
}

/// A column that stores entity keys, so an importer must remap it.
class KeyColumn {
  final String table;
  final List<String> cols;

  /// The column holds a JSON list of {key, …}, not one key.
  final bool json;

  /// Only values matching this pattern are keys.
  final String? only;

  const KeyColumn({required this.table, required this.cols, required this.json, required this.only});
}

/// In declaration order — which is also the [[wiki]] resolver order.
const List<EntityFamily> entityFamilies = [
${famDart}
];

const List<KeyColumn> keyColumns = [
${kcDart}
];

/// Only rows whose [col] is one of [values].
class IdRefWhen {
  final String col;
  final List<String> values;
  const IdRefWhen({required this.col, required this.values});
}

/// A row id stored without a foreign key or an entity key — what an importer
/// or a merge must remap when it renumbers rows. [shape]: \`id\` (the column
/// is the id) · \`prefixedKey\` ([prefix] + an entity key) · \`jsonIdList\` ·
/// \`jsonObjectIdLists\` (a JSON object whose [keys] are id lists). [to]: the
/// table the ids belong to.
class IdRef {
  final String table;
  final String col;
  final String shape;
  final String? to;
  final String? prefix;
  final List<String>? keys;
  final IdRefWhen? when;
  const IdRef({required this.table, required this.col, required this.shape, required this.to, required this.prefix, required this.keys, required this.when});
}

const List<IdRef> idRefs = [
${irDart}
];
`;

function writeOrCheck(rel, content) {
  const out = path.join(root, rel);
  const cur = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : null;
  if (check) {
    if (cur !== content) { console.error(`${rel} is stale — run npm run generate`); process.exit(1); }
    return;
  }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  if (cur !== content) fs.writeFileSync(out, content);
}
writeOrCheck('generated/electron/entity-kinds.json', electronOut);
writeOrCheck('generated/flutter/entity_kinds.g.dart', flutterOut);
console.log(`entity kinds ${check ? 'in sync' : 'written'} (${src.families.length} families, ${src.keyColumns.length} key columns, ${(src.idRefs || []).length} id refs)`);
