"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  Activity,
  Comment,
  ID,
  Invite,
  Member,
  Notification,
  PendingInvite,
  Project,
  Role,
  StatusKey,
  Subtask,
  Task,
  Workspace,
  WorkspaceLineLink,
} from "./types";
import {
  loadDemoState,
  resetDemoState,
  saveDemoState,
} from "./storage";
import { DEMO_WORKSPACE_ID } from "./seed";
import { STATUS_CONFIG } from "./constants";
import { uuid } from "./utils";
import { useAuth } from "./auth-context";
import { getSupabaseClient, isSupabaseConfigured } from "./supabase/client";
import { useToast } from "@/components/ui/toast";
import * as q from "./supabase/queries";

type NewTaskInput = Partial<Omit<Task, "id" | "createdAt" | "updatedAt" | "workspaceId">> & {
  projectId: ID;
};

interface AppData {
  workspaces: Workspace[];
  currentWorkspaceId: ID | null;
  members: Member[];
  projects: Project[];
  tasks: Task[];
  subtasks: Subtask[];
  pendingInvites: PendingInvite[];
  notifications: Notification[];
  lineLink: WorkspaceLineLink | null;
  selectedProjectId: ID | null;
}

interface DataContextValue {
  ready: boolean;
  isLive: boolean;
  currentUserId: ID | null;
  // workspaces
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  currentWorkspaceId: ID | null;
  myRole: Role | null;
  switchWorkspace: (id: ID) => void;
  createWorkspace: (name: string, icon: string) => Promise<void>;
  renameWorkspace: (id: ID, name: string) => void;
  deleteWorkspace: (id: ID) => Promise<void>;
  // members & invites
  members: Member[];
  memberById: (id?: ID) => Member | undefined;
  refreshMembers: () => Promise<void>;
  loadInvites: () => Promise<Invite[]>;
  inviteMember: (email: string, role: Exclude<Role, "owner">) => Promise<Invite>;
  revokeInvite: (id: ID) => Promise<void>;
  updateMemberRole: (userId: ID, role: Role) => Promise<void>;
  removeMember: (userId: ID) => Promise<void>;
  pendingInvites: PendingInvite[];
  acceptInvite: (token: string) => Promise<void>;
  // projects
  projects: Project[];
  selectedProject: Project | null;
  selectedProjectId: ID | null;
  selectProject: (id: ID) => void;
  /** All tasks in the current workspace (across projects). */
  tasks: Task[];
  tasksFor: (projectId: ID) => Task[];
  createProject: (name: string, icon: string) => ID;
  renameProject: (id: ID, name: string) => void;
  setProjectIcon: (id: ID, icon: string) => void;
  deleteProject: (id: ID) => void;
  // tasks
  createTask: (input: NewTaskInput) => Task;
  updateTask: (id: ID, patch: Partial<Task>) => void;
  deleteTask: (id: ID) => void;
  moveTask: (id: ID, toStatus: StatusKey, beforeTaskId: ID | null) => void;
  // subtasks
  subtasksFor: (taskId: ID) => Subtask[];
  addSubtask: (taskId: ID, title: string) => void;
  toggleSubtask: (id: ID, done: boolean) => void;
  renameSubtask: (id: ID, title: string) => void;
  deleteSubtask: (id: ID) => void;
  // comments & activity
  loadThread: (taskId: ID) => Promise<{ comments: Comment[]; activities: Activity[] }>;
  addComment: (taskId: ID, body: string) => Promise<Comment | null>;
  deleteComment: (id: ID) => Promise<void>;
  // notifications
  notifications: Notification[];
  unreadCount: number;
  markNotificationRead: (id: ID) => void;
  markAllNotificationsRead: () => void;
  // LINE
  lineLink: WorkspaceLineLink | null;
  saveLineLink: (patch: Partial<Omit<WorkspaceLineLink, "workspaceId">>) => Promise<void>;
  sendLineTest: () => Promise<void>;
  resetDemoData: () => void;
}

