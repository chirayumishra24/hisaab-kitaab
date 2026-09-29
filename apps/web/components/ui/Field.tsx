import {
  cloneElement,
  forwardRef,
  isValidElement,
  useId,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { WarningCircle } from "@phosphor-icons/react";
import { cn } from "./cn";

export const controlClasses = cn(
  "w-full rounded-[var(--radius-control)] border border-line-strong bg-surface px-3.5 text-[16px] text-ink",
  "placeholder:text-muted/80 transition-[border-color,box-shadow] duration-150",
  "focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/12",
  "aria-[invalid=true]:border-pay aria-[invalid=true]:focus:ring-pay/15",
  "disabled:cursor-not-allowed disabled:bg-sunken disabled:text-muted",
);

interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  optional?: boolean;
  optionalLabel?: string;
  className?: string;
  children: ReactElement<{ id?: string; "aria-describedby"?: string; "aria-invalid"?: boolean }>;
}

/** Label above, control, then hint or error below. Wires up ids for screen readers. */
export function Field({ label, hint, error, optional, optionalLabel = "Optional", className, children }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;
  const control = isValidElement(children)
    ? cloneElement(children, { id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })
    : children;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="flex items-baseline justify-between text-sm font-semibold text-ink">
        <span>{label}</span>
        {optional ? <span className="text-xs font-medium text-muted">{optionalLabel}</span> : null}
      </label>
      {control}
      {error ? (
        <p id={errorId} role="alert" className="flex items-center gap-1.5 text-sm font-medium text-pay">
          <WarningCircle size={16} weight="fill" aria-hidden />
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-[13px] text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={cn(controlClasses, "h-12", className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, rows = 2, ...rest },
  ref,
) {
  return <textarea ref={ref} rows={rows} className={cn(controlClasses, "resize-none py-3", className)} {...rest} />;
});
