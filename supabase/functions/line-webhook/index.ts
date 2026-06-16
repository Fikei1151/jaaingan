// Supabase Edge Function: line-webhook
// Receives LINE Messaging API webhook events. Two jobs:
//   1. When the bot is added to a group OR someone types a connect command
//      ("เชื่อมกลุ่ม" / "จ่ายงานเข้ากลุ่ม" / "id" / "connect"), reply with a card
//      whose button deep-links to <APP_URL>/line/connect?gid=...&name=... so an
//      admin can pick which workspace this group should notify.
//   2. Handle the postback buttons on the assignment Flex card
//      ("รับงานนี้" / "ทำเสร็จแล้ว") and update the task.
//
// Deploy:
//   supabase secrets set LINE_CHANNEL_SECRET=...           (for signature check)
//   supabase secrets set LINE_CHANNEL_ACCESS_TOKEN=...     (to reply)
//   supabase secrets set APP_URL=https://jaaingan.vercel.app   (for the deep link)
//   supabase functions deploy line-webhook --no-verify-jwt
// Then set the webhook URL in the LINE console to this function's URL.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const REPLY_URL = "https://api.line.me/v2/bot/message/reply";

// Messages that ask the bot for the connect link (optional leading slash).
const CONNECT_CMD =
  /^\s*\/?\s*(เชื่อมกลุ่ม|จ่ายงานเข้ากลุ่ม|เชื่อมงาน|connect|groupid|id)\s*$/i;

// "/งาน" → reply links to the workspace(s) this chat is connected to.
const TASKS_CMD = /^\s*\/?\s*(งาน|tasks?|มอบหมาย)\s*$/i;

// "/ของฉัน" → reply the sender's own open tasks in the connected workspace(s).
const MINE_CMD = /^\s*\/?\s*(ของฉัน|งานฉัน|งานของฉัน|me|mytasks)\s*$/i;

const STATUS_TH: Record<string, string> = {
  backlog: "ค้าง",
  todo: "รอทำ",
  in_progress: "กำลังทำ",
  done: "เสร็จ",
};

function bangkokToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

type SourceKind = "group" | "room" | "user";

// Fetches a LINE group's display name (best-effort; only works for groups the
// bot is a member of). Returns undefined for rooms/users or on any failure.
async function fetchGroupName(
  token: string,
  groupId: string,
): Promise<string | undefined> {
  try {
    const res = await fetch(
      `https://api.line.me/v2/bot/group/${groupId}/summary`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return undefined;
    const j = await res.json();
    return typeof j.groupName === "string" ? j.groupName : undefined;
  } catch {
    return undefined;
  }
}

// deno-lint-ignore no-explicit-any
function connectCard(appUrl: string, id: string, kind: SourceKind, name?: string): any {
  const url =
    `${appUrl.replace(/\/$/, "")}/line/connect?gid=${encodeURIComponent(id)}&t=${kind}` +
    (name ? `&name=${encodeURIComponent(name)}` : "");
  return {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#06C755",
      paddingAll: "16px",
      contents: [
        { type: "text", text: "เชื่อม LINE กับ JaaiNgan", color: "#ffffff", weight: "bold", size: "md" },
      ],
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        { type: "text", text: name ?? "แชตนี้", weight: "bold", size: "lg", wrap: true },
        {
          type: "text",
          text: "กดปุ่มด้านล่างเพื่อเลือก workspace ที่จะให้แจ้งเตือนงานเข้าแชตนี้",
          size: "sm",
          color: "#787774",
          wrap: true,
        },
        { type: "text", text: `ID: ${id}`, size: "xxs", color: "#aaaaaa", wrap: true, margin: "md" },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "button",
          style: "primary",
          color: "#06C755",
          height: "sm",
          action: { type: "uri", label: "เลือก workspace ที่จะเชื่อม", uri: url },
        },
      ],
    },
  };
}

