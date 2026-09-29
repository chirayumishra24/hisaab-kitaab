/**
 * Phone number handling, tuned for Indian mobile numbers but tolerant of
 * international E.164 numbers (family abroad, NRI customers).
 */

const INDIAN_MOBILE = /^[6-9]\d{9}$/;
const E164 = /^\+[1-9]\d{7,14}$/;

/**
 * Normalises common ways people type a number into E.164.
 *   "98765 43210"      -> "+919876543210"
 *   "098765-43210"     -> "+919876543210"
 *   "+91 98765 43210"  -> "+919876543210"
 *   "919876543210"     -> "+919876543210"
 *   "+44 7700 900123"  -> "+447700900123"
 * Returns null when the input cannot be a valid mobile number.
 */
export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  const hasPlus = trimmed.startsWith("+") || trimmed.startsWith("00");
  const digits = trimmed.replace(/\D/g, "");

  if (!hasPlus) {
    if (INDIAN_MOBILE.test(digits)) return `+91${digits}`;
    if (digits.length === 11 && digits.startsWith("0") && INDIAN_MOBILE.test(digits.slice(1))) {
      return `+91${digits.slice(1)}`;
    }
    if (digits.length === 12 && digits.startsWith("91") && INDIAN_MOBILE.test(digits.slice(2))) {
      return `+${digits}`;
    }
    return null;
  }

  const international = trimmed.startsWith("00") ? digits.slice(2) : digits;
  if (international.startsWith("91")) {
    return INDIAN_MOBILE.test(international.slice(2)) ? `+${international}` : null;
  }
  const candidate = `+${international}`;
  return E164.test(candidate) ? candidate : null;
}

export function isValidPhone(input: string | null | undefined): boolean {
  return normalizePhone(input) !== null;
}

/** "+919876543210" -> "+91 98765 43210". Other countries are shown as stored. */
export function formatPhone(e164: string): string {
  if (e164.startsWith("+91") && e164.length === 13) {
    return `+91 ${e164.slice(3, 8)} ${e164.slice(8)}`;
  }
  return e164;
}

/** Digits only, without "+", as wa.me expects. */
export function phoneForWhatsApp(e164: string): string {
  return e164.replace(/\D/g, "");
}
