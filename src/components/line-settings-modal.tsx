"use client";

import { useState } from "react";
import { ExternalLink, MessageCircle, Send } from "lucide-react";
import { useData } from "@/lib/data-context";
import type { WorkspaceLineLink } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";

const TARGET_OPTIONS = [
  { value: "group", label: "กลุ่ม LINE (Group)" },
  { value: "room", label: "ห้องแชต (Room)" },
  { value: "user", label: "แชตส่วนตัว (User)" },
];

const TYPE_LABEL: Record<WorkspaceLineLink["targetType"], string> = {
  group: "กลุ่ม LINE",
  room: "ห้องแชต LINE",
  user: "แชตส่วนตัว",
};

function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className="flex w-full items-center justify-between rounded-md px-1 py-1.5 text-left text-sm transition-colors hover:bg-fill"
    >
      <span>{label}</span>
      <span
        className={cn(
          "relative h-5 w-9 rounded-full transition-colors",
          on ? "bg-accent" : "bg-line-strong",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all",
            on ? "left-[18px]" : "left-0.5",
          )}
        />
      </span>
    </button>
  );
}

export function LineSettingsModal({ onClose }: { onClose: () => void }) {
  const { lineLink, saveLineLink, sendLineTest, currentWorkspace, myRole } = useData();
  const toast = useToast();
  const canManage = myRole === "owner" || myRole === "admin";

  const [draft, setDraft] = useState<Omit<WorkspaceLineLink, "workspaceId">>({
    targetType: lineLink?.targetType ?? "group",
    targetId: lineLink?.targetId ?? "",
    notifyOnAssign: lineLink?.notifyOnAssign ?? true,
    notifyOnComment: lineLink?.notifyOnComment ?? false,
    notifyOnStatus: lineLink?.notifyOnStatus ?? false,
    dmAssignee: lineLink?.dmAssignee ?? true,
    enabled: lineLink?.enabled ?? true,
  });
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await saveLineLink(draft);
      toast.success("บันทึกการตั้งค่า LINE แล้ว");
    } catch {
      toast.error("บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setTesting(true);
    try {
      await sendLineTest();
      toast.success("ส่งข้อความทดสอบแล้ว — เช็กใน LINE");
    } catch {
      toast.error("ส่งไม่สำเร็จ — ตรวจสอบว่า deploy edge function + ตั้ง token แล้ว");
    } finally {
      setTesting(false);
    }
  }

  async function disconnect() {
    if (!window.confirm("ยกเลิกการเชื่อมกลุ่ม LINE กับ workspace นี้?")) return;
    setBusy(true);
    try {
      await saveLineLink({ targetId: undefined, targetName: undefined });
      setDraft((d) => ({ ...d, targetId: "" }));
      toast.success("ยกเลิกการเชื่อมแล้ว");
    } catch {
      toast.error("ทำรายการไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={
        <span className="flex items-center gap-2">
          <MessageCircle size={16} className="text-[#06C755]" /> เชื่อมต่อ LINE —{" "}
          {currentWorkspace?.name}
        </span>
      }
      onClose={onClose}
      width="max-w-lg"
    >
      {!canManage ? (
        <p className="text-sm text-ink-faint">
          เฉพาะเจ้าของ/ผู้ดูแลเท่านั้นที่ตั้งค่า LINE ได้
        </p>
      ) : (
        <>
          <p className="mb-3 text-xs leading-relaxed text-ink-muted">
            ส่งการแจ้งเตือนของ workspace นี้เข้า <strong>กลุ่ม/แชต LINE</strong> ผ่าน
            Messaging API
          </p>

          {/* Connection status + disconnect */}
          {lineLink?.targetId ? (
            <div className="mb-4 rounded-lg border border-[#06C755]/40 bg-[#06C755]/5 p-3">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-[#06C755]">
                    ✅ เชื่อมกลุ่มแล้ว
                  </div>
                  <div className="mt-0.5 truncate text-sm font-medium text-ink">
                    {lineLink.targetName ?? TYPE_LABEL[lineLink.targetType]}
                  </div>
                  <div className="truncate font-mono text-[11px] text-ink-faint">
                    {lineLink.targetId}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={disconnect}
                  disabled={busy}
                  className="shrink-0 rounded-md border border-line px-2.5 py-1 text-xs text-[#e03e3e] transition-colors hover:bg-[#ffe2dd] disabled:opacity-60"
                >
                  ยกเลิกการเชื่อม
                </button>
              </div>
            </div>
          ) : (
            <div className="mb-4 rounded-lg border border-line bg-fill/50 p-3 text-xs leading-relaxed text-ink-muted">
              ยังไม่ได้เชื่อมกลุ่ม — เพิ่มบอทเข้ากลุ่ม แล้วพิมพ์{" "}
              <code className="rounded bg-bg px-1">เชื่อมกลุ่ม</code> หรือ{" "}
              <code className="rounded bg-bg px-1">จ่ายงานเข้ากลุ่ม</code> ในกลุ่ม
              แล้วกดลิงก์ที่บอทส่งมา
            </div>
          )}

          {/* Connect-a-group flow (command → link) */}
          <div className="mb-4 rounded-lg border border-accent/30 bg-accent-soft/50 p-3 text-xs leading-relaxed">
            <div className="mb-1.5 font-medium text-ink">
              📋 วิธีเชื่อมกลุ่ม LINE — ไม่ต้องก๊อป ID เอง
            </div>
            <ol className="list-decimal space-y-1 pl-4 text-ink-muted">
              <li>
                เพิ่มบอท (LINE OA) เข้า<strong>กลุ่มที่ต้องการ</strong>
              </li>
              <li>
                พิมพ์ <code className="rounded bg-bg px-1">เชื่อมกลุ่ม</code> หรือ{" "}
                <code className="rounded bg-bg px-1">จ่ายงานเข้ากลุ่ม</code> ในกลุ่ม
              </li>
              <li>
                บอทส่ง<strong>ลิงก์</strong>มา → กด → เลือก{" "}
                <strong>{currentWorkspace?.name ?? "workspace นี้"}</strong> → เสร็จ ✅
              </li>
            </ol>
          </div>

          <Toggle
            on={draft.enabled}
            onChange={(v) => setDraft({ ...draft, enabled: v })}
            label="เปิดใช้งานการแจ้งเตือนเข้า LINE"
          />

          <div className="mt-3">
            <label className="mb-1 block text-xs font-medium text-ink-muted">
              ประเภทปลายทาง
            </label>
            <Select
              value={draft.targetType}
              options={TARGET_OPTIONS}
              onChange={(v) =>
                setDraft({ ...draft, targetType: v as WorkspaceLineLink["targetType"] })
              }
              panelClassName="w-[220px]"
            />
          </div>

          <div className="mt-3">
            <label className="mb-1 block text-xs font-medium text-ink-muted">
              หรือเชื่อมเอง — Destination ID (groupId / roomId / userId)
            </label>
            <input
              value={draft.targetId ?? ""}
              onChange={(e) => setDraft({ ...draft, targetId: e.target.value })}
              placeholder="เช่น Cxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              className="w-full rounded-lg border border-line bg-bg px-3 py-2 font-mono text-sm focus:border-accent"
            />
            <p className="mt-1 text-xs text-ink-faint">
              ไม่รู้ Group ID? เพิ่มบอทเข้ากลุ่ม แล้วบอทจะส่งให้ — หรือพิมพ์ “id” ในกลุ่ม
            </p>
          </div>

          <div className="mt-4 rounded-lg border border-line p-2">
            <div className="mb-1 px-1 text-xs font-medium text-ink-faint">
              ส่งแจ้งเตือนเมื่อ
            </div>
            <Toggle
              on={draft.notifyOnAssign}
              onChange={(v) => setDraft({ ...draft, notifyOnAssign: v })}
              label="📌 มอบหมายงาน"
            />
            <Toggle
              on={draft.notifyOnStatus}
              onChange={(v) => setDraft({ ...draft, notifyOnStatus: v })}
              label="🔄 เปลี่ยนสถานะงาน"
            />
            <Toggle
              on={draft.notifyOnComment}
              onChange={(v) => setDraft({ ...draft, notifyOnComment: v })}
              label="💬 มีคอมเมนต์ใหม่"
            />
          </div>

          <div className="mt-3 rounded-lg border border-line p-2">
            <div className="mb-1 px-1 text-xs font-medium text-ink-faint">
              ช่องทางส่ง
            </div>
            <Toggle
              on={draft.dmAssignee}
              onChange={(v) => setDraft({ ...draft, dmAssignee: v })}
              label="📥 ส่ง DM หาผู้รับผิดชอบโดยตรง (ถ้าผูกบัญชี LINE ไว้)"
            />
          </div>

          <div className="mt-5 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={test}
              disabled={testing}
              className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm text-ink-muted transition-colors hover:bg-fill disabled:opacity-60"
            >
              <Send size={15} />
              {testing ? "กำลังส่ง…" : "ส่งข้อความทดสอบ"}
            </button>
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:brightness-95 disabled:opacity-60"
            >
              {busy ? "กำลังบันทึก…" : "บันทึก"}
            </button>
          </div>

          <details className="mt-5 rounded-lg bg-fill/60 p-3 text-xs leading-relaxed text-ink-muted">
            <summary className="cursor-pointer font-medium text-ink">
              วิธีตั้งค่า LINE (ต้องทำครั้งเดียว)
            </summary>
            <ol className="mt-2 list-decimal space-y-1 pl-4">
              <li>
                สร้าง LINE Official Account + ช่อง Messaging API ที่{" "}
                <a
                  href="https://developers.line.biz/console/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-0.5 text-accent hover:underline"
                >
                  LINE Developers <ExternalLink size={11} />
                </a>
              </li>
              <li>
                ตั้ง secret:{" "}
                <code className="rounded bg-bg px-1">
                  supabase secrets set LINE_CHANNEL_ACCESS_TOKEN=… LINE_CHANNEL_SECRET=…
                </code>
              </li>
              <li>
                deploy:{" "}
                <code className="rounded bg-bg px-1">
                  supabase functions deploy line-send line-webhook --no-verify-jwt
                </code>
              </li>
              <li>
                ในคอนโซล LINE → Messaging API: ตั้ง <strong>Webhook URL</strong> เป็น URL
                ของ <code className="rounded bg-bg px-1">line-webhook</code>, เปิด Use webhook
                และเปิด <strong>“Allow bot to join group chats”</strong>
              </li>
              <li>
                ปิด auto-reply/greeting ของ OA (ที่ LINE Official Account Manager)
                เพื่อให้บอทตอบ Group ID ได้
              </li>
            </ol>
          </details>
        </>
      )}
    </Modal>
  );
}
