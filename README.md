# JaaiNgan (จ่ายงาน) — Task Management สไตล์ Notion

ระบบจัดการงานสำหรับทีม ดีไซน์ UX/UI คล้าย Notion ล็อกอินด้วย Google และออกแบบ
ให้ขับเคลื่อนด้วย **Supabase** เป็นแกนหลัง

> สถานะปัจจุบัน: **เชื่อม Supabase แล้ว** — schema/RLS deploy ขึ้นโปรเจกต์
> `ojwnpeapulvemoelxncx`, ล็อกอินด้วย Email/Password (Google เปิดเพิ่มได้) และงาน
> ทั้งหมด (สร้าง/แก้/ลบ/ลากการ์ด) เซฟลงฐานข้อมูลจริง แยกข้อมูลรายผู้ใช้ด้วย RLS
> เมื่อไม่ตั้งค่า env แอปจะกลับไปทำงานโหมดเดโม (`localStorage`) อัตโนมัติ

## ฟีเจอร์

- 🔐 **Login**: Email/Password (พร้อมใช้) + ปุ่ม Google (เปิดใน dashboard ภายหลัง)
- ☁️ **เก็บข้อมูลบน Supabase** — CRUD ทุกอย่างเซฟลง DB จริง
- 🏢 **Workspace หลายอัน** — สลับ/สร้าง workspace, แต่ละอันมีหน้างานและสมาชิกแยกกัน
- 👥 **ระบบสมาชิก & เชิญ** — เชิญด้วยอีเมล + ลิงก์เชิญ, บทบาท เจ้าของ/ผู้ดูแล/สมาชิก,
  RLS แยกข้อมูลตาม workspace (สมาชิกเห็นเฉพาะ workspace ที่ตนอยู่)
- 🏠 **หน้าแรก “งานของฉัน”** — รวมงานที่มอบหมายให้เราจากทุกหน้า จัดกลุ่มตามกำหนดส่ง
  (เลยกำหนด/วันนี้/สัปดาห์นี้/ภายหลัง) + การ์ดสรุปสถิติ
- 🙋 **มอบหมายงานให้สมาชิก** + ตัวกรองตามผู้รับผิดชอบ/ความสำคัญ/ช่วงวันที่ + “งานของฉัน”
- ✅ **Subtask / Checklist** พร้อมแถบความคืบหน้า
- 💬 **คอมเมนต์ในงาน** + 🕑 **Activity log** (สร้าง/เปลี่ยนสถานะ/มอบหมาย/คอมเมนต์)
- 🗂️ **หน้างาน (Pages)** หลายหน้า — สร้าง / เปลี่ยนชื่อ / เปลี่ยนอีโมจิ / ลบ
- 📋 **4 มุมมอง**: บอร์ด (Kanban + ลากการ์ด), ตาราง, รายการ, ปฏิทิน
- 📝 **แผงรายละเอียดงาน** สไตล์ Notion — แก้ไขทุก property ในที่เดียว
- ⌘ **Command palette (⌘K / Ctrl+K)** — ค้นหางาน/หน้างาน + สร้าง + กระโดดไปเร็ว
- 🔀 **เรียงลำดับการ์ด** — ลำดับเอง / ความสำคัญ / กำหนดส่ง / สร้างล่าสุด
- 🌙 **โหมดมืด** (สว่าง / มืด / ตามระบบ)
- 🎨 ดีไซน์โทน Notion, รองรับฟอนต์ไทย

## เริ่มใช้งาน

```bash
npm install
npm run dev
# เปิด http://localhost:3000
```

หน้าแรกจะพาไป `/login` กด **“ดำเนินการต่อด้วย Google”** เพื่อเข้าใช้งาน
(โหมดเดโมเข้าได้ทันที)

## โครงสร้างโค้ด

