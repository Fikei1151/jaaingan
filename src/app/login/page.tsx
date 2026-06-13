"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { isLineLoginConfigured, startLineAuth } from "@/lib/line/config";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

type Mode = "signin" | "signup";

export default function LoginPage() {
  const { user, loading, signInWithGoogle, signInWithEmail, signUpWithEmail } =
    useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) {
      const pending =
        typeof window !== "undefined"
          ? localStorage.getItem("jaaingan:pendingInviteToken")
          : null;
      router.replace(pending ? `/invite/${pending}` : "/");
    }
  }, [user, loading, router]);

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        const { needsConfirmation } = await signUpWithEmail(
          email.trim(),
          password,
          name.trim(),
        );
        if (needsConfirmation) {
          setInfo(
            "สมัครสำเร็จ! เราส่งลิงก์ยืนยันไปที่อีเมลของคุณแล้ว กดยืนยันแล้วค่อยเข้าสู่ระบบ",
          );
        }
      } else {
        await signInWithEmail(email.trim(), password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    try {
      await signInWithGoogle();
    } catch {
      setError("ยังไม่ได้เปิดใช้งาน Google — ตั้งค่าใน Supabase dashboard ก่อน");
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-6">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-[#faf9f7] to-white dark:from-[#1d1d1d] dark:to-[#141414]" />
      <div className="pointer-events-none absolute -left-24 top-10 -z-10 h-72 w-72 rounded-full bg-[#d3e5ef]/40 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-0 -z-10 h-72 w-72 rounded-full bg-[#fdecc8]/40 blur-3xl" />

      <div className="jn-pop-in w-full max-w-[400px]">
        <div className="mb-7 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-ink text-2xl shadow-sm">
            <span>📥</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">JaaiNgan</h1>
          <p className="mt-2 text-sm text-ink-muted">
            จัดการงานของทีมในที่เดียว — เรียบ ลื่น สไตล์ Notion
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-bg p-6 shadow-[0_8px_30px_rgba(15,15,15,0.06)]">
          <h2 className="text-center text-base font-semibold">
            {mode === "signin" ? "เข้าสู่ระบบ" : "สร้างบัญชีใหม่"}
          </h2>

          {/* Google */}
          <button
            type="button"
            onClick={handleGoogle}
            disabled={busy || loading}
            className="mt-5 flex w-full items-center justify-center gap-3 rounded-lg border border-line-strong bg-white px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-fill disabled:opacity-60"
          >
            <GoogleIcon />
            ดำเนินการต่อด้วย Google
          </button>

          {/* LINE login (shown once a LINE Login channel is configured) */}
          {isLineLoginConfigured() && (
            <button
              type="button"
              onClick={() => startLineAuth("login")}
              className="mt-2.5 flex w-full items-center justify-center gap-3 rounded-lg bg-[#06C755] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:brightness-95"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12 2C6.48 2 2 5.69 2 10.23c0 4.07 3.58 7.48 8.41 8.12.33.07.78.22.89.5.1.26.07.66.03.92l-.14.86c-.04.26-.2 1.02.9.56 1.1-.46 5.92-3.49 8.08-5.97C21.4 13.6 22 12 22 10.23 22 5.69 17.52 2 12 2ZM8.2 12.86H6.6c-.23 0-.42-.19-.42-.42V9.27c0-.23.19-.42.42-.42.24 0 .43.19.43.42v2.74h1.17c.24 0 .43.19.43.43 0 .23-.19.42-.43.42Zm1.67-.42c0 .23-.19.42-.43.42a.42.42 0 0 1-.42-.42V9.27c0-.23.19-.42.42-.42.24 0 .43.19.43.42v3.17Zm3.83 0c0 .18-.12.34-.29.4a.45.45 0 0 1-.14.02c-.13 0-.26-.06-.34-.17l-1.62-2.2v1.95c0 .23-.19.42-.43.42a.42.42 0 0 1-.42-.42V9.27c0-.18.12-.34.29-.4a.43.43 0 0 1 .48.15l1.63 2.2V9.27c0-.23.19-.42.42-.42.24 0 .43.19.43.42v3.17Zm2.65-2c.23 0 .42.19.42.43 0 .23-.19.42-.42.42h-1.17v.73h1.17c.23 0 .42.19.42.43 0 .23-.19.42-.42.42h-1.6a.42.42 0 0 1-.42-.42V9.27c0-.23.19-.42.42-.42h1.6c.23 0 .42.19.42.42 0 .24-.19.43-.42.43h-1.17v.73h1.17Z" />
              </svg>
              เข้าสู่ระบบด้วย LINE
            </button>
          )}

          {/* divider */}
          <div className="my-4 flex items-center gap-3 text-xs text-ink-faint">
            <span className="h-px flex-1 bg-line" />
            หรือใช้อีเมล
            <span className="h-px flex-1 bg-line" />
          </div>

          {/* Email / password */}
          <form onSubmit={handleEmailSubmit} className="space-y-2.5">
            {mode === "signup" && (
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ชื่อที่แสดง"
                className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm transition-colors focus:border-accent"
              />
            )}
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="อีเมล"
              autoComplete="email"
              className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm transition-colors focus:border-accent"
            />
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="รหัสผ่าน (อย่างน้อย 6 ตัว)"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm transition-colors focus:border-accent"
            />

            {error && (
              <p className="rounded-md bg-[#ffe2dd] px-3 py-2 text-xs text-[#5d1715]">
                {error}
              </p>
            )}
            {info && (
              <p className="rounded-md bg-[#dbeddb] px-3 py-2 text-xs text-[#1c3829]">
                {info}
              </p>
            )}

            <button
              type="submit"
              disabled={busy || loading}
              className="flex w-full items-center justify-center rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:brightness-95 disabled:opacity-60"
            >
              {busy
                ? "กำลังดำเนินการ…"
                : mode === "signin"
                  ? "เข้าสู่ระบบ"
                  : "สมัครสมาชิก"}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-ink-muted">
            {mode === "signin" ? "ยังไม่มีบัญชี? " : "มีบัญชีอยู่แล้ว? "}
            <button
              type="button"
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setError(null);
                setInfo(null);
              }}
              className="font-medium text-accent hover:underline"
            >
              {mode === "signin" ? "สมัครสมาชิก" : "เข้าสู่ระบบ"}
            </button>
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-ink-faint">
          ขับเคลื่อนด้วย Supabase · การเข้าใช้งานถือว่ายอมรับเงื่อนไขการให้บริการ
        </p>
      </div>
    </div>
  );
}
