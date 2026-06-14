-- =====================================================================
-- JaaiNgan · 10 — Storage: avatars + task attachments
--   * avatars bucket (public, image-only) — per-user folder by uid
--   * task-attachments bucket (private) — per-workspace folder; signed URLs
--   * attachments metadata table (RLS by workspace membership)
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 5242880,
   array['image/png','image/jpeg','image/webp','image/gif']),
  ('task-attachments', 'task-attachments', false, 26214400, null)
on conflict (id) do nothing;

-- ── attachments metadata ──────────────────────────────────────────────
create table if not exists public.attachments (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references public.tasks (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  uploader_id  uuid references auth.users (id) on delete set null,
  name         text not null,
  path         text not null,
  mime         text,
  size         bigint,
  created_at   timestamptz not null default now()
);
create index if not exists attachments_task_idx on public.attachments (task_id);

alter table public.attachments enable row level security;

drop policy if exists "att_select" on public.attachments;
create policy "att_select" on public.attachments for select
  using (public.is_workspace_member(workspace_id));
drop policy if exists "att_insert" on public.attachments;
create policy "att_insert" on public.attachments for insert
  with check (public.is_workspace_member(workspace_id) and uploader_id = auth.uid());
drop policy if exists "att_delete" on public.attachments;
create policy "att_delete" on public.attachments for delete
  using (public.is_workspace_member(workspace_id));

-- ── storage RLS: avatars (public read, owner-folder write) ────────────
drop policy if exists "avatars_read" on storage.objects;
create policy "avatars_read" on storage.objects for select
  using (bucket_id = 'avatars');
drop policy if exists "avatars_write" on storage.objects;
create policy "avatars_write" on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatars_update" on storage.objects;
create policy "avatars_update" on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatars_delete" on storage.objects;
create policy "avatars_delete" on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ── storage RLS: task-attachments (workspace members; path=<wsId>/<taskId>/file)
drop policy if exists "att_obj_select" on storage.objects;
create policy "att_obj_select" on storage.objects for select
  using (bucket_id = 'task-attachments'
         and public.is_workspace_member(((storage.foldername(name))[1])::uuid));
drop policy if exists "att_obj_insert" on storage.objects;
create policy "att_obj_insert" on storage.objects for insert
  with check (bucket_id = 'task-attachments'
              and public.is_workspace_member(((storage.foldername(name))[1])::uuid));
drop policy if exists "att_obj_delete" on storage.objects;
create policy "att_obj_delete" on storage.objects for delete
  using (bucket_id = 'task-attachments'
         and public.is_workspace_member(((storage.foldername(name))[1])::uuid));
