# 🚀 Deploy JaaiNgan ขึ้น Vercel

แอปเป็น Next.js — Vercel ตรวจจับและ build ให้อัตโนมัติ ฐานข้อมูล/auth ใช้ Supabase
(โปรเจกต์ `ojwnpeapulvemoelxncx`) ที่ตั้งค่าไว้แล้ว

## 1) Environment variables ที่ต้องใส่ใน Vercel

ใส่ใน **Project → Settings → Environment Variables** (ทั้ง Production + Preview):

| Key | ค่า |
|-----|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://ojwnpeapulvemoelxncx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public key (จาก `.env.local`) |
| `NEXT_PUBLIC_LINE_LOGIN_CHANNEL_ID` | *(ใส่เมื่อเปิด LINE Login เท่านั้น)* |

> ⚠️ **อย่าใส่ `SUPABASE_SERVICE_ROLE_KEY` ใน Vercel** — แอปฝั่งหน้าเว็บไม่ใช้ และมันคือ
> secret ที่ข้าม RLS ได้ (ใช้เฉพาะใน Supabase Edge Functions เท่านั้น)

## 2) Deploy

### วิธี A — เชื่อม GitHub (แนะนำ, ได้ auto-deploy ทุก push)
1. ไป [vercel.com/new](https://vercel.com/new) → **Import** repo `jaaingan`
2. Framework = **Next.js** (อัตโนมัติ), Build = `next build` (อัตโนมัติ)
3. เพิ่ม Environment Variables ตามตารางข้อ 1
4. กด **Deploy**

### วิธี B — Vercel CLI
```bash
npx vercel login
npx vercel link          # ผูกกับโปรเจกต์ Vercel
npx vercel env add NEXT_PUBLIC_SUPABASE_URL
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
npx vercel --prod        # deploy production
```

## 3) ตั้งค่า Supabase ให้รับโดเมน production (สำคัญ)

หลังได้โดเมน เช่น `https://jaaingan.vercel.app` ไปที่ Supabase →
**Authentication → URL Configuration**:
- **Site URL**: `https://jaaingan.vercel.app`
- **Redirect URLs**: เพิ่ม `https://jaaingan.vercel.app/**`

(จำเป็นสำหรับ OAuth — แอปส่ง `redirectTo: window.location.origin`)

หรือใช้ CLI: แก้ `supabase/config.toml` ([auth] `site_url` + `additional_redirect_urls`)
แล้ว `npx supabase config push`

## 4) (ถ้าใช้ LINE) อัปเดต URL เป็นโดเมน production
- LINE Login → Callback URL: `https://jaaingan.vercel.app/auth/line/callback`
- Messaging API → Webhook URL: URL ของ edge function `line-webhook`
- ตั้ง `APP_URL=https://jaaingan.vercel.app` เป็น Supabase secret (ปุ่ม "เปิดใน JaaiNgan"
  ใน Flex จะลิงก์ถูก)

## 5) Edge Functions (แยกจาก Vercel — อยู่บน Supabase)
```bash
npx supabase functions deploy line-send line-auth line-webhook line-daily-summary --no-verify-jwt
```

---

เสร็จแล้วเปิดโดเมน Vercel → สมัคร/เข้าสู่ระบบด้วย Email/Password ได้ทันที 🎉
