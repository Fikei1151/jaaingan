-- =====================================================================
-- JaaiNgan · 11 — Web Push subscriptions
--   Stores each device's push subscription. Activated once VAPID keys + the
--   web-push edge function are deployed (see supabase/functions/web-push).
-- =====================================================================

create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subs_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_own" on public.push_subscriptions;
create policy "push_own" on public.push_subscriptions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
