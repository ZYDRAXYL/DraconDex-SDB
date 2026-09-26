#!/usr/bin/env node
// design/tokens.json → generated/electron/tokens.css +
// generated/flutter/tokens.g.dart (APP docs/REDESIGN.md §C5).
//
// One source for the colour, spacing, type and elevation tokens of both apps.
// Before this the palettes lived in EXE's css/themes.css, in DraconDex-PKG's
// theme payloads and — three of them — in APK's app_theme.dart, and each copy
// could drift. Before writing anything this checks the source: every theme
// carries the 12 palette tokens every theme needs, every colour's components
// agree with its hex, --t3-aa really reaches 4.5:1 on the surfaces text sits
// on (also on the Fluent 2 Mica base), and no platform layer re-uses a name
// the apps already mean something else by.
//
//   node design/tokens.mjs          write
//   node design/tokens.mjs --check  fail if the outputs are stale
//   node design/tokens.mjs --validate --src=<file>   (tests) validate only

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const check = process.argv.includes('--check');
// Tests only: validate another copy of the source and write nothing.
const validateOnly = process.argv.includes('--validate');
const srcArg = process.argv.find((a) => a.startsWith('--src='))?.slice(6);
const src = JSON.parse(fs.readFileSync(srcArg || path.join(root, 'design/tokens.json'), 'utf8'));
const errors = [];
const ext = (node) => node?.$extensions?.['app.dracondex'] || {};

