"use client";

import { useMemo } from "react";
import { CalendarClock, CircleCheck, ListTodo, Menu } from "lucide-react";
import { useData } from "@/lib/data-context";
import { useAuth } from "@/lib/auth-context";
import { PRIORITY_CONFIG, STATUS_CONFIG } from "@/lib/constants";
import type { Task } from "@/lib/types";
import { DueDateChip, PriorityPill } from "@/components/ui/pills";

function isoOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

interface Bucket {
  key: string;
  label: string;
  color: string;
  tasks: Task[];
}

export function HomeDashboard({
  onOpenTask,
  onToggleSidebar,
}: {
  onOpenTask: (task: Task) => void;
  onToggleSidebar: () => void;
}) {
  const { tasks, projects, currentUserId, currentWorkspace } = useData();
  const { user } = useAuth();

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const weekEnd = useMemo(() => isoOffset(7), []);
  const dateLabel = useMemo(
    () =>
      new Date().toLocaleDateString("th-TH-u-ca-gregory", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    [],
  );

  const projectById = useMemo(
    () => new Map(projects.map((p) => [p.id, p])),
    [projects],
  );

  const mine = useMemo(
    () => tasks.filter((t) => t.assigneeId === currentUserId),
    [tasks, currentUserId],
  );
  const open = mine.filter((t) => t.status !== "done");

  const buckets = useMemo<Bucket[]>(() => {
    const sortFn = (a: Task, b: Task) => {
      const da = a.dueDate ?? "9999";
      const db = b.dueDate ?? "9999";
      if (da !== db) return da < db ? -1 : 1;
      return PRIORITY_CONFIG[b.priority].rank - PRIORITY_CONFIG[a.priority].rank;
    };
    const overdue = open.filter((t) => t.dueDate && t.dueDate < today);
    const dueToday = open.filter((t) => t.dueDate === today);
    const thisWeek = open.filter(
      (t) => t.dueDate && t.dueDate > today && t.dueDate <= weekEnd,
    );
    const later = open.filter((t) => t.dueDate && t.dueDate > weekEnd);
    const noDue = open.filter((t) => !t.dueDate);
    return [
      { key: "overdue", label: "⛔ เลยกำหนด", color: "#e03e3e", tasks: overdue.sort(sortFn) },
      { key: "today", label: "📍 วันนี้", color: "#d9730d", tasks: dueToday.sort(sortFn) },
      { key: "week", label: "🗓️ สัปดาห์นี้", color: "#2383e2", tasks: thisWeek.sort(sortFn) },
      { key: "later", label: "🌱 ภายหลัง", color: "#448361", tasks: later.sort(sortFn) },
      { key: "nodue", label: "📋 ไม่มีกำหนด", color: "#9b9a97", tasks: noDue.sort(sortFn) },
    ].filter((b) => b.tasks.length > 0);
  }, [open, today, weekEnd]);

  const stats = [
    { icon: <ListTodo size={16} />, label: "ค้างทั้งหมด", value: open.length, color: "#37352f" },
    {
      icon: <CalendarClock size={16} />,
      label: "เลยกำหนด",
      value: open.filter((t) => t.dueDate && t.dueDate < today).length,
      color: "#e03e3e",
    },
    {
      icon: <CalendarClock size={16} />,
      label: "วันนี้",
      value: open.filter((t) => t.dueDate === today).length,
      color: "#d9730d",
    },
    {
      icon: <CircleCheck size={16} />,
      label: "เสร็จแล้ว",
      value: mine.filter((t) => t.status === "done").length,
      color: "#448361",
    },
  ];

  const firstName = (user?.name ?? "").split(" ")[0] || "คุณ";

  return (
    <div className="h-full overflow-y-auto">
      {/* header */}
      <div className="flex items-center gap-2 px-4 pt-4 sm:px-8">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="rounded-md p-1.5 text-ink-muted transition-colors hover:bg-fill md:hidden"
        >
          <Menu size={18} />
        </button>
        <span className="text-xs text-ink-faint">{currentWorkspace?.name}</span>
      </div>

      <div className="mx-auto max-w-[860px] px-4 pb-10 pt-3 sm:px-8">
        <h1 className="text-2xl font-bold tracking-tight">
          สวัสดี, {firstName} 👋
        </h1>
        <p className="mt-1 text-sm text-ink-muted">{dateLabel}</p>

        {/* stats */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s, i) => (
            <div key={i} className="rounded-xl border border-line bg-bg p-3">
              <div className="flex items-center gap-1.5 text-ink-faint">
                <span style={{ color: s.color }}>{s.icon}</span>
                <span className="text-xs">{s.label}</span>
              </div>
              <div
                className="mt-1 text-2xl font-bold tabular-nums"
                style={{ color: s.color }}
              >
                {s.value}
              </div>
            </div>
          ))}
        </div>

        {/* buckets */}
        <div className="mt-7">
          <h2 className="mb-3 text-sm font-semibold text-ink">งานของฉัน</h2>

          {buckets.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line py-14 text-center">
              <div className="mb-2 text-4xl">🎉</div>
              <p className="text-sm font-medium">ไม่มีงานค้างที่มอบหมายให้คุณ</p>
              <p className="mt-1 text-xs text-ink-faint">
                เลือกหน้างานทางซ้ายเพื่อดูงานทั้งหมด หรือมอบหมายงานให้ตัวเอง
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {buckets.map((bucket) => (
                <div key={bucket.key}>
                  <div className="mb-1.5 flex items-center gap-2">
                    <span
                      className="text-xs font-semibold"
                      style={{ color: bucket.color }}
                    >
                      {bucket.label}
                    </span>
                    <span className="text-xs text-ink-faint tabular-nums">
                      {bucket.tasks.length}
                    </span>
                  </div>
                  <div className="overflow-hidden rounded-xl border border-line">
                    {bucket.tasks.map((task) => {
                      const project = projectById.get(task.projectId);
                      const status = STATUS_CONFIG[task.status];
                      return (
                        <button
                          key={task.id}
                          type="button"
                          onClick={() => onOpenTask(task)}
                          className="flex w-full items-center gap-3 border-b border-line px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-fill"
                        >
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ background: status.color.dot }}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-ink">
                              {task.title || (
                                <span className="text-ink-faint">ไม่มีชื่องาน</span>
                              )}
                            </span>
                            <span className="mt-0.5 flex items-center gap-1 text-xs text-ink-faint">
                              <span>{project?.icon}</span>
                              <span className="truncate">{project?.name}</span>
                            </span>
                          </span>
                          <span className="flex shrink-0 items-center gap-2">
                            {task.priority !== "none" && (
                              <PriorityPill priority={task.priority} />
                            )}
                            <DueDateChip date={task.dueDate} todayIso={today} />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
