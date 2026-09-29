"use client";

import { useEffect, type ReactNode } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { MagnifyingGlass, X } from "@phosphor-icons/react";
import { avatarTone, formatINR, initials, type TransactionStatus } from "@hisabkitaab/shared";
import { cn } from "./cn";

/* -------------------------------- skeletons -------------------------------- */

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton", className)} />;
}

export function RowSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col divide-y divide-line">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 py-3.5">
          <Skeleton className="size-11 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-5 w-20" />
        </div>
      ))}
    </div>
  );
}

/* ------------------------------- empty state ------------------------------- */

export function EmptyState({
  icon,
  title,
  body,
  action,
  compact,
}: {
  icon: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-col items-center text-center", compact ? "py-8" : "py-14")}>
      <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-sunken text-primary">{icon}</div>
      <p className="text-lg font-bold text-ink">{title}</p>
      {body ? <p className="mt-1 max-w-[34ch] text-[15px] text-muted">{body}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/* --------------------------------- avatar ---------------------------------- */

const avatarClasses = [
  "bg-[#E4EEF6] text-[#1D4F75] dark:bg-[#17344B] dark:text-[#A9CBEA]",
  "bg-[#E3F4EC] text-[#0B6040] dark:bg-[#12382A] dark:text-[#8FE0B9]",
  "bg-[#FCEBDD] text-[#8A4210] dark:bg-[#3A2614] dark:text-[#F5B98A]",
  "bg-[#EEE8F7] text-[#553C8B] dark:bg-[#2A2240] dark:text-[#C8B6F0]",
  "bg-[#FBE7EE] text-[#8C2451] dark:bg-[#3A1A28] dark:text-[#F2A5C3]",
  "bg-[#E6F1F1] text-[#1F5E5E] dark:bg-[#163333] dark:text-[#98D5D5]",
];

export function PersonAvatar({ id, name, size = "md" }: { id: string; name: string; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "size-9 text-xs", md: "size-11 text-sm", lg: "size-16 text-xl" };
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-bold tracking-wide",
        sizes[size],
        avatarClasses[avatarTone(id, avatarClasses.length)],
      )}
    >
      {initials(name)}
    </span>
  );
}

/* ------------------------------ status badge ------------------------------- */

const badgeTones: Record<TransactionStatus, string> = {
  ACTIVE: "bg-sunken text-body",
  PARTIALLY_PAID: "bg-info-soft text-info",
  PAID: "bg-receive-soft text-receive",
  OVERDUE: "bg-overdue-soft text-overdue",
};

export function StatusBadge({ status, label }: { status: TransactionStatus; label: string }) {
  return (
    <span className={cn("inline-flex h-6 items-center rounded-full px-2.5 text-xs font-bold", badgeTones[status])}>
      {label}
    </span>
  );
}

/* ------------------------------ animated amount ---------------------------- */

/** Rupee amount that counts smoothly to its new value when it changes. */
export function AnimatedAmount({ paise, className }: { paise: number; className?: string }) {
  const reduce = useReducedMotion();
  const value = useMotionValue(paise);
  const text = useTransform(value, (v) => formatINR(Math.round(v)));
  useEffect(() => {
    if (reduce) {
      value.set(paise);
      return;
    }
    const controls = animate(value, paise, { duration: 0.6, ease: [0.16, 1, 0.3, 1] });
    return () => controls.stop();
  }, [paise, reduce, value]);
  return (
    <motion.span className={cn("tabular", className)} aria-label={formatINR(paise)}>
      {text}
    </motion.span>
  );
}

/* ------------------------------- filter tabs ------------------------------- */

export function FilterTabs<T extends string>({
  label,
  options,
  value,
  onChange,
  counts,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  counts?: Partial<Record<T, number>>;
}) {
  return (
    <div role="tablist" aria-label={label} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0">
      {options.map((option) => {
        const selected = option.value === value;
        const count = counts?.[option.value];
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-colors",
              selected ? "bg-primary text-on-primary" : "bg-surface text-body ring-1 ring-line-strong hover:bg-sunken",
            )}
          >
            {option.label}
            {count !== undefined && count > 0 ? (
              <span
                className={cn(
                  "tabular rounded-full px-1.5 text-xs",
                  selected ? "bg-on-primary/15 text-on-primary" : "bg-sunken text-muted",
                )}
              >
                {count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------- search bar ------------------------------- */

export function SearchBar({
  value,
  onChange,
  placeholder,
  label,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  autoFocus?: boolean;
}) {
  return (
    <div className="relative">
      <MagnifyingGlass size={20} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" aria-hidden />
      <input
        type="search"
        role="searchbox"
        aria-label={label}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="h-12 w-full rounded-full border border-line-strong bg-surface pr-11 pl-11 text-[16px] text-ink placeholder:text-muted/80 focus:border-primary focus:ring-4 focus:ring-primary/12 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange("")}
          className="absolute top-1/2 right-1.5 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:bg-sunken"
        >
          <X size={16} weight="bold" />
        </button>
      ) : null}
    </div>
  );
}

/* ---------------------------------- card ----------------------------------- */

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section className={cn("rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)]", className)}>
      {children}
    </section>
  );
}

export function SectionHeader({ title, action, id }: { title: string; action?: ReactNode; id?: string }) {
  return (
    <div className="flex min-h-10 items-center justify-between gap-3">
      <h2 id={id} className="text-[17px] font-bold tracking-tight text-ink">
        {title}
      </h2>
      {action}
    </div>
  );
}
