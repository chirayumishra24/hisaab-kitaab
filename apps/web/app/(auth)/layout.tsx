"use client";

import { Suspense, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle } from "@phosphor-icons/react";
import { NotConfigured } from "@/components/app/NotConfigured";
import { Logo } from "@/components/ui/Logo";
import { useAuth } from "@/lib/auth";

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

  useEffect(() => {
    if (state.status === "signedIn") {
      const next = params.get("next");
      router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
    }
  }, [state.status, params, router]);

  if (state.status === "unconfigured") return <NotConfigured />;

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
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
      <main id="main" className="flex flex-col px-5 py-8 sm:px-10 lg:justify-center lg:px-16">
        <Link href="/" className="mb-10 lg:hidden" aria-label="HisabKitaab home">
          <Logo className="h-7" priority />
        </Link>
        <div className="w-full max-w-sm lg:mx-auto">{children}</div>
      </main>
    </div>
  );
}
