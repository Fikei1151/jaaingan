"use client";

import { Plus } from "lucide-react";
import { useData } from "@/lib/data-context";
import type { ID, Task } from "@/lib/types";
import {
  Avatar,
  DueDateChip,
  PriorityPill,
  StatusPill,
  TagPill,
} from "@/components/ui/pills";

export function TableView({
  projectId,
  tasks,
  todayIso,
  onOpenTask,
}: {
  projectId: ID;
  tasks: Task[];
  todayIso: string;
  onOpenTask: (task: Task) => void;
}) {
  const { createTask, memberById } = useData();

  function addRow() {
    onOpenTask(createTask({ projectId, status: "todo", title: "" }));
  }

  return (
    <div className="h-full overflow-auto px-3 pb-6 pt-2 sm:px-6">
      {/* Desktop: real table */}
      <div className="hidden min-w-[760px] overflow-hidden rounded-lg border border-line md:block">
        <div className="grid grid-cols-[minmax(220px,2fr)_130px_120px_140px_110px] border-b border-line bg-sidebar/60 text-xs font-medium text-ink-muted">
          <div className="px-3 py-2">ชื่องาน</div>
          <div className="border-l border-line px-3 py-2">สถานะ</div>
          <div className="border-l border-line px-3 py-2">ความสำคัญ</div>
          <div className="border-l border-line px-3 py-2">ผู้รับผิดชอบ</div>
          <div className="border-l border-line px-3 py-2">กำหนดส่ง</div>
        </div>

        {tasks.length === 0 && (
          <div className="px-3 py-6 text-center text-sm text-ink-faint">
            ยังไม่มีงานในหน้านี้
          </div>
        )}
        {tasks.map((task) => {
          const a = memberById(task.assigneeId);
          return (
            <button
              key={task.id}
              type="button"
              onClick={() => onOpenTask(task)}
              className="grid w-full grid-cols-[minmax(220px,2fr)_130px_120px_140px_110px] border-b border-line text-left transition-colors last:border-b-0 hover:bg-fill"
            >
              <div className="flex min-w-0 flex-col gap-1 px-3 py-2">
                <span className="truncate text-sm text-ink">
                  {task.title || <span className="text-ink-faint">ไม่มีชื่องาน</span>}
                </span>
                {task.tags.length > 0 && (
                  <span className="flex flex-wrap gap-1">
                    {task.tags.map((tag) => (
                      <TagPill key={tag} tag={tag} />
                    ))}
                  </span>
                )}
              </div>
              <div className="flex items-center border-l border-line px-3 py-2">
                <StatusPill status={task.status} />
              </div>
              <div className="flex items-center border-l border-line px-3 py-2">
                <PriorityPill priority={task.priority} bare />
              </div>
              <div className="flex items-center gap-1.5 border-l border-line px-3 py-2">
                {a ? (
                  <>
                    <Avatar name={a.name} src={a.avatarUrl} size={20} />
                    <span className="truncate text-sm text-ink-muted">{a.name}</span>
                  </>
                ) : (
                  <span className="text-sm text-ink-faint">—</span>
                )}
              </div>
              <div className="flex items-center border-l border-line px-3 py-2">
                {task.dueDate ? (
                  <DueDateChip date={task.dueDate} todayIso={todayIso} />
                ) : (
                  <span className="text-sm text-ink-faint">—</span>
                )}
              </div>
            </button>
          );
        })}

        <button
          type="button"
          onClick={addRow}
          className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-sm text-ink-faint transition-colors hover:bg-fill hover:text-ink-muted"
        >
          <Plus size={15} />
          เพิ่มงานใหม่
        </button>
      </div>

      {/* Mobile: card list */}
      <div className="space-y-2 md:hidden">
        {tasks.length === 0 && (
          <p className="py-6 text-center text-sm text-ink-faint">ยังไม่มีงานในหน้านี้</p>
        )}
        {tasks.map((task) => {
          const a = memberById(task.assigneeId);
          return (
            <button
              key={task.id}
              type="button"
              onClick={() => onOpenTask(task)}
              className="flex w-full flex-col gap-2 rounded-lg border border-line bg-bg p-3 text-left transition-colors active:bg-fill"
            >
              <span className="text-sm text-ink">
                {task.title || <span className="text-ink-faint">ไม่มีชื่องาน</span>}
              </span>
              {task.tags.length > 0 && (
                <span className="flex flex-wrap gap-1">
                  {task.tags.map((tag) => (
                    <TagPill key={tag} tag={tag} />
                  ))}
                </span>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill status={task.status} />
                {task.priority !== "none" && <PriorityPill priority={task.priority} />}
                <DueDateChip date={task.dueDate} todayIso={todayIso} />
                {a && (
                  <span className="ml-auto flex items-center gap-1.5">
                    <Avatar name={a.name} src={a.avatarUrl} size={20} />
                    <span className="text-xs text-ink-muted">{a.name}</span>
                  </span>
                )}
              </div>
            </button>
          );
        })}
        <button
          type="button"
          onClick={addRow}
          className="flex w-full items-center gap-1.5 rounded-lg border border-dashed border-line px-3 py-2 text-left text-sm text-ink-faint transition-colors active:bg-fill"
        >
          <Plus size={15} />
          เพิ่มงานใหม่
        </button>
      </div>
    </div>
  );
}
