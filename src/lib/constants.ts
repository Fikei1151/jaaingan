import type { PriorityKey, StatusKey } from "./types";

/** A pastel color pair used for pills/tags, mirroring Notion's palette. */
export interface ColorPair {
  bg: string;
  text: string;
  dot: string;
}

export const STATUS_CONFIG: Record<
  StatusKey,
  { label: string; color: ColorPair }
> = {
  backlog: {
    label: "Backlog",
    color: { bg: "#e3e2e0", text: "#37352f", dot: "#9b9a97" },
  },
  todo: {
    label: "To Do",
    color: { bg: "#d3e5ef", text: "#183347", dot: "#2383e2" },
  },
  in_progress: {
    label: "In Progress",
    color: { bg: "#fdecc8", text: "#594413", dot: "#dfab01" },
  },
  done: {
    label: "Done",
    color: { bg: "#dbeddb", text: "#1c3829", dot: "#448361" },
  },
};

/** Order in which status columns appear on the board / groups in the list. */
export const STATUS_ORDER: StatusKey[] = [
  "backlog",
  "todo",
  "in_progress",
  "done",
];

export const PRIORITY_CONFIG: Record<
  PriorityKey,
  { label: string; color: ColorPair; rank: number }
> = {
  urgent: {
    label: "Urgent",
    color: { bg: "#ffe2dd", text: "#5d1715", dot: "#e03e3e" },
    rank: 4,
  },
  high: {
    label: "High",
    color: { bg: "#fadec9", text: "#5c3b23", dot: "#d9730d" },
    rank: 3,
  },
  medium: {
    label: "Medium",
    color: { bg: "#fdecc8", text: "#594413", dot: "#dfab01" },
    rank: 2,
  },
  low: {
    label: "Low",
    color: { bg: "#d3e5ef", text: "#183347", dot: "#2383e2" },
    rank: 1,
  },
  none: {
    label: "No priority",
    color: { bg: "#f1f1ef", text: "#787774", dot: "#c7c6c2" },
    rank: 0,
  },
};

export const PRIORITY_ORDER: PriorityKey[] = [
  "urgent",
  "high",
  "medium",
  "low",
  "none",
];

/** Palette used to auto-color tags by hashing their text. */
export const TAG_PALETTE: ColorPair[] = [
  { bg: "#e3e2e0", text: "#37352f", dot: "#9b9a97" }, // gray
  { bg: "#eee0da", text: "#442a1e", dot: "#937264" }, // brown
  { bg: "#fadec9", text: "#5c3b23", dot: "#d9730d" }, // orange
  { bg: "#fdecc8", text: "#594413", dot: "#dfab01" }, // yellow
  { bg: "#dbeddb", text: "#1c3829", dot: "#448361" }, // green
  { bg: "#d3e5ef", text: "#183347", dot: "#2383e2" }, // blue
  { bg: "#e8deee", text: "#412454", dot: "#9065b0" }, // purple
  { bg: "#f5e0e9", text: "#4c2337", dot: "#c14c8a" }, // pink
  { bg: "#ffe2dd", text: "#5d1715", dot: "#e03e3e" }, // red
];

export function colorForTag(tag: string): ColorPair {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = (hash << 5) - hash + tag.charCodeAt(i);
    hash |= 0;
  }
  return TAG_PALETTE[Math.abs(hash) % TAG_PALETTE.length];
}

/** A small set of emojis offered when creating a new page. */
export const PAGE_EMOJIS = [
  "📋",
  "🎯",
  "🚀",
  "🛠️",
  "📝",
  "💡",
  "📌",
  "🔥",
  "⭐",
  "📊",
  "🗂️",
  "🎨",
  "🧩",
  "🌱",
  "💼",
  "🏆",
];
