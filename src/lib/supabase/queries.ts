import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Activity,
  ActivityType,
  Attachment,
  Comment,
  ID,
  Invite,
  Member,
  Notification,
  PendingInvite,
  Project,
  Role,
  Subtask,
  Task,
  Workspace,
  WorkspaceLineLink,
} from "@/lib/types";
import { uuid } from "@/lib/utils";

/**
 * Supabase data access. All reads/writes are scoped to the signed-in user by
 * the RLS policies in supabase/migrations/. Functions map between snake_case
 * rows and the camelCase domain types in src/lib/types.ts.
 */

type DB = SupabaseClient;

// ── mappers (exported for Realtime payload mapping) ───────────────────
/* eslint-disable @typescript-eslint/no-explicit-any */
export const mapProject = (r: any): Project => ({
  id: r.id,
  workspaceId: r.workspace_id,
  name: r.name,
  icon: r.icon,
  createdAt: r.created_at,
});

export const mapTask = (r: any): Task => ({
  id: r.id,
  workspaceId: r.workspace_id,
  projectId: r.project_id,
  title: r.title,
  description: r.description,
  status: r.status,
  priority: r.priority,
  assigneeId: r.assignee_id ?? undefined,
  dueDate: r.due_date ?? undefined,
  tags: r.tags ?? [],
  order: r.order,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const mapSubtask = (r: any): Subtask => ({
  id: r.id,
  taskId: r.task_id,
  title: r.title,
  done: r.done,
  order: r.order,
});

export const mapComment = (r: any): Comment => ({
  id: r.id,
  taskId: r.task_id,
  authorId: r.author_id ?? undefined,
  body: r.body,
  createdAt: r.created_at,
});

const mapActivity = (r: any): Activity => ({
  id: r.id,
  taskId: r.task_id ?? undefined,
  actorId: r.actor_id ?? undefined,
  type: r.type,
  meta: r.meta ?? {},
  createdAt: r.created_at,
});
/* eslint-enable @typescript-eslint/no-explicit-any */

// ── workspaces ────────────────────────────────────────────────────────
export async function loadMyWorkspaces(
  db: DB,
  userId: string,
): Promise<Workspace[]> {
  // Filter to the current user's own membership rows. Without this, RLS (which
  // lets members see all co-members) would also return other members' rows for
  // shared workspaces — making the user inherit someone else's role.
  const { data, error } = await db
    .from("workspace_members")
    .select("role, workspaces(id, name, icon, created_by)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[])
    .filter((r) => r.workspaces)
    .map((r) => ({
      id: r.workspaces.id,
      name: r.workspaces.name,
      icon: r.workspaces.icon,
      createdBy: r.workspaces.created_by ?? undefined,
      role: r.role as Role,
    }));
}

export async function createWorkspace(
  db: DB,
  name: string,
  icon: string,
  userId: string,
): Promise<Workspace> {
  const { data, error } = await db
    .from("workspaces")
    .insert({ name, icon, created_by: userId })
    .select("id, name, icon, created_by")
    .single();
  if (error) throw error;
  return {
    id: data.id,
    name: data.name,
    icon: data.icon,
    createdBy: data.created_by,
    role: "owner",
  };
}

export async function updateWorkspaceRow(
  db: DB,
  id: ID,
  patch: Partial<Pick<Workspace, "name" | "icon">>,
): Promise<void> {
  const { error } = await db.from("workspaces").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteWorkspaceRow(db: DB, id: ID): Promise<void> {
  const { error } = await db.from("workspaces").delete().eq("id", id);
  if (error) throw error;
}

// ── members ───────────────────────────────────────────────────────────
export async function loadMembers(db: DB, workspaceId: ID): Promise<Member[]> {
  const { data: rows, error } = await db
    .from("workspace_members")
    .select("user_id, role")
    .eq("workspace_id", workspaceId);
  if (error) throw error;
  const ids = (rows ?? []).map((r) => r.user_id);
  if (ids.length === 0) return [];
  const { data: profiles, error: pErr } = await db
    .from("profiles")
    .select("id, name, email, avatar_url")
    .in("id", ids);
  if (pErr) throw pErr;
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
  return (rows ?? []).map((r) => {
    const p = byId.get(r.user_id);
    return {
      userId: r.user_id,
      role: r.role as Role,
      name: p?.name ?? p?.email?.split("@")[0] ?? "สมาชิก",
      email: p?.email ?? "",
      avatarUrl: p?.avatar_url ?? undefined,
    };
  });
}

export async function updateMemberRole(
  db: DB,
  workspaceId: ID,
  userId: ID,
  role: Role,
): Promise<void> {
  const { error } = await db
    .from("workspace_members")
    .update({ role })
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function removeMember(
  db: DB,
  workspaceId: ID,
  userId: ID,
): Promise<void> {
  const { error } = await db
    .from("workspace_members")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId);
  if (error) throw error;
}

// ── invites ───────────────────────────────────────────────────────────
export async function loadInvites(db: DB, workspaceId: ID): Promise<Invite[]> {
  const { data, error } = await db
    .from("workspace_invites")
    .select("id, email, role, token, status, created_at")
    .eq("workspace_id", workspaceId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map((r) => ({
    id: r.id,
    email: r.email,
    role: r.role,
    token: r.token,
    status: r.status,
    createdAt: r.created_at,
  }));
}

export async function createInvite(
  db: DB,
  workspaceId: ID,
  email: string,
  role: Exclude<Role, "owner">,
  invitedBy: string,
): Promise<Invite> {
  const { data, error } = await db
    .from("workspace_invites")
    .insert({ workspace_id: workspaceId, email, role, invited_by: invitedBy })
    .select("id, email, role, token, status, created_at")
    .single();
  if (error) throw error;
  return {
    id: data.id,
    email: data.email,
    role: data.role,
    token: data.token,
    status: data.status,
    createdAt: data.created_at,
  };
}

export async function revokeInvite(db: DB, id: ID): Promise<void> {
  const { error } = await db.from("workspace_invites").delete().eq("id", id);
  if (error) throw error;
}

export async function loadMyPendingInvites(db: DB): Promise<PendingInvite[]> {
  // Uses a SECURITY DEFINER function — an invitee isn't a workspace member yet,
  // so they can't read the workspace row directly.
  const { data, error } = await db.rpc("my_pending_invites");
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map((r) => ({
    token: r.token,
    role: r.role,
    workspaceId: r.workspace_id,
    workspaceName: r.workspace_name,
    workspaceIcon: r.workspace_icon,
  }));
}

export async function acceptInvite(db: DB, token: string): Promise<string> {
  const { data, error } = await db.rpc("accept_invite", { invite_token: token });
  if (error) throw error;
  return data as string;
}

export async function invitePreview(db: DB, token: string) {
  const { data, error } = await db.rpc("invite_preview", { invite_token: token });
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = (data as any[])?.[0];
  return row
    ? {
        workspaceId: row.workspace_id as string,
        workspaceName: row.workspace_name as string,
        workspaceIcon: row.workspace_icon as string,
        role: row.role as string,
        status: row.status as string,
      }
    : null;
}

// ── access requests (request to join a workspace) ─────────────────────
export async function workspaceAccessInfo(db: DB, workspaceId: ID) {
  const { data, error } = await db.rpc("workspace_access_info", {
    p_workspace: workspaceId,
  });
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = (data as any[])?.[0];
  return row
    ? {
        name: row.name as string,
        icon: (row.icon as string) ?? "🏢",
        isMember: Boolean(row.is_member),
        requestStatus: (row.request_status as string | null) ?? null,
      }
    : null;
}

export async function requestWorkspaceAccess(
  db: DB,
  workspaceId: ID,
): Promise<string> {
  const { data, error } = await db.rpc("request_workspace_access", {
    p_workspace: workspaceId,
  });
  if (error) throw error;
  return data as string;
}

export interface AccessRequest {
  id: ID;
  userId: ID;
  name: string;
  email: string;
  avatarUrl?: string;
  createdAt: string;
}

export async function loadAccessRequests(
  db: DB,
  workspaceId: ID,
): Promise<AccessRequest[]> {
  const { data, error } = await db.rpc("pending_access_requests", {
    p_workspace: workspaceId,
  });
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data as any[]) ?? []).map((r) => ({
    id: r.id,
    userId: r.user_id,
    name: r.name ?? r.email?.split("@")[0] ?? "ผู้ใช้",
    email: r.email ?? "",
    avatarUrl: r.avatar_url ?? undefined,
    createdAt: r.created_at,
  }));
}

export async function approveAccessRequest(db: DB, requestId: ID): Promise<void> {
  const { error } = await db.rpc("approve_access_request", { p_request: requestId });
  if (error) throw error;
}

export async function rejectAccessRequest(db: DB, requestId: ID): Promise<void> {
  const { error } = await db.rpc("reject_access_request", { p_request: requestId });
  if (error) throw error;
}

// ── workspace bundle (projects + tasks + subtasks) ────────────────────
export async function loadBundle(
  db: DB,
  workspaceId: ID,
): Promise<{ projects: Project[]; tasks: Task[]; subtasks: Subtask[] }> {
  const [projectsRes, tasksRes, subtasksRes] = await Promise.all([
    db.from("projects").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: true }),
    db.from("tasks").select("*").eq("workspace_id", workspaceId).order("order", { ascending: true }),
    db.from("subtasks").select("*").eq("workspace_id", workspaceId).order("order", { ascending: true }),
  ]);
  if (projectsRes.error) throw projectsRes.error;
  if (tasksRes.error) throw tasksRes.error;
  if (subtasksRes.error) throw subtasksRes.error;
  return {
    projects: (projectsRes.data ?? []).map(mapProject),
    tasks: (tasksRes.data ?? []).map(mapTask),
    subtasks: (subtasksRes.data ?? []).map(mapSubtask),
  };
}

// ── projects ──────────────────────────────────────────────────────────
export async function insertProject(
  db: DB,
  project: Project,
  ownerId: string,
): Promise<void> {
  const { error } = await db.from("projects").insert({
    id: project.id,
    workspace_id: project.workspaceId,
    owner_id: ownerId,
    name: project.name,
    icon: project.icon,
  });
  if (error) throw error;
}

export async function updateProjectRow(
  db: DB,
  id: ID,
  patch: Partial<Pick<Project, "name" | "icon">>,
): Promise<void> {
  const { error } = await db.from("projects").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteProjectRow(db: DB, id: ID): Promise<void> {
  const { error } = await db.from("projects").delete().eq("id", id);
  if (error) throw error;
}

// ── tasks ─────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function taskPatchToRow(patch: Partial<Task>): Record<string, any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row: Record<string, any> = {};
  if ("title" in patch) row.title = patch.title;
  if ("description" in patch) row.description = patch.description;
  if ("status" in patch) row.status = patch.status;
  if ("priority" in patch) row.priority = patch.priority;
  if ("assigneeId" in patch) row.assignee_id = patch.assigneeId || null;
  if ("dueDate" in patch) row.due_date = patch.dueDate || null;
  if ("tags" in patch) row.tags = patch.tags;
  if ("order" in patch) row.order = patch.order;
  return row;
}

export async function insertTask(db: DB, task: Task, ownerId: string): Promise<void> {
  const { error } = await db.from("tasks").insert({
    id: task.id,
    workspace_id: task.workspaceId,
    project_id: task.projectId,
    owner_id: ownerId,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    assignee_id: task.assigneeId || null,
    due_date: task.dueDate || null,
    tags: task.tags,
    order: task.order,
  });
  if (error) throw error;
}

export async function updateTaskRow(db: DB, id: ID, patch: Partial<Task>): Promise<void> {
  const { error } = await db.from("tasks").update(taskPatchToRow(patch)).eq("id", id);
  if (error) throw error;
}

export async function deleteTaskRow(db: DB, id: ID): Promise<void> {
  const { error } = await db.from("tasks").delete().eq("id", id);
  if (error) throw error;
}

// ── subtasks ──────────────────────────────────────────────────────────
export async function insertSubtask(
  db: DB,
  subtask: Subtask,
  workspaceId: ID,
): Promise<void> {
  const { error } = await db.from("subtasks").insert({
    id: subtask.id,
    task_id: subtask.taskId,
    workspace_id: workspaceId,
    title: subtask.title,
    done: subtask.done,
    order: subtask.order,
  });
  if (error) throw error;
}

export async function updateSubtaskRow(
  db: DB,
  id: ID,
  patch: Partial<Pick<Subtask, "title" | "done" | "order">>,
): Promise<void> {
  const { error } = await db.from("subtasks").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteSubtaskRow(db: DB, id: ID): Promise<void> {
  const { error } = await db.from("subtasks").delete().eq("id", id);
  if (error) throw error;
}

// ── comments ──────────────────────────────────────────────────────────
export async function loadComments(db: DB, taskId: ID): Promise<Comment[]> {
  const { data, error } = await db
    .from("comments")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapComment);
}

export async function insertComment(
  db: DB,
  taskId: ID,
  workspaceId: ID,
  authorId: string,
  body: string,
): Promise<Comment> {
  const { data, error } = await db
    .from("comments")
    .insert({ task_id: taskId, workspace_id: workspaceId, author_id: authorId, body })
    .select("*")
    .single();
  if (error) throw error;
  return mapComment(data);
}

export async function deleteCommentRow(db: DB, id: ID): Promise<void> {
  const { error } = await db.from("comments").delete().eq("id", id);
  if (error) throw error;
}

// ── activity ──────────────────────────────────────────────────────────
/** status→done events across a workspace since a date (for completion charts). */
export async function loadDoneEvents(
  db: DB,
  workspaceId: ID,
  sinceIso: string,
): Promise<string[]> {
  const { data, error } = await db
    .from("activities")
    .select("created_at, meta")
    .eq("workspace_id", workspaceId)
    .eq("type", "status_changed")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: true })
    .limit(1000);
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[])
    .filter((r) => r.meta?.to === "done")
    .map((r) => r.created_at as string);
}

