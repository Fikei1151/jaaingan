"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlignLeft,
  Calendar,
  CheckSquare,
  CircleDashed,
  Flag,
  Link2,
  ListChecks,
  Loader2,
  MessageSquare,
  Paperclip,
  Plus,
  Tag as TagIcon,
  Trash2,
  Upload,
  User,
  X,
} from "lucide-react";
import { useData } from "@/lib/data-context";
import { PRIORITY_ORDER, STATUS_CONFIG, STATUS_ORDER, PRIORITY_CONFIG } from "@/lib/constants";
import type { Activity, Attachment, Comment, PriorityKey, StatusKey, Task } from "@/lib/types";
import { cn, timeAgo } from "@/lib/utils";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  deleteAttachment,
  insertLinkAttachment,
  loadAttachments,
  mapComment,
  signAttachmentUrls,
  uploadAttachment,
} from "@/lib/supabase/queries";
import { Avatar, PriorityPill, StatusPill, TagPill } from "@/components/ui/pills";
import { MenuItem, Popover } from "@/components/ui/popover";
import { DatePicker } from "@/components/ui/date-picker";
import { useToast } from "@/components/ui/toast";

export function TaskModal({ task, onClose }: { task: Task; onClose: () => void }) {
  const {
    updateTask,
    deleteTask,
    projects,
    members,
    memberById,
    isLive,
    currentUserId,
    currentWorkspaceId,
    subtasksFor,
    addSubtask,
    toggleSubtask,
    renameSubtask,
    deleteSubtask,
    loadThread,
    addComment,
    deleteComment,
  } = useData();
  const project = projects.find((p) => p.id === task.projectId);
  const assignee = memberById(task.assigneeId);

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);

  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description);
  }, [task.id, task.title, task.description]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const subtasks = subtasksFor(task.id);
  const doneCount = subtasks.filter((s) => s.done).length;

  return (
    <div
      className="jn-fade-in fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-overlay px-4 py-10"
      onMouseDown={onClose}
    >
      <div
        className="jn-pop-in relative w-full max-w-[720px] rounded-xl border border-line bg-bg shadow-[0_24px_60px_rgba(15,15,15,0.22)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-1.5 text-xs text-ink-muted">
            <span>{project?.icon}</span>
            <span className="truncate">{project?.name}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                if (window.confirm("ลบงานนี้?")) {
                  deleteTask(task.id);
                  onClose();
                }
              }}
              title="ลบงาน"
              className="rounded-md p-1.5 text-ink-muted transition-colors hover:bg-[#ffe2dd] hover:text-[#e03e3e]"
            >
              <Trash2 size={16} />
            </button>
            <button
              type="button"
              onClick={onClose}
              title="ปิด"
              className="rounded-md p-1.5 text-ink-muted transition-colors hover:bg-fill hover:text-ink"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="max-h-[80vh] overflow-y-auto px-4 pb-8 pt-6 sm:px-10">
          <TextArea
            value={title}
            onChange={setTitle}
            onCommit={(v) => v !== task.title && updateTask(task.id, { title: v })}
            placeholder="ไม่มีชื่องาน"
            className="mb-4 w-full resize-none text-2xl font-bold leading-snug placeholder:text-ink-faint"
          />

          {/* properties */}
          <div className="space-y-1.5">
            <PropertyRow icon={<CircleDashed size={15} />} label="สถานะ">
              <Popover
                panelClassName="w-[180px]"
                trigger={({ toggle }) => (
                  <button
                    type="button"
                    onClick={toggle}
                    className="rounded-md px-1.5 py-1 transition-colors hover:bg-fill"
                  >
                    <StatusPill status={task.status} />
                  </button>
                )}
              >
                {({ close }) => (
                  <div>
                    {STATUS_ORDER.map((key) => (
                      <MenuItem
                        key={key}
                        active={task.status === key}
                        onClick={() => {
                          updateTask(task.id, { status: key as StatusKey });
                          close();
                        }}
                      >
                        <StatusPill status={key} />
                      </MenuItem>
                    ))}
                  </div>
                )}
              </Popover>
            </PropertyRow>

            <PropertyRow icon={<Flag size={15} />} label="ความสำคัญ">
              <Popover
                panelClassName="w-[180px]"
                trigger={({ toggle }) => (
                  <button
                    type="button"
                    onClick={toggle}
                    className="rounded-md px-1.5 py-1 transition-colors hover:bg-fill"
                  >
                    <PriorityPill priority={task.priority} />
                  </button>
                )}
              >
                {({ close }) => (
                  <div>
                    {PRIORITY_ORDER.map((key) => (
                      <MenuItem
                        key={key}
                        active={task.priority === key}
                        onClick={() => {
                          updateTask(task.id, { priority: key as PriorityKey });
                          close();
                        }}
                      >
                        <PriorityPill priority={key} />
                      </MenuItem>
                    ))}
                  </div>
                )}
              </Popover>
            </PropertyRow>

            <PropertyRow icon={<User size={15} />} label="ผู้รับผิดชอบ">
              <Popover
                panelClassName="w-[220px]"
                trigger={({ toggle }) => (
                  <button
                    type="button"
                    onClick={toggle}
                    className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm transition-colors hover:bg-fill"
                  >
                    {assignee ? (
                      <>
                        <Avatar name={assignee.name} src={assignee.avatarUrl} size={20} />
                        <span>{assignee.name}</span>
                      </>
                    ) : (
                      <span className="text-ink-faint">ยังไม่มอบหมาย</span>
                    )}
                  </button>
                )}
              >
                {({ close }) => (
                  <div className="max-h-[260px] overflow-y-auto">
                    <MenuItem
                      active={!task.assigneeId}
                      onClick={() => {
                        updateTask(task.id, { assigneeId: undefined });
                        close();
                      }}
                    >
                      <span className="text-ink-faint">ไม่มอบหมาย</span>
                    </MenuItem>
                    {members.map((m) => (
                      <MenuItem
                        key={m.userId}
                        active={task.assigneeId === m.userId}
                        onClick={() => {
                          updateTask(task.id, { assigneeId: m.userId });
                          close();
                        }}
                      >
                        <Avatar name={m.name} src={m.avatarUrl} size={20} />
                        <span className="min-w-0 flex-1 truncate">{m.name}</span>
                      </MenuItem>
                    ))}
                  </div>
                )}
              </Popover>
            </PropertyRow>

            <PropertyRow icon={<Calendar size={15} />} label="กำหนดส่ง">
              <DatePicker
                value={task.dueDate}
                onChange={(iso) => updateTask(task.id, { dueDate: iso })}
                placeholder="กำหนดวันที่"
              />
            </PropertyRow>

            <PropertyRow icon={<TagIcon size={15} />} label="แท็ก" alignTop>
              <TagEditor
                tags={task.tags}
                onChange={(tags) => updateTask(task.id, { tags })}
              />
            </PropertyRow>
          </div>

          {/* description */}
          <Section icon={<AlignLeft size={14} />} label="รายละเอียด">
            <TextArea
              value={description}
              onChange={setDescription}
              onCommit={(v) =>
                v !== task.description && updateTask(task.id, { description: v })
              }
              placeholder="เพิ่มรายละเอียดงาน เขียนโน้ต หรือเช็กลิสต์ที่นี่…"
              className="min-h-[80px] w-full resize-none text-sm leading-relaxed placeholder:text-ink-faint"
            />
          </Section>

          {/* subtasks */}
          <Section
            icon={<ListChecks size={14} />}
            label={`งานย่อย${subtasks.length ? ` · ${doneCount}/${subtasks.length}` : ""}`}
          >
            {subtasks.length > 0 && (
              <div className="mb-2 h-1 overflow-hidden rounded-full bg-fill">
                <div
                  className="h-full bg-[#448361] transition-all"
                  style={{ width: `${(doneCount / subtasks.length) * 100}%` }}
                />
              </div>
            )}
            <div className="space-y-0.5">
              {subtasks.map((st) => (
                <div key={st.id} className="group/st flex items-center gap-2 rounded-md px-1 py-0.5 hover:bg-fill">
                  <button
                    type="button"
                    onClick={() => toggleSubtask(st.id, !st.done)}
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                      st.done ? "border-[#448361] bg-[#448361] text-white" : "border-line-strong",
                    )}
                  >
                    {st.done && <CheckSquare size={11} />}
                  </button>
                  <input
                    defaultValue={st.title}
                    onBlur={(e) =>
                      e.target.value !== st.title && renameSubtask(st.id, e.target.value)
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    }}
                    className={cn(
                      "min-w-0 flex-1 bg-transparent text-sm",
                      st.done && "text-ink-faint line-through",
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => deleteSubtask(st.id)}
                    className="rounded p-0.5 text-ink-faint opacity-0 hover:bg-fill hover:text-[#e03e3e] group-hover/st:opacity-100"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
            <SubtaskAdder onAdd={(title) => addSubtask(task.id, title)} />
          </Section>

          {/* attachments */}
          <AttachmentsSection
            taskId={task.id}
            workspaceId={currentWorkspaceId}
            uploaderId={currentUserId}
            isLive={isLive}
          />

          {/* comments + activity */}
          <ThreadSection
            taskId={task.id}
            isLive={isLive}
            currentUserId={currentUserId}
            loadThread={loadThread}
            addComment={addComment}
            deleteComment={deleteComment}
            memberName={(id) => memberById(id)?.name ?? "ผู้ใช้"}
            memberAvatar={(id) => memberById(id)}
          />
        </div>
      </div>
    </div>
  );
}

