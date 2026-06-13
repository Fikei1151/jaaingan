"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getSupabaseClient } from "@/lib/supabase/client";
import { acceptInvite, invitePreview } from "@/lib/supabase/queries";

const PENDING_KEY = "jaaingan:pendingInviteToken";

type Preview = {
  workspaceId: string;
  workspaceName: string;
  workspaceIcon: string;
  role: string;
  status: string;
};

export default function InvitePage() {
  const params = useParams();
  const token = String(params.token ?? "");
  const { user, loading } = useAuth();
  const router = useRouter();

  const [phase, setPhase] = useState<"loading" | "preview" | "joining" | "error">(
    "loading",
  );
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      if (typeof window !== "undefined") localStorage.setItem(PENDING_KEY, token);
      router.replace("/login");
      return;
    }
    const db = getSupabaseClient();
    if (!db) {
      setError("ระบบยังไม่ได้เชื่อม Supabase");
      setPhase("error");
      return;
    }
    invitePreview(db, token)
      .then((p) => {
        if (!p) {
          setError("ไม่พบคำเชิญนี้");
          setPhase("error");
        } else if (p.status !== "pending") {
          setError("คำเชิญนี้ถูกใช้ไปแล้วหรือถูกยกเลิก");
          setPhase("error");
        } else {
          setPreview(p as Preview);
          setPhase("preview");
        }
      })
      .catch(() => {
        setError("เกิดข้อผิดพลาดในการโหลดคำเชิญ");
        setPhase("error");
      });
  }, [user, loading, token, router]);

  async function join() {
    if (!preview || !user) return;
    setPhase("joining");
    const db = getSupabaseClient();
    if (!db) return;
    try {
      await acceptInvite(db, token);
      if (typeof window !== "undefined") {
        localStorage.removeItem(PENDING_KEY);
        localStorage.setItem(`jaaingan:ws:${user.id}`, preview.workspaceId);
        window.location.assign("/"); // full reload so the new workspace loads
      }
    } catch {
      setError("เข้าร่วมไม่สำเร็จ ลองใหม่อีกครั้ง");
      setPhase("error");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="jn-pop-in w-full max-w-[380px] rounded-2xl border border-line bg-bg p-7 text-center shadow-[0_8px_30px_rgba(15,15,15,0.06)]">
        {phase === "loading" && (
          <div className="flex flex-col items-center gap-3 py-6 text-ink-faint">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-ink" />
            <span className="text-sm">กำลังตรวจสอบคำเชิญ…</span>
          </div>
        )}

        {phase === "error" && (
          <>
            <div className="mb-3 text-4xl">🙁</div>
            <h1 className="text-lg font-semibold">เปิดคำเชิญไม่ได้</h1>
            <p className="mt-1 text-sm text-ink-muted">{error}</p>
            <button
              type="button"
              onClick={() => router.replace("/")}
              className="mt-5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:brightness-95"
            >
              ไปที่หน้าหลัก
            </button>
          </>
        )}

        {(phase === "preview" || phase === "joining") && preview && (
          <>
            <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-fill text-3xl mx-auto">
              {preview.workspaceIcon}
            </div>
            <h1 className="text-lg font-semibold">คุณได้รับเชิญเข้าร่วม</h1>
            <p className="mt-1 text-xl font-bold">{preview.workspaceName}</p>
            <p className="mt-1 text-sm text-ink-muted">
              ในฐานะ {preview.role === "admin" ? "ผู้ดูแล" : "สมาชิก"}
            </p>
            <button
              type="button"
              onClick={join}
              disabled={phase === "joining"}
              className="mt-6 w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:brightness-95 disabled:opacity-60"
            >
              {phase === "joining" ? "กำลังเข้าร่วม…" : "เข้าร่วม workspace"}
            </button>
            <button
              type="button"
              onClick={() => router.replace("/")}
              className="mt-2 w-full rounded-lg px-4 py-2 text-sm text-ink-muted hover:bg-fill"
            >
              ไว้ทีหลัง
            </button>
          </>
        )}
      </div>
    </div>
  );
}
