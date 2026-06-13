"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarRange, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Central, reusable date-range picker — pick a start day then an end day.
 *
 *   <DateRangePicker value={{ start, end }} onChange={(range) => ...} />
 *
 * `start` / `end` are ISO `yyyy-mm-dd` strings (or undefined).
 */

export interface DateRange {
  start?: string;
  end?: string;
}

const DOW = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const LOCALE = "th-TH-u-ca-gregory";

const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
const fromISO = (iso: string) => new Date(iso + "T00:00:00");
const monthLabel = (d: Date) =>
  d.toLocaleDateString(LOCALE, { month: "long", year: "numeric" });
const shortLabel = (iso: string) =>
  fromISO(iso).toLocaleDateString(LOCALE, { day: "numeric", month: "short" });

export function DateRangePicker({
  value,
  onChange,
  placeholder = "ช่วงกำหนดส่ง",
  align = "right",
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
  placeholder?: string;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const [dir, setDir] = useState<"next" | "prev">("next");
  const rootRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<Date>(
    value.start ? fromISO(value.start) : new Date(),
  );

  useEffect(() => {
    if (open) setView(value.start ? fromISO(value.start) : new Date());
  }, [open, value.start]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node))
        setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const year = view.getFullYear();
  const month = view.getMonth();
  const first = new Date(year, month, 1);
  const gridStart = new Date(year, month, 1 - first.getDay());
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });

  const active = Boolean(value.start || value.end);
  const label =
    value.start && value.end
      ? `${shortLabel(value.start)} – ${shortLabel(value.end)}`
      : value.start
        ? `ตั้งแต่ ${shortLabel(value.start)}`
        : placeholder;

  function pick(d: Date) {
    const iso = toISO(d);
    if (!value.start || (value.start && value.end)) {
      onChange({ start: iso, end: undefined });
    } else if (iso >= value.start) {
      onChange({ start: value.start, end: iso });
      setOpen(false);
    } else {
      onChange({ start: iso, end: undefined });
    }
  }

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors",
          active
            ? "border-accent bg-accent-soft text-accent"
            : "border-line text-ink-muted hover:bg-fill",
        )}
      >
        <CalendarRange size={14} />
        <span className="hidden sm:inline">{label}</span>
      </button>

      {open && (
        <div
          className={cn(
            "jn-pop-in absolute top-full z-50 mt-1 w-[300px] rounded-xl border border-line bg-bg p-3 shadow-[0_12px_40px_rgba(15,15,15,0.16)]",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-semibold">{monthLabel(view)}</div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setDir("prev");
                  setView(new Date(year, month - 1, 1));
                }}
                className="rounded-md p-1 text-ink-muted transition-colors hover:bg-fill"
                aria-label="เดือนก่อนหน้า"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setDir("next");
                  setView(new Date(year, month + 1, 1));
                }}
                className="rounded-md p-1 text-ink-muted transition-colors hover:bg-fill"
                aria-label="เดือนถัดไป"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

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

          <div
            key={`${year}-${month}`}
            className={cn(
              "grid grid-cols-7 gap-0.5",
              dir === "next" ? "jn-slide-from-right" : "jn-slide-from-left",
            )}
          >
            {days.map((d, i) => {
              const inMonth = d.getMonth() === month;
              const iso = toISO(d);
              const isStart = value.start === iso;
              const isEnd = value.end === iso;
              const inRange =
                value.start && value.end && iso > value.start && iso < value.end;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => pick(d)}
                  className={cn(
                    "flex h-9 items-center justify-center rounded-md text-sm transition-colors",
                    !inMonth && "text-ink-faint/50",
                    inMonth && "text-ink",
                    inRange && "bg-accent-soft text-accent",
                    (isStart || isEnd) &&
                      "bg-accent font-medium text-white hover:brightness-95",
                    !isStart && !isEnd && !inRange && "hover:bg-fill",
                  )}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
            <button
              type="button"
              onClick={() => {
                onChange({ start: undefined, end: undefined });
                setOpen(false);
              }}
              className="rounded-md px-2 py-1 text-xs text-ink-muted transition-colors hover:bg-fill"
            >
              ล้าง
            </button>
            <span className="px-2 py-1 text-xs text-ink-faint">
              {value.start && !value.end ? "เลือกวันสิ้นสุด" : ""}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
