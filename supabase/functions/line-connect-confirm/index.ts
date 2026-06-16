// Supabase Edge Function: line-connect-confirm
// After a workspace is linked to a LINE chat from the web /line/connect page,
// the client calls this to post a "connected ✅" confirmation INTO that LINE
// group/chat, showing the workspace name. Uses the workspace's stored target_id
// (never a client-supplied destination) and verifies the caller is a member.
//
// Deploy:  supabase functions deploy line-connect-confirm

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LINE_PUSH = "https://api.line.me/v2/bot/message/push";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const token = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN");
  if (!token) return json({ ok: false, error: "LINE not configured" }, 500);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Identify the caller.
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: ud } = await userClient.auth.getUser();
  if (!ud.user) return json({ ok: false, error: "unauthorized" }, 401);

  let body: { workspaceId?: string };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "invalid body" }, 400);
  }
  const workspaceId = body.workspaceId;
  if (!workspaceId) return json({ ok: false, error: "missing workspaceId" }, 400);

  const admin = createClient(supabaseUrl, serviceKey);

  // Caller must be a member of the workspace.
  const { data: member } = await admin
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", ud.user.id)
    .maybeSingle();
  if (!member) return json({ ok: false, error: "forbidden" }, 403);

  const [{ data: link }, { data: ws }] = await Promise.all([
    admin
      .from("workspace_line_links")
      .select("target_id, target_name")
      .eq("workspace_id", workspaceId)
      .maybeSingle(),
    admin.from("workspaces").select("name, icon").eq("id", workspaceId).maybeSingle(),
  ]);
  if (!link?.target_id) return json({ ok: false, error: "no target" });

  const wsName = ws?.name ?? "Workspace";
  const wsIcon = ws?.icon ?? "🏠";
  const flex = {
    type: "flex",
    altText: `✅ เชื่อมกับ ${wsName} สำเร็จ`,
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#06C755",
        paddingAll: "16px",
        contents: [
          { type: "text", text: "✅ เชื่อมกลุ่มสำเร็จ", color: "#ffffff", weight: "bold", size: "md" },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          { type: "text", text: `${wsIcon} ${wsName}`, weight: "bold", size: "lg", wrap: true },
          {
            type: "text",
            text: "ตั้งแต่นี้ งานที่มอบหมาย/อัปเดตในพื้นที่ทำงานนี้ จะแจ้งเตือนเข้ากลุ่มนี้อัตโนมัติ",
            size: "sm",
            color: "#787774",
            wrap: true,
          },
        ],
      },
    },
  };

  const res = await fetch(LINE_PUSH, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ to: link.target_id, messages: [flex] }),
  });

  return json({ ok: res.ok, status: res.status });
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
