-- =====================================================================
-- JaaiNgan · 13 — Workspace access requests
--   A non-member who opens a workspace link (e.g. from the LINE /งาน command)
--   can request access; an owner/admin approves → they become a member.
--   All mutations go through SECURITY DEFINER RPCs so a non-member can read a
--   workspace's name / file a request without broad table grants.
-- =====================================================================

create table if not exists public.access_requests (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  status       text not null default 'pending'
                 check (status in ('pending', 'approved', 'rejected')),
  created_at   timestamptz not null default now(),
  unique (workspace_id, user_id)
);
create index if not exists access_requests_ws_idx on public.access_requests (workspace_id);

alter table public.access_requests enable row level security;

drop policy if exists "ar_select" on public.access_requests;
create policy "ar_select" on public.access_requests for select
  using (user_id = auth.uid() or public.is_workspace_admin(workspace_id));
-- inserts / status changes happen only via the SECURITY DEFINER functions below.

-- ── workspace info for the /w/<id> page (works for non-members) ────────
create or replace function public.workspace_access_info(p_workspace uuid)
returns table (name text, icon text, is_member boolean, request_status text)
language sql security definer set search_path = public as $$
  select
    w.name,
    w.icon,
    exists (
      select 1 from workspace_members m
      where m.workspace_id = w.id and m.user_id = auth.uid()
    ),
    (select ar.status from access_requests ar
       where ar.workspace_id = w.id and ar.user_id = auth.uid())
  from workspaces w
  where w.id = p_workspace;
$$;

-- ── file (or refresh) a request + notify owners/admins ────────────────
create or replace function public.request_workspace_access(p_workspace uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_name text;
begin
  if not exists (select 1 from workspaces where id = p_workspace) then
    raise exception 'workspace not found';
  end if;
  if exists (
    select 1 from workspace_members
    where workspace_id = p_workspace and user_id = auth.uid()
  ) then
    return 'member';
  end if;

  select coalesce(name, email, 'ผู้ใช้') into v_name
    from profiles where id = auth.uid();

  insert into access_requests (workspace_id, user_id, status)
    values (p_workspace, auth.uid(), 'pending')
    on conflict (workspace_id, user_id)
      do update set status = 'pending', created_at = now();

  -- bell notification for every owner/admin of the workspace
  insert into notifications (user_id, workspace_id, actor_id, type, task_title)
    select m.user_id, p_workspace, auth.uid(), 'access_request', v_name
    from workspace_members m
    where m.workspace_id = p_workspace and m.role in ('owner', 'admin');

  return 'pending';
end; $$;

-- ── pending requests for a workspace (admins only) ────────────────────
create or replace function public.pending_access_requests(p_workspace uuid)
returns table (
  id uuid, user_id uuid, name text, email text, avatar_url text, created_at timestamptz
)
language sql security definer set search_path = public as $$
  select ar.id, ar.user_id, p.name, p.email, p.avatar_url, ar.created_at
  from access_requests ar
  join profiles p on p.id = ar.user_id
  where ar.workspace_id = p_workspace
    and ar.status = 'pending'
    and public.is_workspace_admin(p_workspace)
  order by ar.created_at desc;
$$;

-- ── approve → add membership (admins only) ────────────────────────────
create or replace function public.approve_access_request(p_request uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_ws uuid; v_user uuid;
begin
  select workspace_id, user_id into v_ws, v_user
    from access_requests where id = p_request;
  if v_ws is null then raise exception 'request not found'; end if;
  if not public.is_workspace_admin(v_ws) then raise exception 'forbidden'; end if;

  insert into workspace_members (workspace_id, user_id, role)
    values (v_ws, v_user, 'member')
    on conflict do nothing;
  update access_requests set status = 'approved' where id = p_request;
end; $$;

-- ── reject (admins only) ──────────────────────────────────────────────
create or replace function public.reject_access_request(p_request uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_ws uuid;
begin
  select workspace_id into v_ws from access_requests where id = p_request;
  if v_ws is null then raise exception 'request not found'; end if;
  if not public.is_workspace_admin(v_ws) then raise exception 'forbidden'; end if;
  update access_requests set status = 'rejected' where id = p_request;
end; $$;

grant execute on function public.workspace_access_info(uuid) to authenticated;
grant execute on function public.request_workspace_access(uuid) to authenticated;
grant execute on function public.pending_access_requests(uuid) to authenticated;
grant execute on function public.approve_access_request(uuid) to authenticated;
grant execute on function public.reject_access_request(uuid) to authenticated;