// deno-lint-ignore no-explicit-any
function tasksCard(appUrl: string, links: any[]): any {
  const base = appUrl.replace(/\/$/, "");
  return {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#2383e2",
      paddingAll: "16px",
      contents: [
        { type: "text", text: "📋 งานของทีม", color: "#ffffff", weight: "bold", size: "md" },
      ],
    },
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "เปิดดูงานของพื้นที่ทำงานที่เชื่อมกับกลุ่มนี้ (ต้องเป็นสมาชิก หรือขอสิทธิ์เข้าถึง)",
          size: "sm",
          color: "#787774",
          wrap: true,
        },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: links.slice(0, 4).map((l) => ({
        type: "button",
        style: "primary",
        color: "#2383e2",
        height: "sm",
        action: {
          type: "uri",
          label: `${l.workspaces?.icon ?? "📋"} ${l.workspaces?.name ?? "งาน"}`.slice(0, 38),
          uri: `${base}/w/${l.workspace_id}`,
        },
      })),
    },
  };
}

// deno-lint-ignore no-explicit-any
function myTasksCard(name: string, tasks: any[], appUrl: string | undefined, today: string): any {
  // deno-lint-ignore no-explicit-any
  const body: any[] = [];
  if (tasks.length === 0) {
    body.push({
      type: "text",
      text: "🎉 ไม่มีงานค้างที่มอบหมายให้คุณ",
      size: "sm",
      color: "#448361",
      wrap: true,
    });
  } else {
    tasks.slice(0, 10).forEach((t, i) => {
      if (i > 0) body.push({ type: "separator", margin: "md" });
      const overdue = t.due_date && t.due_date < today;
      const dueTxt = t.due_date
        ? overdue
          ? `⛔ เลยกำหนด ${t.due_date}`
          : `📅 ${t.due_date}`
        : "";
      body.push({
        type: "box",
        layout: "vertical",
        margin: "md",
        contents: [
          { type: "text", text: t.title || "ไม่มีชื่องาน", size: "sm", weight: "bold", wrap: true },
          {
            type: "text",
            text: `${STATUS_TH[t.status] ?? t.status}${dueTxt ? "  ·  " + dueTxt : ""}`,
            size: "xxs",
            color: overdue ? "#e03e3e" : "#9b9a97",
            wrap: true,
          },
        ],
      });
    });
    if (tasks.length > 10)
      body.push({ type: "text", text: `…และอีก ${tasks.length - 10} งาน`, size: "xs", color: "#9b9a97", margin: "md" });
  }
  return {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#2383e2",
      paddingAll: "16px",
      contents: [
        { type: "text", text: "📋 งานของฉัน", color: "#ffffff", weight: "bold", size: "md" },
        { type: "text", text: name, color: "#dCE9FB", size: "sm" },
      ],
    },
    body: { type: "box", layout: "vertical", contents: body },
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
  };
}

// deno-lint-ignore no-explicit-any
function helpCard(): any {
  const cmd = (c: string, desc: string) => ({
    type: "box",
    layout: "vertical",
    margin: "md",
    contents: [
      { type: "text", text: c, weight: "bold", size: "sm", color: "#06C755" },
      { type: "text", text: desc, size: "xs", color: "#787774", wrap: true },
    ],
  });
  return {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#2383e2",
      paddingAll: "16px",
      contents: [
        { type: "text", text: "🤖 คำสั่ง JaaiNgan", color: "#ffffff", weight: "bold", size: "md" },
        { type: "text", text: "พิมพ์คำสั่งเหล่านี้ในกลุ่มได้เลย", color: "#dCE9FB", size: "xs" },
      ],
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        cmd("เชื่อมกลุ่ม", "เชื่อมกลุ่มนี้กับ workspace (พิมพ์ จ่ายงานเข้ากลุ่ม ก็ได้)"),
        cmd("งาน", "เปิดลิงก์ดูงานของ workspace ที่เชื่อมกับกลุ่มนี้"),
        cmd("ของฉัน", "ดูงานที่มอบหมายให้คุณ (เชื่อมบัญชี LINE ก่อน)"),
        cmd("id", "ขอ Group ID ของกลุ่มนี้"),
        { type: "separator", margin: "lg" },
        {
          type: "text",
          text: "เวลามอบหมายงาน บอทจะส่งการ์ดให้กด “รับงาน/ทำเสร็จ” ในกลุ่มอัตโนมัติ",
          size: "xs",
          color: "#9b9a97",
          wrap: true,
          margin: "md",
        },
      ],
    },
  };
}

