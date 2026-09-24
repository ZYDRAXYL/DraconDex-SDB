# สัญญา SQLite schema

Electron กับ Flutter เปิดไฟล์ฐานข้อมูล **ไฟล์เดียวกัน** (Electron: ไฟล์ `.ddx`
ต่อ Nexus, Flutter: `novel-manager.db` ไฟล์เดียวรวมทุก Nexus) แต่ระดับ "vault"
(ตารางข้อมูลสร้างสรรค์จริง — project, object, timeline, map, relation,
hashtag, world_\*, game_\*, write_\*, note, wiki_link, module\*, story_\*,
book_chapter, chat_\*, sketch_\*, design_\*, entity_relation, classifier_\*)
ตอนนี้ **generate จากไฟล์กลางไฟล์เดียว** แทนที่จะ hand-write แยกกันคนละภาษา
แบบเดิม

> **สถานะ**: เปลี่ยนมาเป็น generate-from-central-source เมื่อ 2026-08-22 และ
> **ย้ายออกมาเป็น repo ของตัวเอง (DraconDex-SDB) เมื่อ 2026-09-10** ตอน split
> monorepo — ก่อนหน้านี้ทั้งสองฝั่ง hand-write DDL ของตัวเองแยกกัน และ Flutter
> port แค่ 40 จาก ~100 ตาราง ประวัติก่อน split อ่านได้ที่ ZYDRAXYL/DraconDex-APP

## ใครถือของจริง

| ที่อยู่ | คืออะไร | แก้ที่นี่ไหม |
|---|---|---|
| [`vault.sql`](vault.sql) | **canonical** — ทุก CREATE TABLE ระดับ vault (~100 ตาราง) | ✅ แก้ที่นี่ |
| [`version.json`](version.json) | `vaultSchemaVersion` — เลขเวอร์ชันกลางที่ทั้งสองแอปอ้างอิง | ✅ แก้ที่นี่ (bump เมื่อ vault.sql เปลี่ยนแบบที่ต้องให้ทุกเครื่อง re-run init) |
| [`generate.mjs`](generate.mjs) | codegen: อ่าน vault.sql + version.json แล้วเขียนไฟล์ generated ทั้งสองฝั่ง | แก้เฉพาะตอนปรับวิธี generate เอง ไม่ใช่ตอนแก้ schema |
| `generated/electron/vault-ddl.electron.js` | **GENERATED** — ไม่แก้มือ | ❌ |
| `generated/flutter/vault_schema.g.dart` (vendored into **DraconDex-APK**) | **GENERATED** — ไม่แก้มือ | ❌ |
| `electron/src/db/schema/ddl.js` ใน **DraconDex-EXE** | `APP_DDL_SQL` (~6 ตารางระดับเครื่อง: plugin/app_setting/nexus_file ฯลฯ) hand-maintained ต่อไป, `VAULT_DDL_SQL` import จาก generated file | ✅ แก้ `APP_DDL_SQL` ที่นี่ — **ไม่แก้ `VAULT_DDL_SQL`** |
| `electron/src/db/schema/indexes.js` · `seed.js` · `migrations.js` (ใน **DraconDex-EXE**) | index, symbol seed, migration ตามเวอร์ชัน — ยัง Electron-only เหมือนเดิม | ✅ แก้ที่นี่ |

## ทำไมรวมเฉพาะระดับ vault ไม่รวม app-level

Electron แยก DB เป็น **2 ไฟล์จริง** ตั้งแต่ v4.9.0 (ดู
`docs/VAULTS.md` (ใน DraconDex-APP)): `app.ddx` (plugin, app_setting,
nexus_file — ของระดับเครื่อง ไม่ใช่ของ vault ไหน) กับ `<name>-<id>.ddx` ต่อ
1 Nexus Flutter เก็บทุกอย่างไฟล์เดียว (`novel-manager.db`) ไม่มีระบบ plugin
ไม่มี multi-file vault ให้ต้อง index แบบ `nexus_file` — ตาราง app-level ของ
Electron จึง **ไม่มีความหมายฝั่ง Flutter เลย** ยังคง hand-maintained แยกเฉพาะ
`electron/src/db/schema/ddl.js` (DraconDex-EXE) ของ `APP_DDL_SQL` เหมือนเดิม ไม่ได้รวมเข้า
`vault.sql`

## nexus.name เป็น UNIQUE — Flutter บังคับด้วยแล้ว

