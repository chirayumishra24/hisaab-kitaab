import Link from "next/link";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "./cn";

type Variant = "primary" | "accent" | "secondary" | "ghost" | "danger" | "soft";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary-hover",
  accent: "bg-accent text-on-accent hover:bg-accent-hover",
  secondary: "bg-surface text-ink border border-line-strong hover:bg-sunken",
  soft: "bg-sunken text-ink hover:bg-line",
  ghost: "bg-transparent text-ink hover:bg-sunken",
  danger: "bg-pay text-white hover:opacity-90 dark:text-[#1a0503]",
};

const sizes: Record<Size, string> = {
  sm: "h-10 px-3.5 text-sm gap-1.5",
  md: "h-12 px-5 text-[15px] gap-2",
  lg: "h-14 px-6 text-base gap-2.5",
};

export function buttonClasses(variant: Variant = "primary", size: Size = "md", extra?: string) {
  return cn(
    "inline-flex select-none items-center justify-center whitespace-nowrap rounded-[var(--radius-control)] font-semibold",
    "transition-[background-color,transform,opacity] duration-150 active:scale-[0.98]",
    "disabled:pointer-events-none disabled:opacity-50",
    variants[variant],
    sizes[size],
    extra,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  loading?: boolean;
  loadingText?: string;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", icon, loading, loadingText, block, className, children, disabled, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses(variant, size, cn(block && "w-full", className))}
      {...rest}
    >
      {icon && !loading ? <span className="-ml-0.5 flex shrink-0">{icon}</span> : null}
      <span>{loading && loadingText ? loadingText : children}</span>
    </button>
  );
});

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  icon,
  className,
  children,
  block,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
  block?: boolean;
}) {
  return (
    <Link href={href} className={buttonClasses(variant, size, cn(block && "w-full", className))}>
      {icon ? <span className="-ml-0.5 flex shrink-0">{icon}</span> : null}
      <span>{children}</span>
    </Link>
  );
}

export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { label: string; tone?: "default" | "inverse" }
>(function IconButton({ label, className, children, tone = "default", type = "button", ...rest }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-colors active:scale-95",
        tone === "inverse" ? "text-white hover:bg-white/10" : "text-body hover:bg-sunken",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
