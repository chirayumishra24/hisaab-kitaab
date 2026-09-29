import { contactBalance, outstanding, settlementOrder } from "../calc";
import type { Contact, ISODate, Paise, Transaction, UserProfile } from "../types";
import type { MessageContext } from "./templates";

type ProfileLike = Pick<UserProfile, "displayName" | "businessName" | "messagePrefs"> | null | undefined;

export function senderName(profile: ProfileLike): string | null {
  if (!profile || !profile.messagePrefs.includeBusinessName) return null;
  return profile.businessName?.trim() || profile.displayName?.trim() || null;
}

/**
 * Reminder for everything a person owes. When exactly one entry is pending its
 * note is included; the earliest due date is mentioned either way.
 * Returns null when nothing is pending (no reminder should be sent).
 */
export function reminderContext(
  contact: Pick<Contact, "id" | "name">,
  openEntries: readonly Transaction[],
  today: ISODate,
  profile: ProfileLike,
  transactionId?: string | null,
): MessageContext | null {
  const receivables = openEntries.filter(
    (e) => e.contactId === contact.id && e.type === "RECEIVABLE" && outstanding(e) > 0,
  );
  if (transactionId) {
    const entry = receivables.find((e) => e.id === transactionId);
    if (!entry) return null;
    return {
      kind: "REMINDER",
      contactName: contact.name,
      amount: outstanding(entry),
      note: entry.note,
      dueDate: entry.dueDate,
      today,
      senderName: senderName(profile),
    };
  }
  const balance = contactBalance(contact.id, receivables, today);
  if (balance.toReceive <= 0) return null;
  const first = settlementOrder(receivables)[0];
  return {
    kind: "REMINDER",
    contactName: contact.name,
    amount: balance.toReceive,
    note: receivables.length === 1 ? (first?.note ?? null) : null,
    dueDate: balance.nextReceiveDueDate,
    today,
    senderName: senderName(profile),
  };
}

/** Message telling a person about a new entry that was just recorded. */
export function newEntryContext(
  contact: Pick<Contact, "id" | "name">,
  entry: Pick<Transaction, "type" | "amount" | "note" | "dueDate">,
  totalPendingAfter: Paise,
  today: ISODate,
  profile: ProfileLike,
): MessageContext {
  return {
    kind: "NEW_ENTRY",
    contactName: contact.name,
    amount: entry.amount,
    type: entry.type,
    totalPending: totalPendingAfter,
    note: entry.note,
    dueDate: entry.dueDate,
    today,
    senderName: senderName(profile),
  };
}

export function paymentThanksContext(
  contact: Pick<Contact, "name">,
  amount: Paise,
  remaining: Paise,
  today: ISODate,
  profile: ProfileLike,
): MessageContext {
  return {
    kind: "PAYMENT_THANKS",
    contactName: contact.name,
    amount,
    totalPending: remaining,
    today,
    senderName: senderName(profile),
  };
}