export async function loadActivities(db: DB, taskId: ID): Promise<Activity[]> {
  const { data, error } = await db
    .from("activities")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map(mapActivity);
}

export async function logActivity(
  db: DB,
  args: {
    workspaceId: ID;
    taskId: ID | null;
    actorId: string;
    type: ActivityType;
    meta?: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await db.from("activities").insert({
    workspace_id: args.workspaceId,
    task_id: args.taskId,
    actor_id: args.actorId,
    type: args.type,
    meta: args.meta ?? {},
  });
  if (error) throw error;
}

// ── notifications ─────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const mapNotification = (r: any): Notification => ({
  id: r.id,
  workspaceId: r.workspace_id ?? undefined,
  taskId: r.task_id ?? undefined,
  actorId: r.actor_id ?? undefined,
  type: r.type,
  taskTitle: r.task_title ?? undefined,
  read: r.read,
  createdAt: r.created_at,
});

export async function loadNotifications(db: DB): Promise<Notification[]> {
  const { data, error } = await db
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map(mapNotification);
}

export async function markNotificationRead(db: DB, id: ID): Promise<void> {
  const { error } = await db.from("notifications").update({ read: true }).eq("id", id);
  if (error) throw error;
}

export async function markAllNotificationsRead(db: DB, userId: string): Promise<void> {
  const { error } = await db
    .from("notifications")
    .update({ read: true })
    .eq("user_id", userId)
    .eq("read", false);
  if (error) throw error;
}

