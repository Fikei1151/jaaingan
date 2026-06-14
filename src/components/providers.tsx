"use client";

import { AuthProvider } from "@/lib/auth-context";
import { DataProvider } from "@/lib/data-context";
import { ThemeProvider } from "@/lib/theme";
import { ToastProvider } from "@/components/ui/toast";
import { RegisterSW } from "@/components/register-sw";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <DataProvider>{children}</DataProvider>
        </ToastProvider>
      </AuthProvider>
      <RegisterSW />
    </ThemeProvider>
  );
}
