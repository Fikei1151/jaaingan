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
        cmd("เชื่อมกลุ่ม", "เชื่อมกลุ่มนี้กับ workspace — บอทจะส่งลิงก์ให้เลือก workspace"),
        cmd("จ่ายงานเข้ากลุ่ม", "เหมือน “เชื่อมกลุ่ม”"),
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
