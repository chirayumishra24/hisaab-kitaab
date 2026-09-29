"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { HisabProvider } from "@hisabkitaab/shared/react";
import { AppServicesProvider } from "@/components/app/AppServices";
import { AppShell } from "@/components/app/AppShell";
import { DialogsProvider } from "@/components/app/DialogsProvider";
import { Logo } from "@/components/ui/Logo";
import { useAuth } from "@/lib/auth";
import { NotConfigured } from "@/components/app/NotConfigured";

/**
 * Protected area. Everything below requires a signed-in user; Firestore rules
 * enforce the same thing server-side.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  const state = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (state.status === "signedOut") router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [state.status, router, pathname]);

  if (state.status === "unconfigured") return <NotConfigured />;
  if (state.status !== "signedIn") {
    return (
      <div className="flex min-h-dvh items-center justify-center" role="status" aria-label="Loading">
        <Logo className="h-8 animate-pulse" />
      </div>
    );
  }

  return (
    <AppServicesProvider auth={state.auth} db={state.db} user={state.user}>
      <HisabProvider db={state.db} uid={state.user.uid}>
        <DialogsProvider>
          <AppShell>{children}</AppShell>
        </DialogsProvider>
      </HisabProvider>
    </AppServicesProvider>
  );
}