function PropertyRow({
  icon,
  label,
  children,
  alignTop = false,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  alignTop?: boolean;
}) {
  return (
    <div className={cn("flex gap-2", alignTop ? "items-start" : "items-center")}>
      <div
        className={cn(
          "flex w-28 shrink-0 items-center gap-2 px-1.5 text-sm text-ink-muted sm:w-[140px]",
          alignTop && "pt-1.5",
        )}
      >
        <span className="text-ink-faint">{icon}</span>
        {label}
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function Section({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-6 border-t border-line pt-5">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-ink-faint">
        {icon}
        {label}
      </div>
      {children}
    </div>
  );
}

function formatSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function AttachmentsSection({
  taskId,
  workspaceId,
  uploaderId,
  isLive,
}: {
  taskId: string;
  workspaceId: string | null;
  uploaderId: string | null;
  isLive: boolean;
}) {
  const toast = useToast();
  const { refreshTaskImages } = useData();
  const [items, setItems] = useState<Attachment[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [addingLink, setAddingLink] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isLive) return;
    const db = getSupabaseClient();
    if (!db) return;
    let active = true;
    loadAttachments(db, taskId).then(async (atts) => {
      if (!active) return;
      setItems(atts);
      const map = await signAttachmentUrls(db, atts.map((a) => a.path)).catch(() => ({}));
      if (active) setUrls(map);
    });
    return () => {
      active = false;
    };
  }, [taskId, isLive]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    e.target.value = "";
    if (!files?.length || !workspaceId || !uploaderId) return;
    const db = getSupabaseClient();
    if (!db) return;
    setUploading(true);
    let addedImage = false;
    try {
      for (const f of Array.from(files)) {
        const att = await uploadAttachment(db, f, taskId, workspaceId, uploaderId);
        setItems((prev) => [...prev, att]);
        const m = await signAttachmentUrls(db, [att.path]);
        setUrls((prev) => ({ ...prev, ...m }));
        if ((att.mime ?? "").startsWith("image/")) addedImage = true;
      }
      if (addedImage) refreshTaskImages().catch(() => {});
    } catch (err) {
      console.error("[JaaiNgan] upload failed:", err);
      toast.error(
        "อัปโหลดไฟล์ไม่สำเร็จ" +
          (err instanceof Error && err.message ? `: ${err.message}` : ""),
      );
    } finally {
      setUploading(false);
    }
  }

  async function addLink() {
    let url = linkUrl.trim();
    if (!url || !workspaceId || !uploaderId) return;
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    const db = getSupabaseClient();
    if (!db) return;
    try {
      const name = url.replace(/^https?:\/\//, "").replace(/\/+$/, "").slice(0, 60);
      const att = await insertLinkAttachment(db, taskId, workspaceId, uploaderId, url, name);
      setItems((prev) => [...prev, att]);
      setLinkUrl("");
      setAddingLink(false);
    } catch {
      toast.error("เพิ่มลิงค์ไม่สำเร็จ");
    }
  }

  async function remove(att: Attachment) {
    const db = getSupabaseClient();
    if (!db) return;
    setItems((prev) => prev.filter((x) => x.id !== att.id));
    try {
      await deleteAttachment(db, att);
      if ((att.mime ?? "").startsWith("image/")) refreshTaskImages().catch(() => {});
    } catch {
      toast.error("ลบไฟล์ไม่สำเร็จ");
    }
  }

  if (!isLive) {
    return (
      <Section icon={<Paperclip size={14} />} label="ไฟล์แนบ">
        <p className="text-xs text-ink-faint">แนบไฟล์ได้เมื่อเชื่อม Supabase</p>
      </Section>
    );
  }

  return (
    <Section
      icon={<Paperclip size={14} />}
      label={`ไฟล์แนบ${items.length ? ` · ${items.length}` : ""}`}
    >
      <div className="space-y-1.5">
        {items.map((att) => {
          const isLink = att.mime === "link";
          const isImage = (att.mime ?? "").startsWith("image/");
          const url = isLink ? att.path : urls[att.path];
          return (
            <div
              key={att.id}
              className="group/att flex items-center gap-2 rounded-md border border-line p-1.5"
            >
              {isImage && url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt={att.name} className="h-9 w-9 shrink-0 rounded object-cover" />
              ) : (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-fill text-ink-faint">
                  {isLink ? <Link2 size={15} /> : <Paperclip size={15} />}
                </div>
              )}
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1"
              >
                <div className="truncate text-sm text-ink">{att.name}</div>
                <div className="truncate text-xs text-ink-faint">
                  {isLink ? att.path : formatSize(att.size)}
                </div>
              </a>
              <button
                type="button"
                onClick={() => remove(att)}
                className="rounded p-1 text-ink-faint opacity-0 transition-opacity hover:bg-fill hover:text-[#e03e3e] group-hover/att:opacity-100"
                title="ลบไฟล์"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-dashed border-line px-2 py-2 text-sm text-ink-faint transition-colors hover:bg-fill disabled:opacity-60"
        >
          {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
          {uploading ? "กำลังอัปโหลด…" : "อัปโหลดไฟล์"}
        </button>
        <button
          type="button"
          onClick={() => setAddingLink((v) => !v)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-dashed border-line px-2 py-2 text-sm text-ink-faint transition-colors hover:bg-fill"
        >
          <Link2 size={15} />
          เพิ่มลิงค์
        </button>
      </div>
      {addingLink && (
        <div className="mt-2 flex gap-2">
          <input
            autoFocus
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addLink();
            }}
            placeholder="วางลิงค์ (https://…)"
            className="min-w-0 flex-1 rounded-md border border-line bg-bg px-2 py-1.5 text-sm focus:border-accent"
          />
          <button
            type="button"
            onClick={addLink}
            disabled={!linkUrl.trim()}
            className="shrink-0 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:brightness-95 disabled:opacity-50"
          >
            เพิ่ม
          </button>
        </div>
      )}
      <input ref={fileRef} type="file" multiple className="hidden" onChange={onPick} />
    </Section>
  );
}

function SubtaskAdder({ onAdd }: { onAdd: (title: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <div className="mt-1 flex items-center gap-2 px-1">
      <Plus size={14} className="text-ink-faint" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && value.trim()) {
            onAdd(value);
            setValue("");
          }
        }}
        placeholder="เพิ่มงานย่อย แล้วกด Enter"
        className="flex-1 bg-transparent py-0.5 text-sm placeholder:text-ink-faint"
      />
    </div>
  );
}

function ThreadSection({
  taskId,
  isLive,
  currentUserId,
  loadThread,
  addComment,
  deleteComment,
  memberName,
  memberAvatar,
}: {
  taskId: string;
  isLive: boolean;
  currentUserId: string | null;
  loadThread: (id: string) => Promise<{ comments: Comment[]; activities: Activity[] }>;
  addComment: (id: string, body: string) => Promise<Comment | null>;
  deleteComment: (id: string) => Promise<void>;
  memberName: (id?: string) => string;
  memberAvatar: (id?: string) => { name: string; avatarUrl?: string } | undefined;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    if (isLive) {
      loadThread(taskId).then((t) => {
        if (!active) return;
        setComments(t.comments);
        setActivities(t.activities);
      });
    }
    return () => {
      active = false;
    };
  }, [taskId, isLive, loadThread]);

  // Live comments across devices.
  useEffect(() => {
    if (!isLive) return;
    const db = getSupabaseClient();
    if (!db) return;
    const ch = db
      .channel(`comments-${taskId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "comments", filter: `task_id=eq.${taskId}` },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (p: any) => {
          const c = mapComment(p.new);
          setComments((prev) => (prev.some((x) => x.id === c.id) ? prev : [...prev, c]));
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "comments", filter: `task_id=eq.${taskId}` },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (p: any) => {
          setComments((prev) => prev.filter((x) => x.id !== p.old?.id));
        },
      )
      .subscribe();
    return () => {
      db.removeChannel(ch);
    };
  }, [taskId, isLive]);

  async function submit() {
    if (!draft.trim()) return;
    setBusy(true);
    try {
      const c = await addComment(taskId, draft);
      if (c) setComments((prev) => [...prev, c]);
      setDraft("");
    } finally {
      setBusy(false);
    }
  }

  if (!isLive) {
    return (
      <Section icon={<MessageSquare size={14} />} label="คอมเมนต์ & กิจกรรม">
        <p className="text-xs text-ink-faint">
          คอมเมนต์และประวัติกิจกรรมใช้ได้เมื่อเชื่อม Supabase (โหมดทีม)
        </p>
      </Section>
    );
  }

  return (
    <Section icon={<MessageSquare size={14} />} label="คอมเมนต์ & กิจกรรม">
      {/* comment composer */}
      <div className="mb-3 flex items-start gap-2">
        <Avatar name={memberAvatar(currentUserId ?? undefined)?.name ?? "ฉัน"} src={memberAvatar(currentUserId ?? undefined)?.avatarUrl} size={26} />
        <div className="flex-1">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
            }}
            placeholder="เขียนคอมเมนต์… (⌘/Ctrl + Enter เพื่อส่ง)"
            rows={2}
            className="w-full resize-none rounded-lg border border-line bg-bg px-2.5 py-1.5 text-sm focus:border-accent"
          />
          {draft.trim() && (
            <div className="mt-1 flex justify-end">
              <button
                type="button"
                onClick={submit}
                disabled={busy}
                className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-white hover:brightness-95 disabled:opacity-60"
              >
                ส่ง
              </button>
            </div>
          )}
        </div>
      </div>

      {/* comments */}
      <div className="space-y-3">
        {comments.map((c) => (
          <div key={c.id} className="group/c flex items-start gap-2">
            <Avatar name={memberAvatar(c.authorId)?.name ?? "ผู้ใช้"} src={memberAvatar(c.authorId)?.avatarUrl} size={26} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{memberName(c.authorId)}</span>
                <span className="text-xs text-ink-faint">{timeAgo(c.createdAt)}</span>
                {c.authorId === currentUserId && (
                  <button
                    type="button"
                    onClick={() => {
                      deleteComment(c.id);
                      setComments((prev) => prev.filter((x) => x.id !== c.id));
                    }}
                    className="text-xs text-ink-faint opacity-0 hover:text-[#e03e3e] group-hover/c:opacity-100"
                  >
                    ลบ
                  </button>
                )}
              </div>
              <p className="whitespace-pre-wrap text-sm text-ink">{c.body}</p>
            </div>
          </div>
        ))}
        {comments.length === 0 && (
          <p className="text-xs text-ink-faint">ยังไม่มีคอมเมนต์</p>
        )}
      </div>

      {/* activity log */}
      {activities.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 text-xs font-medium text-ink-faint">ประวัติกิจกรรม</div>
          <div className="space-y-1.5">
            {activities.map((a) => (
              <div key={a.id} className="flex items-center gap-2 text-xs text-ink-muted">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-line-strong" />
                <span className="min-w-0 flex-1">
                  <span className="font-medium text-ink">{memberName(a.actorId)}</span>{" "}
                  {activityText(a)}
                </span>
                <span className="shrink-0 text-ink-faint">{timeAgo(a.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Section>
  );
}

function activityText(a: Activity): string {
  switch (a.type) {
    case "created":
      return "สร้างงานนี้";
    case "status_changed": {
      const to = a.meta.to as StatusKey | undefined;
      return `เปลี่ยนสถานะเป็น ${to ? STATUS_CONFIG[to].label : "-"}`;
    }
    case "priority_changed": {
      const to = a.meta.to as PriorityKey | undefined;
      return `เปลี่ยนความสำคัญเป็น ${to ? PRIORITY_CONFIG[to].label : "-"}`;
    }
    case "assigned":
      return "มอบหมายงาน";
    case "unassigned":
      return "ยกเลิกการมอบหมาย";
    case "commented":
      return "แสดงความคิดเห็น";
    case "completed":
      return "ทำงานเสร็จ";
    default:
      return "อัปเดตงาน";
  }
}

function TextArea({
  value,
  onChange,
  onCommit,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  onCommit: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Measure on the next frame so the element has its final width before we
    // read scrollHeight (otherwise a 0-width measure inflates the height).
    const raf = requestAnimationFrame(() => {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    });
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onBlur={() => onCommit(value)}
      className={className}
    />
  );
}

function TagEditor({
  tags,
  onChange,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  function addTag(raw: string) {
    const tag = raw.trim();
    if (!tag || tags.includes(tag)) {
      setDraft("");
      return;
    }
    onChange([...tags, tag]);
    setDraft("");
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md px-1.5 py-1">
      {tags.map((tag) => (
        <button
          key={tag}
          type="button"
          onClick={() => onChange(tags.filter((t) => t !== tag))}
          title="คลิกเพื่อลบ"
        >
          <TagPill tag={tag} />
        </button>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            addTag(draft);
          }
          if (e.key === "Backspace" && !draft && tags.length) {
            onChange(tags.slice(0, -1));
          }
        }}
        onBlur={() => addTag(draft)}
        placeholder={tags.length ? "เพิ่มแท็ก…" : "เพิ่มแท็ก แล้วกด Enter"}
        className="min-w-[110px] flex-1 bg-transparent py-0.5 text-sm"
      />
    </div>
  );
}
