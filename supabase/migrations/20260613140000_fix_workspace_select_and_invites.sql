-- =====================================================================
-- JaaiNgan · 06 — fixes
--   1) Creator can SELECT their workspace. Without this, `insert ... returning`
--      (used by the app's createWorkspace) fails the SELECT policy because the
--      membership row added by the AFTER-INSERT trigger isn't visible yet.
--   2) Invitees need workspace name/icon for pending invites, but they are not
--      members yet (so the workspace SELECT policy hides it). A SECURITY DEFINER
--      function returns just the needed fields.
-- =====================================================================

drop policy if exists "ws_select" on public.workspaces;
create policy "ws_select" on public.workspaces for select
  using (public.is_workspace_member(id) or created_by = auth.uid());

create or replace function public.my_pending_invites()
returns table (
  token text,
  role text,
  workspace_id uuid,
  workspace_name text,
  workspace_icon text
)
language sql security definer stable set search_path = public as $$
  select i.token, i.role, w.id, w.name, w.icon
  from public.workspace_invites i
  join public.workspaces w on w.id = i.workspace_id
  where i.status = 'pending'
    and lower(i.email) = lower(coalesce(auth.jwt() ->> 'email', ''));
$$;
grant execute on function public.my_pending_invites() to authenticated;
