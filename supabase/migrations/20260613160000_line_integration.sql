-- =====================================================================
-- JaaiNgan · 08 — LINE integration (scaffold)
--   * profiles.line_user_id      → links an app user to their LINE account
--   * workspace_line_links       → one LINE group/room/user target per workspace
--   The actual sending happens in the `line-send` edge function (uses the
--   Messaging API channel access token from Supabase secrets).
-- =====================================================================

alter table public.profiles
  add column if not exists line_user_id text;

create table if not exists public.workspace_line_links (
  workspace_id      uuid primary key references public.workspaces (id) on delete cascade,
  target_type       text not null default 'group'
                      check (target_type in ('group', 'room', 'user')),
  target_id         text,            -- LINE destination id to push to
  notify_on_assign  boolean not null default true,
  notify_on_comment boolean not null default false,
  notify_on_status  boolean not null default false,
  enabled           boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.workspace_line_links enable row level security;

drop policy if exists "wll_select" on public.workspace_line_links;
create policy "wll_select" on public.workspace_line_links for select
  using (public.is_workspace_member(workspace_id));
drop policy if exists "wll_insert" on public.workspace_line_links;
create policy "wll_insert" on public.workspace_line_links for insert
  with check (public.is_workspace_admin(workspace_id));
drop policy if exists "wll_update" on public.workspace_line_links;
create policy "wll_update" on public.workspace_line_links for update
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));
drop policy if exists "wll_delete" on public.workspace_line_links;
create policy "wll_delete" on public.workspace_line_links for delete
  using (public.is_workspace_admin(workspace_id));

drop trigger if exists wll_touch_updated_at on public.workspace_line_links;
create trigger wll_touch_updated_at
  before update on public.workspace_line_links
  for each row execute function public.touch_updated_at();
