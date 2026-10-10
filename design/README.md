# design tokens — แหล่งเดียวของสี ระยะ ตัวอักษร และเงาของทั้งสองแอป

`tokens.json` (รูป [DTCG 2025.10](https://www.designtokens.org/)) → `tokens.mjs` →

| ผลลัพธ์ | ไปที่ | ใช้ยังไง |
|---|---|---|
| `generated/electron/tokens.css` | EXE `src/design/generated/tokens.css` | โหลด **ก่อน** `css/tokens.css` — ของที่แอปยังประกาศเองชนะเสมอ แล้วแอปค่อยลบของซ้ำทีละขั้น |
| `generated/flutter/tokens.g.dart` | APK `flutter/lib/core/theme/tokens.g.dart` | `ddxPalettes` · `DdxSpace` · `DdxFontSize` · `DdxRadius` · `DdxShadow` · `DdxSize` · `DdxMotion` · `DdxIos` · `DdxGlass` |

ที่มา : APP `docs/REDESIGN.md` §C1 (D1 D2) · §C4 · §C5

```bash
npm run generate     # เขียน generated/ + manifest
npm run check        # ตรวจอย่างเดียว — CI
```

## ในไฟล์มีอะไร

- **`color.theme.<ชื่อ>`** — palette ครบ 32 ธีม ชื่อ key = ชื่อ CSS custom property
  ไม่มี `--` (`bg` `surface` … `t3-aa` … `on-button`) **ห้ามเปลี่ยนชื่อ** —
  แพ็กเกจธีมของ DraconDex-PKG และธีมที่ผู้ใช้สร้างเองผูกกับชื่อเหล่านี้
  - `$extensions["app.dracondex"].exe` : `builtin` = EXE ฝังธีมนี้ในแอป ·
    `package` = EXE ได้ธีมนี้จาก DraconDex-PKG (Procress 10 part 2) — CSS ของ EXE
    จึงมีเฉพาะ `builtin` · Dart ได้ครบทุกธีม
  - `on-accent` / `on-button` ที่ต้องเป็นสีเข้มเป็น alias `{color.ink.ink-dark}`
- **`t3-aa`** — `t3` ที่ดันไปทาง `t1` จนได้ ≥ 4.5:1 บน `bg` `surface` `raised`
  (สามธีมฐานใช้ค่าที่ตัดสินไว้ในต้นแบบ, อีก 29 ธีมคำนวณด้วยสูตรเดียวกันแล้ว**เก็บเป็นค่าตายตัว**
  — generator ไม่คำนวณเอง มันแค่ตรวจ) · ใช้กับ *ข้อความ* เท่านั้น `t3` เดิมยังอยู่สำหรับเส้นขอบ/พื้น
- **`warn` `info` `on-warn` `on-info`** — สีสถานะ "ต้องดู" (ไฟล์หาย ใกล้เต็ม) กับ
  "ข้อมูล" (tip ของใหม่) ตาม APP `docs/UX-LAYOUT.md` §9 · ธีมมืด `#f59e0b`/`#38bdf8`
  ธีมสว่าง `#92400e`/`#075985` · generator ตรวจว่าเป็นข้อความได้ ≥ 4.5:1 บน `bg`
  `surface` `raised` และ `on-*` ≥ 4.5:1 บนสีของมัน · ไม่บังคับ (แพ็กเกจธีมที่ไม่มีก็ใช้ได้)
  แต่ถ้ามี `warn`/`info` ต้องมี `on-*` คู่กัน
- **`space` `fontSize` `lineHeight` `radius` `shadow`** — ค่าเดียวกับ `css/tokens.css` ของ EXE
- **`size`** (Procress 21–22) — `row-compact` 28 / `row-comfy` 40 (แถว list มี 2 ระดับนี้เท่านั้น) ·
  `ctl-sm/md/lg` 24/32/40 · `icon-sm/md` 16/20 · `modal-sm/md/lg` 400/560/1100 · `focus-ring` 2
- **`zIndex`** (Procress 22 C3, EXE เท่านั้น) — `z-base` 0 · `z-sticky` 10 · `z-dropdown` 100 ·
  `z-popover` 900 · `z-modal` 1000 · `z-toast` 1100 · `z-tooltip` 1200 · `z-max` (splash/preview เท่านั้น)
  — ค่าเรียงตามชั้นเดิมของ EXE (pb-pop 900 · confirm 1000 · toast 1100 · guide 1200) ย้ายแล้วลำดับไม่เปลี่ยน ·
  generator ปฏิเสธถ้าไม่เรียงจากต่ำไปสูง
- **`motion`** — `dur-fast/normal/slow` 120/200/320 ms · `ease-standard` `ease-emphasized` ·
  CSS ตั้ง duration เป็น 0ms ใต้ `prefers-reduced-motion` เอง · Dart = `Duration` / `Cubic`
- **`platform.glass`** (Procress 23, ทั้งสองแอป, selector `body[data-ui-style="glass"]`) —
  `glass-blur` `glass-tint` `glass-stroke` `glass-shadow` = **ชื่อเดียวกับสัญญา PKG** (`PACKAGES.md`
  กลุ่ม glass — ห้ามเปลี่ยนชื่อ) + `glass-backdrop-from/-to` (ปลายสองข้างของ gradient ใต้กระจก) ·
  `glass-tint` เก็บเป็นสัดส่วน 0..1 · CSS ได้เป็น `%` ตามสัญญา PKG ·
  **ตรวจ contrast กรณีแย่สุด** : ข้อความ `t1` และ `t3-aa` บนแผง = `mix(พื้นหลัง, surface, tint)` ทั้งสองปลาย
  ต้อง ≥ 4.5:1 — ธีมที่ไม่ถึง generator **เพิ่ม tint ให้เอง** (ทีละ 1 %) แล้วออกเป็น
  `[data-theme=…]{--glass-tint:…}` / `DdxGlass.glassTintFor(theme)` — ไม่มีรายการ override ที่ต้องดูแลมือ ·
  ธีมที่ต้องทึบ 100 % ถึงจะอ่านได้ = error · ภาพพื้นหลังของผู้ใช้ตรวจล่วงหน้าไม่ได้ — แอปต้องมีแถบมืด/สว่างทับ
- **`platform.fluent2`** (EXE เท่านั้น, selector `body[data-ui-style="fluent"]`) — radius 4/8 ·
  `elev-*` · สีที่คำนวณจากธีม (`material-*` `stroke-*`) · `themeOverrides` = ธีมที่ `t3-aa`
  ไม่ถึง 4.5:1 บนพื้น Mica ต้องมีค่าของตัวเอง
- **`platform.ios`** (APK เท่านั้น) — ขนาด + สีที่คำนวณจากธีม (`separator` `bar` `fill` `tint`)

สีที่คำนวณ (`derived`) เขียนเป็นข้อมูล ไม่ใช่ CSS : `{mix:[a,b,t]}` = a ผสมไปทาง b ·
`{alpha:[a,t]}` = a ที่ความทึบ t · `{ref:a}` — ทำให้ Dart คำนวณแบบเดียวกันได้
(`Color.lerp` / `withValues`) แทนที่จะมีแค่ `color-mix()` ที่ CSS อ่านออก

## generator ปฏิเสธอะไรบ้าง

- ธีมขาด token 1 ใน 13 ตัวที่ทุกธีมต้องมี หรือมีชื่อที่ไม่รู้จัก
- `components` ไม่ตรงกับ `hex`
- `t3-aa` ต่ำกว่า 4.5:1 บน `bg`/`surface`/`raised` **หรือบนพื้น Mica ของ fluent2**
  (ตัวที่จับ daylight 4.09 ได้ตอนต้นแบบ — รอบนี้จับเพิ่มอีก 11 ธีม)
- ชั้นแพลตฟอร์มตั้งชื่อใหม่ซ้ำกับชื่อที่แอปใช้อยู่แล้ว (ยกเว้น `r`/`rs`/`rl` ที่ fluent2 ตั้งใจเปลี่ยนค่า)
- alias ที่ไม่ได้ชี้ `{color.ink.*}`

เทสต์ : `test/design-tokens.test.mjs`

## ⚠ ธีมแบบแพ็กเกจ

`tokens.css` ของ EXE ไม่มีธีม `package` เพราะธีมเหล่านั้นทำงานเป็น
`data-theme="custom"` — `t3-aa` ของมันต้องไปกับ payload ใน DraconDex-PKG
(ยังไม่ได้ทำ · ต้องเพิ่ม `--t3-aa` ใน `THEME_TOKENS` ทั้ง PKG `tools/build-packages.mjs`
และ EXE `db/pkg.js`) ระหว่างนี้ EXE ใช้ `var(--t3-aa, var(--t2))` และ **ไม่มี `--t3-aa` ใน `:root`**
โดยตั้งใจ — ธีมที่ไม่มีค่าต้องตกไปที่ `t2` ไม่ใช่รับค่าของ midnight มา
