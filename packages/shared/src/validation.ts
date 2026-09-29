/**
 * Input validation shared by web, mobile and the server.
 * Error messages are translation keys (see i18n/en.ts -> errors.*), so each UI
 * can show them in the user's language.
 */
import { z } from "zod";
import { isValidISODate } from "./dates";
import { MAX_AMOUNT_PAISE, parseRupeesToPaise } from "./money";
import { normalizePhone } from "./phone";
import { LANGUAGES, TRANSACTION_TYPES } from "./types";

/** Removes control characters and collapses whitespace so stored text is clean. */
export function sanitizeText(value: string): string {
  return value
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "")
    .replace(/[<>]/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

const optionalText = (max: number, tooLongKey: string) =>
  z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v ? sanitizeText(v) : ""))
    .refine((v) => v.length <= max, { message: tooLongKey })
    .transform((v) => (v.length ? v : null));

export const nameSchema = z
  .string({ error: "errors.nameRequired" })
  .transform(sanitizeText)
  .refine((v) => v.length > 0, { message: "errors.nameRequired" })
  .refine((v) => v.length <= 60, { message: "errors.nameTooLong" });

export const phoneSchema = z
  .string({ error: "errors.phoneRequired" })
  .refine((v) => v.trim().length > 0, { message: "errors.phoneRequired" })
  .transform((v, ctx) => {
    const normalized = normalizePhone(v);
    if (!normalized) {
      ctx.addIssue({ code: "custom", message: "errors.phoneInvalid" });
      return z.NEVER;
    }
    return normalized;
  });

const optionalEmail = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v ? v.trim().toLowerCase() : null))
  .refine((v) => v === null || z.email().safeParse(v).success, { message: "errors.emailInvalid" });

export const contactInputSchema = z.object({
  name: nameSchema,
  phone: phoneSchema,
  email: optionalEmail,
  notes: optionalText(280, "errors.notesTooLong"),
});
export type ContactInput = z.input<typeof contactInputSchema>;
export type ContactData = z.output<typeof contactInputSchema>;

/**
 * Accepts RUPEES ("1,500.50" from an input, or a number of rupees) and outputs integer paise.
 * Never feed its output back in: 150000 paise would be read as ₹1,50,000.
 */
export const amountSchema = z
  .union([z.string(), z.number()], { error: "errors.amountRequired" })
  .transform((v, ctx) => {
    if (typeof v === "string" && v.trim() === "") {
      ctx.addIssue({ code: "custom", message: "errors.amountRequired" });
      return z.NEVER;
    }
    const paise = parseRupeesToPaise(v);
    if (paise === null) {
      ctx.addIssue({ code: "custom", message: "errors.amountInvalid" });
      return z.NEVER;
    }
    if (paise <= 0) {
      ctx.addIssue({ code: "custom", message: "errors.amountPositive" });
      return z.NEVER;
    }
    if (paise > MAX_AMOUNT_PAISE) {
      ctx.addIssue({ code: "custom", message: "errors.amountTooLarge" });
      return z.NEVER;
    }
    return paise;
  });

const dueDateSchema = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v ? v.trim() : null))
  .refine((v) => v === null || isValidISODate(v), { message: "errors.dueDateInvalid" });

export const transactionInputSchema = z.object({
  contactId: z.string({ error: "errors.contactRequired" }).min(1, { message: "errors.contactRequired" }),
  type: z.enum(TRANSACTION_TYPES),
  amount: amountSchema,
  note: optionalText(140, "errors.noteTooLong"),
  category: optionalText(40, "errors.noteTooLong"),
  dueDate: dueDateSchema,
  reminderEnabled: z.boolean().default(false),
});
export type TransactionInput = z.input<typeof transactionInputSchema>;
export type TransactionData = z.output<typeof transactionInputSchema>;

export const transactionUpdateSchema = transactionInputSchema
  .pick({ note: true, category: true, dueDate: true, reminderEnabled: true })
  .partial();
export type TransactionUpdateInput = z.input<typeof transactionUpdateSchema>;

export const paymentInputSchema = z.object({
  contactId: z.string().min(1),
  type: z.enum(TRANSACTION_TYPES),
  amount: amountSchema,
  note: optionalText(140, "errors.noteTooLong"),
  /** Settle a single entry instead of spreading across the person's open entries. */
  transactionId: z.string().min(1).optional().nullable(),
});
export type PaymentInput = z.input<typeof paymentInputSchema>;
export type PaymentData = z.output<typeof paymentInputSchema>;

export const signUpSchema = z.object({
  name: nameSchema,
  email: z.string().trim().toLowerCase().pipe(z.email({ error: "errors.emailInvalid" })),
  password: z.string().min(8, { message: "errors.passwordShort" }),
});
export type SignUpInput = z.input<typeof signUpSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email({ error: "errors.emailInvalid" })),
  password: z.string().min(1, { message: "errors.required" }),
});

export const profileUpdateSchema = z.object({
  displayName: nameSchema.optional(),
  businessName: optionalText(60, "errors.nameTooLong"),
  phone: z
    .string()
    .optional()
    .nullable()
    .transform((v, ctx) => {
      if (!v || !v.trim()) return null;
      const normalized = normalizePhone(v);
      if (!normalized) {
        ctx.addIssue({ code: "custom", message: "errors.phoneInvalid" });
        return z.NEVER;
      }
      return normalized;
    }),
  language: z.enum(LANGUAGES).optional(),
  notificationPrefs: z.object({ dueReminders: z.boolean(), weeklySummary: z.boolean() }).optional(),
  messagePrefs: z
    .object({ includeBusinessName: z.boolean(), defaultChannel: z.enum(["WHATSAPP", "SMS", "SHARE"]) })
    .optional(),
});
export type ProfileUpdateInput = z.input<typeof profileUpdateSchema>;

export type FieldErrors<K extends string = string> = Partial<Record<K, string>>;

/** Flattens a zod error into { field: translationKey } keeping the first issue per field. */
export function toFieldErrors<K extends string>(error: z.ZodError): FieldErrors<K> {
  const out: FieldErrors<K> = {};
  for (const issue of error.issues) {
    const field = (issue.path[0] ?? "_form") as K;
    if (!out[field]) out[field] = issue.message.startsWith("errors.") ? issue.message : "errors.generic";
  }
  return out;
}

export type ValidationResult<T, K extends string> =
  | { ok: true; data: T }
  | { ok: false; errors: FieldErrors<K> };

export function validate<S extends z.ZodType>(
  schema: S,
  input: unknown,
): ValidationResult<z.output<S>, string> {
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };
  return { ok: false, errors: toFieldErrors(result.error) };
}
