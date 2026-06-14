"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, Camera, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useData } from "@/lib/data-context";
import { getSupabaseClient } from "@/lib/supabase/client";
import { uploadAvatar } from "@/lib/supabase/queries";
import {
  isPushConfigured,
  isPushSubscribed,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push";
import { Avatar } from "@/components/ui/pills";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

export function ProfileModal({ onClose }: { onClose: () => void }) {
  const { user, isLive, updateProfile, changePassword } = useAuth();
  const { refreshMembers } = useData();
  const toast = useToast();

  const [name, setName] = useState(user?.name ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl);
  const [uploading, setUploading] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const pushAvailable = isPushConfigured();
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!pushAvailable) return;
    isPushSubscribed()
      .then(setPushOn)
      .catch(() => {});
  }, [pushAvailable]);

  async function togglePush() {
    if (!user) return;
    setPushBusy(true);
    try {
      if (pushOn) {
        await unsubscribeFromPush();
        setPushOn(false);
        toast.success("ปิดการแจ้งเตือนแล้ว");
      } else {
        await subscribeToPush(user.id);
        setPushOn(true);
        toast.success("เปิดการแจ้งเตือนบนอุปกรณ์นี้แล้ว");
      }
    } catch {
      toast.error("ตั้งค่าการแจ้งเตือนไม่สำเร็จ");
    } finally {
      setPushBusy(false);
    }
  }

  async function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    if (!isLive) {
      toast.error("อัปโหลดรูปได้เมื่อเชื่อม Supabase");
      return;
    }
    setUploading(true);
    try {
      const db = getSupabaseClient()!;
      const url = await uploadAvatar(db, file, user.id);
      await updateProfile({ avatarUrl: url });
      setAvatarUrl(url);
      await refreshMembers();
      toast.success("อัปเดตรูปโปรไฟล์แล้ว");
    } catch {
      toast.error("อัปโหลดรูปไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  }

  async function saveName() {
    if (!name.trim()) return;
    setSavingName(true);
    try {
      await updateProfile({ name: name.trim() });
      await refreshMembers();
      toast.success("บันทึกชื่อแล้ว");
    } catch {
      toast.error("บันทึกไม่สำเร็จ");
    } finally {
      setSavingName(false);
    }
  }

  async function savePassword() {
    if (pw.length < 6) {
      toast.error("รหัสผ่านอย่างน้อย 6 ตัว");
      return;
    }
    if (pw !== pw2) {
      toast.error("รหัสผ่านไม่ตรงกัน");
      return;
    }
    setSavingPw(true);
    try {
      await changePassword(pw);
      setPw("");
      setPw2("");
      toast.success("เปลี่ยนรหัสผ่านแล้ว");
    } catch {
      toast.error("เปลี่ยนรหัสผ่านไม่สำเร็จ");
    } finally {
      setSavingPw(false);
    }
  }

  return (
    <Modal title="โปรไฟล์ของฉัน" onClose={onClose} width="max-w-md">
      {/* avatar */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <Avatar name={name || user?.name || "U"} src={avatarUrl} size={64} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border border-line bg-bg text-ink-muted shadow-sm transition-colors hover:bg-fill"
            title="เปลี่ยนรูป"
          >
            {uploading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Camera size={14} />
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={onPickAvatar}
          />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{user?.name}</div>
          <div className="truncate text-xs text-ink-faint">{user?.email}</div>
        </div>
      </div>

      {/* display name */}
      <div className="mt-5">
        <label className="mb-1 block text-xs font-medium text-ink-muted">
          ชื่อที่แสดง
        </label>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 rounded-lg border border-line bg-bg px-3 py-2 text-sm focus:border-accent"
          />
          <button
            type="button"
            onClick={saveName}
            disabled={savingName || !name.trim() || name.trim() === user?.name}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:brightness-95 disabled:opacity-50"
          >
            บันทึก
          </button>
        </div>
      </div>

      {/* change password */}
      {isLive && (
        <div className="mt-5 border-t border-line pt-4">
          <label className="mb-1 block text-xs font-medium text-ink-muted">
            เปลี่ยนรหัสผ่าน
          </label>
          <div className="space-y-2">
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="รหัสผ่านใหม่ (อย่างน้อย 6 ตัว)"
              autoComplete="new-password"
              className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm focus:border-accent"
            />
            <input
              type="password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              placeholder="ยืนยันรหัสผ่านใหม่"
              autoComplete="new-password"
              className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm focus:border-accent"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={savePassword}
                disabled={savingPw || !pw}
                className="rounded-lg border border-line px-4 py-2 text-sm text-ink-muted transition-colors hover:bg-fill disabled:opacity-50"
              >
                {savingPw ? "กำลังเปลี่ยน…" : "เปลี่ยนรหัสผ่าน"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* push notifications (shown only when VAPID is configured) */}
      {pushAvailable && (
        <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
          <div className="flex items-start gap-2">
            <Bell size={16} className="mt-0.5 text-ink-muted" />
            <div>
              <div className="text-sm font-medium">แจ้งเตือนแบบ Push</div>
              <div className="text-xs text-ink-faint">
                รับแจ้งเตือนบนอุปกรณ์นี้แม้ไม่ได้เปิดแอป
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={togglePush}
            disabled={pushBusy}
            role="switch"
            aria-checked={pushOn}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
              pushOn ? "bg-accent" : "bg-line"
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${
                pushOn ? "left-[22px]" : "left-0.5"
              }`}
            />
          </button>
        </div>
      )}
    </Modal>
  );
}
