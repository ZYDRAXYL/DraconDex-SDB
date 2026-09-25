import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

// design/tokens.mjs refuses a token source that would ship unreadable text or
// a name that collides with one the apps already use (APP docs/REDESIGN.md
// §C5). These run it against broken copies of the real source.
const SCRIPT = new URL('../design/tokens.mjs', import.meta.url).pathname;
const SRC = JSON.parse(readFileSync(new URL('../design/tokens.json', import.meta.url), 'utf8'));
const dir = mkdtempSync(join(tmpdir(), 'ddx-tokens-'));

function validate(mutate) {
  const copy = structuredClone(SRC);
  mutate?.(copy);
  const file = join(dir, `t${Math.random().toString(36).slice(2)}.json`);
  writeFileSync(file, JSON.stringify(copy));
  const r = spawnSync(process.execPath, [SCRIPT, '--validate', `--src=${file}`], { encoding: 'utf8' });
  return { ok: r.status === 0, err: r.stderr };
}
const hexColor = (h) => ({
  $type: 'color',
  $value: { colorSpace: 'srgb', components: [1, 3, 5].map((i) => +(parseInt(h.slice(i, i + 2), 16) / 255).toFixed(4)), hex: h },
});

test('the committed source is valid', () => {
  const r = validate();
  assert.ok(r.ok, r.err);
});

test('muted text below 4.5:1 is refused', () => {
  const r = validate((s) => { s.color.theme.midnight['t3-aa'] = hexColor('#5a5a72'); }); // = t3, ~2.6:1
  assert.ok(!r.ok);
  assert.match(r.err, /midnight": t3-aa #5a5a72 is .*needs 4\.5/);
});

test('muted text that fails only on the Fluent 2 Mica base is refused', () => {
  const r = validate((s) => { delete s.platform.fluent2.$extensions['app.dracondex'].themeOverrides.daylight; });
  assert.ok(!r.ok);
  assert.match(r.err, /fluent2 × daylight/);
});

test('a missing palette token is refused', () => {
  const r = validate((s) => { delete s.color.theme.atDusk.border; });
  assert.ok(!r.ok);
  assert.match(r.err, /atDusk": missing border/);
});

test('components that disagree with the hex are refused', () => {
  const r = validate((s) => { s.color.theme.midnight.bg.$value.components = [0, 0, 0]; });
  assert.ok(!r.ok);
  assert.match(r.err, /do not match #0f0f13/);
});

test('a platform layer cannot reuse a name the apps already mean', () => {
  const r = validate((s) => { s.platform.ios.$extensions['app.dracondex'].derived.accent = { ref: 't1' }; });
  assert.ok(!r.ok);
  assert.match(r.err, /"accent" already means something/);
});

test('an alias may only point at an ink colour', () => {
  const r = validate((s) => { s.color.theme.moonlight['on-accent'] = { $type: 'color', $value: '{color.theme.midnight.bg}' }; });
  assert.ok(!r.ok);
  assert.match(r.err, /may only point at an existing \{color\.ink\.\*\}/);
});

test('EXE output carries only the themes EXE ships, and no :root --t3-aa', () => {
  const css = readFileSync(new URL('../generated/electron/tokens.css', import.meta.url), 'utf8');
  const shipped = Object.entries(SRC.color.theme).filter(([, t]) => t.$extensions['app.dracondex'].exe === 'builtin').map(([n]) => n);
  const inCss = [...css.matchAll(/^body\[data-theme="(\w+)"\]\{/gm)].map((m) => m[1]);
  assert.deepEqual(inCss, shipped);
  const rootBlock = /:root\{([^}]*)\}/.exec(css)[1];
  assert.doesNotMatch(rootBlock, /--t3-aa/);
});

test('APK output carries every theme', () => {
  const dart = readFileSync(new URL('../generated/flutter/tokens.g.dart', import.meta.url), 'utf8');
  for (const name of Object.keys(SRC.color.theme)) assert.match(dart, new RegExp(`'${name}': DdxPalette\\(`));
});
