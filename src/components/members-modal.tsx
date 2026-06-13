"use client";

import { useEffect, useState } from "react";
import { Check, Crown, Link2, Mail, Trash2 } from "lucide-react";
import { useData } from "@/lib/data-context";
import type { Invite, Role } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/pills";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";

const ROLE_LABEL: Record<Role, string> = {
  owner: "เจ้าของ",
  admin: "ผู้ดูแล",
  member: "สมาชิก",
};

const ROLE_OPTIONS = [
  { value: "member", label: "สมาชิก" },
  { value: "admin", label: "ผู้ดูแล" },
];

function inviteUrl(token: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/invite/${token}`;
}

export function MembersModal({ onClose }: { onClose: () => void }) {
  const {
    members,
    myRole,
    currentUserId,
    currentWorkspace,
    inviteMember,
    revokeInvite,
    loadInvites,
    updateMemberRole,
    removeMember,
  } = useData();

  const toast = useToast();
  const canManage = myRole === "owner" || myRole === "admin";

  const [invites, setInvites] = useState<Invite[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Exclude<Role, "owner">>("member");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (canManage) loadInvites().then(setInvites).catch(() => {});
  }, [canManage, loadInvites]);

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      toast.success("คัดลอกลิงก์เชิญแล้ว");
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch {
      toast.error("คัดลอกไม่สำเร็จ");
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim()) return;
    setBusy(true);
    try {
      const invite = await inviteMember(email.trim(), role);
      setInvites((prev) => [invite, ...prev]);
      setEmail("");
      copy(inviteUrl(invite.token), invite.id);
      toast.success(`ส่งคำเชิญถึง ${invite.email} แล้ว`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "เชิญไม่สำเร็จ";
      setError(msg);
      toast.error("ส่งคำเชิญไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke(id: string) {
    await revokeInvite(id);
    setInvites((prev) => prev.filter((i) => i.id !== id));
    toast.info("ยกเลิกคำเชิญแล้ว");
  }

  return (
    <Modal
      title={
        <span className="flex items-center gap-2">
          {currentWorkspace?.icon} สมาชิกใน {currentWorkspace?.name}
        </span>
      }
      onClose={onClose}
      width="max-w-xl"
    >
      {/* Invite form */}
      {canManage && (
        <form onSubmit={handleInvite} className="mb-5">
          <label className="mb-1.5 block text-xs font-medium text-ink-muted">
            เชิญสมาชิกใหม่ด้วยอีเมล
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Mail
                size={15}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint"
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@email.com"
                className="w-full rounded-lg border border-line bg-bg py-2 pl-8 pr-2 text-sm focus:border-accent"
              />
            </div>
            <Select
              value={role}
              onChange={(v) => setRole(v as Exclude<Role, "owner">)}
              options={ROLE_OPTIONS}
              className="py-2"
              panelClassName="w-[130px]"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:brightness-95 disabled:opacity-60"
            >
              เชิญ
            </button>
          </div>
          {error && <p className="mt-2 text-xs text-[#e03e3e]">{error}</p>}
          <p className="mt-2 text-xs text-ink-faint">
            ระบบจะสร้างคำเชิญและ<strong>คัดลอกลิงก์</strong>ให้อัตโนมัติ — ส่งลิงก์ให้เพื่อน
            หรือให้เขาล็อกอินด้วยอีเมลนี้แล้วกดรับคำเชิญในแอป
          </p>
        </form>
      )}

      {/* Members list */}
      <div className="mb-4">
        <div className="mb-1.5 text-xs font-medium text-ink-muted">
          สมาชิก ({members.length})
        </div>
        <div className="divide-y divide-line rounded-lg border border-line">
          {members.map((m) => {
            const isSelf = m.userId === currentUserId;
            const canEdit = canManage && m.role !== "owner" && !isSelf;
            return (
              <div key={m.userId} className="flex items-center gap-3 px-3 py-2">
                <Avatar name={m.name} src={m.avatarUrl} size={30} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    <span className="truncate">{m.name}</span>
                    {isSelf && <span className="text-xs text-ink-faint">(คุณ)</span>}
                    {m.role === "owner" && (
                      <Crown size={13} className="text-[#dfab01]" />
                    )}
                  </div>
                  <div className="truncate text-xs text-ink-faint">{m.email}</div>
                </div>
                {canEdit ? (
                  <>
                    <Select
                      value={m.role}
                      onChange={(v) =>
                        updateMemberRole(m.userId, v as Role)
                          .then(() => toast.success("อัปเดตบทบาทแล้ว"))
                          .catch(() => toast.error("เปลี่ยนบทบาทไม่สำเร็จ"))
                      }
                      options={ROLE_OPTIONS}
                      align="right"
                      panelClassName="w-[130px]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`นำ ${m.name} ออกจาก workspace?`))
                          removeMember(m.userId)
                            .then(() => toast.info(`นำ ${m.name} ออกแล้ว`))
                            .catch(() => toast.error("นำออกไม่สำเร็จ"));
                      }}
                      className="rounded p-1 text-ink-faint hover:bg-[#ffe2dd] hover:text-[#e03e3e]"
                      title="นำออก"
                    >
                      <Trash2 size={15} />
                    </button>
                  </>
                ) : (
                  <span className="text-xs text-ink-muted">{ROLE_LABEL[m.role]}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Pending invites */}
      {canManage && invites.length > 0 && (
        <div>
          <div className="mb-1.5 text-xs font-medium text-ink-muted">
            คำเชิญที่รอตอบรับ ({invites.length})
          </div>
          <div className="divide-y divide-line rounded-lg border border-line">
            {invites.map((inv) => (
              <div key={inv.id} className="flex items-center gap-2 px-3 py-2">
                <Mail size={15} className="shrink-0 text-ink-faint" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{inv.email}</div>
                  <div className="text-xs text-ink-faint">{ROLE_LABEL[inv.role]}</div>
                </div>
                <button
                  type="button"
                  onClick={() => copy(inviteUrl(inv.token), inv.id)}
                  className={cn(
                    "flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs transition-colors hover:bg-fill",
                    copied === inv.id && "text-[#448361]",
                  )}
                  title="คัดลอกลิงก์เชิญ"
                >
                  {copied === inv.id ? <Check size={13} /> : <Link2 size={13} />}
                  {copied === inv.id ? "คัดลอกแล้ว" : "ลิงก์"}
                </button>
                <button
                  type="button"
                  onClick={() => handleRevoke(inv.id)}
                  className="rounded p-1 text-ink-faint hover:bg-[#ffe2dd] hover:text-[#e03e3e]"
                  title="ยกเลิกคำเชิญ"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {!canManage && (
        <p className="text-xs text-ink-faint">
          เฉพาะเจ้าของ/ผู้ดูแลเท่านั้นที่เชิญหรือจัดการสมาชิกได้
        </p>
      )}
    </Modal>
  );
}
