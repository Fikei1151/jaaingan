"use client";

import {
  ArrowUpDown,
  CalendarDays,
  LayoutGrid,
  List,
  Menu,
  Plus,
  Search,
  SlidersHorizontal,
  Table2,
  UserCircle2,
} from "lucide-react";
import { useData } from "@/lib/data-context";
import { PRIORITY_ORDER } from "@/lib/constants";
import { SORT_OPTIONS, type SortKey } from "@/lib/sort";
import type { PriorityKey, Project, ViewKey } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Avatar, PriorityPill } from "@/components/ui/pills";
import { MenuItem, Popover } from "@/components/ui/popover";
import { Select } from "@/components/ui/select";
import { DateRangePicker, type DateRange } from "@/components/ui/date-range-picker";

const VIEWS: { key: ViewKey; label: string; icon: React.ReactNode }[] = [
  { key: "board", label: "บอร์ด", icon: <LayoutGrid size={15} /> },
  { key: "table", label: "ตาราง", icon: <Table2 size={15} /> },
  { key: "list", label: "รายการ", icon: <List size={15} /> },
  { key: "calendar", label: "ปฏิทิน", icon: <CalendarDays size={15} /> },
];

export type AssigneeFilter = null | "unassigned" | string;

export function TopBar({
  project,
  view,
  onViewChange,
  search,
  onSearchChange,
  onNewTask,
  onToggleSidebar,
  taskCount,
  assigneeFilter,
  onAssigneeFilter,
  priorityFilter,
  onPriorityFilter,
  dueRange,
  onDueRange,
  sortKey,
  onSortKey,
}: {
  project: Project;
  view: ViewKey;
  onViewChange: (v: ViewKey) => void;
  search: string;
  onSearchChange: (v: string) => void;
  onNewTask: () => void;
  onToggleSidebar: () => void;
  taskCount: number;
  assigneeFilter: AssigneeFilter;
  onAssigneeFilter: (v: AssigneeFilter) => void;
  priorityFilter: PriorityKey | null;
  onPriorityFilter: (v: PriorityKey | null) => void;
  dueRange: DateRange;
  onDueRange: (r: DateRange) => void;
  sortKey: SortKey;
  onSortKey: (k: SortKey) => void;
}) {
  const { members, currentUserId, memberById } = useData();
  const myTasksOn = assigneeFilter === currentUserId && !!currentUserId;
  const assigneeLabel =
    assigneeFilter === null
      ? null
      : assigneeFilter === "unassigned"
        ? "ยังไม่มอบหมาย"
        : memberById(assigneeFilter)?.name ?? "ผู้รับผิดชอบ";
  const hasFilter = assigneeFilter !== null || priorityFilter !== null;

  return (
    <header className="border-b border-line">
      <div className="flex items-center gap-2 px-4 py-2.5 sm:px-6">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="rounded-md p-1.5 text-ink-muted transition-colors hover:bg-fill md:hidden"
        >
          <Menu size={18} />
        </button>
        <span className="text-lg">{project.icon}</span>
        <h1 className="min-w-0 truncate text-base font-semibold">{project.name}</h1>
        <span className="rounded bg-fill px-1.5 py-0.5 text-xs text-ink-muted tabular-nums">
          {taskCount}
        </span>

        <div className="ml-auto flex items-center gap-2">
          <div className="relative hidden sm:block">
            <Search
              size={15}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint"
            />
            <input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="ค้นหางาน…"
              className="w-40 rounded-md border border-line bg-bg py-1.5 pl-8 pr-2 text-sm transition-all focus:border-line-strong focus:w-52"
            />
          </div>
          <button
            type="button"
            onClick={onNewTask}
            className="flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-1.5 text-sm font-medium text-white transition-colors hover:brightness-95"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">เพิ่มงาน</span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1 px-3 pb-1 sm:px-5">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => onViewChange(v.key)}
            className={cn(
              "flex items-center gap-1.5 border-b-2 px-2.5 py-2 text-sm transition-colors",
              view === v.key
                ? "border-ink font-medium text-ink"
                : "border-transparent text-ink-muted hover:text-ink",
            )}
          >
            {v.icon}
            {v.label}
          </button>
        ))}

        {/* filters */}
        <div className="ml-auto flex items-center gap-1.5 py-1">
          <button
            type="button"
            onClick={() => onAssigneeFilter(myTasksOn ? null : currentUserId)}
            disabled={!currentUserId}
            className={cn(
              "flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors disabled:opacity-50",
              myTasksOn
                ? "border-accent bg-accent-soft text-accent"
                : "border-line text-ink-muted hover:bg-fill",
            )}
          >
            <UserCircle2 size={14} />
            งานของฉัน
          </button>

          <Select
            value={sortKey}
            onChange={(v) => onSortKey(v as SortKey)}
            options={SORT_OPTIONS.map((o) => ({
              ...o,
              icon: <ArrowUpDown size={13} />,
            }))}
            align="right"
            panelClassName="w-[150px]"
            className="py-1 text-xs"
          />

          <DateRangePicker value={dueRange} onChange={onDueRange} />

          <Popover
            align="right"
            panelClassName="w-[200px]"
            trigger={({ toggle }) => (
              <button
                type="button"
                onClick={toggle}
                className={cn(
                  "flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors",
                  hasFilter
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-line text-ink-muted hover:bg-fill",
                )}
              >
                <SlidersHorizontal size={14} />
                <span className="hidden sm:inline">
                  {assigneeLabel ?? "ตัวกรอง"}
                </span>
              </button>
            )}
          >
            {({ close }) => (
              <div>
                <div className="px-2 py-1 text-xs font-medium text-ink-faint">ผู้รับผิดชอบ</div>
                <MenuItem active={assigneeFilter === null} onClick={() => { onAssigneeFilter(null); }}>
                  ทั้งหมด
                </MenuItem>
                <MenuItem
                  active={assigneeFilter === "unassigned"}
                  onClick={() => onAssigneeFilter("unassigned")}
                >
                  ยังไม่มอบหมาย
                </MenuItem>
                {members.map((m) => (
                  <MenuItem
                    key={m.userId}
                    active={assigneeFilter === m.userId}
                    onClick={() => onAssigneeFilter(m.userId)}
                  >
                    <Avatar name={m.name} src={m.avatarUrl} size={18} />
                    <span className="min-w-0 flex-1 truncate">{m.name}</span>
                  </MenuItem>
                ))}
                <div className="my-1 h-px bg-line" />
                <div className="px-2 py-1 text-xs font-medium text-ink-faint">ความสำคัญ</div>
                <MenuItem active={priorityFilter === null} onClick={() => onPriorityFilter(null)}>
                  ทั้งหมด
                </MenuItem>
                {PRIORITY_ORDER.filter((p) => p !== "none").map((p) => (
                  <MenuItem
                    key={p}
                    active={priorityFilter === p}
                    onClick={() => onPriorityFilter(p as PriorityKey)}
                  >
                    <PriorityPill priority={p} />
                  </MenuItem>
                ))}
                {hasFilter && (
                  <>
                    <div className="my-1 h-px bg-line" />
                    <MenuItem
                      onClick={() => {
                        onAssigneeFilter(null);
                        onPriorityFilter(null);
                        close();
                      }}
                    >
                      <span className="text-ink-muted">ล้างตัวกรองทั้งหมด</span>
                    </MenuItem>
                  </>
                )}
              </div>
            )}
          </Popover>
        </div>
      </div>
    </header>
  );
}
