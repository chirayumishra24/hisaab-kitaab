import { describe, expect, it, vi } from "vitest";
import { createTranslator } from "../i18n";
import { providersFromEnv, createTwilioProvider } from "../server/providers";
import type { Transaction } from "../types";
import { reminderContext, senderName } from "./compose";
import {
  createCopyProvider,
  createServerProvider,
  createShareProvider,
  createWhatsAppLinkProvider,
  MessageService,
  type OutgoingMessage,
} from "./service";
import { buildMessage, whatsappUrl } from "./templates";

const t = createTranslator("en");
const TODAY = "2026-09-29";

const message: OutgoingMessage = {
  kind: "REMINDER",
  contactId: "rahul",
  transactionId: null,
  to: "+919876543210",
  body: "Hi Rahul",
};

describe("templates", () => {
  it("builds the reminder from the brief", () => {
    const text = buildMessage(t, {
      kind: "REMINDER",
      contactName: "Rahul Sharma",
      amount: 150000,
      today: TODAY,
    });
    expect(text).toBe(
      "Hi Rahul,\nJust a reminder that ₹1,500 is pending from our previous transaction.\n\nHisabKitaab\nNo confusion. Just Hisab.",
    );
  });

  it("includes note, due date and sender when available", () => {
    const text = buildMessage(t, {
      kind: "REMINDER",
      contactName: "Rahul Sharma",
      amount: 150000,
      note: "Groceries",
      dueDate: "2026-10-10",
      today: TODAY,
      senderName: "Sharma Kirana",
    });
    expect(text).toContain("For: Groceries");
    expect(text).toContain("Due: 10 Oct 2026");
    expect(text).toContain("- Sharma Kirana");
  });

  it("says when a due date has passed", () => {
    const text = buildMessage(t, { kind: "REMINDER", contactName: "Aisha", amount: 320000, dueDate: "2026-09-25", today: TODAY });
    expect(text).toContain("It was due on 25 Sep 2026.");
  });

  it("builds new-entry and payment messages", () => {
    expect(
      buildMessage(t, { kind: "NEW_ENTRY", type: "RECEIVABLE", contactName: "Rahul", amount: 50000, totalPending: 200000, today: TODAY }),
    ).toContain("Pending now: ₹2,000");
    expect(buildMessage(t, { kind: "PAYMENT_THANKS", contactName: "Rahul", amount: 200000, totalPending: 0, today: TODAY })).toContain(
      "fully settled",
    );
  });

  it("creates a WhatsApp deep link", () => {
    expect(whatsappUrl("+919876543210", "Hi & bye")).toBe("https://wa.me/919876543210?text=Hi%20%26%20bye");
  });
});

describe("reminder context", () => {
  const base: Omit<Transaction, "id" | "amount" | "type"> = {
    ownerId: "u1",
    contactId: "rahul",
    paidAmount: 0,
    status: "ACTIVE",
    note: null,
    category: null,
    dueDate: null,
    reminderEnabled: false,
    messageStatus: "NOT_SENT",
    lastReminderAt: null,
    createdAt: 1,
    updatedAt: 1,
    paidAt: null,
  };

  it("uses the total receivable and skips payables", () => {
    const ctx = reminderContext(
      { id: "rahul", name: "Rahul Sharma" },
      [
        { ...base, id: "a", type: "RECEIVABLE", amount: 150000, note: "Groceries", dueDate: "2026-10-10" },
        { ...base, id: "b", type: "RECEIVABLE", amount: 100000, paidAmount: 50000, dueDate: "2026-10-05" },
        { ...base, id: "c", type: "PAYABLE", amount: 999900 },
      ],
      TODAY,
      null,
    );
    expect(ctx).toMatchObject({ amount: 200000, dueDate: "2026-10-05", note: null });
  });

  it("returns null when nothing is pending", () => {
    expect(reminderContext({ id: "rahul", name: "Rahul" }, [], TODAY, null)).toBeNull();
  });

  it("respects the include-business-name preference", () => {
    const profile = { displayName: "Sunita", businessName: "Verma Stores", messagePrefs: { includeBusinessName: true, defaultChannel: "WHATSAPP" as const } };
    expect(senderName(profile)).toBe("Verma Stores");
    expect(senderName({ ...profile, messagePrefs: { ...profile.messagePrefs, includeBusinessName: false } })).toBeNull();
  });
});

