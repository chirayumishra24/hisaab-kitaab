import type { ReactNode } from "react";
import { cn } from "./cn";

export interface ChipOption<T extends string> {
  value: T;
  label: ReactNode;
}

/** Single-choice pill group (radio semantics). */
export function ChipGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  options: ChipOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("flex flex-wrap gap-2", className)}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "h-10 rounded-full border px-4 text-sm font-semibold transition-colors active:scale-[0.97]",
              selected
                ? "border-primary bg-primary text-on-primary"
                : "border-line-strong bg-surface text-body hover:border-muted",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
