# supabase/ — ฝั่งเซิร์ฟเวอร์ของฟีเจอร์ที่ปิดใช้อยู่

> ⛔ **ฟีเจอร์ที่ใช้ไฟล์ในโฟลเดอร์นี้ (Cloud Sync — Supabase Token Sync) ถูกปิด
> ตั้งแต่ v4.5.0** ตัวแอปไม่คุยกับ Supabase เลยในสถานะปัจจุบัน และ **ไม่ต้อง**
> ตั้งโปรเจกต์ Supabase ใด ๆ เพื่อใช้ DraconDex

ระบบสำรองข้อมูลบนคลาวด์ที่ใช้งานอยู่จริงตอนนี้คือ **Google Drive Backup**
(OAuth ตรงกับ Google, scope `drive.appdata`) — ดู [`docs/DRIVE.md`](../../docs/DRIVE.md)
ไม่เกี่ยวกับโฟลเดอร์นี้แม้แต่น้อย

## ทำไมยังเก็บไฟล์พวกนี้ไว้

โค้ดฝั่งไคลเอนต์ของ Token Sync ยังอยู่ครบทุกบรรทัด (`src/db/sync.js`,
`src/db/sync-devserver.js`, `src/renderer/sync.js`, IPC `sync:*`) — ที่ปิดไปคือ
ทางเข้า UI เท่านั้น ผ่านค่า `CLOUD_SYNC_ENABLED` ใน
`src/renderer/core/state.js` migration สองไฟล์นี้คือ schema ที่โค้ดชุดนั้น
คาดหวังไว้ ถ้าไม่เก็บไว้ การเปิดฟีเจอร์กลับจะเปิดไม่ได้จริง

## ถ้าจะเปิดกลับ

1. ตั้ง `CLOUD_SYNC_ENABLED = true` ใน `src/renderer/core/state.js`
2. ทำตาม [`docs/SYNC.md`](../../docs/SYNC.md) §1.1–1.2 (สร้างโปรเจกต์ Supabase,
   รัน migration **ตามลำดับ**, เปิด Google provider, กรอก URL + anon key ในแอป)

```
20260717000000_dracondex_sync_prototype.sql   ต้นแบบเดิม (ตาราง/ฟังก์ชันคีย์ถาวร)
20260730000000_dracondex_token_sync.sql       Token Sync จริง — drop ของเดิมแล้วสร้างใหม่
```

## ห้ามแก้ไฟล์ .sql เดิม

migration ทั้งสองเคยถูก apply ไปแล้วกับฐานข้อมูลจริง การแก้ย้อนหลังจะทำให้
สถานะของ instance ที่ apply ไปแล้วกับที่ apply ใหม่ไม่ตรงกัน — ถ้าจำเป็นต้อง
เปลี่ยน schema ให้เพิ่ม migration ไฟล์ใหม่ต่อท้ายเสมอ