describe("MessageService status honesty", () => {
  it("reports device channels as SHARED, never SENT, and records them", async () => {
    const record = vi.fn().mockResolvedValue(undefined);
    const open = vi.fn().mockResolvedValue(undefined);
    const service = new MessageService([createWhatsAppLinkProvider(open), createCopyProvider(async () => undefined)], record);
    const result = await service.send("WHATSAPP_LINK", message);
    expect(result.status).toBe("SHARED");
    expect(open).toHaveBeenCalledWith(expect.stringContaining("wa.me/919876543210"));
    expect(record).toHaveBeenCalledTimes(1);
  });

  it("does not record a dismissed share sheet", async () => {
    const record = vi.fn();
    const service = new MessageService([createShareProvider(async () => false)], record);
    const result = await service.send("SHARE", message);
    expect(result.cancelled).toBe(true);
    expect(record).not.toHaveBeenCalled();
  });

  it("turns provider exceptions into FAILED", async () => {
    const service = new MessageService([
      createWhatsAppLinkProvider(async () => {
        throw new Error("No app");
      }),
    ]);
    expect(await service.send("WHATSAPP_LINK", message)).toMatchObject({ status: "FAILED", error: "No app" });
  });

  it("fails for channels that are not configured", async () => {
    const service = new MessageService([]);
    expect((await service.send("SMS", message)).status).toBe("FAILED");
  });

  it("passes the server's status through for server channels", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "SENT" }), { status: 200 }));
    const provider = createServerProvider("SMS", {
      baseUrl: "",
      getIdToken: async () => "token",
      capabilities: async () => ({ SMS: true, WHATSAPP: false }),
      fetchImpl,
    });
    const service = new MessageService([provider]);
    expect(await service.availableChannels()).toEqual(["SMS"]);
    expect((await service.send("SMS", message)).status).toBe("SENT");
    const [, init] = fetchImpl.mock.calls[0]!;
    expect(JSON.parse(init.body)).toEqual({ channel: "SMS", kind: "REMINDER", contactId: "rahul", transactionId: null });
    expect(init.headers.Authorization).toBe("Bearer token");
  });

  it("reports FAILED when the server rejects the send", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "FAILED", error: "Invalid number" }), { status: 502 }));
    const provider = createServerProvider("SMS", {
      baseUrl: "",
      getIdToken: async () => "token",
      capabilities: async () => ({ SMS: true, WHATSAPP: false }),
      fetchImpl,
    });
    expect(await new MessageService([provider]).send("SMS", message)).toMatchObject({ status: "FAILED", error: "Invalid number" });
  });

  it("fails without a signed-in user", async () => {
    const provider = createServerProvider("SMS", {
      baseUrl: "",
      getIdToken: async () => null,
      capabilities: async () => ({ SMS: true, WHATSAPP: false }),
    });
    expect((await provider.send(message)).status).toBe("FAILED");
  });
});

describe("server providers", () => {
  it("only enables providers that are fully configured", () => {
    expect(providersFromEnv({})).toEqual({});
    expect(Object.keys(providersFromEnv({ SMS_PROVIDER: "twilio" }))).toEqual([]);
    expect(
      Object.keys(
        providersFromEnv({ SMS_PROVIDER: "twilio", TWILIO_ACCOUNT_SID: "AC1", TWILIO_AUTH_TOKEN: "x", TWILIO_SMS_FROM: "+1555" }),
      ),
    ).toEqual(["SMS"]);
    expect(providersFromEnv({ WHATSAPP_PROVIDER: "mock" }).WHATSAPP?.name).toBe("mock");
  });

  it("sends through Twilio REST and surfaces errors", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ sid: "SM1" }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: "Invalid 'To'" }), { status: 400 }));
    const provider = createTwilioProvider("WHATSAPP", { accountSid: "AC1", authToken: "tok", from: "+14155238886", fetchImpl });
    expect(await provider.send("+919876543210", "hi")).toEqual({ ok: true, id: "SM1" });
    const body = new URLSearchParams(fetchImpl.mock.calls[0]![1].body);
    expect(body.get("To")).toBe("whatsapp:+919876543210");
    expect(body.get("From")).toBe("whatsapp:+14155238886");
    expect(await provider.send("+91", "hi")).toEqual({ ok: false, error: "Invalid 'To'", retryable: false });
  });
});
