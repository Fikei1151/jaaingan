import { getSupabaseClient } from "./supabase/client";

/**
 * Web Push (scaffold). Activates once you set NEXT_PUBLIC_VAPID_PUBLIC_KEY and
 * deploy the `web-push` edge function (with the matching VAPID private key).
 */

export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export function isPushConfigured(): boolean {
  return (
    Boolean(VAPID_PUBLIC_KEY) &&
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function isPushSubscribed(): Promise<boolean> {
  if (!isPushConfigured()) return false;
  const reg = await navigator.serviceWorker.ready;
  return Boolean(await reg.pushManager.getSubscription());
}

export async function subscribeToPush(userId: string): Promise<void> {
  if (!VAPID_PUBLIC_KEY) throw new Error("VAPID public key not set");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("permission denied");
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json = sub.toJSON() as any;
  const db = getSupabaseClient();
  if (!db) return;
  await db.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    },
    { onConflict: "endpoint" },
  );
}

export async function unsubscribeFromPush(): Promise<void> {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  const db = getSupabaseClient();
  if (db) await db.from("push_subscriptions").delete().eq("endpoint", endpoint);
}