// ── LINE integration ──────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapLineLink = (r: any): WorkspaceLineLink => ({
  workspaceId: r.workspace_id,
  targetType: r.target_type,
  targetId: r.target_id ?? undefined,
  targetName: r.target_name ?? undefined,
  notifyOnAssign: r.notify_on_assign,
  notifyOnComment: r.notify_on_comment,
  notifyOnStatus: r.notify_on_status,
  dmAssignee: r.dm_assignee,
  enabled: r.enabled,
});

export async function loadLineLink(
  db: DB,
  workspaceId: ID,
): Promise<WorkspaceLineLink | null> {
  const { data, error } = await db
    .from("workspace_line_links")
    .select("*")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapLineLink(data) : null;
}

export async function upsertLineLink(
  db: DB,
  workspaceId: ID,
  patch: Partial<Omit<WorkspaceLineLink, "workspaceId">>,
): Promise<WorkspaceLineLink> {
  const row: Record<string, unknown> = { workspace_id: workspaceId };
  if ("targetType" in patch) row.target_type = patch.targetType;
  if ("targetId" in patch) row.target_id = patch.targetId || null;
  if ("targetName" in patch) row.target_name = patch.targetName || null;
  if ("notifyOnAssign" in patch) row.notify_on_assign = patch.notifyOnAssign;
  if ("notifyOnComment" in patch) row.notify_on_comment = patch.notifyOnComment;
  if ("notifyOnStatus" in patch) row.notify_on_status = patch.notifyOnStatus;
  if ("dmAssignee" in patch) row.dm_assignee = patch.dmAssignee;
  if ("enabled" in patch) row.enabled = patch.enabled;
  const { data, error } = await db
    .from("workspace_line_links")
    .upsert(row, { onConflict: "workspace_id" })
    .select("*")
    .single();
  if (error) throw error;
  return mapLineLink(data);
}