ฝั่ง Electron `nexus.name` เป็น `UNIQUE` มาตั้งแต่ต้น เพราะ 1 ไฟล์ .ddx = 1
Nexus ชื่อซ้ำในไฟล์เดียวไม่มีทางเกิด ฝั่ง Flutter เดิมเก็บหลาย Nexus เป็นแถว
ในไฟล์เดียวจึง**ไม่**เคยบังคับ unique — พอรวม schema กลาง constraint นี้ตกมา
ที่ Flutter ด้วย (ตัดสินใจแล้วตอนทำ unification — ดู docs/CHANGELOG.md) ผล:

- ติดตั้งใหม่ (fresh `_onCreate`): บังคับชื่อไม่ซ้ำทันที
- เครื่องเก่าที่มี Nexus ชื่อซ้ำอยู่แล้วก่อนอัปเดต: **ยังไม่ถูกบังคับ** — ตาราง
  `nexus` เดิมบนเครื่องนั้นไม่มี constraint นี้ และ `CREATE TABLE IF NOT
  EXISTS` ของ `_onOpen` จะข้ามไปเฉยๆเพราะตารางมีอยู่แล้ว (ไม่ retroactively
  ปรับ schema ตารางที่มีอยู่) — เป็น known gap ที่ยังไม่ได้ migrate เพราะ
  ต้องตัดสินใจว่าจะ auto-rename ชื่อซ้ำยังไงถ้าเจอจริง ยังไม่ได้ทำเพราะเสี่ยง
  เกินไปที่จะเดาเอง
- ฝั่ง UI: `NexusDialog._save()`/`ModuleDialog._save()` (flutter/lib/features/
  hub/dialogs/) จับ exception จาก UNIQUE violation แล้วโชว์ SnackBar
  `saveFailedMessage` อยู่แล้ว (ไม่ใช่ crash เงียบ)

## กติกาเวลาแก้ตาราง vault

1. **แก้ที่ [`vault.sql`](vault.sql)** — เป็น raw SQL ตรงๆ ไม่มี DSL ให้เรียนรู้
   เพราะทั้งสองฝั่ง (node-sqlite3-wasm ฝั่ง Electron, sqflite ฝั่ง Flutter)
   เข้าใจ SQLite SQL เหมือนกันอยู่แล้ว
2. รันคำสั่ง generate ให้ไฟล์ generated สองไฟล์ตรงกับ source:
   ```bash
   npm run generate     # generate ทุกไฟล์ + manifest
   npm run check        # ตรวจอย่างเดียว ไม่เขียนไฟล์ — CI ใช้ตัวนี้
   ```
   `.github/workflows/schema-ci.yml` รัน `npm run check` ทุก push/PR — ถ้าลืมรัน
   generate หลังแก้ vault.sql, CI แดงทันทีแทนที่จะเงียบ

   **หลัง generate เสร็จต้อง commit `generated/` ด้วย** เพราะ EXE/APK vendor
   จากไฟล์ที่ commit ไว้ ไม่ได้รัน generator เอง (มันไม่มี `vault.sql` ให้รัน)
3. ตารางที่มีข้อมูลจริงในเครื่อง user แล้ว (ไม่ใช่ตารางใหม่ล้วน): เพิ่มคอลัมน์
   ใหม่ที่ `vault.sql` ยังไม่พอ — ต้องมี migration จริงทั้งสองฝั่งด้วย
   (`electron/src/db/schema/migrations.js` (DraconDex-EXE) และของ Flutter เอง ถ้ามี) เพราะ
   SQLite `ALTER TABLE` แก้ column ที่มีอยู่ในที่เดิมไม่ได้ ต้อง
   `CREATE TABLE IF NOT EXISTS` ใหม่ทั้งก้อนถึงจะพอสำหรับ user ใหม่ แต่ user
   เก่าที่มีตารางอยู่แล้วต้อง ALTER เพิ่มเอง — ตัวอย่างของเก่า (ก่อนรวม
   central schema) อยู่ใน `migrations.js`'s `migrateInlineColumns()`, ซึ่งเป็น
   ที่มาของ `vault.sql` เวอร์ชันแรก (ดู vault.sql's header comment — สร้างจาก
   การรัน ddl.js เดิม + migrations.js เดิมจริงแล้วอ่าน schema ที่ได้กลับมา
   ไม่ใช่ transcribe มือ)
4. ตารางใหม่ล้วน (ไม่มี user คนไหนมีอยู่ก่อน): แค่เพิ่มใน `vault.sql` พอ —
   `CREATE TABLE IF NOT EXISTS` ใน `_onOpen`ฝั่ง Flutter/`initVaultDB` ฝั่ง
   Electron จะสร้างให้เองตอนเปิดแอปครั้งถัดไป ไม่ต้องรอ migration
