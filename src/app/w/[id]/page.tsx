"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Hand } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  requestWorkspaceAccess,
  workspaceAccessInfo,
} from "@/lib/supabase/queries";

/** Generic post-login return path (shared with /line/connect, /line/task). */
const RETURN_KEY = "jaaingan:pendingLineConnect";

type Info = {
  name: string;
  icon: string;
  isMember: boolean;
  requestStatus: string | null;
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="jn-pop-in w-full max-w-[400px] rounded-2xl border border-line bg-bg p-7 text-center shadow-[0_8px_30px_rgba(15,15,15,0.06)]">
        {children}
      </div>
    </div>
  );
}

export default function WorkspaceGatePage() {
  const params = useParams();
  const id = String(params.id ?? "");
  const { user, loading } = useAuth();
  const router = useRouter();

  const [phase, setPhase] = useState<
    "loading" | "request" | "sent" | "error"
  >("loading");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<Info | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!id) {
      setError("ลิงก์ไม่ถูกต้อง");
      setPhase("error");
      return;
    }
    if (!user) {
      if (typeof window !== "undefined")
        localStorage.setItem(
          RETURN_KEY,
          window.location.pathname + window.location.search,
        );
      router.replace("/login");
      return;
    }
    if (typeof window !== "undefined") localStorage.removeItem(RETURN_KEY);

    const db = getSupabaseClient();
    if (!db) {
      setError("ระบบยังไม่ได้เชื่อม Supabase");
      setPhase("error");
      return;
    }
    workspaceAccessInfo(db, id)
      .then((res) => {
        if (!res) {
          setError("ไม่พบ workspace นี้");
          setPhase("error");
          return;
        }
        if (res.isMember) {
          // Already a member → open the workspace (full reload picks it up).
          if (user && typeof window !== "undefined")
            localStorage.setItem(`jaaingan:ws:${user.id}`, id);
          window.location.assign("/");
          return;
        }
        setInfo(res);
        setPhase(res.requestStatus === "pending" ? "sent" : "request");
      })
      .catch(() => {
        setError("โหลดข้อมูลไม่สำเร็จ ลองใหม่อีกครั้ง");
        setPhase("error");
      });
  }, [user, loading, id, router]);

  async function request() {
    const db = getSupabaseClient();
    if (!db) return;
    setBusy(true);
    try {
      const status = await requestWorkspaceAccess(db, id);
      if (status === "member") {
        if (user && typeof window !== "undefined")
          localStorage.setItem(`jaaingan:ws:${user.id}`, id);
        window.location.assign("/");
        return;
      }
      setPhase("sent");
    } catch {
      setError("ส่งคำขอไม่สำเร็จ ลองใหม่อีกครั้ง");
      setPhase("error");
    } finally {
      setBusy(false);
    }
  }

  if (phase === "loading" || (loading && phase !== "error")) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 py-6 text-ink-faint">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-ink" />
          <span className="text-sm">กำลังตรวจสอบสิทธิ์…</span>
        </div>
      </Shell>
    );
  }

  if (phase === "error") {
    return (
      <Shell>
        <div className="mb-3 text-4xl">🙁</div>
        <h1 className="text-lg font-semibold">เปิดไม่ได้</h1>
        <p className="mt-1 text-sm text-ink-muted">{error}</p>
        <button
          type="button"
          onClick={() => router.replace("/")}
          className="mt-5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:brightness-95"
        >
          ไปที่ JaaiNgan
        </button>
      </Shell>
    );
  }

  if (phase === "sent") {
    return (
      <Shell>
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-fill text-3xl">
          ⏳
        </div>
        <h1 className="text-lg font-semibold">ส่งคำขอแล้ว</h1>
        <p className="mt-2 text-sm text-ink-muted">
          รอเจ้าของ/ผู้ดูแลของ{" "}
          <span className="font-medium text-ink">
            {info?.icon} {info?.name}
          </span>{" "}
          อนุมัติ แล้วคุณจะเข้าใช้งานได้
        </p>
        <button
          type="button"
          onClick={() => router.replace("/")}
          className="mt-5 w-full rounded-lg border border-line px-4 py-2.5 text-sm text-ink-muted hover:bg-fill"
        >
          กลับหน้าหลัก
        </button>
      </Shell>
    );
  }

  // phase === "request"
  return (
    <Shell>
      <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-fill text-3xl">
        {info?.icon}
      </div>
      <h1 className="text-lg font-semibold">{info?.name}</h1>
      <p className="mt-1 text-sm text-ink-muted">
        คุณยังไม่ได้เป็นสมาชิกของพื้นที่ทำงานนี้
      </p>
      {info?.requestStatus === "rejected" && (
        <p className="mt-2 text-xs text-[#e03e3e]">คำขอก่อนหน้าถูกปฏิเสธ — ขอใหม่ได้</p>
      )}
      <button
        type="button"
        onClick={request}
        disabled={busy}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:brightness-95 disabled:opacity-60"
      >
        <Hand size={16} />
        {busy ? "กำลังส่งคำขอ…" : "ขอสิทธิ์เข้าถึง"}
      </button>
      <button
        type="button"
        onClick={() => router.replace("/")}
        className="mt-2 w-full rounded-lg px-4 py-2 text-sm text-ink-muted hover:bg-fill"
      >
        ไว้ทีหลัง
      </button>
    </Shell>
  );
}