// ── colour maths (WCAG 2.x relative luminance) ─────────────────────────
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (a) => '#' + a.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = (h) => { const [r, g, b] = rgb(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
// CSS color-mix(in srgb, A (1-t), B t) on opaque colours.
const mix = (a, b, t) => toHex(rgb(a).map((v, i) => v + (rgb(b)[i] - v) * t));

// ── palettes ───────────────────────────────────────────────────────────
// The names are the CSS custom properties without "--". PKG theme packages
// and every user's custom theme are keyed by them, so this list only grows.
const PALETTE = ['bg', 'surface', 'raised', 'hover', 'border', 't1', 't2', 't3', 't3-aa',
  'accent', 'accentH', 'danger', 'success', 'button', 'on-accent', 'on-button'];
const REQUIRED = ['bg', 'surface', 'raised', 'hover', 'border', 't1', 't2', 't3', 't3-aa',
  'accent', 'accentH', 'danger', 'success'];
const AA = 4.5;
const TEXT_SURFACES = ['bg', 'surface', 'raised'];

// Ink colours a palette may alias ({color.ink.ink-dark}) — on-accent and
// on-button of a theme whose fill is too light for white text.
const inks = {};
function colorHex(tok, where) {
  const v = tok?.$value;
  if (tok?.$type === 'color' && typeof v === 'string') {
    const m = /^\{color\.ink\.([a-z0-9-]+)\}$/.exec(v);
    if (m && inks[m[1]]) return { hex: inks[m[1]], css: `var(--${m[1]})` };
    errors.push(`${where}: "${v}" — an alias may only point at an existing {color.ink.*}`);
    return null;
  }
  if (tok?.$type !== 'color' || !v || v.colorSpace !== 'srgb' || !/^#[0-9a-f]{6}$/.test(v.hex || '')) {
    errors.push(`${where}: expected {"$type":"color","$value":{"colorSpace":"srgb","components":[…],"hex":"#rrggbb"}} (lowercase hex)`);
    return null;
  }
  const want = rgb(v.hex).map((c) => +(c / 255).toFixed(4));
  if (!Array.isArray(v.components) || v.components.length !== 3 || v.components.some((c, i) => Math.abs(c - want[i]) > 0.0006)) {
    errors.push(`${where}: components ${JSON.stringify(v.components)} do not match ${v.hex} — use ${JSON.stringify(want)}`);
  }
  return { hex: v.hex, css: v.hex };
}
for (const [name, tok] of Object.entries(src.color?.ink || {})) {
  if (name.startsWith('$')) continue;
  const c = colorHex(tok, `color.ink.${name}`);
  if (c) inks[name] = c.hex;
}

const themes = {};
for (const [name, node] of Object.entries(src.color?.theme || {})) {
  if (!/^[a-z][A-Za-z0-9]*$/.test(name)) errors.push(`theme "${name}": name must be camelCase`);
  const exe = ext(node).exe;
  if (exe !== 'builtin' && exe !== 'package') errors.push(`theme "${name}": $extensions["app.dracondex"].exe must be "builtin" or "package"`);
  const p = {}; // hex, for contrast and for Dart
  const pc = {}; // what CSS writes: the hex, or var(--ink) for an alias
  for (const [k, tok] of Object.entries(node)) {
    if (k.startsWith('$')) continue;
    if (!PALETTE.includes(k)) { errors.push(`theme "${name}": unknown palette token "${k}"`); continue; }
    const c = colorHex(tok, `color.theme.${name}.${k}`);
    if (c) { p[k] = c.hex; pc[k] = c.css; }
  }
  for (const k of REQUIRED) if (!p[k]) errors.push(`theme "${name}": missing ${k}`);
  if (p['t3-aa']) for (const s of TEXT_SURFACES) {
    if (p[s] && contrast(p['t3-aa'], p[s]) < AA) {
      errors.push(`theme "${name}": t3-aa ${p['t3-aa']} is ${contrast(p['t3-aa'], p[s]).toFixed(2)}:1 on ${s} ${p[s]} — needs ${AA}`);
    }
  }
  themes[name] = { exe, p, pc };
}
if (!Object.keys(themes).length) errors.push('color.theme is empty');

// ── scales ─────────────────────────────────────────────────────────────
const dimension = (tok, where) => {
  const v = tok?.$value;
  if (tok?.$type !== 'dimension' || typeof v?.value !== 'number' || v.unit !== 'px') {
    errors.push(`${where}: expected {"$type":"dimension","$value":{"value":<n>,"unit":"px"}}`);
    return 0;
  }
  return v.value;
};
const number = (tok, where) => {
  if (tok?.$type !== 'number' || typeof tok.$value !== 'number') { errors.push(`${where}: expected {"$type":"number","$value":<n>}`); return 0; }
  return tok.$value;
};
// DTCG shadow: one layer or a list. Returned as plain layers.
const shadow = (tok, where) => {
  if (tok?.$type !== 'shadow') { errors.push(`${where}: expected "$type":"shadow"`); return []; }
  const layers = Array.isArray(tok.$value) ? tok.$value : [tok.$value];
  return layers.map((l, i) => {
    const c = l?.color;
    if (!c || c.colorSpace !== 'srgb' || !/^#[0-9a-f]{6}$/.test(c.hex || '') || typeof c.alpha !== 'number') {
      errors.push(`${where}[${i}]: shadow colour needs colorSpace srgb, hex and alpha`);
    }
    const px = (d, f) => (d?.unit === 'px' && typeof d.value === 'number' ? d.value : (errors.push(`${where}[${i}].${f}: px dimension`), 0));
    return { hex: c?.hex || '#000000', alpha: c?.alpha ?? 1, x: px(l.offsetX, 'offsetX'), y: px(l.offsetY, 'offsetY'), blur: px(l.blur, 'blur'), spread: px(l.spread, 'spread') };
  });
};
const group = (node, fn, where) => Object.fromEntries(Object.entries(node || {})
  .filter(([k]) => !k.startsWith('$')).map(([k, t]) => [k, fn(t, `${where}.${k}`)]));

const space = group(src.space, dimension, 'space');
const fontSize = group(src.fontSize, dimension, 'fontSize');
const lineHeight = group(src.lineHeight, number, 'lineHeight');
const radius = group(src.radius, dimension, 'radius');
const shadows = group(src.shadow, shadow, 'shadow');

// ── platform layers ────────────────────────────────────────────────────
// A derived colour is computed per theme by the platform: `mix` blends a
// palette colour toward another (opaque), `alpha` is a palette colour at an
// opacity, `ref` is a palette colour as is. Declaring it as data rather than
// as CSS is what lets the Dart side compute the same thing.
function derivedSpec(d, where) {
  const ok = (k) => PALETTE.includes(k);
  if (d?.mix && ok(d.mix[0]) && ok(d.mix[1]) && d.mix[2] > 0 && d.mix[2] < 1) return d;
  if (d?.alpha && ok(d.alpha[0]) && d.alpha[1] > 0 && d.alpha[1] < 1) return d;
  if (d?.ref && ok(d.ref)) return d;
  errors.push(`${where}: a derived colour is {mix:[from,toward,0..1]}, {alpha:[token,0..1]} or {ref:token}`);
  return null;
}
const platforms = {};
for (const [name, node] of Object.entries(src.platform || {})) {
  const e = ext(node);
  const targets = e.targets || [];
  if (!targets.length || targets.some((t) => t !== 'electron' && t !== 'flutter')) {
    errors.push(`platform.${name}: $extensions["app.dracondex"].targets must list electron and/or flutter`);
  }
  if (targets.includes('electron') && !e.selector?.electron) errors.push(`platform.${name}: an electron target needs selector.electron`);
  const derived = group(e.derived, derivedSpec, `platform.${name}.derived`);
  const overrides = {};
  for (const [theme, o] of Object.entries(e.themeOverrides || {})) {
    if (!themes[theme]) { errors.push(`platform.${name}: override for unknown theme "${theme}"`); continue; }
    overrides[theme] = {
      derived: group(o.derived, derivedSpec, `platform.${name}.themeOverrides.${theme}.derived`),
      color: Object.fromEntries(Object.entries(o.color || {}).map(([k, h]) => {
        if (!PALETTE.includes(k) || !/^#[0-9a-f]{6}$/.test(h)) errors.push(`platform.${name}.themeOverrides.${theme}.color.${k}: a palette token and a #rrggbb value`);
        return [k, h];
      })),
    };
  }
  const sub = {};
  for (const [k, g] of Object.entries(node)) {
    if (k.startsWith('$')) continue;
    const first = Object.values(g).find((t) => t && typeof t === 'object' && t.$type);
    sub[k] = first?.$type === 'shadow' ? { type: 'shadow', v: group(g, shadow, `platform.${name}.${k}`) }
      : { type: 'dimension', v: group(g, dimension, `platform.${name}.${k}`) };
  }
  platforms[name] = { targets, selector: e.selector || {}, derived, overrides, sub };
}

// Additive only: a platform layer may re-value the shared radius tokens
// (that is its job) but must not reuse a palette or scale name for something
// else, and its new names must not collide with each other.
const SHARED = new Set([...Object.keys(radius)]);
const TAKEN = new Set([...PALETTE, ...Object.keys(inks), ...Object.keys(space), ...Object.keys(fontSize), ...Object.keys(lineHeight), ...Object.keys(shadows)]);
for (const [name, pl] of Object.entries(platforms)) {
  const seen = new Set();
  const names = [...Object.keys(pl.derived), ...Object.entries(pl.sub).flatMap(([k, g]) => (k === 'radius' ? [] : Object.keys(g.v)))];
  for (const n of names) {
    if (TAKEN.has(n) || SHARED.has(n)) errors.push(`platform.${name}: "${n}" already means something in the apps — pick a new name`);
    if (seen.has(n)) errors.push(`platform.${name}: "${n}" is declared twice`);
    seen.add(n);
  }
  if (pl.sub.radius) for (const k of Object.keys(pl.sub.radius.v)) {
    if (name === 'fluent2' && !SHARED.has(k)) errors.push(`platform.fluent2.radius.${k}: only re-values r/rs/rl`);
  }
}

// Fluent 2 draws chrome on the Mica base, so muted text must still reach AA
// there — the check that caught daylight at 4.09:1 in the prototype (C2).
const fluent = platforms.fluent2;
if (fluent?.derived['material-base']?.mix) for (const [name, { p }] of Object.entries(themes)) {
  const o = fluent.overrides[name] || { derived: {}, color: {} };
  const d = o.derived['material-base'] || fluent.derived['material-base'];
  const [from, toward, t] = d.mix;
  const base = mix(p[from], p[toward], t);
  const aa = o.color['t3-aa'] || p['t3-aa'];
  if (aa && base && contrast(aa, base) < AA) {
    errors.push(`platform.fluent2 × ${name}: t3-aa ${aa} is ${contrast(aa, base).toFixed(2)}:1 on the Mica base ${base} — add a themeOverride`);
  }
}

if (errors.length) {
  for (const e of errors) console.error(`design/tokens.json: ${e}`);
  process.exit(1);
}
if (validateOnly) { console.log('design tokens valid'); process.exit(0); }

// ── electron: tokens.css ───────────────────────────────────────────────
const HEADER = 'GENERATED from DraconDex-SDB design/tokens.json by design/tokens.mjs — do not edit here.';
const cssColor = (hex, a) => (a >= 1 ? hex : `rgba(${rgb(hex).join(',')},${+a.toFixed(3)})`);
const cssShadow = (layers) => layers.map((l) => `${l.x}px ${l.y}px ${l.blur}px${l.spread ? ` ${l.spread}px` : ''} ${cssColor(l.hex, l.alpha)}`).join(', ');
const cssDerived = (d) => (d.mix ? `color-mix(in srgb,var(--${d.mix[0]}) ${Math.round((1 - d.mix[2]) * 100)}%,var(--${d.mix[1]}))`
  : d.alpha ? `color-mix(in srgb,var(--${d.alpha[0]}) ${Math.round(d.alpha[1] * 100)}%,transparent)` : `var(--${d.ref})`);
const decls = (pairs, ind = '\t') => pairs.map(([k, v]) => `${ind}--${k}:${v};`).join('\n');

let css = `/* ${HEADER}
   Loaded BEFORE css/tokens.css, so anything that file still declares wins —
   the app retires its own copies one at a time (REDESIGN.md C5 step 8).
   Only themes the app ships are here (exe: "builtin"); a package theme is a
   palette under data-theme="custom" and carries its own values. There is
   deliberately no :root --t3-aa: a custom or package theme without one must
   fall back through var(--t3-aa, var(--t2)), not inherit midnight's. */
:root{
${decls([
  ...Object.entries(inks),
  ...Object.entries(space).map(([k, v]) => [k, `${v}px`]),
  ...Object.entries(fontSize).map(([k, v]) => [k, `calc(${v}px * var(--fsc,1))`]),
  ...Object.entries(lineHeight).map(([k, v]) => [k, String(v)]),
  ...Object.entries(radius).map(([k, v]) => [k, `${v}px`]),
  ...Object.entries(shadows).map(([k, v]) => [k, cssShadow(v)]),
])}
}
`;
for (const [name, { exe, pc }] of Object.entries(themes)) {
  if (exe !== 'builtin') continue;
  css += `body[data-theme="${name}"]{\n${decls(PALETTE.filter((k) => pc[k]).map((k) => [k, pc[k]]))}\n}\n`;
}
for (const [name, pl] of Object.entries(platforms)) {
  if (!pl.targets.includes('electron')) continue;
  const sel = pl.selector.electron;
  const pairs = [];
  for (const [k, g] of Object.entries(pl.sub)) {
    for (const [n, v] of Object.entries(g.v)) pairs.push([n, g.type === 'shadow' ? cssShadow(v) : `${v}px`]);
  }
  for (const [n, d] of Object.entries(pl.derived)) pairs.push([n, cssDerived(d)]);
  css += `/* platform: ${name} */\n${sel}{\n${decls(pairs)}\n}\n`;
  for (const [theme, o] of Object.entries(pl.overrides)) {
    // Same rule as the palettes above: a package theme runs as
    // data-theme="custom", so a rule naming it would never match.
    if (themes[theme].exe !== 'builtin') continue;
    const op = [...Object.entries(o.derived).map(([n, d]) => [n, cssDerived(d)]), ...Object.entries(o.color)];
    if (op.length) css += `${sel}[data-theme="${theme}"]{\n${decls(op)}\n}\n`;
  }
}

// ── flutter: tokens.g.dart ─────────────────────────────────────────────
const camel = (s) => s.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
const dartColor = (hex, a = 1) => `Color(0x${Math.round(a * 255).toString(16).padStart(2, '0').toUpperCase()}${hex.slice(1).toUpperCase()})`;
const dartNum = (n) => (Number.isInteger(n) ? `${n}.0` : String(n));
const dartShadow = (layers) => `[${layers.map((l) => `BoxShadow(color: ${dartColor(l.hex, l.alpha)}, offset: Offset(${dartNum(l.x)}, ${dartNum(l.y)}), blurRadius: ${dartNum(l.blur)}, spreadRadius: ${dartNum(l.spread)})`).join(', ')}]`;
const OPTIONAL = PALETTE.filter((k) => !REQUIRED.includes(k));
const dartConsts = (cls, doc, entries) => `/// ${doc}\nabstract final class ${cls} {\n${entries.map(([k, t, v]) => `  static const ${t} ${camel(k)} = ${v};`).join('\n')}\n}\n`;
const dartDerived = (d) => (d.mix ? `Color.lerp(p.${camel(d.mix[0])}, p.${camel(d.mix[1])}, ${d.mix[2]})!`
  : d.alpha ? `p.${camel(d.alpha[0])}.withValues(alpha: ${d.alpha[1]})` : `p.${camel(d.ref)}`);

let dart = `// ${HEADER}
// ignore_for_file: constant_identifier_names

import 'package:flutter/painting.dart';

/// One theme's palette — the same names EXE uses as CSS custom properties
/// (t3Aa is --t3-aa). button/onAccent/onButton are optional there too.
class DdxPalette {
  const DdxPalette({
${REQUIRED.map((k) => `    required this.${camel(k)},`).join('\n')}
${OPTIONAL.map((k) => `    this.${camel(k)},`).join('\n')}
  });

${REQUIRED.map((k) => `  final Color ${camel(k)};`).join('\n')}
${OPTIONAL.map((k) => `  final Color? ${camel(k)};`).join('\n')}

  /// Muted text that reaches 4.5:1 — use this, not t3, for text.
  Color get textMuted => t3Aa;
}

${dartConsts('DdxInk', 'Ink colours a palette may alias for on-accent / on-button.', Object.entries(inks).map(([k, v]) => [k, 'Color', dartColor(v)]))}
/// Every theme, in the order the pickers list them.
const Map<String, DdxPalette> ddxPalettes = {
${Object.entries(themes).map(([name, { p }]) => `  '${name}': DdxPalette(${PALETTE.filter((k) => p[k]).map((k) => `${camel(k)}: ${dartColor(p[k])}`).join(', ')}),`).join('\n')}
};

${dartConsts('DdxSpace', 'Spacing, logical pixels.', Object.entries(space).map(([k, v]) => [k, 'double', dartNum(v)]))}
${dartConsts('DdxFontSize', 'Type sizes, logical pixels, before the font-scale setting.', Object.entries(fontSize).map(([k, v]) => [k, 'double', dartNum(v)]))}
${dartConsts('DdxLineHeight', 'Line-height multipliers.', Object.entries(lineHeight).map(([k, v]) => [k, 'double', dartNum(v)]))}
${dartConsts('DdxRadius', 'Corner radii, logical pixels.', Object.entries(radius).map(([k, v]) => [k, 'double', dartNum(v)]))}
${dartConsts('DdxShadow', 'Elevation.', Object.entries(shadows).map(([k, v]) => [k, 'List<BoxShadow>', dartShadow(v)]))}`;
for (const [name, pl] of Object.entries(platforms)) {
  if (!pl.targets.includes('flutter')) continue;
  const cls = `Ddx${name[0].toUpperCase()}${name.slice(1)}`;
  const nums = Object.entries(pl.sub).flatMap(([g, { type, v }]) => Object.entries(v).map(([k, x]) => [`${g}-${k}`, type === 'shadow' ? 'List<BoxShadow>' : 'double', type === 'shadow' ? dartShadow(x) : dartNum(x)]));
  dart += `
/// Platform layer "${name}" — sizes, and the colours it derives from the
/// active palette.
abstract final class ${cls} {
${nums.map(([k, t, v]) => `  static const ${t} ${camel(k)} = ${v};`).join('\n')}

${Object.entries(pl.derived).map(([k, d]) => `  static Color ${camel(k)}(DdxPalette p) => ${dartDerived(d)};`).join('\n')}
}
`;
}

// ── write ──────────────────────────────────────────────────────────────
function writeOrCheck(rel, content) {
  const out = path.join(root, rel);
  const cur = fs.existsSync(out) ? fs.readFileSync(out, 'utf8').replace(/\r\n/g, '\n') : null;
  if (check) {
    if (cur !== content) { console.error(`${rel} is stale — run npm run generate`); process.exit(1); }
    return;
  }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  if (cur !== content) fs.writeFileSync(out, content);
}
writeOrCheck('generated/electron/tokens.css', css);
writeOrCheck('generated/flutter/tokens.g.dart', dart);
console.log(`design tokens ${check ? 'in sync' : 'written'} (${Object.keys(themes).length} themes, ${Object.keys(platforms).length} platform layers)`);
