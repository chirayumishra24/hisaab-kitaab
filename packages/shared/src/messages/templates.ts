import { formatDate } from "../dates";
import type { Translate } from "../i18n";
import { formatINR } from "../money";
import type { ISODate, MessageKind, Paise, TransactionType } from "../types";

export interface MessageContext {
  kind: MessageKind;
  contactName: string;
  /**
   * REMINDER:       total pending from this person
   * NEW_ENTRY:      amount of the new entry
   * PAYMENT_THANKS: amount just paid
   */
  amount: Paise;
  /** NEW_ENTRY: direction of the entry. */
  type?: TransactionType;
  /** NEW_ENTRY: total pending after this entry. PAYMENT_THANKS: what is still pending. */
  totalPending?: Paise;
  note?: string | null;
  dueDate?: ISODate | null;
  today: ISODate;
  /** Business / display name of the sender, appended when present. */
  senderName?: string | null;
}

/** First name for a friendlier greeting: "Rahul Sharma" -> "Rahul". */
export function greetingName(fullName: string): string {
  const first = fullName.trim().split(/\s+/)[0];
  return first && first.length > 1 ? first : fullName.trim();
}

/**
 * Builds the text of a message. The same function renders the in-app preview
 * and the server-sent SMS/WhatsApp, so what the user sees is what is sent.
 */
export function buildMessage(t: Translate, ctx: MessageContext): string {
  const name = greetingName(ctx.contactName);
  const amount = formatINR(ctx.amount);
  const note = ctx.note ? t("messages.reminderNote", { note: ctx.note }) : "";
  let body: string;

  switch (ctx.kind) {
    case "REMINDER": {
      let due = "";
      if (ctx.dueDate) {
        const date = formatDate(ctx.dueDate);
        due = ctx.dueDate < ctx.today ? t("messages.reminderOverdue", { date }) : t("messages.reminderDue", { date });
      }
      body = t("messages.reminder", { name, amount, note, due });
      break;
    }
    case "NEW_ENTRY": {
      const due = ctx.dueDate ? t("messages.reminderDue", { date: formatDate(ctx.dueDate) }) : "";
      body =
        ctx.type === "PAYABLE"
          ? t("messages.newEntryPay", { name, amount, note, due })
          : t("messages.newEntryReceive", {
              name,
              amount,
              note,
              due,
              total: formatINR(ctx.totalPending ?? ctx.amount),
            });
      break;
    }
    case "PAYMENT_THANKS": {
      const remaining =
        ctx.totalPending && ctx.totalPending > 0
          ? t("messages.paymentRemaining", { amount: formatINR(ctx.totalPending) })
          : t("messages.paymentSettled");
      body = t("messages.paymentThanks", { name, amount, remaining });
      break;
    }
  }

  const sender = ctx.senderName?.trim() ? t("messages.from", { sender: ctx.senderName.trim() }) : "";
  return `${body}${sender}${t("messages.signature")}`;
}

/** wa.me deep link that opens a chat with the text pre-filled. */
export function whatsappUrl(e164Phone: string, text: string): string {
  return `https://wa.me/${e164Phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}

/** sms: deep link. iOS uses "&body=", Android accepts "?body="; "?&body=" works on both. */
export function smsUrl(e164Phone: string, text: string): string {
  return `sms:${e164Phone}?&body=${encodeURIComponent(text)}`;
}
