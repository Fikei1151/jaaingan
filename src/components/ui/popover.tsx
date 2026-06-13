"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface PopoverProps {
  trigger: (props: { open: boolean; toggle: () => void }) => React.ReactNode;
  children: (props: { close: () => void }) => React.ReactNode;
  /** Tailwind alignment classes for the panel. */
  align?: "left" | "right";
  panelClassName?: string;
}

/** Lightweight uncontrolled popover with outside-click + Escape handling. */
export function Popover({
  trigger,
  children,
  align = "left",
  panelClassName,
}: PopoverProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      {trigger({ open, toggle: () => setOpen((v) => !v) })}
      {open && (
        <div
          className={cn(
            "jn-pop-in absolute z-50 mt-1 min-w-[180px] rounded-lg border border-line bg-bg p-1 shadow-[0_10px_30px_rgba(15,15,15,0.12)]",
            align === "right" ? "right-0" : "left-0",
            panelClassName,
          )}
        >
          {children({ close: () => setOpen(false) })}
        </div>
      )}
    </div>
  );
}

export function MenuItem({
  children,
  onClick,
  danger = false,
  active = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
        danger
          ? "text-[#e03e3e] hover:bg-[#ffe2dd]"
          : "text-ink hover:bg-fill",
        active && "bg-fill",
      )}
    >
      {children}
    </button>
  );
}
