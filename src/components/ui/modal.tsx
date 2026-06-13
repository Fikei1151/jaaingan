"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Modal({
  title,
  onClose,
  children,
  width = "max-w-lg",
}: {
  title: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  width?: string;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="jn-fade-in fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-overlay px-4 py-12"
      onMouseDown={onClose}
    >
      <div
        className={cn(
          "jn-pop-in relative w-full rounded-xl border border-line bg-bg shadow-[0_24px_60px_rgba(15,15,15,0.22)]",
          width,
        )}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-ink-muted transition-colors hover:bg-fill hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