const DataContext = createContext<DataContextValue | null>(null);

const nowIso = () => new Date().toISOString();

// Bridge so the module-level `persist` can surface failures as a toast without
// threading the toast handle through every callback.
let toastError: ((message: string) => void) | null = null;
const persist = (p: Promise<unknown>) =>
  p.catch((e) => {
    console.error("[JaaiNgan] Supabase write failed:", e);
    toastError?.("บันทึกการเปลี่ยนแปลงไม่สำเร็จ ลองใหม่อีกครั้ง");
  });

const wsKey = (userId: string) => `jaaingan:ws:${userId}`;

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const live = isSupabaseConfigured();
  const ownerId = user?.id ?? null;
  const db = live ? getSupabaseClient() : null;
  const toast = useToast();

  // Let module-level `persist` surface write failures as toasts.
  useEffect(() => {
    toastError = toast.error;
    return () => {
      if (toastError === toast.error) toastError = null;
    };
  }, [toast]);

  const [state, setState] = useState<AppData | null>(null);
  const stateRef = useRef<AppData | null>(null);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const setData = useCallback(
    (updater: (s: AppData) => AppData) => {
      setState((s) => (s ? updater(s) : s));
    },
    [],
  );

  // Loads projects/tasks/subtasks/members for a workspace and returns new state.
  const buildLiveBundle = useCallback(
    async (
      database: NonNullable<typeof db>,
      workspaces: Workspace[],
      workspaceId: ID,
      pendingInvites: PendingInvite[],
    ): Promise<AppData> => {
      const [bundle, members, lineLink] = await Promise.all([
        q.loadBundle(database, workspaceId),
        q.loadMembers(database, workspaceId),
        q.loadLineLink(database, workspaceId).catch(() => null),
      ]);
      return {
        workspaces,
        currentWorkspaceId: workspaceId,
        members,
        projects: bundle.projects,
        tasks: bundle.tasks,
        subtasks: bundle.subtasks,
        pendingInvites,
        notifications: stateRef.current?.notifications ?? [],
        lineLink,
        selectedProjectId: bundle.projects[0]?.id ?? null,
      };
    },
    [],
  );

  // Bootstrap.
  useEffect(() => {
    let cancelled = false;

    async function init() {
      // Demo mode (no Supabase env).
      if (!live) {
        const demo = loadDemoState();
        const demoUser: Member = {
          userId: user?.id ?? "demo-user",
          role: "owner",
          name: user?.name ?? "ฉัน",
          email: user?.email ?? "",
          avatarUrl: user?.avatarUrl,
        };
        setState({
          workspaces: [
            { id: DEMO_WORKSPACE_ID, name: "JaaiNgan (เดโม)", icon: "🏠", role: "owner" },
          ],
          currentWorkspaceId: DEMO_WORKSPACE_ID,
          members: [demoUser],
          projects: demo.projects,
          tasks: demo.tasks,
          subtasks: demo.subtasks,
          pendingInvites: [],
          notifications: [],
          lineLink: null,
          selectedProjectId: demo.selectedProjectId,
        });
        return;
      }

      if (!ownerId || !db || !user) {
        setState(null);
        return;
      }

      setState(null);
      try {
        let workspaces = await q.loadMyWorkspaces(db, ownerId);
        // Brand-new account → create a personal workspace + starter content.
        if (workspaces.length === 0) {
          const ws = await q.createWorkspace(db, "พื้นที่ทำงานของฉัน", "🏠", ownerId);
          await q.seedStarterData(db, ws.id, ownerId);
          workspaces = [ws];
        }
        const pendingInvites = await q.loadMyPendingInvites(db);

        const stored =
          typeof window !== "undefined"
            ? window.localStorage.getItem(wsKey(ownerId))
            : null;
        const currentId =
          workspaces.find((w) => w.id === stored)?.id ?? workspaces[0].id;

        const next = await buildLiveBundle(db, workspaces, currentId, pendingInvites);
        const notifications = await q.loadNotifications(db);
        if (!cancelled) setState({ ...next, notifications });
      } catch (e) {
        console.error("[JaaiNgan] Failed to bootstrap workspace:", e);
        if (!cancelled)
          setState({
            workspaces: [],
            currentWorkspaceId: null,
            members: [],
            projects: [],
            tasks: [],
            subtasks: [],
            pendingInvites: [],
            notifications: [],
            lineLink: null,
            selectedProjectId: null,
          });
      }
    }

    init();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, ownerId]);

  // Persist demo state.
  useEffect(() => {
    if (!live && state) {
      saveDemoState({
        projects: state.projects,
        tasks: state.tasks,
        subtasks: state.subtasks,
        selectedProjectId: state.selectedProjectId,
      });
    }
  }, [state, live]);

  // ── Realtime: live workspace updates (tasks / projects / subtasks / members) ──
  const currentWsId = state?.currentWorkspaceId ?? null;
  useEffect(() => {
    if (!db || !currentWsId) return;
    const f = `workspace_id=eq.${currentWsId}`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const upsert = <T extends { id: string }>(list: T[], row: T) =>
      list.some((x) => x.id === row.id)
        ? list.map((x) => (x.id === row.id ? row : x))
        : [...list, row];

    const channel = db
      .channel(`ws-${currentWsId}`)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter: f }, (p: any) => {
        setData((s) =>
          p.eventType === "DELETE"
            ? { ...s, tasks: s.tasks.filter((t) => t.id !== p.old?.id) }
            : { ...s, tasks: upsert(s.tasks, q.mapTask(p.new)) },
        );
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on("postgres_changes", { event: "*", schema: "public", table: "projects", filter: f }, (p: any) => {
        setData((s) =>
          p.eventType === "DELETE"
            ? { ...s, projects: s.projects.filter((pr) => pr.id !== p.old?.id) }
            : { ...s, projects: upsert(s.projects, q.mapProject(p.new)) },
        );
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on("postgres_changes", { event: "*", schema: "public", table: "subtasks", filter: f }, (p: any) => {
        setData((s) =>
          p.eventType === "DELETE"
            ? { ...s, subtasks: s.subtasks.filter((st) => st.id !== p.old?.id) }
            : { ...s, subtasks: upsert(s.subtasks, q.mapSubtask(p.new)) },
        );
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "workspace_members", filter: f }, () => {
        q.loadMembers(db, currentWsId)
          .then((members) => setData((s) => ({ ...s, members })))
          .catch(() => {});
      })
      .subscribe();

    return () => {
      db.removeChannel(channel);
    };
  }, [db, currentWsId, setData]);

  // ── Realtime: notifications for the current user (assignments etc.) ──
  useEffect(() => {
    if (!db || !ownerId) return;
    const channel = db
      .channel(`notif-${ownerId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${ownerId}` },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (p: any) => {
          const n = q.mapNotification(p.new);
          setData((s) => ({
            ...s,
            notifications: [n, ...s.notifications.filter((x) => x.id !== n.id)],
          }));
          if (n.type === "assigned")
            toast.info(`📌 มีงานมอบหมายให้คุณ: ${n.taskTitle ?? "งานใหม่"}`);
        },
      )
      .subscribe();
    return () => {
      db.removeChannel(channel);
    };
  }, [db, ownerId, setData, toast]);

  const markNotificationRead = useCallback(
    (id: ID) => {
      setData((s) => ({
        ...s,
        notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
      }));
      if (db) persist(q.markNotificationRead(db, id));
    },
    [db, setData],
  );

  const markAllNotificationsRead = useCallback(() => {
    setData((s) => ({ ...s, notifications: s.notifications.map((n) => ({ ...n, read: true })) }));
    if (db && ownerId) persist(q.markAllNotificationsRead(db, ownerId));
  }, [db, ownerId, setData]);

  const recordActivity = useCallback(
    (taskId: ID, type: Parameters<typeof q.logActivity>[1]["type"], meta?: Record<string, unknown>) => {
      const ws = stateRef.current?.currentWorkspaceId;
      if (db && ownerId && ws)
        persist(q.logActivity(db, { workspaceId: ws, taskId, actorId: ownerId, type, meta }));
    },
    [db, ownerId],
  );

  // Fire a LINE notification (best-effort, no-op until LINE is configured).
  const dispatchLine = useCallback(
    (kind: "assigned" | "comment" | "status", task: Task, status?: string) => {
      const s = stateRef.current;
      const link = s?.lineLink;
      if (!db || !s || !link?.enabled) return;
      const flag =
        kind === "assigned"
          ? link.notifyOnAssign
          : kind === "comment"
            ? link.notifyOnComment
            : link.notifyOnStatus;
      if (!flag) return;
      const project = s.projects.find((p) => p.id === task.projectId);
      const actorName = s.members.find((m) => m.userId === ownerId)?.name;
      q.invokeLineSend(db, {
        workspaceId: s.currentWorkspaceId,
        taskId: task.id,
        kind,
        taskTitle: task.title || "ไม่มีชื่องาน",
        projectName: project?.name,
        assigneeId: kind === "assigned" ? task.assigneeId : undefined,
        actorName,
        status,
        appUrl: typeof window !== "undefined" ? window.location.origin : undefined,
      }).catch((e) =>
        console.warn("[JaaiNgan] LINE send skipped:", e?.message ?? e),
      );
    },
    [db, ownerId],
  );

  const saveLineLink = useCallback(
    async (patch: Partial<Omit<WorkspaceLineLink, "workspaceId">>) => {
      const ws = stateRef.current?.currentWorkspaceId;
      if (!db || !ws) return;
      const link = await q.upsertLineLink(db, ws, patch);
      setData((s) => ({ ...s, lineLink: link }));
    },
    [db, setData],
  );

  const sendLineTest = useCallback(async () => {
    const s = stateRef.current;
    if (!db || !s?.currentWorkspaceId) return;
    await q.invokeLineSend(db, {
      workspaceId: s.currentWorkspaceId,
      kind: "assigned",
      taskTitle: "ทดสอบการแจ้งเตือนจาก JaaiNgan ✅",
      projectName: s.projects[0]?.name,
      actorName: s.members.find((m) => m.userId === ownerId)?.name,
      appUrl: typeof window !== "undefined" ? window.location.origin : undefined,
    });
  }, [db, ownerId]);

  // ── workspaces ──────────────────────────────────────────────────────
  const switchWorkspace = useCallback(
    (id: ID) => {
      const s = stateRef.current;
      if (!s || s.currentWorkspaceId === id) return;
      if (ownerId && typeof window !== "undefined")
        window.localStorage.setItem(wsKey(ownerId), id);
      if (!db) {
        setData((cur) => ({ ...cur, currentWorkspaceId: id }));
        return;
      }
      setData((cur) => ({ ...cur, currentWorkspaceId: id, selectedProjectId: null }));
      buildLiveBundle(db, s.workspaces, id, s.pendingInvites).then((next) => {
        setState(next);
      });
    },
    [db, ownerId, setData, buildLiveBundle],
  );

  const createWorkspace = useCallback(
    async (name: string, icon: string) => {
      if (!db || !ownerId) return;
      const ws = await q.createWorkspace(db, name.trim() || "พื้นที่ทำงานใหม่", icon, ownerId);
      if (ownerId && typeof window !== "undefined")
        window.localStorage.setItem(wsKey(ownerId), ws.id);
      const s = stateRef.current;
      const workspaces = [...(s?.workspaces ?? []), ws];
      const next = await buildLiveBundle(db, workspaces, ws.id, s?.pendingInvites ?? []);
      setState(next);
    },
    [db, ownerId, buildLiveBundle],
  );

  const renameWorkspace = useCallback(
    (id: ID, name: string) => {
      setData((s) => ({
        ...s,
        workspaces: s.workspaces.map((w) => (w.id === id ? { ...w, name } : w)),
      }));
      if (db) persist(q.updateWorkspaceRow(db, id, { name }));
    },
    [db, setData],
  );

  const deleteWorkspace = useCallback(
    async (id: ID) => {
      const s = stateRef.current;
      if (!s) return;
      const workspaces = s.workspaces.filter((w) => w.id !== id);
      if (db) await persist(q.deleteWorkspaceRow(db, id));
      const nextId = s.currentWorkspaceId === id ? workspaces[0]?.id ?? null : s.currentWorkspaceId;
      if (db && nextId) {
        const next = await buildLiveBundle(db, workspaces, nextId, s.pendingInvites);
        setState(next);
      } else {
        setData((cur) => ({ ...cur, workspaces, currentWorkspaceId: nextId }));
      }
    },
    [db, setData, buildLiveBundle],
  );

  // ── members & invites ───────────────────────────────────────────────
  const refreshMembers = useCallback(async () => {
    const ws = stateRef.current?.currentWorkspaceId;
    if (!db || !ws) return;
    const members = await q.loadMembers(db, ws);
    setData((s) => ({ ...s, members }));
  }, [db, setData]);

  const loadInvites = useCallback(async (): Promise<Invite[]> => {
    const ws = stateRef.current?.currentWorkspaceId;
    if (!db || !ws) return [];
    return q.loadInvites(db, ws);
  }, [db]);

  const inviteMember = useCallback(
    async (email: string, role: Exclude<Role, "owner">): Promise<Invite> => {
      const ws = stateRef.current?.currentWorkspaceId;
      if (!db || !ws || !ownerId) throw new Error("ใช้ได้เฉพาะเมื่อเชื่อม Supabase");
      return q.createInvite(db, ws, email.trim(), role, ownerId);
    },
    [db, ownerId],
  );

  const revokeInvite = useCallback(
    async (id: ID) => {
      if (db) await q.revokeInvite(db, id);
    },
    [db],
  );

  const updateMemberRole = useCallback(
    async (userId: ID, role: Role) => {
      const ws = stateRef.current?.currentWorkspaceId;
      if (!db || !ws) return;
      await q.updateMemberRole(db, ws, userId, role);
      setData((s) => ({
        ...s,
        members: s.members.map((m) => (m.userId === userId ? { ...m, role } : m)),
      }));
    },
    [db, setData],
  );

  const removeMember = useCallback(
    async (userId: ID) => {
      const ws = stateRef.current?.currentWorkspaceId;
      if (!db || !ws) return;
      await q.removeMember(db, ws, userId);
      setData((s) => ({ ...s, members: s.members.filter((m) => m.userId !== userId) }));
    },
    [db, setData],
  );

  const acceptInvite = useCallback(
    async (token: string) => {
      if (!db || !ownerId || !user) return;
      await q.acceptInvite(db, token);
      const workspaces = await q.loadMyWorkspaces(db, ownerId);
      const pendingInvites = await q.loadMyPendingInvites(db);
      const joined =
        workspaces.find((w) => !stateRef.current?.workspaces.some((x) => x.id === w.id)) ??
        workspaces[0];
      if (ownerId && typeof window !== "undefined")
        window.localStorage.setItem(wsKey(ownerId), joined.id);
      const next = await buildLiveBundle(db, workspaces, joined.id, pendingInvites);
      setState(next);
    },
    [db, ownerId, user, buildLiveBundle],
  );

  // ── projects ────────────────────────────────────────────────────────
  const selectProject = useCallback(
    (id: ID) => setData((s) => ({ ...s, selectedProjectId: id })),
    [setData],
  );

  const tasksFor = useCallback(
    (projectId: ID) =>
      (state?.tasks ?? [])
        .filter((t) => t.projectId === projectId)
        .sort((a, b) => a.order - b.order),
    [state],
  );

  const createProject = useCallback(
    (name: string, icon: string): ID => {
      const ws = stateRef.current?.currentWorkspaceId ?? DEMO_WORKSPACE_ID;
      const project: Project = {
        id: uuid(),
        workspaceId: ws,
        name: name.trim() || "หน้าใหม่",
        icon,
        createdAt: nowIso(),
      };
      setData((s) => ({
        ...s,
        projects: [...s.projects, project],
        selectedProjectId: project.id,
      }));
      if (db && ownerId) persist(q.insertProject(db, project, ownerId));
      return project.id;
    },
    [db, ownerId, setData],
  );

  const renameProject = useCallback(
    (id: ID, name: string) => {
      setData((s) => ({
        ...s,
        projects: s.projects.map((p) => (p.id === id ? { ...p, name } : p)),
      }));
      if (db) persist(q.updateProjectRow(db, id, { name }));
    },
    [db, setData],
  );

  const setProjectIcon = useCallback(
    (id: ID, icon: string) => {
      setData((s) => ({
        ...s,
        projects: s.projects.map((p) => (p.id === id ? { ...p, icon } : p)),
      }));
      if (db) persist(q.updateProjectRow(db, id, { icon }));
    },
    [db, setData],
  );

  const deleteProject = useCallback(
    (id: ID) => {
      setData((s) => {
        const projects = s.projects.filter((p) => p.id !== id);
        const tasks = s.tasks.filter((t) => t.projectId !== id);
        const selectedProjectId =
          s.selectedProjectId === id ? projects[0]?.id ?? null : s.selectedProjectId;
        return { ...s, projects, tasks, selectedProjectId };
      });
      if (db) persist(q.deleteProjectRow(db, id));
    },
    [db, setData],
  );

  // ── tasks ───────────────────────────────────────────────────────────
  const createTask = useCallback(
    (input: NewTaskInput): Task => {
      const ws = stateRef.current?.currentWorkspaceId ?? DEMO_WORKSPACE_ID;
      const ts = nowIso();
      const task: Task = {
        id: uuid(),
        workspaceId: ws,
        projectId: input.projectId,
        title: input.title ?? "",
        description: input.description ?? "",
        status: input.status ?? "todo",
        priority: input.priority ?? "none",
        assigneeId: input.assigneeId,
        dueDate: input.dueDate,
        tags: input.tags ?? [],
        order: input.order ?? Date.now(),
        createdAt: ts,
        updatedAt: ts,
      };
      setData((s) => ({ ...s, tasks: [...s.tasks, task] }));
      if (db && ownerId) {
        persist(q.insertTask(db, task, ownerId));
        recordActivity(task.id, "created", { title: task.title });
      }
      return task;
    },
    [db, ownerId, setData, recordActivity],
  );

  const updateTask = useCallback(
    (id: ID, patch: Partial<Task>) => {
      const prev = stateRef.current?.tasks.find((t) => t.id === id);
      setData((s) => ({
        ...s,
        tasks: s.tasks.map((t) =>
          t.id === id ? { ...t, ...patch, updatedAt: nowIso() } : t,
        ),
      }));
      if (db && prev) {
        const updated = { ...prev, ...patch } as Task;
        persist(q.updateTaskRow(db, id, patch));
        if ("status" in patch && patch.status && patch.status !== prev.status) {
          recordActivity(id, "status_changed", { to: patch.status });
          dispatchLine("status", updated, STATUS_CONFIG[patch.status].label);
        }
        if ("assigneeId" in patch && patch.assigneeId !== prev.assigneeId) {
          recordActivity(id, patch.assigneeId ? "assigned" : "unassigned", {
            assigneeId: patch.assigneeId ?? null,
          });
          if (patch.assigneeId) dispatchLine("assigned", updated);
        }
        if ("priority" in patch && patch.priority && patch.priority !== prev.priority)
          recordActivity(id, "priority_changed", { to: patch.priority });
      }
    },
    [db, setData, recordActivity, dispatchLine],
  );

  const deleteTask = useCallback(
    (id: ID) => {
      setData((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) }));
      if (db) persist(q.deleteTaskRow(db, id));
    },
    [db, setData],
  );

  const moveTask = useCallback(
    (id: ID, toStatus: StatusKey, beforeTaskId: ID | null) => {
      const base = stateRef.current;
      if (!base) return;
      const moving = base.tasks.find((t) => t.id === id);
      if (!moving) return;
      const changedStatus = moving.status !== toStatus;

      const group = base.tasks
        .filter(
          (t) => t.projectId === moving.projectId && t.status === toStatus && t.id !== id,
        )
        .sort((a, b) => a.order - b.order);
      const insertIdx = beforeTaskId
        ? group.findIndex((t) => t.id === beforeTaskId)
        : group.length;
      const at = insertIdx === -1 ? group.length : insertIdx;
      group.splice(at, 0, moving);

      const orderMap = new Map(group.map((t, i) => [t.id, i]));
      const tasks = base.tasks.map((t) => {
        if (t.id === id)
          return { ...t, status: toStatus, order: orderMap.get(id)!, updatedAt: nowIso() };
        return orderMap.has(t.id) ? { ...t, order: orderMap.get(t.id)! } : t;
      });
      setState({ ...base, tasks });

      if (db) {
        persist(q.updateTaskRow(db, id, { status: toStatus, order: orderMap.get(id)! }));
        for (const [tid, ord] of orderMap) {
          if (tid === id) continue;
          const prevTask = base.tasks.find((t) => t.id === tid);
          if (prevTask && prevTask.order !== ord)
            persist(q.updateTaskRow(db, tid, { order: ord }));
        }
        if (changedStatus) {
          recordActivity(id, "status_changed", { to: toStatus });
          dispatchLine("status", { ...moving, status: toStatus }, STATUS_CONFIG[toStatus].label);
        }
      }
    },
    [db, recordActivity, dispatchLine],
  );

  // ── subtasks ────────────────────────────────────────────────────────
  const subtasksFor = useCallback(
    (taskId: ID) =>
      (state?.subtasks ?? [])
        .filter((s) => s.taskId === taskId)
        .sort((a, b) => a.order - b.order),
    [state],
  );

  const addSubtask = useCallback(
    (taskId: ID, title: string) => {
      const ws = stateRef.current?.currentWorkspaceId ?? DEMO_WORKSPACE_ID;
      const count = stateRef.current?.subtasks.filter((s) => s.taskId === taskId).length ?? 0;
      const subtask: Subtask = {
        id: uuid(),
        taskId,
        title: title.trim(),
        done: false,
        order: count,
      };
      setData((s) => ({ ...s, subtasks: [...s.subtasks, subtask] }));
      if (db) persist(q.insertSubtask(db, subtask, ws));
    },
    [db, setData],
  );

  const toggleSubtask = useCallback(
    (id: ID, done: boolean) => {
      setData((s) => ({
        ...s,
        subtasks: s.subtasks.map((st) => (st.id === id ? { ...st, done } : st)),
      }));
      if (db) persist(q.updateSubtaskRow(db, id, { done }));
    },
    [db, setData],
  );

  const renameSubtask = useCallback(
    (id: ID, title: string) => {
      setData((s) => ({
        ...s,
        subtasks: s.subtasks.map((st) => (st.id === id ? { ...st, title } : st)),
      }));
      if (db) persist(q.updateSubtaskRow(db, id, { title }));
    },
    [db, setData],
  );

  const deleteSubtask = useCallback(
    (id: ID) => {
      setData((s) => ({ ...s, subtasks: s.subtasks.filter((st) => st.id !== id) }));
      if (db) persist(q.deleteSubtaskRow(db, id));
    },
    [db, setData],
  );

  // ── comments & activity ─────────────────────────────────────────────
  const loadThread = useCallback(
    async (taskId: ID) => {
      if (!db) return { comments: [], activities: [] };
      const [comments, activities] = await Promise.all([
        q.loadComments(db, taskId),
        q.loadActivities(db, taskId),
      ]);
      return { comments, activities };
    },
    [db],
  );

  const addComment = useCallback(
    async (taskId: ID, body: string): Promise<Comment | null> => {
      const ws = stateRef.current?.currentWorkspaceId;
      if (!db || !ws || !ownerId) return null;
      const comment = await q.insertComment(db, taskId, ws, ownerId, body.trim());
      recordActivity(taskId, "commented", {});
      const task = stateRef.current?.tasks.find((t) => t.id === taskId);
      if (task) dispatchLine("comment", task);
      return comment;
    },
    [db, ownerId, recordActivity, dispatchLine],
  );

  const deleteComment = useCallback(
    async (id: ID) => {
      if (db) await q.deleteCommentRow(db, id);
    },
    [db],
  );

  const resetDemoData = useCallback(() => {
    if (live) return;
    const demo = resetDemoState();
    setData((s) => ({
      ...s,
      projects: demo.projects,
      tasks: demo.tasks,
      subtasks: demo.subtasks,
      selectedProjectId: demo.selectedProjectId,
    }));
  }, [live, setData]);

  const value = useMemo<DataContextValue>(() => {
    const workspaces = state?.workspaces ?? [];
    const currentWorkspaceId = state?.currentWorkspaceId ?? null;
    const currentWorkspace =
      workspaces.find((w) => w.id === currentWorkspaceId) ?? workspaces[0] ?? null;
    const projects = state?.projects ?? [];
    const selectedProjectId = state?.selectedProjectId ?? null;
    const members = state?.members ?? [];
    const notifications = state?.notifications ?? [];
    return {
      ready: state !== null,
      isLive: live,
      currentUserId: ownerId,
      workspaces,
      currentWorkspace,
      currentWorkspaceId,
      myRole: currentWorkspace?.role ?? null,
      switchWorkspace,
      createWorkspace,
      renameWorkspace,
      deleteWorkspace,
      members,
      memberById: (id?: ID) => (id ? members.find((m) => m.userId === id) : undefined),
      refreshMembers,
      loadInvites,
      inviteMember,
      revokeInvite,
      updateMemberRole,
      removeMember,
      pendingInvites: state?.pendingInvites ?? [],
      acceptInvite,
      projects,
      selectedProject:
        projects.find((p) => p.id === selectedProjectId) ?? projects[0] ?? null,
      selectedProjectId,
      selectProject,
      tasks: state?.tasks ?? [],
      tasksFor,
      createProject,
      renameProject,
      setProjectIcon,
      deleteProject,
      createTask,
      updateTask,
      deleteTask,
      moveTask,
      subtasksFor,
      addSubtask,
      toggleSubtask,
      renameSubtask,
      deleteSubtask,
      loadThread,
      addComment,
      deleteComment,
      notifications,
      unreadCount: notifications.filter((n) => !n.read).length,
      markNotificationRead,
      markAllNotificationsRead,
      lineLink: state?.lineLink ?? null,
      saveLineLink,
      sendLineTest,
      resetDemoData,
    };
  }, [
    state,
    live,
    ownerId,
    switchWorkspace,
    createWorkspace,
    renameWorkspace,
    deleteWorkspace,
    refreshMembers,
    loadInvites,
    inviteMember,
    revokeInvite,
    updateMemberRole,
    removeMember,
    acceptInvite,
    selectProject,
    tasksFor,
    createProject,
    renameProject,
    setProjectIcon,
    deleteProject,
    createTask,
    updateTask,
    deleteTask,
    moveTask,
    subtasksFor,
    addSubtask,
    toggleSubtask,
    renameSubtask,
    deleteSubtask,
    loadThread,
    addComment,
    deleteComment,
    markNotificationRead,
    markAllNotificationsRead,
    saveLineLink,
    sendLineTest,
    resetDemoData,
  ]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within <DataProvider>");
  return ctx;
}
