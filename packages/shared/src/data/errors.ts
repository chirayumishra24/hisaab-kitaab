import { AllocationError } from "../calc";
import type { Translate, TranslationKey } from "../i18n";
import { formatINR } from "../money";

/** Thrown by data functions when input fails validation. `errors` holds translation keys per field. */
export class ValidationFailed extends Error {
  constructor(public readonly errors: Record<string, string>) {
    super("VALIDATION_FAILED");
    this.name = "ValidationFailed";
  }
}

/** Thrown when an action is not allowed in the current state (e.g. deleting a person with history). */
export class BlockedAction extends Error {
  constructor(public readonly reason: TranslationKey) {
    super(reason);
    this.name = "BlockedAction";
  }
}

function code(error: unknown): string | null {
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") return error.code;
  return null;
}

/** Turns any thrown value into a sentence the user can act on. */
export function describeError(t: Translate, error: unknown): string {
  if (error instanceof AllocationError) {
    if (error.code === "EXCEEDS_PENDING") return t("errors.amountExceeds", { amount: formatINR(error.pending) });
    if (error.code === "NOTHING_PENDING") return t("errors.nothingPending");
    return t("errors.amountPositive");
  }
  if (error instanceof BlockedAction) return t(error.reason);
  if (error instanceof ValidationFailed) {
    const first = Object.values(error.errors)[0];
    return first ? t(first as TranslationKey) : t("errors.generic");
  }
  const c = code(error);
  if (c?.startsWith("auth/")) {
    const text = t(`errors.${c}` as TranslationKey);
    return text.startsWith("errors.") ? t("errors.generic") : text;
  }
  switch (c) {
    case "permission-denied":
    case "unauthenticated":
      return t("errors.permission");
    case "unavailable":
    case "deadline-exceeded":
      return t("errors.network");
    case "failed-precondition":
      return t("errors.offlinePayment");
    case "not-found":
      return t("errors.notFound");
  }
  return t("errors.generic");
}

export function isOfflineError(error: unknown): boolean {
  const c = code(error);
  return c === "unavailable" || c === "failed-precondition" || c === "auth/network-request-failed";
}
