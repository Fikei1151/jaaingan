-- =====================================================================
-- JaaiNgan · 07 — Realtime + assignment notifications
--   * notifications table (+ RLS) populated by a trigger when a task is
--     assigned to someone other than the actor
--   * enable Realtime (publication + REPLICA IDENTITY FULL) for the tables
--     the client subscribes to
-- =====================================================================

-- ── notifications ─────────────────────────────────────────────────────
create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade, -- recipient
  workspace_id uuid references public.workspaces (id) on delete cascade,
  task_id      uuid references public.tasks (id) on delete set null,
  actor_id     uuid references auth.users (id) on delete set null,
  type         text not null default 'assigned',
  task_title   text,
  read         boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists notifications_user_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "notif_select" on public.notifications;
create policy "notif_select" on public.notifications for select
  using (user_id = auth.uid());
drop policy if exists "notif_update" on public.notifications;
create policy "notif_update" on public.notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "notif_delete" on public.notifications;
create policy "notif_delete" on public.notifications for delete
  using (user_id = auth.uid());

-- Insert a notification when a task gains/changes an assignee (≠ the actor).
create or replace function public.notify_assignee()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.assignee_id is not null
     and new.assignee_id is distinct from old.assignee_id
     and new.assignee_id <> auth.uid()
  then
    insert into public.notifications (user_id, workspace_id, task_id, actor_id, type, task_title)
    values (new.assignee_id, new.workspace_id, new.id, auth.uid(), 'assigned', new.title);
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_notify_assignee on public.tasks;
create trigger tasks_notify_assignee
  after insert or update of assignee_id on public.tasks
  for each row execute function public.notify_assignee();

-- ── Realtime ──────────────────────────────────────────────────────────
-- Full row image so UPDATE/DELETE payloads carry enough data to reconcile.
alter table public.tasks             replica identity full;
alter table public.projects          replica identity full;
alter table public.subtasks          replica identity full;
alter table public.comments          replica identity full;
alter table public.workspace_members replica identity full;
alter table public.notifications     replica identity full;

do $$
declare t text;
begin
  foreach t in array array[
    'tasks','projects','subtasks','comments','workspace_members','notifications'
  ] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception
      when duplicate_object then null;
    end;
  end loop;
end $$;
