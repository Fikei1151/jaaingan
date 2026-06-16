"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import type { User } from "./types";
import { loadUser, saveUser } from "./storage";
import { getSupabaseClient, isSupabaseConfigured } from "./supabase/client";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  /** True when real Supabase auth is wired up; false in local demo mode. */
  isLive: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (
    email: string,
    password: string,
    name: string,
  ) => Promise<{ needsConfirmation: boolean }>;
  updateProfile: (patch: { name?: string; avatarUrl?: string }) => Promise<void>;
  changePassword: (password: string) => Promise<void>;
  /** Attach an email + password to the current account (e.g. a LINE account). */
  setEmailPassword: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** A believable demo user for the frontend-only phase. */
const DEMO_USER: User = {
  id: "demo-user",
  name: "Fikree",
  email: "fikree205m@gmail.com",
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const live = isSupabaseConfigured();

  useEffect(() => {
    if (!live) {
      // Demo mode: restore the locally-stored session.
      setUser(loadUser());
      setLoading(false);
      return;
    }

    // Live mode: read the Supabase session and keep it in sync.
    const supabase = getSupabaseClient()!;
    let active = true;

    supabase.auth
      .getSession()
      .then(({ data }: { data: { session: Session | null } }) => {
        if (!active) return;
        setUser(mapSupabaseUser(data.session?.user));
        setLoading(false);
      });

    const { data: sub } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        setUser(mapSupabaseUser(session?.user));
      },
    );

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [live]);

  const signInWithGoogle = useCallback(async () => {
    if (!live) {
      saveUser(DEMO_USER);
      setUser(DEMO_USER);
      return;
    }
    const supabase = getSupabaseClient()!;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  }, [live]);

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      if (!live) {
        const demo = { ...DEMO_USER, email };
        saveUser(demo);
        setUser(demo);
        return;
      }
      const supabase = getSupabaseClient()!;
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    },
    [live],
  );

  const signUpWithEmail = useCallback(
    async (email: string, password: string, name: string) => {
      if (!live) {
        const demo = { ...DEMO_USER, email, name: name || DEMO_USER.name };
        saveUser(demo);
        setUser(demo);
        return { needsConfirmation: false };
      }
      const supabase = getSupabaseClient()!;
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      });
      if (error) throw error;
      // When email confirmation is enabled, signUp returns a user but no session.
      return { needsConfirmation: !data.session };
    },
    [live],
  );

  const updateProfile = useCallback(
    async (patch: { name?: string; avatarUrl?: string }) => {
      if (!live) {
        setUser((u) =>
          u
            ? {
                ...u,
                name: patch.name ?? u.name,
                avatarUrl: patch.avatarUrl ?? u.avatarUrl,
              }
            : u,
        );
        return;
      }
      const supabase = getSupabaseClient()!;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = {};
      if (patch.name !== undefined) data.full_name = patch.name;
      if (patch.avatarUrl !== undefined) data.avatar_url = patch.avatarUrl;
      const { error } = await supabase.auth.updateUser({ data });
      if (error) throw error;
      const { data: u } = await supabase.auth.getUser();
      if (u.user) {
        const row: Record<string, unknown> = {};
        if (patch.name !== undefined) row.name = patch.name;
        if (patch.avatarUrl !== undefined) row.avatar_url = patch.avatarUrl;
        await supabase.from("profiles").update(row).eq("id", u.user.id);
      }
    },
    [live],
  );

  const changePassword = useCallback(
    async (password: string) => {
      if (!live) return;
      const { error } = await getSupabaseClient()!.auth.updateUser({ password });
      if (error) throw error;
    },
    [live],
  );

  const setEmailPassword = useCallback(
    async (email: string, password: string) => {
      if (!live) return;
      const db = getSupabaseClient()!;
      const { data, error } = await db.functions.invoke(
        "account-set-credentials",
        { body: { email, password } },
      );
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = data as any;
      if (res && res.ok === false) throw new Error(res.error || "ตั้งค่าไม่สำเร็จ");
      // Refresh so the new email shows up in the local session.
      await db.auth.refreshSession().catch(() => {});
      const { data: u } = await db.auth.getUser();
      setUser(mapSupabaseUser(u.user));
    },
    [live],
  );

  const signOut = useCallback(async () => {
    if (!live) {
      saveUser(null);
      setUser(null);
      return;
    }
    await getSupabaseClient()!.auth.signOut();
    setUser(null);
  }, [live]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isLive: live,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      updateProfile,
      changePassword,
      setEmailPassword,
      signOut,
    }),
    [
      user,
      loading,
      live,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      updateProfile,
      changePassword,
      setEmailPassword,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSupabaseUser(u: any): User | null {
  if (!u) return null;
  const meta = u.user_metadata ?? {};
  return {
    id: u.id,
    email: u.email ?? "",
    name: meta.full_name ?? meta.name ?? (u.email ? u.email.split("@")[0] : "User"),
    avatarUrl: meta.avatar_url ?? meta.picture,
  };
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
