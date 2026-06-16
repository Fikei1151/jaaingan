// Supabase Edge Function: account-set-credentials
// Lets a signed-in user attach an email + password to their account — e.g. a
// LINE-only account (synthetic @line.jaaingan.local email, no password). Sets
// them directly via the admin API with email_confirm:true, so the user can
// immediately sign in with email + password in addition to LINE.
//
// Note: the email is NOT ownership-verified (set by an authenticated user on
// their OWN account only). Acceptable for this app; switch to a confirmation
// flow if stronger guarantees are needed.
//
// Deploy:  supabase functions deploy account-set-credentials

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Identify the caller from their JWT.
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: u } = await userClient.auth.getUser();
  if (!u.user) return json({ ok: false, error: "unauthorized" }, 401);

  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "invalid body" }, 400);
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  if (!email.includes("@") || email.endsWith("@line.jaaingan.local")) {
    return json({ ok: false, error: "อีเมลไม่ถูกต้อง" });
  }
  if (password.length < 6) {
    return json({ ok: false, error: "รหัสผ่านอย่างน้อย 6 ตัว" });
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const { error } = await admin.auth.admin.updateUserById(u.user.id, {
    email,
    email_confirm: true,
    password,
  });
  if (error) {
    const taken = /already|registered|exists|duplicate|been/i.test(error.message);
    return json({
      ok: false,
      error: taken ? "อีเมลนี้ถูกใช้กับบัญชีอื่นแล้ว" : error.message,
    });
  }

  return json({ ok: true, email });
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
