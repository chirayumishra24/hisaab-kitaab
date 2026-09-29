"use client";

import { Suspense, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle } from "@phosphor-icons/react";
import { NotConfigured } from "@/components/app/NotConfigured";
import { Logo } from "@/components/ui/Logo";
import { useAuth } from "@/lib/auth";
import { useStatusBarStyle } from "@/lib/native";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense>
      <AuthFrame>{children}</AuthFrame>
    </Suspense>
  );
}

function AuthFrame({ children }: { children: ReactNode }) {
  const state = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  // The phone layout puts a navy band behind the status bar.
  useStatusBarStyle("DARK");

  useEffect(() => {
    if (state.status === "signedIn") {
      const next = params.get("next");
      router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
    }
  }, [state.status, params, router]);

  if (state.status === "unconfigured") return <NotConfigured />;

  return (
    <div className="flex min-h-dvh flex-col bg-navy lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:bg-canvas">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-navy p-12 text-white lg:flex">
        <Link href="/" aria-label="HisabKitaab home">
          <Logo onDark className="h-9" priority />
        </Link>
        <div className="max-w-md">
          <p className="text-[40px] leading-[1.1] font-extrabold tracking-tight">No confusion. Just Hisab.</p>
          <ul className="mt-8 flex flex-col gap-3 text-[17px] text-white/85">
            {["See who owes you in one look", "Add a record in seconds", "Send a friendly reminder on WhatsApp"].map((line) => (
              <li key={line} className="flex items-center gap-3">
                <CheckCircle size={22} weight="fill" className="shrink-0 text-[#5FE3AE]" aria-hidden />
                {line}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-white/60">Made for local shops, small businesses and families.</p>
      </aside>
      {/* Phones: an app-style welcome band, with the form on a sheet below it. */}
      <header className="safe-top bg-navy text-white lg:hidden">
        <div className="px-5 pt-7 pb-14 sm:px-10">
          <Logo onDark className="h-8" priority />
          <p className="mt-6 text-[28px] leading-[1.1] font-extrabold tracking-tight">No confusion. Just Hisab.</p>
          <p className="mt-2 text-[15px] text-white/75">See who owes you, in one look.</p>
        </div>
      </header>
      <main
        id="main"
        className="relative -mt-7 flex flex-1 flex-col rounded-t-[28px] bg-canvas px-5 pt-8 pb-[calc(2rem+var(--sab))] sm:px-10 lg:mt-0 lg:justify-center lg:rounded-none lg:px-16 lg:py-8"
      >
        <div className="w-full max-w-sm sm:mx-auto">{children}</div>
      </main>
    </div>
  );
}
