"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useData } from "@/lib/data-context";
import { Workspace } from "@/components/workspace";

export default function HomePage() {
  const { user, loading } = useAuth();
  const { ready } = useData();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user || !ready) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-ink-faint">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-ink" />
          <span className="text-sm">กำลังโหลด JaaiNgan…</span>
        </div>
      </div>
    );
  }

  return <Workspace />;
}
