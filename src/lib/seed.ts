import type { DemoState, Project, Task } from "./types";

/** Fixed workspace id used only by the localStorage demo layer. */
export const DEMO_WORKSPACE_ID = "demo-workspace";

/** yyyy-mm-dd for `today + offsetDays`. */
function dayOffset(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

const now = new Date().toISOString();
const ws = DEMO_WORKSPACE_ID;

const projects: Project[] = [
  { id: "proj_roadmap", workspaceId: ws, name: "Product Roadmap", icon: "🎯", createdAt: now },
  { id: "proj_eng", workspaceId: ws, name: "Engineering", icon: "🛠️", createdAt: now },
  { id: "proj_marketing", workspaceId: ws, name: "Marketing", icon: "🚀", createdAt: now },
  { id: "proj_personal", workspaceId: ws, name: "งานส่วนตัว", icon: "📋", createdAt: now },
];

let seq = 0;
function task(
  t: Omit<Task, "id" | "workspaceId" | "order" | "createdAt" | "updatedAt">,
): Task {
  return {
    id: `task_${++seq}`,
    workspaceId: ws,
    order: seq,
    createdAt: now,
    updatedAt: now,
    ...t,
  };
}

const tasks: Task[] = [
  task({
    projectId: "proj_roadmap",
    title: "วาง vision ของ Q3",
    description: "สรุปทิศทางผลิตภัณฑ์และเป้าหมายหลักของไตรมาสหน้า",
    status: "in_progress",
    priority: "high",
    dueDate: dayOffset(2),
    tags: ["strategy", "planning"],
  }),
  task({
    projectId: "proj_roadmap",
    title: "Research คู่แข่งในตลาด",
    description: "เปรียบเทียบฟีเจอร์กับ Notion, Linear, Asana",
    status: "todo",
    priority: "medium",
    dueDate: dayOffset(5),
    tags: ["research"],
  }),
  task({
    projectId: "proj_roadmap",
    title: "ออกแบบ onboarding flow ใหม่",
    description: "",
    status: "backlog",
    priority: "low",
    tags: ["design", "ux"],
  }),
  task({
    projectId: "proj_roadmap",
    title: "สรุป feedback จากลูกค้า 10 ราย",
    description: "รวบรวม insight จากการสัมภาษณ์",
    status: "done",
    priority: "medium",
    dueDate: dayOffset(-3),
    tags: ["research"],
  }),
  task({
    projectId: "proj_eng",
    title: "ทำ drag-and-drop board ให้ลื่นไหล",
    description: "รองรับการลากการ์ดข้าม column",
    status: "in_progress",
    priority: "medium",
    tags: ["frontend"],
  }),
  task({
    projectId: "proj_eng",
    title: "ตั้งค่า CI/CD บน Vercel",
    description: "",
    status: "backlog",
    priority: "low",
    tags: ["devops"],
  }),
  task({
    projectId: "proj_eng",
    title: "Setup โครงสร้างโปรเจกต์ Next.js",
    description: "TypeScript + Tailwind + App Router",
    status: "done",
    priority: "high",
    dueDate: dayOffset(-1),
    tags: ["frontend", "setup"],
  }),
  task({
    projectId: "proj_marketing",
    title: "เขียนบทความเปิดตัว JaaiNgan",
    description: "เนื้อหาแนะนำฟีเจอร์หลัก พร้อมภาพประกอบ",
    status: "in_progress",
    priority: "medium",
    dueDate: dayOffset(4),
    tags: ["content"],
  }),
  task({
    projectId: "proj_marketing",
    title: "ออกแบบโพสต์ social media 5 ชิ้น",
    description: "",
    status: "todo",
    priority: "low",
    tags: ["design", "social"],
  }),
  task({
    projectId: "proj_personal",
    title: "อ่านหนังสือ Atomic Habits ให้จบ",
    description: "",
    status: "in_progress",
    priority: "low",
    dueDate: dayOffset(7),
    tags: ["reading"],
  }),
  task({
    projectId: "proj_personal",
    title: "จองตั๋วเครื่องบินเดือนหน้า",
    description: "",
    status: "todo",
    priority: "high",
    dueDate: dayOffset(6),
    tags: ["travel"],
  }),
];

export function createSeedState(): DemoState {
  return {
    projects,
    tasks,
    subtasks: [],
    selectedProjectId: projects[0].id,
  };
}
