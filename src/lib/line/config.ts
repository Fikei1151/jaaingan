/**
 * LINE integration config (client side).
 *
 * LINE Login features (sign-in / account linking) activate once you set:
 *   NEXT_PUBLIC_LINE_LOGIN_CHANNEL_ID=...
 * in `.env.local`. Sending messages additionally needs the Messaging API
 * channel access token configured as a Supabase Edge Function secret
 * (LINE_CHANNEL_ACCESS_TOKEN) — see supabase/functions/line-send.
 */

export const LINE_LOGIN_CHANNEL_ID =
  process.env.NEXT_PUBLIC_LINE_LOGIN_CHANNEL_ID;

export function isLineLoginConfigured(): boolean {
  return Boolean(LINE_LOGIN_CHANNEL_ID);
}

export type LineAuthMode = "login" | "link";

/** Local-storage key carrying the mode across the LINE OAuth redirect. */
export const LINE_MODE_KEY = "jaaingan:lineAuthMode";

export function lineCallbackUri(): string {
  return typeof window !== "undefined"
    ? `${window.location.origin}/auth/line/callback`
    : "";
}

/** Builds the LINE Login authorize URL to redirect the user to. */
export function lineAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: LINE_LOGIN_CHANNEL_ID ?? "",
    redirect_uri: lineCallbackUri(),
    state,
    scope: "profile openid",
  });
  return `https://access.line.me/oauth2/v2.1/authorize?${params.toString()}`;
}

/** Starts a LINE OAuth redirect for either signing in or linking an account. */
export function startLineAuth(mode: LineAuthMode): void {
  if (typeof window === "undefined") return;
  const state = `${mode}.${Math.abs(
    Array.from(mode + lineCallbackUri()).reduce(
      (a, c) => (a << 5) - a + c.charCodeAt(0),
      7,
    ),
  ).toString(36)}`;
  window.localStorage.setItem(LINE_MODE_KEY, mode);
  window.location.assign(lineAuthorizeUrl(state));
}
