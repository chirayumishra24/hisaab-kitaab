import { useId, type ReactNode } from "react";
import { cn } from "./cn";

export function Switch({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  hint?: ReactNode;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex min-h-12 items-center justify-between gap-4 py-2">
      <label htmlFor={id} className="flex min-w-0 flex-col">
        <span className="text-[15px] font-semibold text-ink">{label}</span>
        {hint ? <span className="text-[13px] text-muted">{hint}</span> : null}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 disabled:opacity-50",
          checked ? "bg-accent" : "bg-line-strong",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "absolute top-0.5 left-0.5 size-6 rounded-full bg-white shadow transition-transform duration-200",
            checked && "translate-x-5",
          )}
        />
      </button>
    </div>
  );
}
