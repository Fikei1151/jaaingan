"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Check,
  CheckCheck,
  ChevronsUpDown,
  Database,
  Home,
  LogOut,
  Mail,
  MessageCircle,
  Monitor,
  Moon,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Sun,
  Trash2,
  Users,
} from "lucide-react";
import { isLineLoginConfigured, startLineAuth } from "@/lib/line/config";
import { useTheme, type Theme } from "@/lib/theme";
import { useAuth } from "@/lib/auth-context";
import { useData } from "@/lib/data-context";
import { PAGE_EMOJIS } from "@/lib/constants";
import type { ID } from "@/lib/types";
import { cn, timeAgo } from "@/lib/utils";
import { Avatar } from "@/components/ui/pills";
import { MenuItem, Popover } from "@/components/ui/popover";
import { useToast } from "@/components/ui/toast";

export function Sidebar({
  onNavigate,
  onOpenMembers,
  onCreateWorkspace,
  onOpenLine,
  screenIsHome,
  onHome,
  onSelectProject,
  onOpenPalette,
}: {
  onNavigate?: () => void;
  onOpenMembers: () => void;
  onCreateWorkspace: () => void;
  onOpenLine: () => void;
  screenIsHome: boolean;
  onHome: () => void;
  onSelectProject: () => void;
  onOpenPalette: () => void;
}) {
  const { user, isLive, signOut } = useAuth();
  const {
    workspaces,
    currentWorkspace,
    myRole,
    switchWorkspace,
    members,
    projects,
    selectedProjectId,
    selectProject,
    createProject,
    renameProject,
    setProjectIcon,
    deleteProject,
    tasksFor,
    resetDemoData,
    pendingInvites,
    acceptInvite,
    notifications,
    unreadCount,
    markNotificationRead,
    markAllNotificationsRead,
    memberById,
  } = useData();
  const router = useRouter();
  const toast = useToast();
  const { theme, setTheme } = useTheme();

  const [renamingId, setRenamingId] = useState<ID | null>(null);
  const visibleProjects = projects;

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  function handleAddPage() {
    const emoji = PAGE_EMOJIS[(projects.length + 3) % PAGE_EMOJIS.length];
    const id = createProject("หน้าใหม่", emoji);
    setRenamingId(id);
    onSelectProject();
    onNavigate?.();
  }

  return (
    <aside className="flex h-full w-full flex-col bg-sidebar text-sm">
      {/* Workspace switcher */}
      <div className="px-2 pt-3 pb-1">
        <Popover
          panelClassName="w-[256px]"
          trigger={({ toggle }) => (
            <button
              type="button"
              onClick={toggle}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-sidebar-hover"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded bg-ink/5 text-sm">
                {currentWorkspace?.icon ?? "🏢"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold leading-tight">
                  {currentWorkspace?.name ?? "JaaiNgan"}
                </span>
                <span className="block truncate text-xs text-ink-faint">
                  {members.length} สมาชิก
                </span>
              </span>
              <ChevronsUpDown size={14} className="text-ink-faint" />
            </button>
          )}
        >
          {({ close }) => (
            <div>
              <div className="px-2 py-1 text-xs font-medium text-ink-faint">
                พื้นที่ทำงาน
              </div>
              {workspaces.map((w) => (
                <MenuItem
                  key={w.id}
                  active={w.id === currentWorkspace?.id}
                  onClick={() => {
                    switchWorkspace(w.id);
                    close();
                    onNavigate?.();
                  }}
                >
                  <span className="text-base">{w.icon}</span>
                  <span className="min-w-0 flex-1 truncate">{w.name}</span>
                  {w.id === currentWorkspace?.id && (
                    <Check size={14} className="text-accent" />
                  )}
                </MenuItem>
              ))}
              {isLive && (
                <MenuItem
                  onClick={() => {
                    onCreateWorkspace();
                    close();
                  }}
                >
                  <Plus size={15} className="text-ink-muted" />
                  สร้าง workspace ใหม่
                </MenuItem>
              )}
              <div className="my-1 h-px bg-line" />
              {isLive && (
                <MenuItem
                  onClick={() => {
                    onOpenMembers();
                    close();
                  }}
                >
                  <Users size={15} className="text-ink-muted" />
                  สมาชิก &amp; คำเชิญ
                </MenuItem>
              )}
              {isLive && (myRole === "owner" || myRole === "admin") && (
                <MenuItem
                  onClick={() => {
                    onOpenLine();
                    close();
                  }}
                >
                  <MessageCircle size={15} className="text-[#06C755]" />
                  เชื่อมต่อ LINE
                </MenuItem>
              )}
              {isLive && isLineLoginConfigured() && (
                <MenuItem onClick={() => startLineAuth("link")}>
                  <MessageCircle size={15} className="text-[#06C755]" />
                  เชื่อมบัญชี LINE ของฉัน
                </MenuItem>
              )}
              <div className="flex items-center gap-2 px-2 py-2">
                <Avatar name={user?.name ?? "U"} src={user?.avatarUrl} size={30} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{user?.name}</div>
                  <div className="truncate text-xs text-ink-faint">{user?.email}</div>
                </div>
              </div>
              <div className="my-1 h-px bg-line" />
              <div className="px-2 py-1.5">
                <div className="mb-1 text-xs text-ink-faint">ธีม</div>
                <div className="flex items-center gap-0.5 rounded-md bg-fill p-0.5">
                  {(
                    [
                      { v: "light", icon: <Sun size={14} />, label: "สว่าง" },
                      { v: "dark", icon: <Moon size={14} />, label: "มืด" },
                      { v: "system", icon: <Monitor size={14} />, label: "ระบบ" },
                    ] as { v: Theme; icon: React.ReactNode; label: string }[]
                  ).map((o) => (
                    <button
                      key={o.v}
                      type="button"
                      onClick={() => setTheme(o.v)}
                      className={cn(
                        "flex flex-1 items-center justify-center gap-1 rounded px-1.5 py-1 text-xs transition-colors",
                        theme === o.v
                          ? "bg-bg font-medium text-ink shadow-sm"
                          : "text-ink-muted hover:text-ink",
                      )}
                    >
                      {o.icon}
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="my-1 h-px bg-line" />
              {!isLive && (
                <MenuItem
                  onClick={() => {
                    resetDemoData();
                    close();
                  }}
                >
                  <RotateCcw size={15} className="text-ink-muted" />
                  รีเซ็ตข้อมูลเดโม
                </MenuItem>
              )}
              <MenuItem onClick={handleSignOut} danger>
                <LogOut size={15} />
                ออกจากระบบ
              </MenuItem>
            </div>
          )}
        </Popover>
      </div>

      {/* Home */}
      <div className="px-2 pt-1">
        <button
          type="button"
          onClick={() => {
            onHome();
            onNavigate?.();
          }}
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-2 py-1 transition-colors",
            screenIsHome
              ? "bg-sidebar-hover font-medium text-ink"
              : "text-ink-muted hover:bg-sidebar-hover",
          )}
        >
          <Home size={16} />
          <span>หน้าแรก</span>
        </button>
      </div>

      {/* Notifications */}
      <div className="px-2 pt-1">
        <Popover
          panelClassName="w-[300px]"
          trigger={({ toggle }) => (
            <button
              type="button"
              onClick={toggle}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-ink-muted transition-colors hover:bg-sidebar-hover"
            >
              <span className="relative">
                <Bell size={16} />
                {unreadCount > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#e03e3e] px-1 text-[10px] font-medium text-white">
                    {unreadCount}
                  </span>
                )}
              </span>
              <span className="flex-1 text-left">การแจ้งเตือน</span>
            </button>
          )}
        >
          {({ close }) => (
            <div>
              <div className="flex items-center justify-between px-2 py-1">
                <span className="text-xs font-semibold text-ink-faint">
                  การแจ้งเตือน
                </span>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => markAllNotificationsRead()}
                    className="flex items-center gap-1 text-xs text-accent hover:underline"
                  >
                    <CheckCheck size={13} /> อ่านทั้งหมด
                  </button>
                )}
              </div>
              <div className="max-h-[320px] overflow-y-auto">
                {notifications.length === 0 && (
                  <p className="px-2 py-5 text-center text-xs text-ink-faint">
                    ยังไม่มีการแจ้งเตือน
                  </p>
                )}
                {notifications.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => {
                      markNotificationRead(n.id);
                      if (n.workspaceId) switchWorkspace(n.workspaceId);
                      close();
                      onNavigate?.();
                    }}
                    className={cn(
                      "flex w-full items-start gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-fill",
                      !n.read && "bg-accent-soft/50",
                    )}
                  >
                    <span className="mt-0.5 text-base">📌</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-ink">
                        <span className="font-medium">
                          {memberById(n.actorId)?.name ?? "มีผู้ใช้"}
                        </span>{" "}
                        มอบหมายงานให้คุณ
                      </span>
                      {n.taskTitle && (
                        <span className="block truncate text-xs text-ink-muted">
                          “{n.taskTitle}”
                        </span>
                      )}
                      <span className="block text-xs text-ink-faint">
                        {timeAgo(n.createdAt)}
                      </span>
                    </span>
                    {!n.read && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Popover>
      </div>

      {/* Pending invites */}
      {pendingInvites.length > 0 && (
        <div className="mx-2 mb-1 rounded-lg border border-accent/30 bg-accent-soft/60 p-2">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-accent">
            <Mail size={13} /> คำเชิญเข้าร่วม ({pendingInvites.length})
          </div>
          {pendingInvites.map((inv) => (
            <div key={inv.token} className="flex items-center gap-2 py-0.5">
              <span className="min-w-0 flex-1 truncate text-xs">
                {inv.workspaceIcon} {inv.workspaceName}
              </span>
              <button
                type="button"
                onClick={() =>
                  acceptInvite(inv.token)
                    .then(() => toast.success(`เข้าร่วม ${inv.workspaceName} แล้ว`))
                    .catch(() => toast.error("เข้าร่วมไม่สำเร็จ"))
                }
                className="rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-white hover:brightness-95"
              >
                เข้าร่วม
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Global search → command palette */}
      <div className="px-2">
        <button
          type="button"
          onClick={onOpenPalette}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-ink-muted transition-colors hover:bg-sidebar-hover"
        >
          <Search size={16} />
          <span className="flex-1 text-left">ค้นหา</span>
          <kbd className="rounded border border-line px-1 text-[10px] text-ink-faint">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Pages */}
      <div className="mt-3 flex items-center justify-between px-3">
        <span className="text-xs font-semibold tracking-wide text-ink-faint">
          หน้างาน
        </span>
        <button
          type="button"
          onClick={handleAddPage}
          title="เพิ่มหน้าใหม่"
          className="rounded p-0.5 text-ink-faint transition-colors hover:bg-sidebar-hover hover:text-ink"
        >
          <Plus size={16} />
        </button>
      </div>

      <nav className="mt-1 flex-1 overflow-y-auto px-2 pb-2">
        {visibleProjects.length === 0 && (
          <p className="px-2 py-2 text-xs text-ink-faint">ยังไม่มีหน้างาน</p>
        )}
        {visibleProjects.map((project) => {
          const isActive = !screenIsHome && project.id === selectedProjectId;
          const count = tasksFor(project.id).length;
          const isRenaming = renamingId === project.id;
          return (
            <div
              key={project.id}
              className={cn(
                "group flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors",
                isActive ? "bg-sidebar-hover" : "hover:bg-sidebar-hover",
              )}
            >
              <Popover
                align="left"
                panelClassName="w-[232px]"
                trigger={({ toggle }) => (
                  <button
                    type="button"
                    onClick={toggle}
                    className="shrink-0 rounded text-base leading-none hover:bg-fill"
                  >
                    {project.icon}
                  </button>
                )}
              >
                {({ close }) => (
                  <div className="grid grid-cols-8 gap-0.5">
                    {PAGE_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => {
                          setProjectIcon(project.id, emoji);
                          close();
                        }}
                        className="rounded p-1 text-lg hover:bg-fill"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </Popover>

              {isRenaming ? (
                <RenameInput
                  initial={project.name}
                  onCommit={(name) => {
                    renameProject(project.id, name.trim() || "หน้าใหม่");
                    setRenamingId(null);
                  }}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    selectProject(project.id);
                    onSelectProject();
                    onNavigate?.();
                  }}
                  className={cn(
                    "min-w-0 flex-1 truncate py-0.5 text-left",
                    isActive ? "font-medium text-ink" : "text-ink-muted",
                  )}
                >
                  {project.name}
                </button>
              )}

              {!isRenaming && (
                <span className="text-xs text-ink-faint tabular-nums transition-opacity group-hover:opacity-0">
                  {count}
                </span>
              )}

              {!isRenaming && (
                <Popover
                  align="right"
                  panelClassName="w-[180px]"
                  trigger={({ toggle }) => (
                    <button
                      type="button"
                      onClick={toggle}
                      className="rounded p-0.5 text-ink-faint opacity-0 transition-opacity hover:bg-fill hover:text-ink group-hover:opacity-100"
                    >
                      <MoreHorizontal size={16} />
                    </button>
                  )}
                >
                  {({ close }) => (
                    <div>
                      <MenuItem
                        onClick={() => {
                          setRenamingId(project.id);
                          close();
                        }}
                      >
                        <Pencil size={15} className="text-ink-muted" />
                        เปลี่ยนชื่อ
                      </MenuItem>
                      <MenuItem
                        onClick={() => {
                          if (
                            window.confirm(
                              `ลบหน้า “${project.name}” และงานทั้งหมดในนั้น?`,
                            )
                          ) {
                            deleteProject(project.id);
                          }
                          close();
                        }}
                        danger
                      >
                        <Trash2 size={15} />
                        ลบหน้านี้
                      </MenuItem>
                    </div>
                  )}
                </Popover>
              )}
            </div>
          );
        })}

        <button
          type="button"
          onClick={handleAddPage}
          className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1 text-ink-faint transition-colors hover:bg-sidebar-hover hover:text-ink"
        >
          <Plus size={16} />
          เพิ่มหน้าใหม่
        </button>
      </nav>

      {/* Supabase status */}
      <div className="border-t border-line px-3 py-2">
        <div className="flex items-center gap-2 text-xs text-ink-faint">
          <Database size={13} />
          {isLive ? (
            <span className="text-[#448361]">เชื่อม Supabase แล้ว</span>
          ) : (
            <span>โหมดเดโม · ข้อมูลเก็บในเบราว์เซอร์</span>
          )}
        </div>
      </div>
    </aside>
  );
}

function RenameInput({
  initial,
  onCommit,
}: {
  initial: string;
  onCommit: (value: string) => void;
}) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.select();
  }, []);
  return (
    <input
      ref={ref}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => onCommit(value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onCommit(value);
        if (e.key === "Escape") onCommit(initial);
      }}
      className="min-w-0 flex-1 rounded border border-accent bg-bg px-1 py-0.5 text-sm"
    />
  );
}
