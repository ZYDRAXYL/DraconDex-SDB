import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';

/**
 * Procress 19 part 2: the indexes in vault.sql's @indexes section are what
 * both apps' hot queries run on. Each query below is copied from the app that
 * runs it (file named beside it); EXPLAIN QUERY PLAN must show no SCAN of a
 * table that grows with the vault. A query that changes shape in an app, or an
 * index dropped here, turns this red instead of turning a phone slow.
 *
 * node:sqlite is the same SQLite the planner decisions are made by in both
 * apps (EXE node-sqlite3-wasm, APK sqflite_common_ffi on the desktop and
 * Android's system SQLite) — none of these plans depend on the version.
 */
const require = createRequire(import.meta.url);
const { VAULT_DDL_SQL, VAULT_INDEX_SQL } = require('../generated/electron/vault-ddl.electron.js');

function vault() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(VAULT_DDL_SQL);
  db.exec(VAULT_INDEX_SQL);
  // Created by each app after it de-duplicates relations (vault.sql explains
  // why it is not in @indexes); the from_key lookups below lean on it.
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_entity_relation_v5 ON entity_relation
    (from_key, to_key, COALESCE(label,''), COALESCE(rel_type,''))`);
  return db;
}

const HOT = {
  // ── APK (flutter/lib/data/…) ──────────────────────────────────────────
  'APK module_dao getModules (Nest children)': [`
    SELECT m.* FROM module m LEFT JOIN use_color c ON m.color=c.id LEFT JOIN use_color uic ON m.icon_color=uic.id
    WHERE m.nexus_ref=? AND m.parent_id IS ? ORDER BY m.pinned DESC, m.display_order, m.name COLLATE NOCASE`, [1, 2]],
  'APK module_dao getModules (top level)': [`
    SELECT m.* FROM module m WHERE m.nexus_ref=? AND m.parent_id IS ? ORDER BY m.display_order`, [1, null]],
  'APK classifier_dao getFields': [`
    SELECT * FROM classifier_template WHERE module_ref=? AND object_ref IS NULL ORDER BY display_order, id`, [1]],
  'APK classifier_dao getItems': [`
    SELECT * FROM classifier_object WHERE module_ref=? ORDER BY display_order, id`, [1]],
  'APK classifier_dao getModuleValues': [`
    SELECT a.object_ref, a.template_ref, a.attribute_value FROM classifier_attribute a
    JOIN classifier_object o ON a.object_ref=o.id WHERE o.module_ref=?`, [1]],
  'APK classifier_dao getModuleLevels': [`
    SELECT cl.* FROM classifier_level cl JOIN classifier_object o ON cl.object_ref=o.id
    WHERE o.module_ref=? ORDER BY cl.display_order, cl.id`, [1]],
  'APK classifier_views clsDataProvider relations': [`
    SELECT r.id, r.from_key, r.to_key, r.label, r.rel_type FROM entity_relation r
    JOIN classifier_object o ON r.from_key='cobj_'||o.id WHERE o.module_ref=? ORDER BY r.id`, [1]],
  'APK page_block_dao stack (module page)': [`
    SELECT * FROM page_block WHERE module_ref=? AND item_key IS NULL AND block_type<>'property' ORDER BY block_order, id`, [1]],
  'APK page_block_dao stack (element page)': [`
    SELECT * FROM page_block WHERE module_ref=? AND item_key=? AND block_type<>'property' ORDER BY block_order, id`, [1, 'cobj_1']],
  'APK trash_service list': [`SELECT * FROM trash WHERE nexus_ref=? ORDER BY id DESC`, [1]],
  'APK wiki_service reindexSource': [`DELETE FROM wiki_link WHERE src_key=?`, ['cobj_1']],
  // ── EXE (electron/src/db/…) ───────────────────────────────────────────
  'EXE importdock find collector': [`
    SELECT id FROM module WHERE nexus_ref=? AND parent_id IS ? AND kind='collector' AND name=?`, [1, null, 'x']],
  'EXE md-export whole tree': [`
    SELECT id, parent_id, name FROM module WHERE nexus_ref=? ORDER BY display_order, id`, [1]],
  'EXE versions next seq': [`SELECT COALESCE(MAX(seq),0) AS m FROM module_version WHERE module_ref=?`, [1]],
  'EXE versions prune': [`
    DELETE FROM module_version WHERE module_ref=? AND id NOT IN (
      SELECT id FROM module_version WHERE module_ref=? ORDER BY seq DESC LIMIT ?)`, [1, 1, 50]],
  'EXE asset-pack dedupe probe': [`SELECT id, module_ref FROM import_file WHERE nexus_ref=? AND file_path=?`, [1, '/x']],
  'EXE exhibitor module ui': [`
    SELECT m.id, u.ui_key, u.ui_value FROM module m JOIN module_ui u ON u.module_ref=m.id WHERE m.nexus_ref=?`, [1]],
  'EXE trash list': [`
    SELECT t.id FROM trash t LEFT JOIN module p ON p.id=t.parent_ref WHERE t.nexus_ref=? ORDER BY t.id DESC`, [1]],
  // ── both ───────────────────────────────────────────────────────────────
  'backlinks (what points here)': [`SELECT * FROM entity_relation WHERE to_key=?`, ['cobj_1']],
  'a module\'s relations': [`SELECT * FROM entity_relation WHERE nexus_ref=? AND from_key=?`, [1, 'module_1']],
  'Chronicler events of a timeline': [`
    SELECT e.* FROM timeline_event e JOIN timeline t ON e.timeline_id=t.id WHERE t.module_ref=?`, [1]],
  'Diviner entries of a module': [`
    SELECT e.* FROM diviner_entry e JOIN diviner_table t ON e.table_ref=t.id WHERE t.module_ref=?`, [1]],
};

const scans = (db, sql, args) =>
  db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...args)
    .map((r) => r.detail)
    .filter((d) => /^SCAN \w+/.test(d));

for (const [name, [sql, args]] of Object.entries(HOT)) {
  test(`no table scan: ${name}`, () => {
    const db = vault();
    assert.deepEqual(scans(db, sql, args), [], sql.trim());
  });
}

test('every foreign key a v5 table has is indexed (ON DELETE CASCADE scans the child table otherwise)', () => {
  const db = vault();
  // Legacy systems keep their indexes in DraconDex-EXE, the only app reading
  // them; use_color is a 12-row lookup no one deletes from; timeline_date is
  // deleted only with its event and is NULL on almost every relation.
  const LEGACY = /^(project|project_\w+|object|object_\w+|relation|relation_\w+|event_hashtag|world_\w+|game_\w+|write_\w+|symbol_\w+)$/;
  const ALLOWED = new Set(['entity_relation.valid_from', 'entity_relation.valid_to']);
  const missing = [];
  for (const { name } of db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`).all()) {
    if (LEGACY.test(name)) continue;
    const leading = new Set(db.prepare(`PRAGMA index_list("${name}")`).all()
      .map((i) => db.prepare(`PRAGMA index_info("${i.name}")`).all()[0]?.name));
    for (const fk of db.prepare(`PRAGMA foreign_key_list("${name}")`).all()) {
      const col = `${name}.${fk.from}`;
      // A link back into a legacy table (timeline.project_id) is the legacy
      // system's to index, in EXE, like the rest of it.
      if (fk.table === 'use_color' || LEGACY.test(fk.table) || ALLOWED.has(col) || leading.has(fk.from)) continue;
      missing.push(`${col} -> ${fk.table}`);
    }
  }
  assert.deepEqual(missing, []);
});

test('the @indexes section is what the generator emitted, and it is all IF NOT EXISTS', () => {
  const src = readFileSync(new URL('../schema/vault.sql', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const section = src.slice(src.indexOf('\n-- @indexes'));
  const inSql = [...section.matchAll(/CREATE (?:UNIQUE )?INDEX IF NOT EXISTS (\w+)/g)].map((m) => m[1]);
  const emitted = [...VAULT_INDEX_SQL.matchAll(/INDEX IF NOT EXISTS (\w+)/g)].map((m) => m[1]);
  assert.deepEqual(emitted, inSql);
  assert.equal(new Set(inSql).size, inSql.length, 'an index name used twice');
  assert.ok(!/CREATE (UNIQUE )?INDEX (?!IF NOT EXISTS)/.test(section), 'every index must be IF NOT EXISTS — they run on every open');
  assert.ok(!VAULT_DDL_SQL.includes('CREATE INDEX'), 'indexes stay out of the table DDL (it runs before migrations)');
  const dart = readFileSync(new URL('../generated/flutter/vault_schema.g.dart', import.meta.url), 'utf8');
  assert.deepEqual([...dart.matchAll(/INDEX IF NOT EXISTS (\w+)/g)].map((m) => m[1]), inSql);
});
