"use client";

import { Plus } from "lucide-react";
import { useData } from "@/lib/data-context";
import { STATUS_CONFIG, STATUS_ORDER } from "@/lib/constants";
import type { ID, StatusKey, Task } from "@/lib/types";
import {
  Avatar,
  DueDateChip,
  PriorityPill,
  TagPill,
} from "@/components/ui/pills";

export function ListView({
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

  function addTask(status: StatusKey) {
    const task = createTask({ projectId, status, title: "" });
    onOpenTask(task);
  }

  return (
    <div className="mx-auto h-full w-full max-w-[920px] overflow-auto px-3 pb-6 pt-2 sm:px-6">
      {STATUS_ORDER.map((status) => {
        const group = tasks.filter((t) => t.status === status);
        const { label, color } = STATUS_CONFIG[status];
        return (
          <div key={status} className="mb-5">
            <div className="flex items-center gap-2 px-1 py-1.5">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold"
                style={{ background: color.bg, color: color.text }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: color.dot }}
                />
                {label}
              </span>
              <span className="text-xs text-ink-faint tabular-nums">
                {group.length}
              </span>
            </div>

            <div className="overflow-hidden rounded-lg border border-line">
              {group.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => onOpenTask(task)}
                  className="flex w-full items-center gap-3 border-b border-line px-3 py-2 text-left transition-colors last:border-b-0 hover:bg-fill"
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: color.dot }}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">
                    {task.title || (
                      <span className="text-ink-faint">ไม่มีชื่องาน</span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {task.tags.slice(0, 2).map((tag) => (
                      <TagPill key={tag} tag={tag} />
                    ))}
                    {task.priority !== "none" && (
                      <PriorityPill priority={task.priority} />
                    )}
                    <DueDateChip date={task.dueDate} todayIso={todayIso} />
                    {(() => {
                      const a = memberById(task.assigneeId);
                      return a ? (
                        <Avatar name={a.name} src={a.avatarUrl} size={20} />
                      ) : null;
                    })()}
                  </span>
                </button>
              ))}

              <button
                type="button"
                onClick={() => addTask(status)}
                className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-sm text-ink-faint transition-colors hover:bg-fill hover:text-ink-muted"
              >
                <Plus size={15} />
                เพิ่มงาน
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
