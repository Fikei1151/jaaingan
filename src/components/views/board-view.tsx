"use client";

import { useState } from "react";
import { ListChecks, Plus } from "lucide-react";
import { useData } from "@/lib/data-context";
import { STATUS_CONFIG, STATUS_ORDER } from "@/lib/constants";
import type { ID, Member, StatusKey, Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Avatar, DueDateChip, PriorityPill, TagPill } from "@/components/ui/pills";

export function BoardView({
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
  const { createTask, moveTask, memberById, subtasksFor } = useData();
  const [draggingId, setDraggingId] = useState<ID | null>(null);
  const [overColumn, setOverColumn] = useState<StatusKey | null>(null);

  function handleDropOnColumn(status: StatusKey, beforeId: ID | null) {
    if (draggingId) moveTask(draggingId, status, beforeId);
    setDraggingId(null);
    setOverColumn(null);
  }

  function addCard(status: StatusKey) {
    onOpenTask(createTask({ projectId, status, title: "" }));
  }

  return (
    <div className="flex h-full gap-3 overflow-x-auto px-3 pb-6 pt-2 sm:px-6">
      {STATUS_ORDER.map((status) => {
        const columnTasks = tasks.filter((t) => t.status === status);
        const { label, color } = STATUS_CONFIG[status];
        return (
          <div
            key={status}
            className="flex w-[280px] shrink-0 flex-col"
            onDragOver={(e) => {
              e.preventDefault();
              setOverColumn(status);
            }}
            onDrop={() => handleDropOnColumn(status, null)}
          >
            <div className="mb-2 flex items-center gap-2 px-1">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold"
                style={{ background: color.bg, color: color.text }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: color.dot }} />
                {label}
              </span>
              <span className="text-xs text-ink-faint tabular-nums">{columnTasks.length}</span>
              <button
                type="button"
                onClick={() => addCard(status)}
                className="ml-auto rounded p-0.5 text-ink-faint transition-colors hover:bg-fill hover:text-ink"
                title="เพิ่มงาน"
              >
                <Plus size={15} />
              </button>
            </div>

            <div
              className={cn(
                "flex min-h-[60px] flex-1 flex-col gap-2 rounded-lg p-1 transition-colors",
                overColumn === status && draggingId ? "bg-accent-soft/60" : "bg-transparent",
              )}
            >
              {columnTasks.map((task) => {
                const subs = subtasksFor(task.id);
                return (
                  <Card
                    key={task.id}
                    task={task}
                    todayIso={todayIso}
                    assignee={memberById(task.assigneeId)}
                    subDone={subs.filter((s) => s.done).length}
                    subTotal={subs.length}
                    dragging={draggingId === task.id}
                    onOpen={() => onOpenTask(task)}
                    onDragStart={() => setDraggingId(task.id)}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setOverColumn(null);
                    }}
                    onDropBefore={() => handleDropOnColumn(status, task.id)}
                  />
                );
              })}

              <button
                type="button"
                onClick={() => addCard(status)}
                className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm text-ink-faint transition-colors hover:bg-fill hover:text-ink-muted"
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

function Card({
  task,
  todayIso,
  assignee,
  subDone,
  subTotal,
  dragging,
  onOpen,
  onDragStart,
  onDragEnd,
  onDropBefore,
}: {
  task: Task;
  todayIso: string;
  assignee?: Member;
  subDone: number;
  subTotal: number;
  dragging: boolean;
  onOpen: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDropBefore: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDrop={(e) => {
        e.stopPropagation();
        onDropBefore();
      }}
      onClick={onOpen}
      className={cn(
        "group cursor-pointer rounded-lg border border-line bg-bg p-2.5 shadow-[0_1px_2px_rgba(15,15,15,0.04)] transition-all hover:border-line-strong hover:shadow-[0_2px_6px_rgba(15,15,15,0.08)]",
        dragging && "opacity-40",
      )}
    >
      {task.priority !== "none" && (
        <div className="mb-1.5">
          <PriorityPill priority={task.priority} />
        </div>
      )}
      <p className={cn("text-sm leading-snug", task.title ? "text-ink" : "text-ink-faint")}>
        {task.title || "ไม่มีชื่องาน"}
      </p>

      {task.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {task.tags.map((tag) => (
            <TagPill key={tag} tag={tag} />
          ))}
        </div>
      )}

      {(task.dueDate || subTotal > 0 || assignee) && (
        <div className="mt-2 flex items-center gap-2">
          <DueDateChip date={task.dueDate} todayIso={todayIso} />
          {subTotal > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-ink-faint">
              <ListChecks size={13} />
              {subDone}/{subTotal}
            </span>
          )}
          <span className="ml-auto">
            {assignee && <Avatar name={assignee.name} src={assignee.avatarUrl} size={20} />}
          </span>
        </div>
      )}
    </div>
  );
}
