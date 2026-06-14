// Supabase Edge Function: web-push
// Sends a Web Push notification to every device a user has subscribed.
// Called server-side (e.g. from a DB trigger via pg_net when a notification
// row is inserted) — protected by a shared CRON_SECRET.
//
// Deploy:
//   # generate a VAPID keypair once (npx web-push generate-vapid-keys)
//   supabase secrets set VAPID_PUBLIC_KEY=...   VAPID_PRIVATE_KEY=...
//   supabase secrets set VAPID_SUBJECT=mailto:you@example.com
//   supabase secrets set CRON_SECRET=<random>
//   supabase functions deploy web-push --no-verify-jwt
//
// Also expose the public key to the web app:
//   NEXT_PUBLIC_VAPID_PUBLIC_KEY=<same VAPID_PUBLIC_KEY>
//
// Request body: { "user_id": "...", "title": "...", "body": "...", "url": "/" }
// Header:       Authorization: Bearer <CRON_SECRET>

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

Deno.serve(async (req) => {
  const cronSecret = Deno.env.get("CRON_SECRET");
  const pub = Deno.env.get("VAPID_PUBLIC_KEY");
  const priv = Deno.env.get("VAPID_PRIVATE_KEY");
  const subject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@jaaingan.app";
  if (!cronSecret || !pub || !priv) {
    return new Response("not configured", { status: 500 });
  }
  if (req.headers.get("Authorization") !== `Bearer ${cronSecret}`) {
    return new Response("unauthorized", { status: 401 });
  }

  const { user_id, title, body, url } = await req.json().catch(() => ({}));
  if (!user_id) return new Response("user_id required", { status: 400 });

  webpush.setVapidDetails(subject, pub, priv);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", user_id);

  const payload = JSON.stringify({
    title: title ?? "JaaiNgan",
    body: body ?? "",
    url: url ?? "/",
  });

  let sent = 0;
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload,
      );
      sent++;
    } catch (err) {
      // 404/410 → subscription is dead; clean it up.
      // deno-lint-ignore no-explicit-any
      const code = (err as any)?.statusCode;
      if (code === 404 || code === 410) {
        await admin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
      }
    }
  }

  return new Response(JSON.stringify({ subscriptions: subs?.length ?? 0, sent }), {
    headers: { "Content-Type": "application/json" },
  });
});
