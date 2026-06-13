/** Tiny classnames helper (avoids pulling in clsx for this scope). */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** Collision-resistant id generator usable in the browser. */
export function uid(prefix = "id"): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.abs(
          Array.from(prefix).reduce((a, c) => (a << 5) - a + c.charCodeAt(0), 7),
        ).toString(36) + performance.now().toString(36).replace(".", "");
  return `${prefix}_${rand.replace(/-/g, "").slice(0, 12)}`;
}

/**
 * Raw RFC-4122 UUID — used as the primary key for new projects/tasks so the
 * client-generated id is valid for Supabase's `uuid` columns (no reconciliation
 * needed after insert).
 */
export function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback (older runtimes): RFC-4122 v4 shaped string.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (performance.now() * Math.random() * 16) % 16 | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Returns initials (max 2 chars) from a display name. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Deterministic avatar background color from a string. */
export function avatarColor(seed: string): string {
  const colors = [
    "#e03e3e",
    "#d9730d",
    "#dfab01",
    "#448361",
    "#2383e2",
    "#9065b0",
    "#c14c8a",
    "#937264",
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash << 5) - hash + seed.charCodeAt(i);
  return colors[Math.abs(hash) % colors.length];
}

/** Formats an ISO date (yyyy-mm-dd) into a short human label. */
export function formatDueDate(iso?: string): string {
  if (!iso) return "";
  const date = new Date(iso + "T00:00:00");
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("th-TH-u-ca-gregory", {
    month: "short",
    day: "numeric",
  });
}

/** Short Thai relative time, e.g. "เมื่อสักครู่", "3 ชม.ที่แล้ว". */
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const sec = Math.max(0, (Date.now() - then) / 1000);
  if (sec < 60) return "เมื่อสักครู่";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} นาทีที่แล้ว`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ชม.ที่แล้ว`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} วันที่แล้ว`;
  return new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short" });
}

/** Returns 'overdue' | 'today' | 'soon' | 'normal' for due-date styling. */
export function dueStatus(
  iso: string | undefined,
  todayIso: string,
): "overdue" | "today" | "soon" | "normal" {
  if (!iso) return "normal";
  if (iso < todayIso) return "overdue";
  if (iso === todayIso) return "today";
  const due = new Date(iso + "T00:00:00").getTime();
  const today = new Date(todayIso + "T00:00:00").getTime();
  const days = (due - today) / 86_400_000;
  return days <= 3 ? "soon" : "normal";
}
