"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { STATUS_CONFIG } from "@/lib/constants";
import type { ID, Task } from "@/lib/types";
import { cn } from "@/lib/utils";

const DOW = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const LOCALE = "th-TH-u-ca-gregory";
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;

export function CalendarView({
  tasks,
  todayIso,
  onOpenTask,
}: {
  projectId: ID;
  tasks: Task[];
  todayIso: string;
  onOpenTask: (task: Task) => void;
}) {
  const [view, setView] = useState(() => new Date());
  const [dir, setDir] = useState<"next" | "prev">("next");

  const year = view.getFullYear();
  const month = view.getMonth();

  const byDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      if (!t.dueDate) continue;
      const arr = map.get(t.dueDate) ?? [];
      arr.push(t);
      map.set(t.dueDate, arr);
    }
    return map;
  }, [tasks]);

  const noDue = useMemo(() => tasks.filter((t) => !t.dueDate), [tasks]);

  const days = useMemo(() => {
    const first = new Date(year, month, 1);
    const start = new Date(year, month, 1 - first.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [year, month]);

  function shift(delta: number) {
    setDir(delta > 0 ? "next" : "prev");
    setView(new Date(year, month + delta, 1));
  }

  return (
    <div className="flex h-full flex-col px-2 pb-6 pt-2 sm:px-6">
      {/* nav */}
      <div className="mb-3 flex items-center gap-2">
        <div className="text-base font-semibold">
          {view.toLocaleDateString(LOCALE, { month: "long", year: "numeric" })}
        </div>
        <div className="ml-2 flex items-center gap-1">
          <button
            type="button"
            onClick={() => shift(-1)}
            className="rounded-md p-1 text-ink-muted transition-colors hover:bg-fill"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => {
              setDir("next");
              setView(new Date());
            }}
            className="rounded-md border border-line px-2 py-0.5 text-xs text-ink-muted transition-colors hover:bg-fill"
          >
            วันนี้
          </button>
          <button
            type="button"
            onClick={() => shift(1)}
            className="rounded-md p-1 text-ink-muted transition-colors hover:bg-fill"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* dow */}
      <div className="grid grid-cols-7 border-b border-line">
        {DOW.map((d) => (
          <div key={d} className="px-2 py-1.5 text-xs font-medium text-ink-faint">
            {d}
          </div>
        ))}
      </div>

      {/* grid */}
      <div
        key={`${year}-${month}`}
        className={cn(
          "grid min-h-0 flex-1 grid-cols-7 grid-rows-6 overflow-hidden rounded-b-lg border-x border-b border-line",
          dir === "next" ? "jn-slide-from-right" : "jn-slide-from-left",
        )}
      >
        {days.map((d, i) => {
          const key = iso(d);
          const inMonth = d.getMonth() === month;
          const isToday = key === todayIso;
          const dayTasks = byDate.get(key) ?? [];
          return (
            <div
              key={i}
              className={cn(
                "min-h-0 overflow-hidden border-b border-r border-line p-1 last:border-r-0",
                !inMonth && "bg-sidebar/40",
              )}
            >
              <div
                className={cn(
                  "mb-1 flex h-5 w-5 items-center justify-center rounded-full text-xs",
                  isToday && "bg-accent font-semibold text-white",
                  !isToday && (inMonth ? "text-ink-muted" : "text-ink-faint/60"),
                )}
              >
                {d.getDate()}
              </div>
              <div className="space-y-0.5">
                {dayTasks.slice(0, 3).map((t) => {
                  const c = STATUS_CONFIG[t.status].color;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onOpenTask(t)}
                      title={t.title || "ไม่มีชื่องาน"}
                      className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[11px] leading-tight transition-opacity hover:opacity-80"
                      style={{ background: c.bg, color: c.text }}
                    >
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ background: c.dot }}
                      />
                      <span className="truncate">{t.title || "ไม่มีชื่อ"}</span>
                    </button>
                  );
                })}
                {dayTasks.length > 3 && (
                  <div className="px-1 text-[10px] text-ink-faint">
                    +{dayTasks.length - 3} เพิ่มเติม
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* no due date */}
      {noDue.length > 0 && (
        <div className="mt-3 shrink-0">
          <div className="mb-1 text-xs font-medium text-ink-faint">
            ไม่มีกำหนดส่ง ({noDue.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {noDue.map((t) => {
              const c = STATUS_CONFIG[t.status].color;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onOpenTask(t)}
                  className="inline-flex max-w-[200px] items-center gap-1 rounded px-1.5 py-0.5 text-xs"
                  style={{ background: c.bg, color: c.text }}
                >
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: c.dot }}
                  />
                  <span className="truncate">{t.title || "ไม่มีชื่อ"}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