/**
 * Loads the LINE link summary for several workspaces at once (used by the
 * /line/connect page to show which of the user's workspaces are already linked
 * to a group). RLS limits the rows to workspaces the caller is a member of.
 */
export async function loadLineLinksForWorkspaces(
  db: DB,
  workspaceIds: ID[],
): Promise<
  Record<string, { targetId?: string; targetName?: string; enabled: boolean }>
> {
  if (workspaceIds.length === 0) return {};
  const { data, error } = await db
    .from("workspace_line_links")
    .select("workspace_id, target_id, target_name, enabled")
    .in("workspace_id", workspaceIds);
  if (error) throw error;
  const map: Record<
    string,
    { targetId?: string; targetName?: string; enabled: boolean }
  > = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ((data as any[]) ?? []).forEach((r) => {
    map[r.workspace_id] = {
      targetId: r.target_id ?? undefined,
      targetName: r.target_name ?? undefined,
      enabled: r.enabled,
    };
  });
  return map;
}

/** Invokes the `line-send` edge function (no-op until it's deployed). */
export async function invokeLineSend(
  db: DB,
  body: Record<string, unknown>,
): Promise<void> {
  const { error } = await db.functions.invoke("line-send", { body });
  if (error) throw error;
}

/**
 * Loads a single task + its project/assignee names for the /line/task page
 * (the web "take / complete" flow reached from a LINE card button). RLS only
 * returns the row if the caller is a member of the task's workspace.
 */
