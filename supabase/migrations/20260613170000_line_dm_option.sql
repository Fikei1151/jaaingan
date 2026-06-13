-- =====================================================================
-- JaaiNgan · 09 — LINE delivery option
--   dm_assignee: also send a direct LINE message to the assignee (if they've
--   linked their LINE account), in addition to / instead of the group push.
-- =====================================================================

alter table public.workspace_line_links
  add column if not exists dm_assignee boolean not null default true;