async function replyFlex(
  token: string,
  replyToken: string,
  altText: string,
  // deno-lint-ignore no-explicit-any
  contents: any,
) {
  await fetch(REPLY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ replyToken, messages: [{ type: "flex", altText, contents }] }),
  });
}

async function verifySignature(secret: string, body: string, signature: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
  return expected === signature;
}

async function reply(token: string, replyToken: string, text: string) {
  await fetch(REPLY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ replyToken, messages: [{ type: "text", text }] }),
  });
}

Deno.serve(async (req) => {
  const secret = Deno.env.get("LINE_CHANNEL_SECRET");
  const accessToken = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN");
  if (!secret || !accessToken) return new Response("not configured", { status: 500 });

  const raw = await req.text();
  const signature = req.headers.get("x-line-signature") ?? "";
  if (!(await verifySignature(secret, raw, signature))) {
    return new Response("bad signature", { status: 401 });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const payload = JSON.parse(raw);
  const appUrl = Deno.env.get("APP_URL");
  for (const event of payload.events ?? []) {
    const text: string = event.message?.text ?? "";

    // "/" (a single slash) → reply with the command help card.
    if (event.type === "message" && /^\s*\/\s*$/.test(text)) {
      if (event.replyToken)
        await replyFlex(accessToken, event.replyToken, "คำสั่ง JaaiNgan", helpCard());
      continue;
    }

    // Bot added to a group/room → brief greeting only (NO connect card), so no
    // one can mis-tap "connect"; the setup person sends a command when ready.
    if (event.type === "join") {
      if (event.replyToken)
        await reply(
          accessToken,
          event.replyToken,
          'สวัสดีครับ 👋 ผมคือบอท JaaiNgan\nพิมพ์ "เชื่อมกลุ่ม" เมื่อต้องการเชื่อมห้องนี้กับ workspace ของคุณ (หรือพิมพ์ "/" เพื่อดูคำสั่งทั้งหมด)',
        );
      continue;
    }

    // Connect command → reply the workspace-picker card linking to /line/connect
    // (fallback: raw id as text when APP_URL isn't set).
    if (event.type === "message" && CONNECT_CMD.test(text)) {
      const src = event.source ?? {};
      const id: string | undefined = src.groupId ?? src.roomId ?? src.userId;
      const kind: SourceKind =
        src.type === "group" ? "group" : src.type === "room" ? "room" : "user";
      if (event.replyToken && id) {
        const name =
          kind === "group" ? await fetchGroupName(accessToken, id) : undefined;
        if (appUrl) {
          await replyFlex(
            accessToken,
            event.replyToken,
            "เชื่อม LINE กับ JaaiNgan",
            connectCard(appUrl, id, kind, name),
          );
        } else {
          // APP_URL not set yet → fall back to the manual copy-paste flow.
          const label =
            kind === "group" ? "Group" : kind === "room" ? "Room" : "User";
          await reply(
            accessToken,
            event.replyToken,
            `✅ พร้อมเชื่อมกับ JaaiNgan\n\n${label} ID:\n${id}\n\nคัดลอก ID นี้ไปวางในแอป → เมนู workspace (มุมซ้ายบน) → “เชื่อมต่อ LINE” → วางในช่อง Destination ID แล้วกดบันทึก`,
          );
        }
      }
      continue;
    }

    // "/งาน" → reply links to the workspace(s) connected to this chat.
    if (event.type === "message" && TASKS_CMD.test(text)) {
      const src = event.source ?? {};
      const id: string | undefined = src.groupId ?? src.roomId ?? src.userId;
      if (event.replyToken && id) {
        const { data: links } = await admin
          .from("workspace_line_links")
          .select("workspace_id, workspaces(name, icon)")
          .eq("target_id", id)
          .eq("enabled", true);
        // deno-lint-ignore no-explicit-any
        const list = ((links ?? []) as any[]).filter((l) => l.workspaces);
        if (list.length === 0) {
          await reply(
            accessToken,
            event.replyToken,
            'กลุ่มนี้ยังไม่ได้เชื่อมกับ workspace — พิมพ์ "เชื่อมกลุ่ม" เพื่อเชื่อมก่อน',
          );
        } else if (appUrl) {
          await replyFlex(
            accessToken,
            event.replyToken,
            "งานของทีม",
            tasksCard(appUrl, list),
          );
        }
      }
      continue;
    }

    // "/ของฉัน" → the sender's own open tasks in this chat's workspace(s).
    if (event.type === "message" && MINE_CMD.test(text)) {
      const src = event.source ?? {};
      const gid: string | undefined = src.groupId ?? src.roomId ?? src.userId;
      const lineUserId: string | undefined = src.userId;
      if (event.replyToken && gid) {
        if (!lineUserId) {
          await reply(accessToken, event.replyToken, "ดูงานส่วนตัวได้เฉพาะในแชตที่ระบุตัวตนได้");
        } else {
          const { data: profile } = await admin
            .from("profiles")
            .select("id, name")
            .eq("line_user_id", lineUserId)
            .maybeSingle();
          if (!profile) {
            await reply(
              accessToken,
              event.replyToken,
              'ยังไม่ได้เชื่อมบัญชี LINE กับ JaaiNgan\nเปิดแอป → เมนูบัญชี (มุมล่างซ้าย) → "เชื่อมบัญชี LINE ของฉัน"',
            );
          } else {
            const { data: links } = await admin
              .from("workspace_line_links")
              .select("workspace_id")
              .eq("target_id", gid)
              .eq("enabled", true);
            // deno-lint-ignore no-explicit-any
            const wsIds = ((links ?? []) as any[]).map((l) => l.workspace_id);
            if (wsIds.length === 0) {
              await reply(
                accessToken,
                event.replyToken,
                'กลุ่มนี้ยังไม่ได้เชื่อมกับ workspace — พิมพ์ "เชื่อมกลุ่ม" ก่อน',
              );
            } else {
              const { data: tasks } = await admin
                .from("tasks")
                .select("title, status, due_date")
                .in("workspace_id", wsIds)
                .eq("assignee_id", profile.id)
                .neq("status", "done")
                .order("due_date", { ascending: true })
                .limit(50);
              await replyFlex(
                accessToken,
                event.replyToken,
                `งานของ ${profile.name}`,
                myTasksCard(profile.name ?? "คุณ", tasks ?? [], appUrl, bangkokToday()),
              );
            }
          }
        }
      }
      continue;
    }

    if (event.type !== "postback") continue;
    const params = new URLSearchParams(event.postback?.data ?? "");
    const action = params.get("action");
    const taskId = params.get("taskId");
    const lineUserId: string | undefined = event.source?.userId;
    if (!action || !taskId || !lineUserId) continue;

    // Map the LINE user → app user.
    const { data: profile } = await admin
      .from("profiles")
      .select("id, name")
      .eq("line_user_id", lineUserId)
      .maybeSingle();
    if (!profile) {
      await reply(accessToken, event.replyToken, "กรุณาเชื่อมบัญชี LINE กับ JaaiNgan ก่อน");
      continue;
    }

    // Load the task + verify membership.
    const { data: task } = await admin
      .from("tasks")
      .select("id, title, workspace_id")
      .eq("id", taskId)
      .maybeSingle();
    if (!task) continue;
    const { data: membership } = await admin
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", task.workspace_id)
      .eq("user_id", profile.id)
      .maybeSingle();
    if (!membership) {
      await reply(accessToken, event.replyToken, "คุณไม่ได้อยู่ใน workspace นี้");
      continue;
    }

    if (action === "take") {
      await admin.from("tasks").update({ assignee_id: profile.id }).eq("id", taskId);
      await reply(accessToken, event.replyToken, `รับงาน "${task.title}" แล้ว ✅`);
    } else if (action === "done") {
      await admin.from("tasks").update({ status: "done" }).eq("id", taskId);
      await reply(accessToken, event.replyToken, `ทำเครื่องหมายว่า "${task.title}" เสร็จแล้ว 🏁`);
    }
  }

  return new Response("ok");
});
