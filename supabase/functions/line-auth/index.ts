// Supabase Edge Function: line-auth
// Handles the LINE Login OAuth callback for two modes:
//   - "link"  : attach a LINE account to the currently signed-in user
//               (stores profiles.line_user_id) → enables personal LINE pushes.
//   - "login" : sign in / sign up using LINE as the identity provider.
//
// Deploy (once you have a LINE Login channel):
//   supabase secrets set LINE_LOGIN_CHANNEL_ID=xxxx LINE_LOGIN_CHANNEL_SECRET=yyyy
//   supabase functions deploy line-auth
//
// Client flow: redirect the user to the LINE authorize URL with
//   redirect_uri = <app>/auth/line/callback and state encoding the mode.
// The callback page POSTs { code, redirectUri, mode } here.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TOKEN_URL = "https://api.line.me/oauth2/v2.1/token";
const PROFILE_URL = "https://api.line.me/v2/profile";

interface Body {
  code: string;
  redirectUri: string;
  mode: "link" | "login";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const channelId = Deno.env.get("LINE_LOGIN_CHANNEL_ID");
  const channelSecret = Deno.env.get("LINE_LOGIN_CHANNEL_SECRET");
  if (!channelId || !channelSecret) {
    return json({ error: "LINE_LOGIN_CHANNEL_ID/SECRET not set" }, 500);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid body" }, 400);
  }

  // 1) Exchange the authorization code for tokens.
  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: body.code,
      redirect_uri: body.redirectUri,
      client_id: channelId,
      client_secret: channelSecret,
    }),
  });
  if (!tokenRes.ok) {
    return json({ error: "token_exchange_failed", detail: await tokenRes.text() }, 400);
  }
  const tokens = await tokenRes.json();

  // 2) Fetch the LINE profile (userId, displayName, pictureUrl).
  const profRes = await fetch(PROFILE_URL, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!profRes.ok) {
    return json({ error: "profile_failed", detail: await profRes.text() }, 400);
  }
  const lineProfile = await profRes.json();
  const lineUserId: string = lineProfile.userId;
  const displayName: string = lineProfile.displayName ?? "LINE User";
  const pictureUrl: string | undefined = lineProfile.pictureUrl;

  const admin = createClient(supabaseUrl, serviceKey);

  // ── link mode: attach LINE to the signed-in user ─────────────────────
  if (body.mode === "link") {
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u.user) return json({ error: "unauthorized" }, 401);
    const { error } = await admin
      .from("profiles")
      .update({ line_user_id: lineUserId })
      .eq("id", u.user.id);
    if (error) return json({ error: error.message }, 400);
    return json({ linked: true, lineUserId, displayName });
  }

  // ── login mode: find or create a user keyed by the LINE account ──────
  // Look up an existing profile linked to this LINE user.
  const { data: existing } = await admin
    .from("profiles")
    .select("id, email")
    .eq("line_user_id", lineUserId)
    .maybeSingle();

  // Synthetic email so LINE-only users have a stable auth identity.
  const email = existing?.email ?? `line_${lineUserId}@line.jaaingan.local`;

  if (!existing) {
    // Create the auth user (email auto-confirmed) and link the LINE id.
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: displayName, avatar_url: pictureUrl, line_user_id: lineUserId },
    });
    if (createErr) return json({ error: createErr.message }, 400);
    await admin
      .from("profiles")
      .update({ line_user_id: lineUserId, name: displayName, avatar_url: pictureUrl })
      .eq("id", created.user.id);
  }

  // Issue a one-time magic link the client can follow to establish a session.
  // Redirect it back to the app that started the flow (prod or localhost),
  // derived from the callback URL the client sent — so it does NOT depend on the
  // project's global Site URL (which otherwise sends every login to localhost).
  // The origin must be allow-listed in Supabase Auth → URL Configuration.
  let redirectTo: string | undefined;
  try {
    redirectTo = new URL(body.redirectUri).origin + "/";
  } catch {
    redirectTo = undefined;
  }
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: redirectTo ? { redirectTo } : undefined,
  });
  if (linkErr) return json({ error: linkErr.message }, 400);

  // The client should redirect to action_link (or verify the OTP) to sign in.
  return json({
    login: true,
    email,
    actionLink: linkData.properties?.action_link,
    displayName,
  });
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
