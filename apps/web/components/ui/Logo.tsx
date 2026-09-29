import Image from "next/image";
import { cn } from "./cn";

/**
 * The original HisabKitaab brush wordmark (keyed out of the pitch deck logo).
 * `onDark` forces the white variant; otherwise it follows the color scheme.
 */
export function Logo({ className, onDark, priority }: { className?: string; onDark?: boolean; priority?: boolean }) {
  const common = { width: 2124, height: 348, priority };
  if (onDark) {
    return <Image {...common} alt="HisabKitaab" src="/brand/wordmark-on-dark.png" className={cn("h-7 w-auto", className)} />;
  }
  return (
    <>
      <Image {...common} alt="HisabKitaab" src="/brand/wordmark-on-light.png" className={cn("h-7 w-auto dark:hidden", className)} />
      <Image {...common} src="/brand/wordmark-on-dark.png" alt="" aria-hidden className={cn("hidden h-7 w-auto dark:block", className)} />
    </>
  );
}
