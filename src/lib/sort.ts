import { PRIORITY_CONFIG } from "./constants";
import type { Task } from "./types";

export type SortKey = "manual" | "priority" | "due" | "created";

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "manual", label: "ลำดับเอง" },
  { value: "priority", label: "ความสำคัญ" },
  { value: "due", label: "กำหนดส่ง" },
  { value: "created", label: "สร้างล่าสุด" },
];

const FAR = "9999-99-99";

/** Returns a new sorted array (or the same array for "manual"). */
export function sortTasks(tasks: Task[], key: SortKey): Task[] {
  if (key === "manual") return tasks;
  const arr = [...tasks];
  if (key === "priority") {
    arr.sort(
      (a, b) =>
        PRIORITY_CONFIG[b.priority].rank - PRIORITY_CONFIG[a.priority].rank ||
        a.order - b.order,
    );
  } else if (key === "due") {
    arr.sort(
      (a, b) =>
        (a.dueDate ?? FAR).localeCompare(b.dueDate ?? FAR) || a.order - b.order,
    );
  } else if (key === "created") {
    arr.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  return arr;
}