export async function loadTaskForLine(
  db: DB,
  taskId: ID,
): Promise<{ task: Task; projectName?: string; assigneeName?: string } | null> {
  const { data, error } = await db
    .from("tasks")
    .select("*")
    .eq("id", taskId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const task = mapTask(data);
  const [proj, assignee] = await Promise.all([
    db.from("projects").select("name").eq("id", task.projectId).maybeSingle(),
    task.assigneeId
      ? db.from("profiles").select("name").eq("id", task.assigneeId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  return {
    task,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    projectName: (proj as any).data?.name ?? undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assigneeName: (assignee as any).data?.name ?? undefined,
  };
}

// ── attachments (Supabase Storage) ────────────────────────────────────
const ATT_BUCKET = "task-attachments";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapAttachment = (r: any): Attachment => ({
  id: r.id,
  taskId: r.task_id,
  uploaderId: r.uploader_id ?? undefined,
  name: r.name,
  path: r.path,
  mime: r.mime ?? undefined,
  size: r.size ?? undefined,
  createdAt: r.created_at,
});

export async function loadAttachments(db: DB, taskId: ID): Promise<Attachment[]> {
  const { data, error } = await db
    .from("attachments")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapAttachment);
}

/** Batch-create signed download URLs for private attachment paths. */
export async function signAttachmentUrls(
  db: DB,
  paths: string[],
): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data, error } = await db.storage
    .from(ATT_BUCKET)
    .createSignedUrls(paths, 3600);
  if (error) throw error;
  const map: Record<string, string> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (data ?? []).forEach((d: any) => {
    if (d.path && d.signedUrl) map[d.path] = d.signedUrl;
  });
  return map;
}

export async function uploadAttachment(
  db: DB,
  file: File,
  taskId: ID,
  workspaceId: ID,
  uploaderId: string,
): Promise<Attachment> {
  const safe = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${workspaceId}/${taskId}/${uuid()}-${safe}`;
  const up = await db.storage
    .from(ATT_BUCKET)
    .upload(path, file, { contentType: file.type || undefined });
  if (up.error) throw up.error;
  const { data, error } = await db
    .from("attachments")
    .insert({
      task_id: taskId,
      workspace_id: workspaceId,
      uploader_id: uploaderId,
      name: file.name,
      path,
      mime: file.type || null,
      size: file.size,
    })
    .select("*")
    .single();
  if (error) throw error;
  return mapAttachment(data);
}

export async function deleteAttachment(db: DB, att: Attachment): Promise<void> {
  // Link attachments have no storage object (path holds the URL).
  if (att.mime !== "link") await db.storage.from(ATT_BUCKET).remove([att.path]);
  const { error } = await db.from("attachments").delete().eq("id", att.id);
  if (error) throw error;
}

/**
 * Adds a link "attachment" (no file). Reuses the attachments table: `path`
 * stores the URL and `mime` is the sentinel "link" — so no schema change.
 */
export async function insertLinkAttachment(
  db: DB,
  taskId: ID,
  workspaceId: ID,
  uploaderId: string,
  url: string,
  name: string,
): Promise<Attachment> {
  const { data, error } = await db
    .from("attachments")
    .insert({
      task_id: taskId,
      workspace_id: workspaceId,
      uploader_id: uploaderId,
      name: name || url,
      path: url,
      mime: "link",
      size: null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return mapAttachment(data);
}

/** First image attachment per task in a workspace → signed thumbnail URL. */
export async function loadTaskImages(
  db: DB,
  workspaceId: ID,
): Promise<Record<string, string>> {
  const { data, error } = await db
    .from("attachments")
    .select("task_id, path, created_at")
    .eq("workspace_id", workspaceId)
    .like("mime", "image/%")
    .order("created_at", { ascending: true });
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = ((data as any[]) ?? []) as { task_id: string; path: string }[];
  const firstByTask = new Map<string, string>();
  for (const r of rows) if (!firstByTask.has(r.task_id)) firstByTask.set(r.task_id, r.path);
  if (firstByTask.size === 0) return {};
  const signed = await signAttachmentUrls(db, [...firstByTask.values()]).catch(
    () => ({}) as Record<string, string>,
  );
  const out: Record<string, string> = {};
  for (const [taskId, path] of firstByTask) if (signed[path]) out[taskId] = signed[path];
  return out;
}

// ── avatar / profile ──────────────────────────────────────────────────
export async function uploadAvatar(
  db: DB,
  file: File,
  userId: string,
): Promise<string> {
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const path = `${userId}/${uuid()}.${ext}`;
  const up = await db.storage
    .from("avatars")
    .upload(path, file, { contentType: file.type || undefined, upsert: true });
  if (up.error) throw up.error;
  return db.storage.from("avatars").getPublicUrl(path).data.publicUrl;
}

export async function updateProfileRow(
  db: DB,
  userId: string,
  patch: { name?: string; avatarUrl?: string },
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.avatarUrl !== undefined) row.avatar_url = patch.avatarUrl;
  const { error } = await db.from("profiles").update(row).eq("id", userId);
  if (error) throw error;
}

// ── first-login starter content ───────────────────────────────────────
export async function seedStarterData(
  db: DB,
  workspaceId: ID,
  ownerId: string,
): Promise<{ projects: Project[]; tasks: Task[] }> {
  const nowIso = new Date().toISOString();
  const project: Project = {
    id: uuid(),
    workspaceId,
    name: "เริ่มต้นใช้งาน",
    icon: "🚀",
    createdAt: nowIso,
  };
  const base = {
    workspaceId,
    projectId: project.id,
    description: "",
    tags: [] as string[],
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  const tasks: Task[] = [
    { ...base, id: uuid(), title: "ยินดีต้อนรับสู่ JaaiNgan 🎉", status: "done", priority: "none", order: 0, tags: ["welcome"] },
    { ...base, id: uuid(), title: "คลิกการ์ดนี้เพื่อแก้ไข + เพิ่ม subtask/คอมเมนต์", status: "in_progress", priority: "medium", order: 0 },
    { ...base, id: uuid(), title: "เชิญเพื่อนร่วมทีมจากเมนู workspace ด้านบนซ้าย", status: "todo", priority: "high", order: 0 },
    { ...base, id: uuid(), title: "ลากการ์ดข้ามคอลัมน์เพื่อเปลี่ยนสถานะ", status: "backlog", priority: "low", order: 0 },
  ];

  await insertProject(db, project, ownerId);
  const { error } = await db.from("tasks").insert(
    tasks.map((t) => ({
      id: t.id,
      workspace_id: workspaceId,
      project_id: t.projectId,
      owner_id: ownerId,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      assignee_id: null,
      due_date: null,
      tags: t.tags,
      order: t.order,
    })),
  );
  if (error) throw error;
  return { projects: [project], tasks };
}
