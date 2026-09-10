// Builds generated/manifest.json — the contract EXE and APK pin against.
//
//   node tools/build-manifest.mjs           write
//   node tools/build-manifest.mjs --check   verify only, exit 1 on drift (CI)
//
// The important design choice here is that SDB — the PRODUCER — declares where
// each artifact must land in each consumer, in the `consumers` map. The
// alternative (each consumer deciding what to fetch and where to put it) spreads
// the contract across three repos and lets them disagree silently. With the map
// here, a consumer's drift check is data-driven and the whole contract is
// auditable from one file.
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CHECK = process.argv.includes('--check');

// Same normalisation the generators use. `.gitattributes` is `* text=auto`, so
// a Windows checkout rewrites every text file's line endings on the way to
// disk; hashing raw bytes would make every Windows CI run red for no reason.
const normalizeEol = s => s.replace(/\r\n/g, '\n');
const isText = p => /\.(js|dart|sql|json|md|mjs|txt)$/.test(p);

function sha256(relPath) {
  const abs = join(ROOT, relPath);
  const buf = readFileSync(abs);
  const data = isText(relPath) ? Buffer.from(normalizeEol(buf.toString('utf8')), 'utf8') : buf;
  return { sha256: createHash('sha256').update(data).digest('hex'), bytes: buf.length };
}

function walk(dir, out = []) {
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = join(dir, name);
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out);
    else out.push(rel);
  }
  return out;
}

const sdb = JSON.parse(readFileSync(join(ROOT, 'sdb.json'), 'utf8'));
const { vaultSchemaVersion } = JSON.parse(readFileSync(join(ROOT, 'schema/version.json'), 'utf8'));
const setupSql = readFileSync(join(ROOT, 'supabase/setup/dracondex_setup.sql'), 'utf8');
const supabaseSchemaVersion = Number(/^-- DRACONDEX_SCHEMA_VERSION: (\d+)$/m.exec(setupSql)?.[1]);

// Where each artifact must land downstream. A path here is the consumer's own
// repo-relative path — chosen so the consumer's existing relative requires and
// url() references keep resolving byte-identically to the monorepo layout.
const CONSUMERS = {
  'generated/electron/vault-ddl.electron.js': { EXE: 'src/schema/generated/vault-ddl.electron.js' },
  'generated/electron/supabase-schema.js':    { EXE: 'electron/src/db/supabase-schema.js' },
  'generated/flutter/vault_schema.g.dart':    { APK: 'flutter/lib/core/database/vault_schema.g.dart' },
  'generated/flutter/supabase_schema.dart':   { APK: 'flutter/lib/data/services/supabase_schema.dart' },
};
// Asset masters. EXE vendors brand (electron/css resolves it through url() at
// runtime); APK mirrors images+fonts because pubspec.yaml cannot declare assets
// outside its own package dir.
for (const f of walk('assets/brand'))   CONSUMERS[f] = { EXE: f.replace(/^assets\//, 'src/assets/') };
for (const f of walk('assets/flutter')) CONSUMERS[f] = { APK: f.replace(/^assets\/flutter\//, 'flutter/assets/images/') };
for (const f of walk('assets/fonts'))   CONSUMERS[f] = { APK: f.replace(/^assets\/fonts\//, 'flutter/assets/fonts/') };

const artifacts = {};
for (const [artifact, consumers] of Object.entries(CONSUMERS)) {
  if (!existsSync(join(ROOT, artifact))) {
    console.error(`manifest: ${artifact} is declared for ${Object.keys(consumers).join('/')} but does not exist. Run: npm run generate`);
    process.exit(1);
  }
  artifacts[artifact] = { ...sha256(artifact), consumers };
}

const manifest = {
  manifestVersion: 1,
  sdb: { repo: 'ZYDRAXYL/DraconDex-SDB', version: sdb.sdbVersion },
  sources: {
    vaultSchemaVersion,
    supabaseSchemaVersion,
    vaultSqlSha256: sha256('schema/vault.sql').sha256,
    setupSqlSha256: sha256('supabase/setup/dracondex_setup.sql').sha256,
  },
  artifacts,
};

// generatedAt is deliberately absent: a timestamp would make every rebuild a
// diff, so --check could never be clean and the file would churn on every CI
// run. The content hashes already say whether anything really changed.
const out = JSON.stringify(manifest, null, 2) + '\n';
const dest = join(ROOT, 'generated/manifest.json');
const cur = existsSync(dest) ? readFileSync(dest, 'utf8') : null;

if (cur === out) { console.log(`manifest in sync (${Object.keys(artifacts).length} artifacts)`); process.exit(0); }
if (CHECK) {
  console.error('manifest out of sync — run: node tools/build-manifest.mjs');
  process.exit(1);
}
writeFileSync(dest, out);
console.log(`wrote generated/manifest.json (${Object.keys(artifacts).length} artifacts, vaultSchemaVersion ${vaultSchemaVersion}, supabaseSchemaVersion ${supabaseSchemaVersion})`);
