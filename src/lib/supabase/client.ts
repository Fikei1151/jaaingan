import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase browser client.
 *
 * The app runs fully in "demo / local" mode until these two env vars are set in
 * `.env.local`:
 *
 *   NEXT_PUBLIC_SUPABASE_URL=...
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
 *
 * Once they exist, `isSupabaseConfigured()` flips to true and the auth layer
 * (src/lib/auth-context.tsx) uses real Google OAuth instead of the mock login.
 */

// .trim() guards against a trailing newline/space pasted into the env value
// (a trailing "\n" in the anon key breaks the realtime WebSocket auth, which
// sends the key as a URL query param).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

export function isSupabaseConfigured(): boolean {
  return Boolean(url && anonKey);
}

let cached: ReturnType<typeof createBrowserClient> | null = null;

/** Returns the singleton browser client, or null if env vars are missing. */
export function getSupabaseClient() {
  if (!isSupabaseConfigured()) return null;
  if (!cached) cached = createBrowserClient(url!, anonKey!);
  return cached;
}
