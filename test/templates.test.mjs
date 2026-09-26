import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { validate } from '../templates/validate.mjs';
import { loadSources } from '../templates/sources.mjs';

// templates/validate.mjs is what stands between a typo in a bundle and a
// half-made project in both apps (APP docs/TEMPLATES.md §3–§4). These feed it
// the real sources, broken one way at a time.
const SRC = loadSources();
const clone = () => structuredClone({ ...SRC, kinds: [...SRC.kinds] });
function check(mutate) {
  const s = clone();
  mutate(s);
  return validate({ ...s, kinds: new Set(s.kinds) }).errors;
}
const bundle = (s, id) => s.bundles.find((x) => x.b.id === id).b;
const mod = (s, id, ref) => bundle(s, id).spec.modules.find((m) => m.ref === ref);
const page = (s, kind) => s.pages.find((x) => x.p.kind === kind).p;
const expectError = (errors, re) => assert.ok(errors.some((e) => re.test(e)), `expected ${re}, got:\n  ${errors.join('\n  ') || '(none)'}`);

test('the committed sources are valid', () => {
  assert.deepEqual(validate(SRC).errors, []);
});

test('a folder cycle is refused', () => {
  expectError(check((s) => {
    const f = bundle(s, 'classicDirector').spec.folders;
    f.find((x) => x.ref === 'data').parent = 'story';
    f.find((x) => x.ref === 'story').parent = 'data';
  }), /folder "(data|story)" is in a cycle/);
});

test('a borrow of a ref that is not in the bundle is refused', () => {
  expectError(check((s) => { mod(s, 'classicDirector', 'project').page[1].children[0][0].borrow = 'nowhere'; }),
    /borrow "nowhere" is not a module ref/);
});

test('a borrow of the wrong kind is refused', () => {
  expectError(check((s) => { mod(s, 'classicDirector', 'project').page[1].children[0][0].borrow = 'map'; }),
    /borrow "map" is a locator, "chronicler.eras" needs a chronicler/);
});

test('another kind\'s component without a borrow is refused', () => {
  expectError(check((s) => { delete mod(s, 'classicDirector', 'project').page[1].children[1][0].borrow; }),
    /"locator.pinlist" belongs to another kind — it must borrow/);
});

test('four samples in one module are refused', () => {
  expectError(check((s) => { mod(s, 'classicDirector', 'chars').objects.push({ ref: 'extra', sample: true, name: 'Extra' }); }),
    /4 samples in objects — at most 3/);
});

test('an unknown component and a bad preset are refused', () => {
  expectError(check((s) => { page(s, 'author').templates[0].page.push({ component: 'author.nothing' }); }),
    /component "author.nothing" is not in components.json/);
  expectError(check((s) => { page(s, 'author').templates[0].page[2].config.preset = 'scroll'; }),
    /preset "scroll" is not one of author.view's/);
});

test('a once component twice on a page is refused', () => {
  expectError(check((s) => { page(s, 'inspector').templates[1].page.push({ component: 'core.toc' }); }),
    /"core.toc" can appear once per page/);
});

test('a missing or duplicate field key is refused', () => {
  expectError(check((s) => { delete mod(s, 'fantasy', 'items').fields[0].key; }), /key "undefined" must match/);
  expectError(check((s) => { mod(s, 'fantasy', 'items').fields[1].key = 'description'; }), /duplicate field key "description"/);
});

test('links on a field that is not a relation are refused', () => {
  expectError(check((s) => { mod(s, 'classicDirector', 'chars').objects[0].links.age = ['town']; }),
    /links."age" is not a relation field/);
});

test('links outside the relation\'s module are refused', () => {
  expectError(check((s) => { mod(s, 'classicDirector', 'chars').objects[0].links.home = ['sword']; }),
    /links."home" → "sword" is not in "places"/);
});

test('config.field naming a key that does not exist is refused', () => {
  expectError(check((s) => { page(s, 'classifier').templates[0].page[1].children[1][0].config.field = 'height'; }),
    /field "height" is not a field key of this module/);
});

test('two ★ templates in one kind are refused', () => {
  expectError(check((s) => { page(s, 'author').templates[1].default = true; }), /2 default templates — exactly one is ★/);
  expectError(check((s) => { page(s, 'classifier').templates[1].default = true; }), /2 default templates for "character"/);
});

test('a page naming a template of another kind is refused', () => {
  expectError(check((s) => { mod(s, 'classicDirector', 'map').page = 'chronicler.timeline'; }),
    /page "chronicler.timeline" is a chronicler template, this is a locator/);
});

test('a string missing a locale is refused', () => {
  expectError(check((s) => { delete s.strings.bundleClassicDirector.qd; }), /strings.bundleClassicDirector: no qd/);
});

test('a standalone template may only borrow unbound', () => {
  expectError(check((s) => { page(s, 'manager').templates[0].page.push({ component: 'chronicler.eras', borrow: 'timeline' }); }),
    /a standalone template borrows unbound/);
  assert.deepEqual(check((s) => { page(s, 'manager').templates[0].page.push({ component: 'chronicler.eras', borrow: true }); }), []);
});

test('the generated files carry every template, and every bundle page resolves', () => {
  const pages = JSON.parse(readFileSync(new URL('../generated/templates/pages.json', import.meta.url), 'utf8'));
  const bundles = JSON.parse(readFileSync(new URL('../generated/templates/bundles.json', import.meta.url), 'utf8'));
  assert.equal(pages.format, 'ddx-pages');
  assert.equal(bundles.version, 2);
  const ids = new Set(pages.templates.map((t) => t.id));
  assert.equal(ids.size, SRC.pages.reduce((n, { p }) => n + p.templates.length, 0));
  for (const b of bundles.bundles) for (const m of b.spec.modules) {
    if (typeof m.page === 'string') assert.ok(ids.has(m.page), `${b.id}.${m.ref}: ${m.page}`);
  }
  for (const t of pages.templates) for (const k of [t.name.t, t.description.t]) assert.ok(pages.strings[k], k);
  // the four Classic bundles are there, in the picker after the genres
  assert.deepEqual(bundles.bundles.filter((b) => b.group === 'classic').map((b) => b.id),
    ['classicDirector', 'classicNavigator', 'classicHero', 'classicWriter']);
});
