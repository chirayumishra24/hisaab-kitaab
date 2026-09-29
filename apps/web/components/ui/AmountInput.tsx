import { forwardRef, type InputHTMLAttributes } from "react";
import { formatAmountInput } from "@hisabkitaab/shared";
import { cn } from "./cn";

interface AmountInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "size"> {
  value: string;
  onValueChange: (value: string) => void;
  size?: "md" | "xl";
  tone?: "receive" | "pay" | "neutral";
}

/** Large ₹ amount field with live Indian digit grouping and a numeric keyboard on phones. */
export const AmountInput = forwardRef<HTMLInputElement, AmountInputProps>(function AmountInput(
  { value, onValueChange, size = "xl", tone = "neutral", className, ...rest },
  ref,
) {
  const color = tone === "receive" ? "text-receive" : tone === "pay" ? "text-pay" : "text-ink";
  return (
    <div
      className={cn(
        "group flex items-center rounded-[var(--radius-control)] border border-line-strong bg-surface px-4",
        "transition-[border-color,box-shadow] focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/12",
        "has-[input[aria-invalid=true]]:border-pay",
        size === "xl" ? "h-[72px]" : "h-12",
        className,
      )}
    >
      <span aria-hidden className={cn("font-bold", color, size === "xl" ? "mr-1.5 text-3xl" : "mr-1 text-lg")}>
        ₹
      </span>
      <input
        ref={ref}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        enterKeyHint="done"
        placeholder="0"
        value={value}
        onChange={(e) => onValueChange(formatAmountInput(e.target.value))}
        className={cn(
          "tabular w-full min-w-0 bg-transparent font-extrabold tracking-tight outline-none placeholder:text-line-strong",
          color,
          size === "xl" ? "text-[34px]" : "text-lg",
        )}
        {...rest}
      />
    </div>
  );
});
