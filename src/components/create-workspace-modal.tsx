"use client";

import { useState } from "react";
import { useData } from "@/lib/data-context";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

const WS_ICONS = ["🏢", "🏠", "🚀", "🎯", "💼", "🧩", "🌱", "⭐", "🔥", "🎨", "📦", "🛠️"];

export function CreateWorkspaceModal({ onClose }: { onClose: () => void }) {
  const { createWorkspace } = useData();
  const toast = useToast();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("🏢");
  const [busy, setBusy] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await createWorkspace(name, icon);
      toast.success(`สร้าง workspace “${name.trim() || "พื้นที่ทำงานใหม่"}” แล้ว`);
      onClose();
    } catch {
      toast.error("สร้าง workspace ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="สร้าง workspace ใหม่" onClose={onClose} width="max-w-md">
      <form onSubmit={handleCreate}>
        <label className="mb-1.5 block text-xs font-medium text-ink-muted">ไอคอน</label>
        <div className="mb-4 flex flex-wrap gap-1">
          {WS_ICONS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setIcon(e)}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg text-xl transition-colors hover:bg-fill",
                icon === e && "bg-accent-soft ring-1 ring-accent",
              )}
            >
              {e}
            </button>
          ))}
        </div>

        <label className="mb-1.5 block text-xs font-medium text-ink-muted">
          ชื่อ workspace
        </label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="เช่น ทีมการตลาด, บริษัทของฉัน"
          className="mb-5 w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm focus:border-accent"
        />

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm text-ink-muted hover:bg-fill"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:brightness-95 disabled:opacity-60"
          >
            {busy ? "กำลังสร้าง…" : "สร้าง"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
