// Supabase Edge Function: line-webhook
// Receives LINE Messaging API webhook events. Handles the postback buttons on
// the assignment Flex card ("รับงานนี้" / "ทำเสร็จแล้ว") and updates the task.
//
// Deploy:
//   supabase secrets set LINE_CHANNEL_SECRET=...           (for signature check)
//   supabase secrets set LINE_CHANNEL_ACCESS_TOKEN=...     (to reply)
//   supabase functions deploy line-webhook --no-verify-jwt
// Then set the webhook URL in the LINE console to this function's URL.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const REPLY_URL = "https://api.line.me/v2/bot/message/reply";

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
  for (const event of payload.events ?? []) {
    // Bot was added to a group/room, OR someone typed "id" — reply with the
    // destination id so it can be pasted into JaaiNgan's "เชื่อมต่อ LINE".
    const text: string = event.message?.text ?? "";
    if (
      event.type === "join" ||
      (event.type === "message" && /^\s*(id|groupid|\/id)\s*$/i.test(text))
    ) {
      const src = event.source ?? {};
      const id: string | undefined = src.groupId ?? src.roomId ?? src.userId;
      const kind =
        src.type === "group" ? "Group" : src.type === "room" ? "Room" : "User";
      if (event.replyToken && id) {
        await reply(
          accessToken,
          event.replyToken,
          `✅ พร้อมเชื่อมกับ JaaiNgan\n\n${kind} ID:\n${id}\n\nคัดลอก ID นี้ไปวางในแอป → เมนู workspace (มุมซ้ายบน) → “เชื่อมต่อ LINE” → วางในช่อง Destination ID แล้วกดบันทึก`,
        );
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
