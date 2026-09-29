import {
  collection,
  doc,
  Timestamp,
  type CollectionReference,
  type DocumentData,
  type DocumentReference,
  type DocumentSnapshot,
  type Firestore,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import type { Contact, MessageLog, Payment, Transaction, UserProfile } from "../types";

export const userDoc = (db: Firestore, uid: string): DocumentReference => doc(db, "users", uid);
export const contactsCol = (db: Firestore, uid: string): CollectionReference => collection(db, "users", uid, "contacts");
export const transactionsCol = (db: Firestore, uid: string): CollectionReference =>
  collection(db, "users", uid, "transactions");
export const paymentsCol = (db: Firestore, uid: string): CollectionReference => collection(db, "users", uid, "payments");
export const messagesCol = (db: Firestore, uid: string): CollectionReference => collection(db, "users", uid, "messages");

/** Firestore Timestamp | Date | number -> millis. Pending server timestamps are estimated by the SDK. */
export function toMillis(value: unknown): number {
  if (value instanceof Timestamp) return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function") {
    return (value as { toMillis(): number }).toMillis();
  }
  return Date.now();
}

const nullableMillis = (value: unknown): number | null => (value == null ? null : toMillis(value));

type Snap = QueryDocumentSnapshot<DocumentData> | DocumentSnapshot<DocumentData>;

function read(snap: Snap): DocumentData {
  return snap.data({ serverTimestamps: "estimate" }) ?? {};
}

export function toContact(snap: Snap): Contact {
  const d = read(snap);
  return {
    id: snap.id,
    ownerId: d.ownerId,
    name: d.name ?? "",
    nameLower: d.nameLower ?? "",
    phone: d.phone ?? "",
    email: d.email ?? null,
    notes: d.notes ?? null,
    archived: d.archived === true,
    createdAt: toMillis(d.createdAt),
    updatedAt: toMillis(d.updatedAt),
    lastActivityAt: toMillis(d.lastActivityAt ?? d.createdAt),
    lastReminderAt: nullableMillis(d.lastReminderAt),
    lastReminderStatus: d.lastReminderStatus ?? null,
  };
}

export function toTransaction(snap: Snap): Transaction {
  const d = read(snap);
  return {
    id: snap.id,
    ownerId: d.ownerId,
    contactId: d.contactId,
    type: d.type,
    amount: d.amount ?? 0,
    paidAmount: d.paidAmount ?? 0,
    status: d.status ?? "ACTIVE",
    note: d.note ?? null,
    category: d.category ?? null,
    dueDate: d.dueDate ?? null,
    reminderEnabled: d.reminderEnabled === true,
    messageStatus: d.messageStatus ?? "NOT_SENT",
    lastReminderAt: nullableMillis(d.lastReminderAt),
    createdAt: toMillis(d.createdAt),
    updatedAt: toMillis(d.updatedAt),
    paidAt: nullableMillis(d.paidAt),
  };
}

export function toPayment(snap: Snap): Payment {
  const d = read(snap);
  return {
    id: snap.id,
    ownerId: d.ownerId,
    contactId: d.contactId,
    type: d.type,
    amount: d.amount ?? 0,
    allocations: Array.isArray(d.allocations) ? d.allocations : [],
    note: d.note ?? null,
    createdAt: toMillis(d.createdAt),
  };
}

export function toMessageLog(snap: Snap): MessageLog {
  const d = read(snap);
  return {
    id: snap.id,
    ownerId: d.ownerId,
    contactId: d.contactId,
    transactionId: d.transactionId ?? null,
    kind: d.kind,
    channel: d.channel,
    status: d.status,
    to: d.to,
    body: d.body,
    provider: d.provider ?? null,
    error: d.error ?? null,
    createdAt: toMillis(d.createdAt),
  };
}

export function toProfile(snap: Snap): UserProfile | null {
  if (!snap.exists()) return null;
  const d = read(snap);
  return {
    uid: snap.id,
    email: d.email ?? "",
    displayName: d.displayName ?? "",
    businessName: d.businessName ?? null,
    phone: d.phone ?? null,
    language: d.language ?? "en",
    notificationPrefs: { dueReminders: true, weeklySummary: false, ...(d.notificationPrefs ?? {}) },
    messagePrefs: { includeBusinessName: true, defaultChannel: "WHATSAPP", ...(d.messagePrefs ?? {}) },
    createdAt: toMillis(d.createdAt),
    updatedAt: toMillis(d.updatedAt),
  };
}
