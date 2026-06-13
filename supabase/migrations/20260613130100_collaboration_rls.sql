-- =====================================================================
-- JaaiNgan · 05 — RLS for collaboration
--   SECURITY DEFINER helpers break the recursion that workspace-based
--   policies would otherwise hit when checking membership.
-- =====================================================================

create or replace function public.is_workspace_member(ws uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws and user_id = auth.uid()
  );
$$;

create or replace function public.is_workspace_admin(ws uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws and user_id = auth.uid() and role in ('owner','admin')
  );
$$;

create or replace function public.workspace_role(ws uuid)
returns text language sql security definer stable set search_path = public as $$
  select role from public.workspace_members
  where workspace_id = ws and user_id = auth.uid();
$$;

create or replace function public.shares_workspace(other uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1
    from public.workspace_members m1
    join public.workspace_members m2 on m1.workspace_id = m2.workspace_id
    where m1.user_id = auth.uid() and m2.user_id = other
  );
$$;

-- ── Enable RLS ────────────────────────────────────────────────────────
alter table public.workspaces        enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invites enable row level security;
alter table public.subtasks          enable row level security;
alter table public.comments          enable row level security;
alter table public.activities        enable row level security;

-- ── workspaces ────────────────────────────────────────────────────────
drop policy if exists "ws_select" on public.workspaces;
create policy "ws_select" on public.workspaces for select using (public.is_workspace_member(id));
drop policy if exists "ws_insert" on public.workspaces;
create policy "ws_insert" on public.workspaces for insert with check (created_by = auth.uid());
drop policy if exists "ws_update" on public.workspaces;
create policy "ws_update" on public.workspaces for update using (public.is_workspace_admin(id)) with check (public.is_workspace_admin(id));
drop policy if exists "ws_delete" on public.workspaces;
create policy "ws_delete" on public.workspaces for delete using (public.workspace_role(id) = 'owner');

-- ── workspace_members ─────────────────────────────────────────────────
drop policy if exists "wm_select" on public.workspace_members;
create policy "wm_select" on public.workspace_members for select using (public.is_workspace_member(workspace_id));
drop policy if exists "wm_insert" on public.workspace_members;
create policy "wm_insert" on public.workspace_members for insert with check (public.is_workspace_admin(workspace_id));
drop policy if exists "wm_update" on public.workspace_members;
create policy "wm_update" on public.workspace_members for update using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));
drop policy if exists "wm_delete" on public.workspace_members;
create policy "wm_delete" on public.workspace_members for delete using (public.is_workspace_admin(workspace_id) or user_id = auth.uid());

-- ── workspace_invites ─────────────────────────────────────────────────
drop policy if exists "wi_select" on public.workspace_invites;
create policy "wi_select" on public.workspace_invites for select using (
  public.is_workspace_admin(workspace_id)
  or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);
drop policy if exists "wi_insert" on public.workspace_invites;
create policy "wi_insert" on public.workspace_invites for insert with check (public.is_workspace_admin(workspace_id));
drop policy if exists "wi_update" on public.workspace_invites;
create policy "wi_update" on public.workspace_invites for update using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));
drop policy if exists "wi_delete" on public.workspace_invites;
create policy "wi_delete" on public.workspace_invites for delete using (public.is_workspace_admin(workspace_id));

-- ── projects (replace owner-only policy) ──────────────────────────────
drop policy if exists "own projects" on public.projects;
drop policy if exists "proj_all" on public.projects;
create policy "proj_all" on public.projects for all
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

-- ── tasks (replace owner-only policy) ─────────────────────────────────
drop policy if exists "own tasks" on public.tasks;
drop policy if exists "task_all" on public.tasks;
create policy "task_all" on public.tasks for all
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

-- ── subtasks / comments / activities ──────────────────────────────────
drop policy if exists "subtask_all" on public.subtasks;
create policy "subtask_all" on public.subtasks for all
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists "comment_select" on public.comments;
create policy "comment_select" on public.comments for select using (public.is_workspace_member(workspace_id));
drop policy if exists "comment_insert" on public.comments;
create policy "comment_insert" on public.comments for insert with check (public.is_workspace_member(workspace_id) and author_id = auth.uid());
drop policy if exists "comment_modify" on public.comments;
create policy "comment_modify" on public.comments for delete using (author_id = auth.uid() or public.is_workspace_admin(workspace_id));

drop policy if exists "activity_select" on public.activities;
create policy "activity_select" on public.activities for select using (public.is_workspace_member(workspace_id));
drop policy if exists "activity_insert" on public.activities;
create policy "activity_insert" on public.activities for insert with check (public.is_workspace_member(workspace_id) and actor_id = auth.uid());

-- ── profiles: let workspace co-members read each other ────────────────
drop policy if exists "own profile" on public.profiles;
drop policy if exists "profile_select" on public.profiles;
create policy "profile_select" on public.profiles for select using (id = auth.uid() or public.shares_workspace(id));
drop policy if exists "profile_insert" on public.profiles;
create policy "profile_insert" on public.profiles for insert with check (id = auth.uid());
drop policy if exists "profile_update" on public.profiles;
create policy "profile_update" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- ── Invite helpers ────────────────────────────────────────────────────
-- Preview an invite by token (works even if the viewer's email differs).
create or replace function public.invite_preview(invite_token text)
returns table (workspace_id uuid, workspace_name text, workspace_icon text, role text, status text)
language sql security definer stable set search_path = public as $$
  select w.id, w.name, w.icon, i.role, i.status
  from public.workspace_invites i
  join public.workspaces w on w.id = i.workspace_id
  where i.token = invite_token;
$$;
grant execute on function public.invite_preview(text) to authenticated, anon;

-- Accept an invite by token: join the workspace, mark the invite accepted.
create or replace function public.accept_invite(invite_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare inv record;
begin
  select * into inv from public.workspace_invites where token = invite_token and status = 'pending';
  if inv is null then
    raise exception 'invite_not_found_or_used';
  end if;
  insert into public.workspace_members (workspace_id, user_id, role)
    values (inv.workspace_id, auth.uid(), inv.role)
    on conflict (workspace_id, user_id) do nothing;
  update public.workspace_invites set status = 'accepted' where id = inv.id;
  return inv.workspace_id;
end;
$$;
grant execute on function public.accept_invite(text) to authenticated;
