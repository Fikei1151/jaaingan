"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Hand } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { getSupabaseClient } from "@/lib/supabase/client";
import { loadTaskForLine, updateTaskRow } from "@/lib/supabase/queries";
import type { Task } from "@/lib/types";

/** Generic "where to go after login" key (shared with /line/connect). */
const RETURN_KEY = "jaaingan:pendingLineConnect";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="jn-pop-in w-full max-w-[420px] rounded-2xl border border-line bg-bg p-7 shadow-[0_8px_30px_rgba(15,15,15,0.06)]">
        {children}
      </div>
    </div>
  );
}

function Spinner({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-ink-faint">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-ink" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

function LineTask() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const search = useSearchParams();

  const taskId = search.get("t") ?? "";
  const hint = search.get("a"); // "take" | "done" — which action to emphasize

  const [phase, setPhase] = useState<
    "loading" | "view" | "saving" | "done" | "error"
  >("loading");
  const [error, setError] = useState<string | null>(null);
  const [task, setTask] = useState<Task | null>(null);
  const [projectName, setProjectName] = useState<string | undefined>();
  const [assigneeName, setAssigneeName] = useState<string | undefined>();
  const [didAction, setDidAction] = useState<"take" | "done" | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!taskId) {
      setError("ลิงก์ไม่สมบูรณ์ — ไม่พบรหัสงาน");
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
    loadTaskForLine(db, taskId)
      .then((res) => {
        if (!res) {
          setError("ไม่พบงานนี้ หรือคุณไม่ได้อยู่ใน workspace ของงานนี้");
          setPhase("error");
          return;
        }
        setTask(res.task);
        setProjectName(res.projectName);
        setAssigneeName(res.assigneeName);
        setPhase("view");
      })
      .catch(() => {
        setError("โหลดงานไม่สำเร็จ ลองใหม่อีกครั้ง");
        setPhase("error");
      });
  }, [user, loading, taskId, router]);

  async function act(action: "take" | "done") {
    if (!task || !user) return;
    const db = getSupabaseClient();
    if (!db) return;
    setPhase("saving");
    setDidAction(action);
    try {
      await updateTaskRow(
        db,
        task.id,
        action === "take" ? { assigneeId: user.id } : { status: "done" },
      );
      setPhase("done");
    } catch {
      setError("ทำรายการไม่สำเร็จ — อาจไม่มีสิทธิ์ในงานนี้");
      setPhase("error");
    }
  }

  if (phase === "loading" || (loading && phase !== "error")) {
    return (
      <Shell>
        <Spinner label="กำลังโหลดงาน…" />
      </Shell>
    );
  }

  if (phase === "error") {
    return (
      <Shell>
        <div className="text-center">
          <div className="mb-3 text-4xl">🙁</div>
          <h1 className="text-lg font-semibold">เปิดงานไม่ได้</h1>
          <p className="mt-1 text-sm text-ink-muted">{error}</p>
          <button
            type="button"
            onClick={() => router.replace("/")}
            className="mt-5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:brightness-95"
          >
            ไปที่ JaaiNgan
          </button>
        </div>
      </Shell>
    );
  }

  if (phase === "done") {
    return (
      <Shell>
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#06C755]/10 text-3xl">
            {didAction === "done" ? "🏁" : "✅"}
          </div>
          <h1 className="text-lg font-semibold">
            {didAction === "done" ? "ทำเครื่องหมายว่าเสร็จแล้ว" : "รับงานเรียบร้อย!"}
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            {didAction === "done" ? (
              <>
                <span className="font-medium text-ink">{task?.title}</span> เสร็จสิ้น 🎉
              </>
            ) : (
              <>
                <span className="font-medium text-ink">{user?.name}</span> รับผิดชอบ{" "}
                <span className="font-medium text-ink">{task?.title}</span> แล้ว
              </>
            )}
          </p>
          <button
            type="button"
            onClick={() => router.replace("/")}
            className="mt-5 w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:brightness-95"
          >
            เปิดใน JaaiNgan
          </button>
        </div>
      </Shell>
    );
  }

  // phase === "view" | "saving"
  const saving = phase === "saving";
  const takePrimary = hint !== "done";
  return (
    <Shell>
      <div className="mb-4">
        <div className="text-xs font-medium text-ink-faint">
          {projectName ? `📁 ${projectName}` : "งาน"}
        </div>
        <h1 className="mt-1 text-xl font-bold leading-snug">{task?.title}</h1>
        <p className="mt-2 text-sm text-ink-muted">
          {assigneeName
            ? `ตอนนี้รับผิดชอบโดย: ${assigneeName}`
            : "ยังไม่มีคนรับผิดชอบ"}
        </p>
      </div>

      <div className="rounded-lg border border-line bg-fill/40 p-3 text-xs text-ink-muted">
        คุณกำลังทำรายการในชื่อ{" "}
        <span className="font-medium text-ink">{user?.name}</span>
      </div>

      <div className="mt-4 space-y-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => act("take")}
          className={
            "flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-60 " +
            (takePrimary
              ? "bg-[#06C755] text-white hover:brightness-95"
              : "border border-line text-ink hover:bg-fill")
          }
        >
          <Hand size={16} />
          {saving && didAction === "take" ? "กำลังรับงาน…" : "รับงานนี้"}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => act("done")}
          className={
            "flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-60 " +
            (!takePrimary
              ? "bg-[#06C755] text-white hover:brightness-95"
              : "border border-line text-ink hover:bg-fill")
          }
        >
          <CheckCircle2 size={16} />
          {saving && didAction === "done" ? "กำลังบันทึก…" : "ทำเสร็จแล้ว"}
        </button>
      </div>
    </Shell>
  );
}

export default function LineTaskPage() {
  return (
    <Suspense
      fallback={
        <Shell>
          <Spinner label="กำลังโหลด…" />
        </Shell>
      }
    >
      <LineTask />
    </Suspense>
  );
}