```
src/
  app/
    layout.tsx           # ฟอนต์ (Inter + Noto Sans Thai) + Providers
    globals.css          # design tokens โทน Notion (Tailwind v4 @theme)
    login/page.tsx       # หน้าเข้าสู่ระบบ
    page.tsx             # auth gate → Workspace
  components/
    workspace.tsx        # ตัวประกอบหลัก (sidebar + เนื้อหา + modal)
    sidebar.tsx          # แถบข้าง รายการหน้างาน
    top-bar.tsx          # หัวเรื่อง + สลับมุมมอง + ค้นหา
    task-modal.tsx       # แผงแก้ไขงานสไตล์ Notion
    views/               # board / table / list
    ui/                  # pills, avatar, popover
  lib/
    types.ts             # โดเมนหลัก (map ตรงกับตาราง Supabase)
    constants.ts         # สี/สถานะ/ความสำคัญ/แท็ก
    seed.ts              # ข้อมูลตัวอย่างเริ่มต้น
    storage.ts           # localStorage fallback (โหมดเดโมเมื่อไม่มี env)
    auth-context.tsx     # auth: Email/Password + Google (Supabase) / เดโม
    data-context.tsx     # state + CRUD (สลับ Supabase ↔ localStorage อัตโนมัติ)
    supabase/
      client.ts          # Supabase browser client (อ่าน env)
      queries.ts         # ★ CRUD จริงเข้าตาราง projects/tasks + seed เริ่มต้น
supabase/                # โปรเจกต์ Supabase มาตรฐาน (จาก `supabase init`)
  config.toml            # ตั้งค่าโปรเจกต์ + Google OAuth
  migrations/            # ★ สคีมา/นโยบายแบบ migration (deploy ด้วย `supabase db push`)
  seed.sql               # seed สำหรับ local dev
```

## สถานะ Supabase

- ✅ env ตั้งไว้ใน `.env.local` (โปรเจกต์ `ojwnpeapulvemoelxncx`)
- ✅ schema + RLS + triggers deploy แล้ว (`supabase db push`)
- ✅ Email/Password login + CRUD เซฟลง DB จริง ใช้งานได้ทันที
- ⏳ Google OAuth — ยังไม่เปิด (ทำเมื่อพร้อม, ดูด้านล่าง)

### Deploy schema ซ้ำ / โปรเจกต์ใหม่

```bash
npx supabase login                       # ครั้งแรกเท่านั้น
npx supabase link --project-ref ojwnpeapulvemoelxncx
npx supabase db push                     # รัน migration ทั้งหมดใน supabase/migrations/
```

### เปิด Google OAuth (ภายหลัง)

1. **Authentication → Providers → Google** บน Supabase ใส่ Client ID / Secret
   (จาก Google Cloud Console), redirect URL:
   `https://ojwnpeapulvemoelxncx.supabase.co/auth/v1/callback`
2. ปุ่ม “ดำเนินการต่อด้วย Google” ในหน้า login จะใช้งานได้ทันที

### บัญชีทดสอบ

มีบัญชีทดสอบ (ยืนยันอีเมลแล้ว) 2 บัญชี ไว้ลองฟีเจอร์ทีม/เชิญสมาชิก:

```
tester@jaaingan.dev  / jaaingan123   (เจ้าของ workspace ตัวอย่าง)
tester2@jaaingan.dev / jaaingan123   (ชื่อ Nina — เป็นสมาชิกที่ถูกเชิญ)
```

หรือกด **สมัครสมาชิก** ในหน้า login เพื่อสร้างบัญชีใหม่ (ถ้าโปรเจกต์เปิด “Confirm
email” ไว้ ระบบจะส่งลิงก์ยืนยันไปทางอีเมลก่อนเข้าใช้งาน — ปิดได้ที่
Authentication → Providers → Email)

## เชื่อมต่อ LINE (โครงพร้อม — เปิดใช้เมื่อมี credentials)

โครงสร้างพร้อมแล้ว เปิดใช้งานได้โดยใส่ค่าเพิ่ม ไม่ต้องแก้โค้ด:

**A) แจ้งเตือนเข้ากลุ่ม/แชต LINE (Messaging API)** — 1 workspace ⇄ 1 ปลายทาง LINE

