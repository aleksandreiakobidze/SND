"use client";

import { usePathname } from "next/navigation";
import { Toaster } from "sonner";
import { ThemeProvider } from "./ThemeProvider";
import { LocaleProvider } from "@/lib/locale-context";
import { AuthProvider } from "@/lib/auth-context";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { TooltipProvider } from "@/components/ui/tooltip";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/login";

  return (
    <ThemeProvider>
      <LocaleProvider>
        <AuthProvider>
          <TooltipProvider>
            {isLogin ? (
              <main className="min-h-full bg-background">{children}</main>
            ) : (
              <div className="flex h-full min-h-0">
                <Sidebar />
                <div className="relative flex min-w-0 flex-1 flex-col bg-background">
                  <Header />
                  <main className="relative flex-1 overflow-auto overscroll-contain">
                    {children}
                  </main>
                </div>
              </div>
            )}
          </TooltipProvider>
          <Toaster richColors position="top-center" closeButton />
        </AuthProvider>
      </LocaleProvider>
    </ThemeProvider>
  );
}
