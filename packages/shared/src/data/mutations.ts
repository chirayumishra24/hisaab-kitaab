/**
 * All writes go through here so both apps apply identical validation and
 * keep the same invariants that firestore.rules enforce server-side.
 */
import {
  deleteDoc,
  doc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from "firebase/firestore";
import { allocatePayment, applyAllocation, outstanding } from "../calc";
import {
  contactInputSchema,
  paymentInputSchema,
  profileUpdateSchema,
  transactionInputSchema,
  transactionUpdateSchema,
  validate,
  type ContactInput,
  type PaymentInput,
  type ProfileUpdateInput,
  type TransactionInput,
  type TransactionUpdateInput,
} from "../validation";
import type { DeviceChannel, MessageKind, PaymentAllocation, TransactionType } from "../types";
import { OPEN_STATUSES } from "../types";
import { BlockedAction, ValidationFailed } from "./errors";
import { contactsCol, messagesCol, paymentsCol, toTransaction, transactionsCol, userDoc } from "./refs";

/**
 * Firestore resolves writes only once the server acknowledges them, which can
 * take forever offline. The local cache (and every listener) is updated
 * immediately, so after a short grace period we let the UI move on and report
 * the write as queued. Late failures are forwarded to `onLateError`.
 */
export type WriteOutcome = "committed" | "queued";

export async function withOfflineGrace(
  write: Promise<unknown>,
  onLateError?: (error: unknown) => void,
  graceMs = 3500,
): Promise<WriteOutcome> {
  let settled = false;
  const tracked = write.then(
    () => {
      settled = true;
      return "committed" as const;
    },
    (error: unknown) => {
      if (!settled) {
        settled = true;
        throw error;
      }
      onLateError?.(error);
      return "committed" as const;
    },
  );
  const timeout = new Promise<WriteOutcome>((resolve) =>
    setTimeout(() => {
      if (!settled) {
        settled = true;
        tracked.catch(onLateError ?? (() => undefined));
        resolve("queued");
      }
    }, graceMs),
  );
  return Promise.race([tracked, timeout]);
}

function check<T>(result: { ok: true; data: T } | { ok: false; errors: Record<string, string | undefined> }): T {
  if (!result.ok) throw new ValidationFailed(result.errors as Record<string, string>);
  return result.data;
}

export interface MutationOptions {
  onLateError?: (error: unknown) => void;
}

/* --------------------------------- contacts --------------------------------- */

export async function createContact(db: Firestore, uid: string, input: ContactInput, opts: MutationOptions = {}) {
  const data = check(validate(contactInputSchema, input));
  const ref = doc(contactsCol(db, uid));
  const outcome = await withOfflineGrace(
    setDoc(ref, {
      ownerId: uid,
      name: data.name,
      nameLower: data.name.toLowerCase(),
      phone: data.phone,
      email: data.email,
      notes: data.notes,
      archived: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastActivityAt: serverTimestamp(),
      lastReminderAt: null,
      lastReminderStatus: null,
    }),
    opts.onLateError,
  );
  return { id: ref.id, name: data.name, phone: data.phone, outcome };
}

export async function updateContact(
  db: Firestore,
  uid: string,
  contactId: string,
  input: ContactInput,
  opts: MutationOptions = {},
) {
  const data = check(validate(contactInputSchema, input));
  const outcome = await withOfflineGrace(
    updateDoc(doc(contactsCol(db, uid), contactId), {
      name: data.name,
      nameLower: data.name.toLowerCase(),
      phone: data.phone,
      email: data.email,
      notes: data.notes,
      updatedAt: serverTimestamp(),
    }),
    opts.onLateError,
  );
  return { outcome };
}

async function hasOpenEntries(db: Firestore, uid: string, contactId: string): Promise<boolean> {
  const snap = await getDocs(
    query(
      transactionsCol(db, uid),
      where("contactId", "==", contactId),
      where("status", "in", [...OPEN_STATUSES]),
      limit(1),
    ),
  );
  return !snap.empty;
}

/** Hides a person. Only allowed once nothing is pending, so totals never lose money silently. */
export async function archiveContact(db: Firestore, uid: string, contactId: string) {
  if (await hasOpenEntries(db, uid, contactId)) throw new BlockedAction("people.archiveBlocked");
  await updateDoc(doc(contactsCol(db, uid), contactId), { archived: true, updatedAt: serverTimestamp() });
}

export async function restoreContact(db: Firestore, uid: string, contactId: string) {
  await updateDoc(doc(contactsCol(db, uid), contactId), { archived: false, updatedAt: serverTimestamp() });
}

/** Permanently deletes a person that has no history at all. Anyone with entries must be archived instead. */
export async function deleteContact(db: Firestore, uid: string, contactId: string) {
  const any = await getDocs(query(transactionsCol(db, uid), where("contactId", "==", contactId), limit(1)));
  if (!any.empty) throw new BlockedAction("people.deleteBlocked");
  await deleteDoc(doc(contactsCol(db, uid), contactId));
}

/* ---------------------------------- entries --------------------------------- */

export async function createTransaction(
  db: Firestore,
  uid: string,
  input: TransactionInput,
  opts: MutationOptions = {},
) {
  const data = check(validate(transactionInputSchema, input));
  const ref = doc(transactionsCol(db, uid));
  const batch = writeBatch(db);
  batch.set(ref, {
    ownerId: uid,
    contactId: data.contactId,
    type: data.type,
    amount: data.amount,
    paidAmount: 0,
    status: "ACTIVE",
    note: data.note,
    category: data.category,
    dueDate: data.dueDate,
    reminderEnabled: data.reminderEnabled,
    messageStatus: "NOT_SENT",
    lastReminderAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    paidAt: null,
  });
  batch.update(doc(contactsCol(db, uid), data.contactId), {
    lastActivityAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const outcome = await withOfflineGrace(batch.commit(), opts.onLateError);
  return { id: ref.id, data, outcome };
}

export async function updateTransaction(
  db: Firestore,
  uid: string,
  transactionId: string,
  input: TransactionUpdateInput,
  opts: MutationOptions = {},
) {
  const data = check(validate(transactionUpdateSchema, input));
  const patch: Record<string, unknown> = { updatedAt: serverTimestamp() };
  for (const key of ["note", "category", "dueDate", "reminderEnabled"] as const) {
    if (key in input) patch[key] = data[key] ?? null;
  }
  const outcome = await withOfflineGrace(updateDoc(doc(transactionsCol(db, uid), transactionId), patch), opts.onLateError);
  return { outcome };
}

/** Deletes an entry that has no payments recorded against it. */
export async function deleteTransaction(db: Firestore, uid: string, transactionId: string, paidAmount: number) {
  if (paidAmount > 0) throw new BlockedAction("entry.deleteBlocked");
  await deleteDoc(doc(transactionsCol(db, uid), transactionId));
}

/* --------------------------------- payments --------------------------------- */

export interface PaymentResult {
  paymentId: string;
  allocations: PaymentAllocation[];
  /** What is still pending with this person in the same direction after the payment. */
  remaining: number;
}

/**
 * Records money received/paid. The amount is spread over the person's open
 * entries of that direction (earliest due first) inside a Firestore
 * transaction, so concurrent edits cannot over-settle an entry. Entries are
 * never deleted: each keeps its original amount and a running paidAmount.
 * Requires a connection (Firestore transactions don't run offline).
 */
export async function recordPayment(db: Firestore, uid: string, input: PaymentInput): Promise<PaymentResult> {
  const data = check(validate(paymentInputSchema, input));
  const txCol = transactionsCol(db, uid);

  const candidateIds: string[] = data.transactionId
    ? [data.transactionId]
    : (
        await getDocs(
          query(txCol, where("contactId", "==", data.contactId), where("status", "in", [...OPEN_STATUSES])),
        )
      ).docs
        .map(toTransaction)
        .filter((t) => t.type === data.type)
        .map((t) => t.id);

  const paymentRef = doc(paymentsCol(db, uid));

  return runTransaction(db, async (tx) => {
    const refs = candidateIds.map((id) => doc(txCol, id));
    const snaps = await Promise.all(refs.map((ref) => tx.get(ref)));
    const entries = snaps
      .filter((s) => s.exists())
      .map(toTransaction)
      .filter((t) => t.contactId === data.contactId && t.type === data.type);

    const allocations = allocatePayment(entries, data.type, data.amount);
    const byId = new Map(entries.map((e) => [e.id, e]));

    for (const allocation of allocations) {
      const entry = byId.get(allocation.transactionId)!;
      const next = applyAllocation(entry, allocation.amount);
      tx.update(doc(txCol, entry.id), {
        paidAmount: next.paidAmount,
        status: next.status,
        updatedAt: serverTimestamp(),
        paidAt: next.status === "PAID" ? serverTimestamp() : null,
      });
    }
    tx.set(paymentRef, {
      ownerId: uid,
      contactId: data.contactId,
      type: data.type,
      amount: data.amount,
      allocations,
      note: data.note,
      createdAt: serverTimestamp(),
    });
    tx.update(doc(contactsCol(db, uid), data.contactId), {
      lastActivityAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const pendingBefore = entries.reduce((sum, e) => sum + outstanding(e), 0);
    return { paymentId: paymentRef.id, allocations, remaining: pendingBefore - data.amount };
  });
}

/* --------------------------------- messages --------------------------------- */

export interface DeviceShareRecord {
  contactId: string;
  transactionId: string | null;
  kind: MessageKind;
  channel: DeviceChannel;
  to: string;
  body: string;
}

/**
 * Logs a reminder the user shared from their device. Always stored as SHARED:
 * we opened WhatsApp / the share sheet but cannot confirm it was delivered.
 */
export async function recordDeviceShare(db: Firestore, uid: string, record: DeviceShareRecord) {
  const batch = writeBatch(db);
  batch.set(doc(messagesCol(db, uid)), {
    ownerId: uid,
    contactId: record.contactId,
    transactionId: record.transactionId,
    kind: record.kind,
    channel: record.channel,
    status: "SHARED",
    to: record.to,
    body: record.body.slice(0, 1000),
    provider: "device",
    error: null,
    createdAt: serverTimestamp(),
  });
  batch.update(doc(contactsCol(db, uid), record.contactId), {
    lastReminderAt: serverTimestamp(),
    lastReminderStatus: "SHARED",
  });
  if (record.transactionId) {
    batch.update(doc(transactionsCol(db, uid), record.transactionId), {
      messageStatus: "SHARED",
      lastReminderAt: serverTimestamp(),
    });
  }
  await withOfflineGrace(batch.commit());
}

/* ---------------------------------- profile --------------------------------- */

export async function updateProfile(db: Firestore, uid: string, input: ProfileUpdateInput) {
  const data = check(validate(profileUpdateSchema, input));
  const patch: Record<string, unknown> = { updatedAt: serverTimestamp() };
  for (const [key, value] of Object.entries(data)) {
    if (key in input && value !== undefined) patch[key] = value;
  }
  return withOfflineGrace(updateDoc(userDoc(db, uid), patch));
}

export function defaultProfileFields(email: string, displayName: string) {
  return {
    email,
    displayName,
    businessName: null,
    phone: null,
    language: "en",
    notificationPrefs: { dueReminders: true, weeklySummary: false },
    messagePrefs: { includeBusinessName: true, defaultChannel: "WHATSAPP" },
  };
}

export type { TransactionType };
