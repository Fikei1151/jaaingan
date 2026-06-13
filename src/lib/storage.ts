import type { DemoState, User } from "./types";
import { createSeedState } from "./seed";

/**
 * Local persistence for the demo layer (used only when Supabase env vars are
 * absent). The Supabase layer lives in src/lib/supabase/queries.ts.
 */

const DEMO_KEY = "jaaingan:demo:v2";
const AUTH_KEY = "jaaingan:auth:v1";

const isBrowser = typeof window !== "undefined";

export function loadDemoState(): DemoState {
  if (!isBrowser) return createSeedState();
  try {
    const raw = window.localStorage.getItem(DEMO_KEY);
    if (!raw) {
      const seed = createSeedState();
      window.localStorage.setItem(DEMO_KEY, JSON.stringify(seed));
      return seed;
    }
    return JSON.parse(raw) as DemoState;
  } catch {
    return createSeedState();
  }
}

export function saveDemoState(state: DemoState): void {
  if (!isBrowser) return;
  try {
    window.localStorage.setItem(DEMO_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota / serialization errors */
  }
}

export function resetDemoState(): DemoState {
  if (isBrowser) window.localStorage.removeItem(DEMO_KEY);
  return loadDemoState();
}

export function loadUser(): User | null {
  if (!isBrowser) return null;
  try {
    const raw = window.localStorage.getItem(AUTH_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function saveUser(user: User | null): void {
  if (!isBrowser) return;
  if (user) window.localStorage.setItem(AUTH_KEY, JSON.stringify(user));
  else window.localStorage.removeItem(AUTH_KEY);
}
