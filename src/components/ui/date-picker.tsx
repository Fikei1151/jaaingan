"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Central, reusable date picker — Notion-styled, animated, Thai locale (Gregorian
 * year). Drop it in anywhere a date is needed:
 *
 *   <DatePicker value={iso} onChange={(iso) => ...} />
 *
 * `value` / `onChange` use an ISO `yyyy-mm-dd` string (or undefined for empty).
 */

const DOW = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const LOCALE = "th-TH-u-ca-gregory";

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function fromISO(iso: string): Date {
  return new Date(iso + "T00:00:00");
}
function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
const monthLabel = (d: Date) =>
  d.toLocaleDateString(LOCALE, { month: "long", year: "numeric" });
const triggerLabel = (d: Date) =>
  d.toLocaleDateString(LOCALE, { day: "numeric", month: "short", year: "numeric" });

export function DatePicker({
  value,
  onChange,
  placeholder = "เลือกวันที่",
  align = "left",
}: {
  value?: string;
  onChange: (iso: string | undefined) => void;
  placeholder?: string;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const [dir, setDir] = useState<"next" | "prev">("next");
  const selected = value ? fromISO(value) : null;
  const today = new Date();
  const [view, setView] = useState<Date>(selected ?? today);
  const rootRef = useRef<HTMLDivElement>(null);

  // Sync the visible month to the selected date whenever the popover opens.
  useEffect(() => {
    if (open) setView(value ? fromISO(value) : new Date());
  }, [open, value]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node))
        setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const year = view.getFullYear();
  const month = view.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const gridStart = new Date(year, month, 1 - firstOfMonth.getDay());
  const days: Date[] = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });

  function shiftMonth(delta: number) {
    setDir(delta > 0 ? "next" : "prev");
    setView(new Date(year, month + delta, 1));
  }

  function pick(d: Date) {
    onChange(toISO(d));
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-2 rounded-md px-1.5 py-1 text-sm transition-colors hover:bg-fill",
          !selected && "text-ink-faint",
        )}
      >
        <CalendarDays size={15} className="text-ink-faint" />
        {selected ? triggerLabel(selected) : placeholder}
      </button>

      {open && (
        <div
          className={cn(
            "jn-pop-in absolute top-full z-50 mt-1 w-[300px] rounded-xl border border-line bg-bg p-3 shadow-[0_12px_40px_rgba(15,15,15,0.16)]",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {/* header */}
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-semibold">{monthLabel(view)}</div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                className="rounded-md p-1 text-ink-muted transition-colors hover:bg-fill"
                aria-label="เดือนก่อนหน้า"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                className="rounded-md p-1 text-ink-muted transition-colors hover:bg-fill"
                aria-label="เดือนถัดไป"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* day-of-week */}
          <div className="mb-1 grid grid-cols-7">
            {DOW.map((d) => (
              <div
                key={d}
                className="py-1 text-center text-xs font-medium text-ink-faint"
              >
                {d}
              </div>
            ))}
          </div>

          {/* days (re-keyed per month to replay the slide animation) */}
          <div
            key={`${year}-${month}`}
            className={cn(
              "grid grid-cols-7 gap-0.5",
              dir === "next" ? "jn-slide-from-right" : "jn-slide-from-left",
            )}
          >
            {days.map((d, i) => {
              const inMonth = d.getMonth() === month;
              const isToday = sameDay(d, today);
              const isSel = selected ? sameDay(d, selected) : false;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => pick(d)}
                  className={cn(
                    "flex h-9 items-center justify-center rounded-md text-sm transition-colors",
                    !inMonth && "text-ink-faint/50 hover:bg-fill",
                    inMonth && !isSel && "text-ink hover:bg-fill",
                    isToday && !isSel && "font-semibold text-accent",
                    isSel && "bg-accent font-medium text-white hover:brightness-95",
                  )}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>

          {/* footer */}
          <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
            <button
              type="button"
              onClick={() => {
                onChange(undefined);
                setOpen(false);
              }}
              className="rounded-md px-2 py-1 text-xs text-ink-muted transition-colors hover:bg-fill"
            >
              ล้าง
            </button>
            <button
              type="button"
              onClick={() => pick(new Date())}
              className="rounded-md px-2 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent-soft"
            >
              วันนี้
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
