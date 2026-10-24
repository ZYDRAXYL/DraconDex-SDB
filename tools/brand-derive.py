#!/usr/bin/env python3
"""Derive the small WebP copies of the brand masters (Procress 19 part 7).

The masters are 1847 px (assets/brand) and 1024 px (assets/flutter) PNGs of
200 KB-1.5 MB each. Nothing in either app shows one larger than 88 px (the
splash logo; the rail logo is 28-30 px), yet every first paint decoded one
and the PWA precached all seven. These copies are sized for the largest use
at 3x device pixels and stay in step with the masters:

  assets/brand/web/<name>.webp     256 px   EXE + PWA desktop lane (CSS/img)
  assets/flutter/<name>.webp       128 px   APK + PWA mobile lane (Image.asset)
  assets/flutter/DraconDex_Color.webp  128 px   the one logo both apps show (Procress 26)
  assets/brand/DraconDex_Icon.ico  16-256 px  the Windows exe/installer icon, from Color

  python3 tools/brand-derive.py           write them
  python3 tools/brand-derive.py --check   exit 1 if a copy is missing or stale

Pillow, deterministic for a given Pillow/libwebp: lossless, so the bytes do
not depend on an encoder's quality heuristics and a re-run diffs only when a
master changed. Then: npm run generate (the manifest hashes them).
"""
import io
import pathlib
import sys

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
SETS = [
    (ROOT / 'assets/brand', ROOT / 'assets/brand/web', 256, '*.png'),
    (ROOT / 'assets/flutter', ROOT / 'assets/flutter', 128, 'DraconDex-Symbol*.png'),
    (ROOT / 'assets/brand', ROOT / 'assets/flutter', 128, 'DraconDex_Color.png'),
]
# Every size Windows asks an .ico for (taskbar, title bar, Explorer views,
# installer); with only 256 px it downscales on the fly and the small ones blur.
ICO_SRC = ROOT / 'assets/brand/DraconDex_Color.png'
ICO_DEST = ROOT / 'assets/brand/DraconDex_Icon.ico'
ICO_SIZES = [(n, n) for n in (16, 20, 24, 32, 40, 48, 64, 128, 256)]


def derive(src: pathlib.Path, size: int) -> bytes:
    im = Image.open(src).convert('RGBA')
    im.thumbnail((size, size), Image.LANCZOS)
    out = io.BytesIO()
    im.save(out, 'WEBP', lossless=True, quality=100, method=6, exact=False)
    return out.getvalue()


def derive_ico() -> bytes:
    out = io.BytesIO()
    Image.open(ICO_SRC).convert('RGBA').save(out, 'ICO', sizes=ICO_SIZES)
    return out.getvalue()


def main() -> int:
    check = '--check' in sys.argv
    stale = []
    ico = derive_ico()
    if not (ICO_DEST.exists() and ICO_DEST.read_bytes() == ico):
        if check:
            stale.append(str(ICO_DEST.relative_to(ROOT)))
        else:
            ICO_DEST.write_bytes(ico)
            print(f'wrote {ICO_DEST.relative_to(ROOT)} ({len(ico) / 1024:.1f} KB, {len(ICO_SIZES)} sizes)')
    for src_dir, out_dir, size, pattern in SETS:
        out_dir.mkdir(parents=True, exist_ok=True)
        for src in sorted(src_dir.glob(pattern)):
            dest = out_dir / (src.stem + '.webp')
            data = derive(src, size)
            if dest.exists() and dest.read_bytes() == data:
                continue
            if check:
                stale.append(str(dest.relative_to(ROOT)))
                continue
            dest.write_bytes(data)
            print(f'wrote {dest.relative_to(ROOT)} ({len(data) / 1024:.1f} KB, from {src.stat().st_size / 1024:.0f} KB)')
    if stale:
        print('stale brand copies: ' + ', '.join(stale) + ' - run: python3 tools/brand-derive.py', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
