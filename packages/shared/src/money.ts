import type { Paise } from "./types";

/** Largest single entry we accept: ₹10 crore. Guards against typos like an extra zero chain. */
export const MAX_AMOUNT_PAISE: Paise = 10_00_00_000 * 100;

/**
 * Parse user input like "1500", "1,500", "₹ 1,500.5" into paise.
 * Returns null for anything that is not a clean, non-negative amount with at most 2 decimals.
 */
export function parseRupeesToPaise(input: string | number | null | undefined): Paise | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") {
    if (!Number.isFinite(input) || input < 0) return null;
    return Math.round(input * 100);
  }
  const cleaned = input.replace(/[₹,\s]/g, "").replace(/^rs\.?/i, "");
  if (cleaned === "" || !/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  const [whole = "0", fraction = ""] = cleaned.split(".");
  const paise = Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
  return Number.isSafeInteger(paise) ? paise : null;
}

/** Groups digits the Indian way: 12,34,567. Implemented by hand because Hermes/Android ICU data varies. */
function groupIndian(digits: string): string {
  if (digits.length <= 3) return digits;
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3);
  return rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3;
}

export interface FormatOptions {
  /** Prefix + for positive and - for negative values. */
  signed?: boolean;
  /** Drop the ₹ symbol (useful inside inputs). */
  bare?: boolean;
  /** Show 1.2L / 3.4Cr for large numbers (compact stat tiles). */
  compact?: boolean;
}

/** Formats paise as Indian Rupees: 150000 -> "₹1,500", 150050 -> "₹1,500.50". */
export function formatINR(paise: Paise, options: FormatOptions = {}): string {
  const negative = paise < 0;
  const abs = Math.abs(Math.round(paise));
  const rupees = Math.floor(abs / 100);
  const fraction = abs % 100;
  let body: string;
  if (options.compact && rupees >= 1_00_000) {
    const crore = rupees >= 1_00_00_000;
    const value = crore ? rupees / 1_00_00_000 : rupees / 1_00_000;
    body = `${trimTrailingZero(value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2))}${crore ? "Cr" : "L"}`;
  } else {
    body = groupIndian(String(rupees)) + (fraction ? "." + String(fraction).padStart(2, "0") : "");
  }
  const symbol = options.bare ? "" : "₹";
  const sign = negative ? "-" : options.signed && abs > 0 ? "+" : "";
  return `${sign}${symbol}${body}`;
}

function trimTrailingZero(value: string): string {
  return value.includes(".") ? value.replace(/\.?0+$/, "") : value;
}

/** Converts paise to a plain rupee string for an input box: 150050 -> "1500.50", 150000 -> "1500". */
export function paiseToInputValue(paise: Paise): string {
  const rupees = Math.floor(paise / 100);
  const fraction = paise % 100;
  return fraction ? `${rupees}.${String(fraction).padStart(2, "0")}` : String(rupees);
}

/**
 * Live-formats what the user is typing in an amount box with Indian grouping,
 * keeping at most two decimals. "150000" -> "1,50,000", "1500.5" -> "1,500.5".
 */
export function formatAmountInput(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const [whole = "", ...rest] = cleaned.split(".");
  const trimmedWhole = whole.replace(/^0+(?=\d)/, "").slice(0, 10);
  const grouped = trimmedWhole ? groupIndian(trimmedWhole) : "";
  if (rest.length === 0) return grouped;
  return `${grouped || "0"}.${rest.join("").slice(0, 2)}`;
}
