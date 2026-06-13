"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";
import { LINE_MODE_KEY, lineCallbackUri } from "@/lib/line/config";

/**
 * LINE Login OAuth callback. Exchanges the code via the `line-auth` edge
 * function then either links the LINE account (mode=link) or signs in
 * (mode=login, by following the returned magic action link).
 */
export default function LineCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState("กำลังเชื่อมต่อกับ LINE…");

  useEffect(() => {
    async function run() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const error = params.get("error");
      const mode =
        (window.localStorage.getItem(LINE_MODE_KEY) as "login" | "link" | null) ??
        "login";
      window.localStorage.removeItem(LINE_MODE_KEY);

      if (error || !code) {
        setStatus("การเชื่อมต่อถูกยกเลิก");
        setTimeout(() => router.replace("/login"), 1500);
        return;
      }

      const db = getSupabaseClient();
      if (!db) {
        setStatus("ระบบยังไม่ได้เชื่อม Supabase");
        return;
      }

      try {
        const { data, error: fnErr } = await db.functions.invoke("line-auth", {
          body: { code, redirectUri: lineCallbackUri(), mode },
        });
        if (fnErr) throw fnErr;

        if (mode === "link") {
          setStatus("เชื่อมบัญชี LINE สำเร็จ ✅");
          setTimeout(() => router.replace("/"), 1200);
        } else if (data?.actionLink) {
          // Follow the magic link to establish a Supabase session.
          window.location.assign(data.actionLink as string);
        } else {
          setStatus("เข้าสู่ระบบไม่สำเร็จ");
          setTimeout(() => router.replace("/login"), 1500);
        }
      } catch {
        setStatus("เกิดข้อผิดพลาดในการเชื่อมต่อ LINE");
        setTimeout(() => router.replace("/login"), 1800);
      }
    }
    run();
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="flex flex-col items-center gap-3 text-ink-muted">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-[#06C755]" />
        <span className="text-sm">{status}</span>
      </div>
    </div>
  );
}
