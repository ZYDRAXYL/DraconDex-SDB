#!/usr/bin/env node
// generate.mjs — generate both apps' vault-schema source from src/schema/vault.sql.
//
// vault.sql is the one canonical source (see its own header comment for why).
// This script never invents SQL — it only reformats the same statements into
// each language's shape:
//
//   node src/schema/generate.mjs           write both generated files
//   node src/schema/generate.mjs --check   compare only; exit 1 if out of sync
//
// Electron (electron/src/db/schema/ddl.js) execs the WHOLE vault.sql text as
// one multi-statement blob (node-sqlite3-wasm's Database#exec supports that),
// so its generated file is vault.sql verbatim, wrapped as one JS template
// literal — src/schema/generated/vault-ddl.electron.js.
//
// Flutter (flutter/lib/core/database/database_helper.dart) has to call
// sqflite's Database#execute() once per statement, so its generated file
// (flutter/lib/core/database/vault_schema.g.dart) is a Dart list of
// individual CREATE TABLE strings, one per table — extracted from vault.sql
// by balanced-paren scanning, same technique used to build vault.sql itself.
// The one non-CREATE-TABLE statement in vault.sql (use_color's seed INSERT)
// is intentionally NOT included in that list; its hex codes are extracted
// into a separate defaultColorCodes list instead, so Flutter keeps seeding
// through its own parameterized INSERT OR IGNORE loop (database_helper.dart)
// rather than executing a raw multi-row literal.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// schema/generate.mjs -> repo root. Before the multi-repo split this was three
// hops up from src/schema/ and wrote straight into the Electron and Flutter
// trees; those now live in separate repositories, so everything is emitted
// into this repo's generated/ instead and the consumers vendor it.
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const check = process.argv.includes('--check');

const vaultSqlPath = path.join(root, 'schema/vault.sql');
const versionPath = path.join(root, 'schema/version.json');
const electronOutPath = path.join(root, 'generated/electron/vault-ddl.electron.js');
const flutterOutPath = path.join(root, 'generated/flutter/vault_schema.g.dart');

// Normalize CRLF -> LF: on a Windows checkout, git's `* text=auto` rewrites
// every checked-in text file's line endings on the way to disk (including
// this very generator's own already-committed output), but the SQL text
// this script builds from scratch always uses LF. Without normalizing, a
// Windows CI run sees a real-looking diff that is really just checkout
// line-ending noise. See docs/CHANGELOG.md for the day this bit us.
const normalizeEol = (s) => s.replace(/\r\n/g, '\n');

const vaultSql = normalizeEol(fs.readFileSync(vaultSqlPath, 'utf8'));
const { vaultSchemaVersion } = JSON.parse(fs.readFileSync(versionPath, 'utf8'));

// The Electron artifact wraps vault.sql in ONE JS template literal, so a
// backtick anywhere in it — even inside an SQL comment — ends the literal
// and breaks EXE's schema-split test only after vendoring. Refuse it here.
if (vaultSql.includes('`')) {
  console.error('generate.mjs: vault.sql contains a backtick; it would end the Electron template literal');
  process.exit(1);
}

// Balanced-paren scan for every `CREATE TABLE IF NOT EXISTS <name> ( ... );`
// block, in file order — the same technique that built vault.sql from
// ddl.js in the first place, so it's already proven against this exact text.
function extractCreateTableStatements(sql) {
  const out = [];
  const re = /CREATE TABLE IF NOT EXISTS (\w+) \(/g;
  let m;
  while ((m = re.exec(sql))) {
    const name = m[1];
    let depth = 0;
    let i = m.index + m[0].length - 1; // at the opening '('
    for (; i < sql.length; i++) {
      if (sql[i] === '(') depth++;
      else if (sql[i] === ')') { depth--; if (depth === 0) break; }
    }
    let end = i + 1;
    if (sql[end] === ';') end++;
    out.push({ name, sql: sql.slice(m.index, end) });
  }
  return out;
}

function extractDefaultColorCodes(sql) {
  const m = /INSERT OR IGNORE INTO use_color[\s\S]*?;/.exec(sql);
  if (!m) throw new Error('generate.mjs: use_color seed INSERT not found in vault.sql');
  return [...m[0].matchAll(/#[0-9a-f]{6}/g)].map((x) => x[0]);
}

const tables = extractCreateTableStatements(vaultSql);
const colors = extractDefaultColorCodes(vaultSql);

const GENERATED_BANNER =
  'GENERATED FILE — do not hand-edit, in this repo or in the repo that vendors it.\nSource: ZYDRAXYL/DraconDex-SDB schema/vault.sql (+ schema/version.json).\nRegenerate with: npm run generate';

const electronOut = `'use strict';
// ${GENERATED_BANNER.replace(/\n/g, '\n// ')}
const VAULT_SCHEMA_VERSION = ${vaultSchemaVersion};
const VAULT_DDL_SQL = \`
${vaultSql.replace(/`/g, '\\`').replace(/\$\{/g, '\\${')}
\`;
module.exports = { VAULT_SCHEMA_VERSION, VAULT_DDL_SQL };
`;

const dartColorList = colors.map((c) => `  '${c}',`).join('\n');
const dartTableList = tables
  .map(({ name, sql }) => `  // ${name}\n  '''\n${sql}\n''',`)
  .join('\n\n');
const flutterOut = `// ${GENERATED_BANNER.replace(/\n/g, '\n// ')}

const int vaultSchemaVersion = ${vaultSchemaVersion};

const List<String> defaultColorCodes = [
${dartColorList}
];

const List<String> vaultCreateStatements = [
${dartTableList}
];
`;

let stale = false;
function writeOrCheck(outPath, content, label) {
  const exists = fs.existsSync(outPath);
  const current = exists ? normalizeEol(fs.readFileSync(outPath, 'utf8')) : null;
  if (current === normalizeEol(content)) return;
  if (check) {
    console.error(`out of sync: ${path.relative(root, outPath)} does not match ${label}`);
    stale = true;
    return;
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, content);
  console.log(`wrote ${path.relative(root, outPath)}`);
}

writeOrCheck(electronOutPath, electronOut, 'src/schema/vault.sql');
writeOrCheck(flutterOutPath, flutterOut, 'src/schema/vault.sql');

if (check) {
  if (stale) {
    console.error('\nschema generated files out of sync — run: node src/schema/generate.mjs');
    process.exit(1);
  }
  console.log(`schema generated files in sync (${tables.length} tables, vaultSchemaVersion ${vaultSchemaVersion})`);
} else {
  console.log(`${tables.length} tables, vaultSchemaVersion ${vaultSchemaVersion}`);
}
