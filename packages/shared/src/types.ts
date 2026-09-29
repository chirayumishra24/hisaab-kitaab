/**
 * Domain model for HisabKitaab.
 *
 * Money is always stored as integer paise (₹1 = 100 paise) so that sums and
 * partial payments never suffer from floating point drift.
 *
 * Firestore layout (everything is scoped under the signed-in user):
 *   users/{uid}                      UserProfile
 *   users/{uid}/contacts/{id}        Contact
 *   users/{uid}/transactions/{id}    Transaction   (a Hisab entry)
 *   users/{uid}/payments/{id}        Payment       (money settled against entries)
 *   users/{uid}/messages/{id}        MessageLog    (reminders / shares)
 */

/** Integer amount in paise. */
export type Paise = number;

/** Calendar date without time, `YYYY-MM-DD`, interpreted in the user's local time zone. */
export type ISODate = string;

/** Milliseconds since epoch. Firestore Timestamps are converted to this at the edge. */
export type Millis = number;

export const TRANSACTION_TYPES = ["RECEIVABLE", "PAYABLE"] as const;
/**
 * RECEIVABLE = this person owes money to me ("To Receive").
 * PAYABLE    = I owe money to this person ("To Pay").
 */
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

/** Status persisted on the document. */
export const STORED_STATUSES = ["ACTIVE", "PARTIALLY_PAID", "PAID"] as const;
export type StoredTransactionStatus = (typeof STORED_STATUSES)[number];

/**
 * Status shown to the user. OVERDUE is derived at read time from the due date
 * (time passes without any write happening), so it is never stored.
 */
export type TransactionStatus = StoredTransactionStatus | "OVERDUE";

export const OPEN_STATUSES: readonly StoredTransactionStatus[] = ["ACTIVE", "PARTIALLY_PAID"];

/**
 * NOT_SENT  - nothing sent yet
 * SENDING   - server is talking to the provider
 * SENT      - provider accepted the message
 * FAILED    - provider rejected it / network error
 * SHARED    - user opened WhatsApp / share sheet / copied text; we cannot confirm delivery
 * SIMULATED - development mock provider; nothing was delivered
 */
export const MESSAGE_STATUSES = ["NOT_SENT", "SENDING", "SENT", "FAILED", "SHARED", "SIMULATED"] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

/** Channels delivered by our server (credentials live server-side). */
export const SERVER_CHANNELS = ["SMS", "WHATSAPP"] as const;
export type ServerChannel = (typeof SERVER_CHANNELS)[number];

/** Channels handled on the device by the user themself. */
export const DEVICE_CHANNELS = ["WHATSAPP_LINK", "SMS_LINK", "SHARE", "COPY"] as const;
export type DeviceChannel = (typeof DEVICE_CHANNELS)[number];

export type MessageChannel = ServerChannel | DeviceChannel;

export const MESSAGE_KINDS = ["REMINDER", "NEW_ENTRY", "PAYMENT_THANKS"] as const;
export type MessageKind = (typeof MESSAGE_KINDS)[number];

export const LANGUAGES = ["en", "hi", "hinglish"] as const;
export type Language = (typeof LANGUAGES)[number];

export interface NotificationPrefs {
  /** Show upcoming / overdue due-date nudges inside the app. */
  dueReminders: boolean;
  /** Placeholder for a future scheduled weekly summary. */
  weeklySummary: boolean;
}

export interface MessagePrefs {
  /** Append the business / display name to outgoing messages. */
  includeBusinessName: boolean;
  /** Preferred way to send a reminder. */
  defaultChannel: "WHATSAPP" | "SMS" | "SHARE";
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  businessName: string | null;
  phone: string | null;
  language: Language;
  notificationPrefs: NotificationPrefs;
  messagePrefs: MessagePrefs;
  createdAt: Millis;
  updatedAt: Millis;
}

export interface Contact {
  id: string;
  ownerId: string;
  name: string;
  /** Lowercased name for prefix search. */
  nameLower: string;
  /** E.164, e.g. +919876543210 */
  phone: string;
  email: string | null;
  notes: string | null;
  archived: boolean;
  createdAt: Millis;
  updatedAt: Millis;
  lastActivityAt: Millis;
  lastReminderAt: Millis | null;
  lastReminderStatus: MessageStatus | null;
}

export interface Transaction {
  id: string;
  ownerId: string;
  contactId: string;
  type: TransactionType;
  /** Original amount of the entry. Never changes after creation. */
  amount: Paise;
  /** Sum of all payment allocations against this entry. 0 <= paidAmount <= amount. */
  paidAmount: Paise;
  status: StoredTransactionStatus;
  note: string | null;
  category: string | null;
  dueDate: ISODate | null;
  reminderEnabled: boolean;
  messageStatus: MessageStatus;
  lastReminderAt: Millis | null;
  createdAt: Millis;
  updatedAt: Millis;
  paidAt: Millis | null;
}

export interface PaymentAllocation {
  transactionId: string;
  amount: Paise;
}

export interface Payment {
  id: string;
  ownerId: string;
  contactId: string;
  /**
   * Direction of the entries being settled.
   * RECEIVABLE = they paid me. PAYABLE = I paid them.
   */
  type: TransactionType;
  amount: Paise;
  allocations: PaymentAllocation[];
  note: string | null;
  createdAt: Millis;
}

export interface MessageLog {
  id: string;
  ownerId: string;
  contactId: string;
  transactionId: string | null;
  kind: MessageKind;
  channel: MessageChannel;
  status: MessageStatus;
  to: string;
  body: string;
  provider: string | null;
  error: string | null;
  createdAt: Millis;
}

/** Aggregated position with one person, derived from their open entries. */
export interface ContactBalance {
  contactId: string;
  toReceive: Paise;
  toPay: Paise;
  /** toReceive - toPay. Positive = they owe me overall. */
  net: Paise;
  overdueReceive: Paise;
  overduePay: Paise;
  /** Earliest due date among open entries (either direction). */
  nextDueDate: ISODate | null;
  /** Earliest due date among open RECEIVABLE entries. */
  nextReceiveDueDate: ISODate | null;
  openCount: number;
}

export interface Summary {
  toReceive: Paise;
  toPay: Paise;
  net: Paise;
  overdueReceive: Paise;
  overduePay: Paise;
  /** Receivable amount due within the next 7 days (not yet overdue). */
  dueSoonReceive: Paise;
  peopleToReceive: number;
  peopleToPay: number;
  openCount: number;
}

export type PeopleFilter = "ALL" | "RECEIVE" | "PAY" | "OVERDUE" | "SETTLED";
export type EntryFilter = "ALL" | "RECEIVE" | "PAY" | "OVERDUE" | "PAID";
