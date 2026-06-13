-- =====================================================================
-- JaaiNgan · 04 — Workspaces & collaboration
--   * workspaces + members + email/link invites
--   * projects & tasks become workspace-scoped; tasks gain assignee_id
--   * subtasks, comments, activity log
--   * backfill: existing data → a personal workspace per owner
-- =====================================================================

-- ── Workspaces ────────────────────────────────────────────────────────
create table if not exists public.workspaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  icon        text not null default '🏢',
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  role         text not null default 'member' check (role in ('owner','admin','member')),
  created_at   timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index if not exists workspace_members_user_idx on public.workspace_members (user_id);

create table if not exists public.workspace_invites (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email        text not null,
  role         text not null default 'member' check (role in ('admin','member')),
  token        text not null unique default replace(gen_random_uuid()::text, '-', ''),
  invited_by   uuid references auth.users (id) on delete set null,
  status       text not null default 'pending' check (status in ('pending','accepted','revoked')),
  created_at   timestamptz not null default now()
);
create index if not exists workspace_invites_email_idx on public.workspace_invites (lower(email));
create index if not exists workspace_invites_ws_idx on public.workspace_invites (workspace_id);

-- Auto-add the creator as the workspace owner.
create or replace function public.handle_new_workspace()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new.id, new.created_by, 'owner')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_workspace_created on public.workspaces;
create trigger on_workspace_created
  after insert on public.workspaces
  for each row when (new.created_by is not null)
  execute function public.handle_new_workspace();

-- ── Attach existing tables to workspaces ──────────────────────────────
alter table public.projects
  add column if not exists workspace_id uuid references public.workspaces (id) on delete cascade;

alter table public.tasks
  add column if not exists workspace_id uuid references public.workspaces (id) on delete cascade;
alter table public.tasks
  add column if not exists assignee_id uuid references auth.users (id) on delete set null;

-- ── Subtasks / comments / activity ────────────────────────────────────
create table if not exists public.subtasks (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references public.tasks (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  title        text not null default '',
  done         boolean not null default false,
  "order"      double precision not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists subtasks_task_idx on public.subtasks (task_id);

create table if not exists public.comments (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references public.tasks (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  author_id    uuid references auth.users (id) on delete set null,
  body         text not null,
  created_at   timestamptz not null default now()
);
create index if not exists comments_task_idx on public.comments (task_id);

create table if not exists public.activities (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  task_id      uuid references public.tasks (id) on delete set null,
  actor_id     uuid references auth.users (id) on delete set null,
  type         text not null,
  meta         jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists activities_task_idx on public.activities (task_id, created_at desc);
create index if not exists activities_ws_idx on public.activities (workspace_id, created_at desc);

-- ── Backfill existing projects/tasks into a personal workspace ─────────
do $$
declare r record; ws uuid;
begin
  for r in (
    select distinct owner_id from public.projects
    where workspace_id is null and owner_id is not null
  ) loop
    insert into public.workspaces (name, icon, created_by)
      values ('พื้นที่ทำงานของฉัน', '🏠', r.owner_id)
      returning id into ws;
    update public.projects set workspace_id = ws where owner_id = r.owner_id and workspace_id is null;
    update public.tasks    set workspace_id = ws where owner_id = r.owner_id and workspace_id is null;
  end loop;
end $$;

-- Old free-text assignee can't map to real users — drop it.
alter table public.tasks drop column if exists assignee;

-- Enforce workspace membership now that data is backfilled.
alter table public.projects alter column workspace_id set not null;
alter table public.tasks    alter column workspace_id set not null;
