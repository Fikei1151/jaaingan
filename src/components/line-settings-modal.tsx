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
          <p className="mb-4 text-xs leading-relaxed text-ink-muted">
            ส่งการแจ้งเตือนของ workspace นี้เข้า <strong>กลุ่ม/แชต LINE</strong> ผ่าน
            Messaging API — เพิ่ม LINE OA เข้ากลุ่ม แล้ววาง destination id ด้านล่าง
          </p>

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
              Destination ID (groupId / roomId / userId)
            </label>
            <input
              value={draft.targetId ?? ""}
              onChange={(e) => setDraft({ ...draft, targetId: e.target.value })}
              placeholder="เช่น Cxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              className="w-full rounded-lg border border-line bg-bg px-3 py-2 font-mono text-sm focus:border-accent"
            />
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
              <li>คัดลอก Channel access token</li>
              <li>
                ตั้งเป็น secret:{" "}
                <code className="rounded bg-bg px-1">
                  supabase secrets set LINE_CHANNEL_ACCESS_TOKEN=…
                </code>
              </li>
              <li>
                <code className="rounded bg-bg px-1">
                  supabase functions deploy line-send
                </code>
              </li>
              <li>เพิ่มบอท (LINE OA) เข้ากลุ่ม แล้วนำ groupId มาวางด้านบน</li>
            </ol>
          </details>
        </>
      )}
    </Modal>
  );
}
