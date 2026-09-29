"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClockCounterClockwise, GearSix, House, Plus, UsersThree, type Icon } from "@phosphor-icons/react";
import { useHisab } from "@hisabkitaab/shared/react";
import { PersonAvatar } from "../ui/Display";
import { Logo } from "../ui/Logo";
import { cn } from "../ui/cn";
import { useServices } from "./AppServices";
import { useDialogs } from "./DialogsProvider";

const NAV: { href: string; key: "home" | "people" | "activity" | "settings"; icon: Icon }[] = [
  { href: "/dashboard", key: "home", icon: House },
  { href: "/people", key: "people", icon: UsersThree },
  { href: "/activity", key: "activity", icon: ClockCounterClockwise },
  { href: "/settings", key: "settings", icon: GearSix },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[256px_1fr]">
      <DesktopSidebar />
      <div className="flex min-w-0 flex-col">
        <MobileHeader />
        <main id="main" className="mx-auto w-full max-w-[1120px] flex-1 px-4 pt-4 pb-32 sm:px-6 lg:px-10 lg:pt-8 lg:pb-12">
          {children}
        </main>
      </div>
      <BottomNavigation />
    </div>
  );
}

export function AddHisabButton({ className, size = "md" }: { className?: string; size?: "md" | "lg" }) {
  const { t } = useHisab();
  const dialogs = useDialogs();
  return (
    <button
      type="button"
      onClick={() => dialogs.open({ type: "addHisab" })}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] bg-accent font-bold text-on-accent",
        "shadow-[var(--shadow-fab)] transition-[transform,background-color] hover:bg-accent-hover active:scale-[0.97]",
        size === "lg" ? "h-14 px-6 text-base" : "h-12 px-5 text-[15px]",
        className,
      )}
    >
      <Plus size={20} weight="bold" aria-hidden />
      {t("nav.addHisab")}
    </button>
  );
}

function DesktopSidebar() {
  const pathname = usePathname();
  const { t, profile } = useHisab();
  const { user } = useServices();
  const name = profile?.displayName || user.displayName || user.email || "";
  return (
    <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-surface px-4 py-6 lg:flex">
      <Link href="/dashboard" className="px-2" aria-label="HisabKitaab home">
        <Logo className="h-[26px]" />
      </Link>
      <AddHisabButton className="mt-8 w-full" />
      <nav aria-label="Main" className="mt-6 flex flex-col gap-1">
        {NAV.map(({ href, key, icon: IconCmp }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-semibold transition-colors",
                active ? "bg-sunken text-ink" : "text-body hover:bg-sunken/70",
              )}
            >
              <IconCmp size={22} weight={active ? "fill" : "regular"} aria-hidden className={active ? "text-primary" : ""} />
              {t(`nav.${key}`)}
            </Link>
          );
        })}
      </nav>
      <Link
        href="/profile"
        className="mt-auto flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-sunken"
        aria-label={t("nav.profile")}
      >
        <PersonAvatar id={user.uid} name={name} size="sm" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold text-ink">{profile?.businessName || name}</span>
          <span className="block truncate text-[12px] text-muted">{user.email}</span>
        </span>
      </Link>
    </aside>
  );
}

function MobileHeader() {
  const { t, profile } = useHisab();
  const { user } = useServices();
  const name = profile?.displayName || user.displayName || "";
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line/70 bg-canvas/90 px-4 backdrop-blur-md supports-[not(backdrop-filter:blur(0))]:bg-canvas lg:hidden">
      <Link href="/dashboard" aria-label="HisabKitaab home">
        <Logo className="h-[22px]" priority />
      </Link>
      <Link href="/profile" aria-label={t("nav.profile")} className="rounded-full">
        <PersonAvatar id={user.uid} name={name || "?"} size="sm" />
      </Link>
    </header>
  );
}

function BottomNavigation() {
  const pathname = usePathname();
  const { t } = useHisab();
  const dialogs = useDialogs();
  const [left, right] = [NAV.slice(0, 2), NAV.slice(2)];

  const item = ({ href, key, icon: IconCmp }: (typeof NAV)[number]) => {
    const active = isActive(pathname, href);
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold",
          active ? "text-primary" : "text-muted",
        )}
      >
        <IconCmp size={24} weight={active ? "fill" : "regular"} aria-hidden />
        {t(`nav.${key}`)}
      </Link>
    );
  };

  return (
    <nav
      aria-label="Main"
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur-md lg:hidden"
    >
      <div className="mx-auto flex h-16 max-w-lg items-stretch px-2">
        {left.map(item)}
        <div className="flex flex-1 items-start justify-center">
          <button
            type="button"
            onClick={() => dialogs.open({ type: "addHisab" })}
            aria-label={t("nav.addHisab")}
            className="-mt-5 flex size-16 flex-col items-center justify-center rounded-full bg-accent text-on-accent shadow-[var(--shadow-fab)] ring-4 ring-canvas transition-transform active:scale-95"
          >
            <Plus size={28} weight="bold" aria-hidden />
          </button>
        </div>
        {right.map(item)}
      </div>
    </nav>
  );
}
