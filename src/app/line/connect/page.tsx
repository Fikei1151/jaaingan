"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, MessageCircle, Plus } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  createWorkspace,
  loadLineLinksForWorkspaces,
  loadMyWorkspaces,
  upsertLineLink,
} from "@/lib/supabase/queries";
import type { Workspace } from "@/lib/types";

/** Where we stash the intended connect URL across the login redirect. */
const PENDING_KEY = "jaaingan:pendingLineConnect";

type TargetType = "group" | "room" | "user";
type LinkSummary = { targetId?: string; targetName?: string; enabled: boolean };

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

function LineConnect() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const search = useSearchParams();

  const gid = search.get("gid") ?? "";
  const targetType = ((search.get("t") as TargetType) || "group") as TargetType;
  const groupName = search.get("name") ?? "";

  const [phase, setPhase] = useState<
    "loading" | "pick" | "saving" | "done" | "error"
  >("loading");
  const [error, setError] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [links, setLinks] = useState<Record<string, LinkSummary>>({});
  const [savedWs, setSavedWs] = useState<Workspace | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const targetLabel =
    targetType === "group"
      ? "กลุ่ม LINE"
      : targetType === "room"
        ? "ห้องแชต LINE"
        : "แชต LINE";
  const displayName =
    groupName || (targetType === "group" ? "กลุ่มนี้" : "แชตนี้");

  useEffect(() => {
    if (loading) return;
    if (!gid) {
      setError("ลิงก์ไม่สมบูรณ์ — ไม่พบรหัสกลุ่ม (gid) ลองพิมพ์ “เชื่อมกลุ่ม” ในกลุ่มอีกครั้ง");
      setPhase("error");
      return;
    }
    if (!user) {
      // Stash the full URL so login can bounce us straight back here.
      if (typeof window !== "undefined")
        localStorage.setItem(
          PENDING_KEY,
          window.location.pathname + window.location.search,
        );
      router.replace("/login");
      return;
    }
    if (typeof window !== "undefined") localStorage.removeItem(PENDING_KEY);

    const db = getSupabaseClient();
    if (!db) {
      setError("ระบบยังไม่ได้เชื่อม Supabase");
      setPhase("error");
      return;
    }

    (async () => {
      try {
        const all = await loadMyWorkspaces(db, user.id);
        const manageable = all.filter(
          (w) => w.role === "owner" || w.role === "admin",
        );
        const linkMap = await loadLineLinksForWorkspaces(
          db,
          manageable.map((w) => w.id),
        ).catch(() => ({}) as Record<string, LinkSummary>);
        setWorkspaces(manageable);
        setLinks(linkMap);
        // No manageable workspace yet → still show the picker so the user can
        // create one and connect in a single step.
        if (manageable.length === 0) setCreating(true);
        setPhase("pick");
      } catch {
        setError("โหลดรายชื่อ workspace ไม่สำเร็จ ลองใหม่อีกครั้ง");
        setPhase("error");
      }
    })();
  }, [user, loading, gid, router]);

  async function connect(ws: Workspace) {
    const db = getSupabaseClient();
    if (!db) return;
    setSavedWs(ws);
    setPhase("saving");
    try {
      await upsertLineLink(db, ws.id, {
        targetType,
        targetId: gid,
        targetName: groupName || undefined,
        enabled: true,
      });
      setPhase("done");
    } catch {
      setError("เชื่อมไม่สำเร็จ ลองใหม่อีกครั้ง");
      setPhase("error");
    }
  }

  async function createAndConnect() {
    const name = newName.trim();
    if (!name || !user) return;
    const db = getSupabaseClient();
    if (!db) return;
    setPhase("saving");
    try {
      const ws = await createWorkspace(db, name, "🏠", user.id);
      await upsertLineLink(db, ws.id, {
        targetType,
        targetId: gid,
        targetName: groupName || undefined,
        enabled: true,
      });
      setSavedWs(ws);
      setPhase("done");
    } catch {
      setError("สร้าง/เชื่อมไม่สำเร็จ ลองใหม่อีกครั้ง");
      setPhase("error");
    }
  }

  if (phase === "loading" || (loading && phase !== "error")) {
    return (
      <Shell>
        <Spinner label="กำลังเตรียมการเชื่อมต่อ…" />
      </Shell>
    );
  }

  if (phase === "error") {
    return (
      <Shell>
        <div className="text-center">
          <div className="mb-3 text-4xl">🙁</div>
          <h1 className="text-lg font-semibold">เชื่อมกลุ่มไม่ได้</h1>
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

  if (phase === "done" && savedWs) {
    return (
      <Shell>
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#06C755]/10 text-3xl">
            ✅
          </div>
          <h1 className="text-lg font-semibold">เชื่อมเรียบร้อย!</h1>
          <p className="mt-2 text-sm text-ink-muted">
            <span className="font-medium text-ink">{displayName}</span> จะได้รับแจ้งเตือนงานของ
          </p>
          <p className="text-base font-bold">
            {savedWs.icon} {savedWs.name}
          </p>
          <p className="mt-3 text-xs text-ink-faint">
            ปรับว่าจะแจ้งเตือนเมื่อไหร่ได้ที่ เมนู workspace → “เชื่อมต่อ LINE”
          </p>
          <button
            type="button"
            onClick={() => router.replace("/")}
            className="mt-5 w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:brightness-95"
          >
            เปิด JaaiNgan
          </button>
        </div>
      </Shell>
    );
  }

  // phase === "pick" | "saving"
  return (
    <Shell>
      <div className="mb-5 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#06C755]/10">
          <MessageCircle size={26} className="text-[#06C755]" />
        </div>
        <h1 className="text-lg font-semibold">เชื่อม {targetLabel} กับ workspace</h1>
        <p className="mt-1 text-sm text-ink-muted">
          เลือก workspace ที่จะให้ส่งแจ้งเตือนงานเข้า{" "}
          <span className="font-medium text-ink">{displayName}</span>
        </p>
      </div>

      <div className="space-y-1.5">
        {workspaces.map((w) => {
          const link = links[w.id];
          const linkedHere = link?.targetId && link.targetId === gid;
          const linkedElse = link?.targetId && link.targetId !== gid;
          const saving = phase === "saving" && savedWs?.id === w.id;
          return (
            <button
              key={w.id}
              type="button"
              disabled={phase === "saving"}
              onClick={() => connect(w)}
              className="flex w-full items-center gap-3 rounded-xl border border-line bg-bg px-3 py-2.5 text-left transition-colors hover:border-accent hover:bg-fill disabled:opacity-60"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-fill text-lg">
                {w.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{w.name}</span>
                <span className="block truncate text-xs text-ink-faint">
                  {linkedHere
                    ? "เชื่อมกลุ่มนี้อยู่แล้ว"
                    : linkedElse
                      ? `เชื่อมกับ ${link?.targetName ?? "กลุ่มอื่น"} อยู่ — เลือกเพื่อเปลี่ยนมากลุ่มนี้`
                      : w.role === "owner"
                        ? "เจ้าของ"
                        : "ผู้ดูแล"}
                </span>
              </span>
              {saving ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-accent" />
              ) : linkedHere ? (
                <Check size={16} className="text-[#06C755]" />
              ) : null}
            </button>
          );
        })}
      </div>

      {/* create a brand-new workspace and connect this chat to it */}
      <div className="mt-3 border-t border-line pt-3">
        {creating ? (
          <div className="flex gap-2">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") createAndConnect();
              }}
              placeholder="ชื่อ workspace ใหม่"
              disabled={phase === "saving"}
              className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 py-2 text-sm focus:border-accent"
            />
            <button
              type="button"
              onClick={createAndConnect}
              disabled={phase === "saving" || !newName.trim()}
              className="shrink-0 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:brightness-95 disabled:opacity-50"
            >
              สร้าง + เชื่อม
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            disabled={phase === "saving"}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line px-3 py-2.5 text-sm text-ink-muted transition-colors hover:border-accent hover:text-ink disabled:opacity-60"
          >
            <Plus size={16} />
            สร้าง workspace ใหม่แล้วเชื่อม
          </button>
        )}
      </div>

      <p className="mt-5 break-all text-center text-[11px] text-ink-faint">
        {targetLabel} ID: {gid}
      </p>
    </Shell>
  );
}

export default function LineConnectPage() {
  return (
    <Suspense
      fallback={
        <Shell>
          <Spinner label="กำลังโหลด…" />
        </Shell>
      }
    >
      <LineConnect />
    </Suspense>
  );
}