_ตั้งค่าครั้งเดียว (แอดมินเทคนิค):_
1. สร้าง LINE Official Account + ช่อง **Messaging API** ที่ [LINE Developers](https://developers.line.biz/console/)
2. ตั้ง secret + deploy edge functions:
   ```bash
   npx supabase secrets set LINE_CHANNEL_ACCESS_TOKEN=... LINE_CHANNEL_SECRET=...
   npx supabase functions deploy line-send line-webhook --no-verify-jwt
   ```
3. ในคอนโซล LINE → Messaging API: ตั้ง **Webhook URL** เป็น URL ของ `line-webhook`,
   เปิด *Use webhook* + **“Allow bot to join group chats”**, และปิด auto-reply/greeting
   ที่ LINE Official Account Manager (เพื่อให้บอทตอบ Group ID ได้)

_เชื่อมแต่ละกลุ่มเข้ากับ workspace (flow):_
1. เพิ่มบอท (LINE OA) เข้า **กลุ่มที่ต้องการ**
2. บอทจะ **ส่ง Group ID เข้ากลุ่มทันที** ที่เข้าร่วม (หรือพิมพ์ `id` ในกลุ่มเพื่อขออีกครั้ง)
3. ในแอป → เมนู workspace (มุมซ้ายบน) → **เชื่อมต่อ LINE** → วาง Group ID ในช่อง
   Destination ID → เลือกเหตุการณ์ (มอบหมาย/เปลี่ยนสถานะ/คอมเมนต์) → **บันทึก**
4. กด **ส่งข้อความทดสอบ** เพื่อยืนยัน ✅
   - เมื่อมอบหมายงาน ระบบจะส่ง **Flex Message** (มีปุ่ม “รับงาน/ทำเสร็จ”) เข้ากลุ่ม
     และเข้าแชตส่วนตัวของผู้รับผิดชอบที่ผูกบัญชี LINE ไว้

> แต่ละ workspace ผูกได้ 1 ปลายทาง — สลับ workspace แล้วตั้งของแต่ละอันแยกกันได้

**B) เข้าสู่ระบบ / ผูกบัญชีด้วย LINE (LINE Login)**
1. สร้างช่อง **LINE Login** → ตั้ง Callback URL เป็น `<app>/auth/line/callback`
2. ใส่ `NEXT_PUBLIC_LINE_LOGIN_CHANNEL_ID=...` ใน `.env.local`
3. ตั้ง secret + deploy:
   ```bash
   npx supabase secrets set LINE_LOGIN_CHANNEL_SECRET=...
   npx supabase functions deploy line-auth
   ```
4. ปุ่ม “เข้าสู่ระบบด้วย LINE” + “เชื่อมบัญชี LINE ของฉัน” จะโผล่อัตโนมัติ

**C) สองทาง + อัตโนมัติ (ต่อยอด)**
- **ปุ่มในการ์ด Flex** “✅ รับงานนี้ / 🏁 ทำเสร็จแล้ว” → กดใน LINE แล้วอัปเดตงานกลับ
  ```bash
  npx supabase secrets set LINE_CHANNEL_SECRET=...
  npx supabase functions deploy line-webhook --no-verify-jwt
  ```
  แล้วตั้ง **Webhook URL** ในคอนโซล LINE เป็น URL ของฟังก์ชันนี้
- **สรุปงานประจำวัน** ส่งเข้ากลุ่มตอนเช้า
  ```bash
  npx supabase secrets set CRON_SECRET=<random>
  npx supabase functions deploy line-daily-summary --no-verify-jwt
  ```
  ตั้ง cron (dashboard หรือ pg_cron + pg_net) ยิง POST มาที่ฟังก์ชันพร้อม
  `Authorization: Bearer <CRON_SECRET>` — ตัวอย่าง SQL อยู่หัวไฟล์ฟังก์ชัน
- **เลือกช่องทางส่ง** (กลุ่ม และ/หรือ DM ผู้รับผิดชอบ) ในโมดัล “เชื่อมต่อ LINE”

ไฟล์ที่เกี่ยว: `supabase/functions/{line-send,line-auth,line-webhook,line-daily-summary}`,
`src/lib/line/`, `src/components/line-settings-modal.tsx`,
`src/app/auth/line/callback/`

> หมายเหตุ: **LINE Notify ปิดบริการแล้ว (มี.ค. 2025)** — ใช้ Messaging API แทน

## เทคโนโลยี

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 ·
lucide-react · Supabase (`@supabase/ssr`, `@supabase/supabase-js`, Realtime,
Edge Functions) · LINE Messaging API / LINE Login
