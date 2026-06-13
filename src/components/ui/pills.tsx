"use client";

import {
  PRIORITY_CONFIG,
  STATUS_CONFIG,
  colorForTag,
} from "@/lib/constants";
import type { PriorityKey, StatusKey } from "@/lib/types";
import { avatarColor, cn, formatDueDate, dueStatus, initials } from "@/lib/utils";

export function StatusPill({ status }: { status: StatusKey }) {
  const { label, color } = STATUS_CONFIG[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap"
      style={{ background: color.bg, color: color.text }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: color.dot }}
      />
      {label}
    </span>
  );
}

export function PriorityPill({
  priority,
  bare = false,
}: {
  priority: PriorityKey;
  bare?: boolean;
}) {
  const { label, color } = PRIORITY_CONFIG[priority];
  if (priority === "none" && bare) {
    return <span className="text-xs text-ink-faint">—</span>;
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap"
      style={{ background: color.bg, color: color.text }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: color.dot }}
      />
      {label}
    </span>
  );
}

export function TagPill({ tag }: { tag: string }) {
  const color = colorForTag(tag);
  return (
    <span
      className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium whitespace-nowrap"
      style={{ background: color.bg, color: color.text }}
    >
      {tag}
    </span>
  );
}

export function Avatar({
  name,
  src,
  size = 22,
}: {
  name: string;
  src?: string;
  size?: number;
}) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="inline-flex items-center justify-center rounded-full font-medium text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: avatarColor(name || "?"),
      }}
      title={name}
    >
      {initials(name || "?")}
    </span>
  );
}

export function DueDateChip({
  date,
  todayIso,
}: {
  date?: string;
  todayIso: string;
}) {
  if (!date) return null;
  const state = dueStatus(date, todayIso);
  const styles: Record<typeof state, string> = {
    overdue: "text-[#e03e3e] bg-[#ffe2dd]",
    today: "text-[#d9730d] bg-[#fadec9]",
    soon: "text-ink-muted bg-fill",
    normal: "text-ink-muted bg-fill",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium whitespace-nowrap",
        styles[state],
      )}
    >
      {formatDueDate(date)}
    </span>
  );
}
