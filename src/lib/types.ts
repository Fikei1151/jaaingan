/**
 * Core domain types for JaaiNgan.
 *
 * These map to the Supabase tables in `supabase/migrations/`, so the
 * localStorage demo layer and the Supabase layer share one shape.
 */

export type ID = string;

export type StatusKey = "backlog" | "todo" | "in_progress" | "done";

export type PriorityKey = "none" | "low" | "medium" | "high" | "urgent";

export type ViewKey = "board" | "table" | "list" | "calendar";

export type Role = "owner" | "admin" | "member";

export interface User {
  id: ID;
  name: string;
  email: string;
  avatarUrl?: string;
}

export interface Workspace {
  id: ID;
  name: string;
  icon: string;
  /** The signed-in user's role in this workspace. */
  role: Role;
  createdBy?: ID;
}

export interface Member {
  userId: ID;
  role: Role;
  name: string;
  email: string;
  avatarUrl?: string;
}

export interface Invite {
  id: ID;
  email: string;
  role: Exclude<Role, "owner">;
  token: string;
  status: "pending" | "accepted" | "revoked";
  createdAt: string;
}

/** An invite addressed to the signed-in user (shown for acceptance). */
export interface PendingInvite {
  token: string;
  workspaceId: ID;
  workspaceName: string;
  workspaceIcon: string;
  role: Exclude<Role, "owner">;
}

export interface Project {
  id: ID;
  workspaceId: ID;
  name: string;
  icon: string;
  createdAt: string;
}

export interface Task {
  id: ID;
  workspaceId: ID;
  projectId: ID;
  title: string;
  description: string;
  status: StatusKey;
  priority: PriorityKey;
  /** User id of the assigned member, or undefined. */
  assigneeId?: ID;
  dueDate?: string;
  tags: string[];
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface Subtask {
  id: ID;
  taskId: ID;
  title: string;
  done: boolean;
  order: number;
}

export interface Comment {
  id: ID;
  taskId: ID;
  authorId?: ID;
  body: string;
  createdAt: string;
}

export type ActivityType =
  | "created"
  | "status_changed"
  | "assigned"
  | "unassigned"
  | "priority_changed"
  | "commented"
  | "completed";

export interface Activity {
  id: ID;
  taskId?: ID;
  actorId?: ID;
  type: ActivityType;
  meta: Record<string, unknown>;
  createdAt: string;
}

export interface Notification {
  id: ID;
  workspaceId?: ID;
  taskId?: ID;
  actorId?: ID;
  type: string;
  taskTitle?: string;
  read: boolean;
  createdAt: string;
}

export interface WorkspaceLineLink {
  workspaceId: ID;
  targetType: "group" | "room" | "user";
  targetId?: string;
  notifyOnAssign: boolean;
  notifyOnComment: boolean;
  notifyOnStatus: boolean;
  /** Also DM the assignee directly (requires their linked LINE account). */
  dmAssignee: boolean;
  enabled: boolean;
}

/** Persisted shape for the localStorage demo layer. */
export interface DemoState {
  projects: Project[];
  tasks: Task[];
  subtasks: Subtask[];
  selectedProjectId: ID | null;
}
