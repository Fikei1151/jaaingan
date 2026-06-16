-- =====================================================================
-- JaaiNgan · 12 — LINE group display name
--   target_name: human-readable LINE group/room name, fetched from the LINE
--   Messaging API the moment a group connects (via the line-webhook function).
--   Lets the workspace LINE settings show "เชื่อมอยู่กับกลุ่ม: <ชื่อ>" instead of
--   only the raw destination id.
-- =====================================================================

alter table public.workspace_line_links
  add column if not exists target_name text;
