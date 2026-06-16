// Supabase Edge Function: line-daily-summary
// Sends a morning Flex digest of each workspace's open tasks to its LINE group.
// Meant to be run on a schedule (not by end users).
//
// Deploy:
//   supabase secrets set CRON_SECRET=<random>           (shared secret)
//   supabase secrets set LINE_CHANNEL_ACCESS_TOKEN=...
//   supabase functions deploy line-daily-summary --no-verify-jwt
//
// Schedule it (Supabase dashboard "Cron", or pg_cron + pg_net) to POST here
// daily with header  Authorization: Bearer <CRON_SECRET>.
//   select cron.schedule('jaaingan-daily', '0 1 * * *',  -- 08:00 Asia/Bangkok
//     $$ select net.http_post(
//          url := 'https://<ref>.functions.supabase.co/line-daily-summary',
//          headers := '{"Authorization":"Bearer <CRON_SECRET>"}'::jsonb) $$);

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PUSH_URL = "https://api.line.me/v2/bot/message/push";

function bangkokToday(): string {
  // yyyy-mm-dd in Asia/Bangkok.
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

// deno-lint-ignore no-explicit-any
function digestFlex(
  workspaceName: string,
  // deno-lint-ignore no-explicit-any
  stats: any,
  urgent: { icon: string; color: string; title: string }[],
  appUrl?: string,
  // deno-lint-ignore no-explicit-any
): any {
  const row = (label: string, value: number, color: string) => ({
    type: "box",
    layout: "horizontal",
    contents: [
      { type: "text", text: label, size: "sm", color: "#555555" },
      { type: "text", text: String(value), size: "sm", color, align: "end", weight: "bold" },
    ],
  });
  // deno-lint-ignore no-explicit-any
  const body: any[] = [
    row("⛔ เลยกำหนด", stats.overdue, "#e03e3e"),
    row("📍 ครบกำหนดวันนี้", stats.dueToday, "#d9730d"),
    row("🔧 กำลังทำ", stats.inProgress, "#dfab01"),
    row("📋 ค้างทั้งหมด", stats.open, "#37352f"),
  ];
  if (urgent.length > 0) {
    body.push({ type: "separator", margin: "md" });
    body.push({ type: "text", text: "ต้องรีบ", size: "xs", color: "#9b9a97", margin: "md" });
    for (const u of urgent.slice(0, 6)) {
      body.push({ type: "text", text: `${u.icon} ${u.title}`, size: "xs", color: u.color, wrap: true });
    }
    if (urgent.length > 6)
      body.push({ type: "text", text: `…และอีก ${urgent.length - 6} งาน`, size: "xs", color: "#9b9a97" });
  }
  return {
    type: "flex",
    altText: `สรุปงานวันนี้ — ${workspaceName}`,
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#2383e2",
        paddingAll: "16px",
        contents: [
          { type: "text", text: "🗓️ สรุปงานประจำวัน", color: "#ffffff", weight: "bold" },
          { type: "text", text: workspaceName, color: "#dCE9FB", size: "sm" },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: body,
      },
      ...(appUrl
        ? {
            footer: {
              type: "box",
              layout: "vertical",
              contents: [
                {
                  type: "button",
                  style: "primary",
                  color: "#2383e2",
                  height: "sm",
                  action: { type: "uri", label: "เปิด JaaiNgan", uri: appUrl },
                },
              ],
            },
          }
        : {}),
    },
  };
}

Deno.serve(async (req) => {
  const cronSecret = Deno.env.get("CRON_SECRET");
  const token = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN");
  if (!cronSecret || !token) return new Response("not configured", { status: 500 });
  if (req.headers.get("Authorization") !== `Bearer ${cronSecret}`) {
    return new Response("unauthorized", { status: 401 });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const today = bangkokToday();
  const appUrl = Deno.env.get("APP_URL") ?? undefined;

  const { data: links } = await admin
    .from("workspace_line_links")
    .select("workspace_id, target_id, enabled, workspaces(name)")
    .eq("enabled", true)
    .not("target_id", "is", null);

  let sent = 0;
  for (const link of links ?? []) {
    const { data: tasks } = await admin
      .from("tasks")
      .select("title, status, due_date")
      .eq("workspace_id", link.workspace_id)
      .neq("status", "done");
    const open = tasks ?? [];
    const stats = {
      open: open.length,
      inProgress: open.filter((t) => t.status === "in_progress").length,
      overdue: open.filter((t) => t.due_date && t.due_date < today).length,
      dueToday: open.filter((t) => t.due_date === today).length,
    };
    if (stats.open === 0) continue;

    const urgent = [
      ...open
        .filter((t) => t.due_date && t.due_date < today)
        .map((t) => ({ icon: "⛔", color: "#e03e3e", title: t.title || "ไม่มีชื่องาน" })),
      ...open
        .filter((t) => t.due_date === today)
        .map((t) => ({ icon: "📍", color: "#d9730d", title: t.title || "ไม่มีชื่องาน" })),
    ];

    // deno-lint-ignore no-explicit-any
    const name = (link as any).workspaces?.name ?? "Workspace";
    const flex = digestFlex(name, stats, urgent, appUrl);
    const res = await fetch(PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ to: link.target_id, messages: [flex] }),
    });
    if (res.ok) sent++;
  }

  return new Response(JSON.stringify({ workspaces: links?.length ?? 0, sent }), {
    headers: { "Content-Type": "application/json" },
  });
});
