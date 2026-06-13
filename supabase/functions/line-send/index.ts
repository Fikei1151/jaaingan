// Supabase Edge Function: line-send
// Pushes a LINE Flex Message when something happens in a workspace (e.g. a task
// is assigned). Called from the client via supabase.functions.invoke("line-send").
//
// Deploy (once you have a LINE Messaging API channel):
//   supabase secrets set LINE_CHANNEL_ACCESS_TOKEN=xxxx
//   supabase functions deploy line-send
//
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are injected
// automatically by the Edge runtime.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LINE_PUSH = "https://api.line.me/v2/bot/message/push";

interface SendBody {
  workspaceId: string;
  taskId?: string;
  kind: "assigned" | "comment" | "status";
  taskTitle: string;
  projectName?: string;
  assigneeId?: string;
  actorName?: string;
  status?: string;
  appUrl?: string;
}

// deno-lint-ignore no-explicit-any
function assignedFlex(b: SendBody): any {
  return {
    type: "flex",
    altText: `📌 มอบหมายงาน: ${b.taskTitle}`,
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#2383e2",
        paddingAll: "16px",
        contents: [
          { type: "text", text: "📌 งานใหม่ที่ได้รับมอบหมาย", color: "#ffffff", weight: "bold", size: "md" },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          { type: "text", text: b.taskTitle, weight: "bold", size: "lg", wrap: true },
          ...(b.projectName
            ? [{ type: "text", text: `📁 ${b.projectName}`, size: "sm", color: "#787774", wrap: true }]
            : []),
          ...(b.actorName
            ? [{ type: "text", text: `โดย ${b.actorName}`, size: "xs", color: "#9b9a97", margin: "md" }]
            : []),
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          // Interactive buttons → handled by the line-webhook function.
          ...(b.taskId
            ? [
                {
                  type: "button",
                  style: "primary",
                  color: "#06C755",
                  height: "sm",
                  action: {
                    type: "postback",
                    label: "✅ รับงานนี้",
                    data: `action=take&taskId=${b.taskId}`,
                    displayText: "รับงานนี้",
                  },
                },
                {
                  type: "button",
                  style: "secondary",
                  height: "sm",
                  action: {
                    type: "postback",
                    label: "🏁 ทำเสร็จแล้ว",
                    data: `action=done&taskId=${b.taskId}`,
                    displayText: "ทำเสร็จแล้ว",
                  },
                },
              ]
            : []),
          ...(b.appUrl
            ? [
                {
                  type: "button",
                  style: "link",
                  height: "sm",
                  action: { type: "uri", label: "เปิดใน JaaiNgan", uri: b.appUrl },
                },
              ]
            : []),
        ],
      },
    },
  };
}

// deno-lint-ignore no-explicit-any
function genericFlex(b: SendBody): any {
  const title =
    b.kind === "comment" ? "💬 มีคอมเมนต์ใหม่" : `🔄 อัปเดตสถานะ: ${b.status ?? ""}`;
  return {
    type: "flex",
    altText: `${title} — ${b.taskTitle}`,
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          { type: "text", text: title, weight: "bold", size: "md" },
          { type: "text", text: b.taskTitle, size: "sm", color: "#787774", wrap: true },
        ],
      },
    },
  };
}

async function pushLine(token: string, to: string, message: unknown) {
  const res = await fetch(LINE_PUSH, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ to, messages: [message] }),
  });
  return { ok: res.ok, status: res.status, body: await res.text() };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const token = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN");
  if (!token) {
    return json({ error: "LINE_CHANNEL_ACCESS_TOKEN not set" }, 500);
  }

  // Identify the caller from their JWT.
  const authHeader = req.headers.get("Authorization") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await userClient.auth.getUser();
  const caller = userData.user;
  if (!caller) return json({ error: "unauthorized" }, 401);

  let body: SendBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid body" }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey);

  // Caller must be a member of the workspace.
  const { data: membership } = await admin
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", body.workspaceId)
    .eq("user_id", caller.id)
    .maybeSingle();
  if (!membership) return json({ error: "forbidden" }, 403);

  const { data: link } = await admin
    .from("workspace_line_links")
    .select("*")
    .eq("workspace_id", body.workspaceId)
    .maybeSingle();

  const message = body.kind === "assigned" ? assignedFlex(body) : genericFlex(body);
  const results: unknown[] = [];

  // 1) Group / room target.
  const eventEnabled =
    link?.enabled &&
    ((body.kind === "assigned" && link.notify_on_assign) ||
      (body.kind === "comment" && link.notify_on_comment) ||
      (body.kind === "status" && link.notify_on_status));
  if (eventEnabled && link?.target_id) {
    results.push(await pushLine(token, link.target_id, message));
  }

  // 2) Personal push to the assignee (assignments only, if DM is enabled).
  if (body.kind === "assigned" && body.assigneeId && link?.dm_assignee) {
    const { data: profile } = await admin
      .from("profiles")
      .select("line_user_id")
      .eq("id", body.assigneeId)
      .maybeSingle();
    if (profile?.line_user_id) {
      results.push(await pushLine(token, profile.line_user_id, message));
    }
  }

  return json({ sent: results.length, results });
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
