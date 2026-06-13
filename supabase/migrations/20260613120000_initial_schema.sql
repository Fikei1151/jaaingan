-- =====================================================================
-- JaaiNgan · 01 — core schema (profiles, projects, tasks)
-- Tables mirror src/lib/types.ts
-- =====================================================================

-- Profiles: one row per authenticated user, auto-created on sign up
-- (see migration 03 for the trigger).
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  name        text,
  avatar_url  text,
  created_at  timestamptz not null default now()
);

create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  icon        text not null default '📋',
  created_at  timestamptz not null default now()
);

create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  owner_id    uuid not null references auth.users (id) on delete cascade,
  title       text not null default '',
  description text not null default '',
  status      text not null default 'todo'
                check (status in ('backlog','todo','in_progress','done')),
  priority    text not null default 'none'
                check (priority in ('none','low','medium','high','urgent')),
  assignee    text,
  due_date    date,
  tags        text[] not null default '{}',
  "order"     double precision not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists projects_owner_id_idx on public.projects (owner_id);
create index if not exists tasks_project_id_idx  on public.tasks (project_id);
create index if not exists tasks_owner_id_idx     on public.tasks (owner_id);
