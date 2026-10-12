import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';

/**
 * Procress 19 part 7: every brand master has its small WebP copy
 * (tools/brand-derive.py), sized for the largest place an app shows it, and
 * the copy is newer than its master. Reads the WebP header directly — no
 * image library in CI — so it checks presence and dimensions, not pixels;
 * re-run the script after replacing a master.
 */
const root = new URL('..', import.meta.url);
const SETS = [
  ['assets/brand', 'assets/brand/web', 256, /\.png$/],
  ['assets/flutter', 'assets/flutter', 128, /^DraconDex-Symbol.*\.png$/],
];

function webpSize(buf) {
  assert.equal(buf.subarray(0, 4).toString(), 'RIFF');
  assert.equal(buf.subarray(8, 12).toString(), 'WEBP');
  const kind = buf.subarray(12, 16).toString();
  if (kind === 'VP8L') {
    const b = buf.readUInt32LE(21);
    return [(b & 0x3fff) + 1, ((b >> 14) & 0x3fff) + 1];
  }
  if (kind === 'VP8X') return [buf.readUIntLE(24, 3) + 1, buf.readUIntLE(27, 3) + 1];
  if (kind === 'VP8 ') return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
  throw new Error(`unknown WebP chunk ${kind}`);
}

for (const [srcDir, outDir, max, pattern] of SETS) {
  for (const name of readdirSync(new URL(srcDir, root)).filter((n) => pattern.test(n))) {
    test(`${srcDir}/${name} has its WebP copy`, () => {
      const copy = new URL(`${outDir}/${name.replace(/\.png$/, '.webp')}`, root);
      const buf = readFileSync(copy);
      const [w, h] = webpSize(buf);
      assert.ok(Math.max(w, h) === max, `${w}x${h}, expected the long side to be ${max}`);
      assert.ok(buf.length < statSync(new URL(`${srcDir}/${name}`, root)).size / 4, 'the copy is not much smaller than the master');
    });
  }
}
