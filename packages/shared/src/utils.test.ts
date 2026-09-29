import { describe, expect, it } from "vitest";
import { addDays, daysBetween, dueState, formatDate, isValidISODate } from "./dates";
import { createTranslator } from "./i18n";
import { describeDue } from "./labels";
import { formatAmountInput, formatINR, parseRupeesToPaise } from "./money";
import { formatPhone, normalizePhone } from "./phone";
import { contactInputSchema, transactionInputSchema, validate, paymentInputSchema } from "./validation";

describe("money", () => {
  it("formats with Indian grouping and ₹", () => {
    expect(formatINR(150000)).toBe("₹1,500");
    expect(formatINR(150050)).toBe("₹1,500.50");
    expect(formatINR(12345678900)).toBe("₹12,34,56,789");
    expect(formatINR(0)).toBe("₹0");
    expect(formatINR(-50000)).toBe("-₹500");
    expect(formatINR(50000, { signed: true })).toBe("+₹500");
    expect(formatINR(2450000 * 100, { compact: true })).toBe("₹24.5L");
    expect(formatINR(3_40_00_000 * 100, { compact: true })).toBe("₹3.4Cr");
  });

  it("parses what people type", () => {
    expect(parseRupeesToPaise("1500")).toBe(150000);
    expect(parseRupeesToPaise("1,500.5")).toBe(150050);
    expect(parseRupeesToPaise("₹ 1,500.05")).toBe(150005);
    expect(parseRupeesToPaise("Rs. 20")).toBe(2000);
    expect(parseRupeesToPaise("0.1")).toBe(10);
    expect(parseRupeesToPaise("12.345")).toBeNull();
    expect(parseRupeesToPaise("-5")).toBeNull();
    expect(parseRupeesToPaise("abc")).toBeNull();
    expect(parseRupeesToPaise("")).toBeNull();
  });

  it("live-formats amount inputs", () => {
    expect(formatAmountInput("150000")).toBe("1,50,000");
    expect(formatAmountInput("1500.567")).toBe("1,500.56");
    expect(formatAmountInput("00012")).toBe("12");
    expect(formatAmountInput(".5")).toBe("0.5");
    expect(formatAmountInput("12a3")).toBe("123");
  });
});

describe("phone", () => {
  it("normalises Indian mobile numbers", () => {
    expect(normalizePhone("98765 43210")).toBe("+919876543210");
    expect(normalizePhone("098765-43210")).toBe("+919876543210");
    expect(normalizePhone("+91 98765 43210")).toBe("+919876543210");
    expect(normalizePhone("919876543210")).toBe("+919876543210");
    expect(normalizePhone("0091 9876543210")).toBe("+919876543210");
  });

  it("accepts international numbers and rejects invalid ones", () => {
    expect(normalizePhone("+44 7700 900123")).toBe("+447700900123");
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("5876543210")).toBeNull(); // Indian mobiles start with 6-9
    expect(normalizePhone("+91 12345 67890")).toBeNull();
    expect(normalizePhone("")).toBeNull();
  });

  it("formats for display", () => {
    expect(formatPhone("+919876543210")).toBe("+91 98765 43210");
  });
});

describe("dates", () => {
  it("validates and compares dates", () => {
    expect(isValidISODate("2026-02-29")).toBe(false);
    expect(isValidISODate("2028-02-29")).toBe(true);
    expect(daysBetween("2026-09-29", "2026-10-02")).toBe(3);
    expect(addDays("2026-09-29", 7)).toBe("2026-10-06");
    expect(formatDate("2026-10-10")).toBe("10 Oct 2026");
  });

  it("describes due dates in plain words", () => {
    const t = createTranslator("en");
    const today = "2026-09-29";
    expect(describeDue(t, "2026-10-02", today)).toEqual({ text: "Due in 3 days", tone: "soon" });
    expect(describeDue(t, "2026-09-25", today)).toEqual({ text: "Overdue by 4 days", tone: "overdue" });
    expect(describeDue(t, "2026-09-28", today).text).toBe("Overdue by 1 day");
    expect(describeDue(t, today, today).text).toBe("Due today");
    expect(describeDue(t, null, today).tone).toBe("none");
    expect(dueState("2026-11-30", today).kind).toBe("later");
  });
});

describe("validation", () => {
  it("normalises a valid person", () => {
    const result = validate(contactInputSchema, { name: "  Rahul   Sharma ", phone: "98765 43210", email: "" });
    expect(result).toEqual({
      ok: true,
      data: { name: "Rahul Sharma", phone: "+919876543210", email: null, notes: null },
    });
  });

  it("reports field errors as translation keys", () => {
    const result = validate(contactInputSchema, { name: "", phone: "123" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.name).toBe("errors.nameRequired");
      expect(result.errors.phone).toBe("errors.phoneInvalid");
    }
  });

  it("strips markup from free text", () => {
    const result = validate(contactInputSchema, { name: "<b>Aisha</b>", phone: "9876543210" });
    expect(result.ok && result.data.name).toBe("bAisha/b");
  });

  it("requires a positive amount", () => {
    const base = { contactId: "c1", type: "RECEIVABLE" as const };
    const bad = (amount: string) => {
      const r = validate(transactionInputSchema, { ...base, amount });
      return r.ok ? null : r.errors.amount;
    };
    expect(bad("0")).toBe("errors.amountPositive");
    expect(bad("")).toBe("errors.amountRequired");
    expect(bad("12.345")).toBe("errors.amountInvalid");
    expect(bad("999999999999")).toBe("errors.amountTooLarge");
    const ok = validate(transactionInputSchema, { ...base, amount: "1,500", dueDate: "2026-10-10", note: "Groceries" });
    expect(ok.ok && ok.data).toMatchObject({ amount: 150000, dueDate: "2026-10-10", note: "Groceries", reminderEnabled: false });
  });

  it("rejects impossible due dates", () => {
    const r = validate(transactionInputSchema, { contactId: "c1", type: "PAYABLE", amount: "10", dueDate: "2026-02-30" });
    expect(r.ok).toBe(false);
  });

  it("validates payments", () => {
    const r = validate(paymentInputSchema, { contactId: "c1", type: "RECEIVABLE", amount: "2000" });
    expect(r.ok && r.data.amount).toBe(200000);
  });
});

describe("i18n", () => {
  it("falls back to English for missing Hindi keys", () => {
    const t = createTranslator("hi");
    expect(t("money.toReceive")).toBe("लेने हैं");
    expect(t("people.add")).toBe("व्यक्ति जोड़ें");
    expect(t("auth.forgot")).toBe("Forgot password?");
    expect(t("money.netReceive", { amount: "₹1,000" })).toBe("₹1,000 to receive");
  });
});
