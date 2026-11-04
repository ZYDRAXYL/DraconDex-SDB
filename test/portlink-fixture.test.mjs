import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';

/**
 * Procress 32 9.0: fixtures/portlink-merge-v1.json is what both apps' merge
 * engines are held to, so it must be runnable as written: every case's SQL
 * runs on the vault DDL generated here, the shape is what the runners read,
 * and a case that expects a conflict names one the edits really make. The
 * merge itself is run by the apps (EXE electron/test/portlink-fixture.test.mjs,
 * APK flutter/test/portlink_fixture_test.dart) — not here, where there is no
 * engine.
 */
const require = createRequire(import.meta.url);
const { VAULT_DDL_SQL } = require('../generated/electron/vault-ddl.electron.js');
const fx = JSON.parse(readFileSync(new URL('../fixtures/portlink-merge-v1.json', import.meta.url), 'utf8'));

const vault = (extra = []) => {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(VAULT_DDL_SQL);
  for (const s of [...fx.seed, ...extra]) db.exec(s);
  return db;
};

test('the fixture is the format the runners read', () => {
  assert.equal(fx.format, 'dracondex-portlink-merge-fixture');
  assert.equal(fx.version, 1);
  const names = new Set();
  for (const c of fx.cases) {
    assert.ok(c.name && !names.has(c.name), `unique name: ${c.name}`);
    names.add(c.name);
    assert.ok(c.why, `${c.name}: why`);
    assert.ok(Array.isArray(c.local) && Array.isArray(c.drive), `${c.name}: local + drive`);
    assert.ok(c.expect.ok === true ? Array.isArray(c.expect.queries) && c.expect.queries.length : c.expect.code === 'needs_choice' && c.expect.conflicts.length, `${c.name}: expect`);
  }
  assert.ok(names.has('owner-example'), 'the owner\'s own example is a case');
});

test('every case\'s SQL runs on the vault DDL, and every expect query parses', () => {
  for (const c of fx.cases) {
    const L = vault(c.seedExtra), D = vault(c.seedExtra);
    for (const s of c.local) assert.doesNotThrow(() => L.exec(s), `${c.name} local: ${s}`);
    for (const s of c.drive) assert.doesNotThrow(() => D.exec(s), `${c.name} drive: ${s}`);
    for (const q of c.expect.queries || []) assert.doesNotThrow(() => D.prepare(q.sql).all(), `${c.name}: ${q.sql}`);
  }
});

test('a conflict a case expects is one its edits really make (both sides changed that cell)', () => {
  for (const c of fx.cases.filter((x) => x.expect.code === 'needs_choice')) {
    const B = vault(c.seedExtra), L = vault(c.seedExtra), D = vault(c.seedExtra);
    for (const s of c.local) L.exec(s);
    for (const s of c.drive) D.exec(s);
    for (const key of c.expect.conflicts) {
      const [table, id, col] = key.split(':');
      const v = (db) => db.prepare(`SELECT "${col}" AS v FROM "${table}" WHERE id=?`).get(Number(id))?.v;
      assert.notEqual(v(L), v(B), `${key}: changed here`);
      assert.notEqual(v(D), v(B), `${key}: changed on the drive`);
      assert.notEqual(v(L), v(D), `${key}: to different values`);
    }
  }
});