5. ถ้าการเปลี่ยนแปลงต้องบังคับให้ทุกเครื่องที่มีอยู่แล้ว re-run init path จริงๆ
   (เช่น เพิ่ม migration ใหม่ใน migrations.js) — bump
   `version.json`'s `vaultSchemaVersion` ด้วย: ฝั่ง Electron ค่านี้ถูก hash
   เข้า `vaultSchemaStamp()` (`electron/src/db/schema/init.js`) ทำให้ stamp
   เปลี่ยนและ initVaultDB รันใหม่ 1 ครั้ง ฝั่ง Flutter ค่านี้คือ
   `openDatabase(version:)` ตรงๆ ทำให้ sqflite เรียก `onUpgrade` (เป็น no-op
   เพราะงานจริงอยู่ใน `_onOpen`'s idempotent loop เหมือนกันทั้งสองฝั่งอยู่แล้ว)
   ตารางใหม่ล้วนไม่จำเป็นต้อง bump (ข้อ 4 อธิบายว่าทำไม) แต่ bump ไว้เผื่อ
   traceability ก็ได้

6. **ลบตาราง** (เช่น `module_attribute` ใน v5 Part 8): เอาออกจาก `vault.sql`
   อย่างเดียวไม่พอ — เครื่อง user เก่ายังมีตารางและข้อมูลอยู่ ต้องมี migration
   ทั้งสองฝั่งที่ **ย้ายข้อมูลออกก่อน** แล้วค่อย `DROP TABLE` (ฝั่ง EXE ใส่
   ใน `migrateInlineColumns()` + รายการใน `vaultSchemaStamp()`, ฝั่ง APK ใน
   `_onOpen`) และลบ index ของตารางนั้นใน `indexes.js` ด้วย เพราะ
   `CREATE INDEX IF NOT EXISTS` บนตารางที่ไม่มีแล้วยัง throw — bump
   `vaultSchemaVersion` และ `sdbVersion` เป็นเลข X (breaking)

## Electron ฝั่ง APP_DDL_SQL — ยังเหมือนเดิมทุกอย่าง

`electron/src/db/schema/ddl.js` (DraconDex-EXE) ของ `APP_DDL_SQL`, `electron/src/db/schema/
indexes.js` (DraconDex-EXE), `seed.js`, `migrations.js` **ไม่ถูกแตะ** โดยการรวม schema กลางนี้
เลย — `schemaStamp()`/`appSchemaStamp()`/`vaultSchemaStamp()` (init.js) ยังคง
ทำงานแบบเดิม (hash เนื้อหาไฟล์ + source ของ migration function) แค่
`vaultSchemaStamp()` ตอนนี้ hash เพิ่ม `VAULT_SCHEMA_VERSION` (มาจาก
`version.json` ผ่าน generated file) เข้าไปด้วย

รายละเอียดว่าตารางไหนอยู่ในระบบไหน ดู `docs/Architec.md`
และ `docs/SYSTEMS.md` (ทั้งคู่อยู่ใน DraconDex-APP)


## ของที่ generate แล้วไปถึงแอปยังไง (หลัง split)

ก่อน split `generate.mjs` เขียนไฟล์ลง `electron/` กับ `flutter/` ตรงๆ เพราะอยู่
repo เดียวกัน ตอนนี้เขียนไม่ได้แล้ว — ทั้งสองอยู่คนละ repo ลำดับใหม่คือ:

```
schema/vault.sql  ── npm run generate ──▶  generated/  ──▶  commit + tag sdb-vX.Y.Z
                                                              │
                                    chained-updated เปิด PR   │
                              ┌───────────────────────────────┴───────────────┐
                              ▼                                               ▼
      DraconDex-EXE                                          DraconDex-APK
      src/schema/generated/vault-ddl.electron.js             flutter/lib/core/database/vault_schema.g.dart
      electron/src/db/supabase-schema.js                     flutter/lib/data/services/supabase_schema.dart
      + sdb.lock.json (pin)                                  + sdb.lock.json (pin)
```

`generated/manifest.json` คือสัญญาของขั้นตอนนี้ — **ฝั่ง producer (ที่นี่) เป็นคน
ประกาศว่าไฟล์แต่ละอันต้องไปวางที่ path ไหนของ consumer** (field `consumers`)
ไม่ใช่ให้ consumer เดาเอง เพราะถ้าให้ consumer ตัดสิน สัญญาจะกระจายอยู่ 3 repo
แล้วขัดกันเองแบบเงียบๆ ได้

ฝั่ง consumer มี `sdb.lock.json` pin ไว้ว่าใช้ `sdb-vX.Y.Z` ตัวไหน และ CI ของมัน
ตรวจ sha256 ของไฟล์ที่ vendor ไว้เทียบกับ manifest — แทนที่ `--check` เดิมที่
เคยทำงานได้เพราะทุกอย่างอยู่ checkout เดียวกัน
