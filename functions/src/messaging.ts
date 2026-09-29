import { FieldValue, type DocumentReference, type Firestore } from "firebase-admin/firestore";
import {
  buildMessage,
  createTranslator,
  newEntryContext,
  outstanding,
  OPEN_STATUSES,
  reminderContext,
  type Contact,
  type Language,
  type MessageContext,
  type MessageKind,
  type ServerChannel,
  type Transaction,
  type UserProfile,
} from "@hisabkitaab/shared";
import { providersFromEnv, type GatewayProvider } from "@hisabkitaab/shared/server";

export function serverProviders(): Partial<Record<ServerChannel, GatewayProvider>> {
  return providersFromEnv(process.env);
}

/** "Today" in the business's time zone (defaults to India). */
export function todayInZone(timeZone = process.env.APP_TIMEZONE || "Asia/Kolkata"): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(),
  );
}

/* ------------------------------ rate limiting ------------------------------ */

/**
 * Sliding-window limit per user, stored in Firestore so it holds across
 * function instances. Counts server-sent messages in the last hour.
 */
export async function rateLimited(db: Firestore, uid: string): Promise<boolean> {
  const limit = Number(process.env.MESSAGE_RATE_LIMIT_PER_HOUR || 30);
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const snap = await db
    .collection("users")
    .doc(uid)
    .collection("messages")
    .where("createdAt", ">=", since)
    .count()
    .get();
  return snap.data().count >= limit;
}

/* ------------------------------ message build ------------------------------ */

type Loaded =
  | { ok: true; contact: Pick<Contact, "id" | "name" | "phone">; body: string; context: MessageContext }
  | { ok: false; status: number; error: string };

function toMillis(v: unknown): number {
  return v && typeof v === "object" && "toMillis" in v ? (v as { toMillis(): number }).toMillis() : 0;
}

/**
 * Rebuilds the message on the server from the user's own records, so the API
 * can only ever send HisabKitaab messages to the user's own contacts.
 */
export async function loadMessage(
  db: Firestore,
  uid: string,
  kind: MessageKind,
  contactId: string,
  transactionId: string | null,
): Promise<Loaded> {
  const userRef = db.collection("users").doc(uid);
  const [profileSnap, contactSnap, openSnap] = await Promise.all([
    userRef.get(),
    userRef.collection("contacts").doc(contactId).get(),
    userRef
      .collection("transactions")
      .where("contactId", "==", contactId)
      .where("status", "in", [...OPEN_STATUSES])
      .get(),
  ]);
  if (!contactSnap.exists) return { ok: false, status: 404, error: "Person not found" };
  const c = contactSnap.data()!;
  if (c.archived) return { ok: false, status: 409, error: "Person is archived" };

  const contact = { id: contactSnap.id, name: String(c.name), phone: String(c.phone) };
  const p = profileSnap.data() ?? {};
  const profile = {
    displayName: p.displayName ?? "",
    businessName: p.businessName ?? null,
    messagePrefs: { includeBusinessName: true, defaultChannel: "WHATSAPP", ...(p.messagePrefs ?? {}) },
  } as Pick<UserProfile, "displayName" | "businessName" | "messagePrefs">;
  const t = createTranslator((p.language as Language) ?? "en");
  const today = todayInZone();

  const open: Transaction[] = openSnap.docs.map((d) => {
    const x = d.data();
    return {
      id: d.id,
      ownerId: uid,
      contactId: x.contactId,
      type: x.type,
      amount: x.amount,
      paidAmount: x.paidAmount,
      status: x.status,
      note: x.note ?? null,
      category: x.category ?? null,
      dueDate: x.dueDate ?? null,
      reminderEnabled: !!x.reminderEnabled,
      messageStatus: x.messageStatus ?? "NOT_SENT",
      lastReminderAt: null,
      createdAt: toMillis(x.createdAt),
      updatedAt: toMillis(x.updatedAt),
      paidAt: null,
    };
  });

  let context: MessageContext | null = null;
  if (kind === "REMINDER") {
    context = reminderContext(contact, open, today, profile, transactionId);
    if (!context) return { ok: false, status: 409, error: "Nothing is pending" };
  } else if (kind === "NEW_ENTRY") {
    if (!transactionId) return { ok: false, status: 400, error: "transactionId is required" };
    const entrySnap = await userRef.collection("transactions").doc(transactionId).get();
    const e = entrySnap.data();
    if (!entrySnap.exists || !e || e.contactId !== contactId) return { ok: false, status: 404, error: "Entry not found" };
    const pending = open.filter((x) => x.type === e.type).reduce((sum, x) => sum + outstanding(x), 0);
    context = newEntryContext(
      contact,
      { type: e.type, amount: e.amount, note: e.note ?? null, dueDate: e.dueDate ?? null },
      pending,
      today,
      profile,
    );
  } else {
    return { ok: false, status: 400, error: "This message can only be shared from the device" };
  }

  return { ok: true, contact, body: buildMessage(t, context), context };
}

/* --------------------------------- logging --------------------------------- */

export async function startLog(
  db: Firestore,
  uid: string,
  data: {
    contactId: string;
    transactionId: string | null;
    kind: MessageKind;
    channel: ServerChannel;
    to: string;
    body: string;
    provider: string;
  },
): Promise<DocumentReference> {
  const ref = db.collection("users").doc(uid).collection("messages").doc();
  await ref.set({ ownerId: uid, ...data, status: "SENDING", error: null, createdAt: FieldValue.serverTimestamp() });
  if (data.transactionId) {
    await db
      .collection("users")
      .doc(uid)
      .collection("transactions")
      .doc(data.transactionId)
      .update({ messageStatus: "SENDING" })
      .catch(() => undefined);
  }
  return ref;
}

export async function finishLog(
  db: Firestore,
  uid: string,
  logRef: DocumentReference,
  data: {
    contactId: string;
    transactionId: string | null;
    status: "SENT" | "FAILED" | "SIMULATED";
    error: string | null;
    providerMessageId: string | null;
  },
): Promise<void> {
  const userRef = db.collection("users").doc(uid);
  const batch = db.batch();
  batch.update(logRef, { status: data.status, error: data.error, providerMessageId: data.providerMessageId });
  batch.update(userRef.collection("contacts").doc(data.contactId), {
    lastReminderAt: FieldValue.serverTimestamp(),
    lastReminderStatus: data.status,
  });
  if (data.transactionId) {
    batch.update(userRef.collection("transactions").doc(data.transactionId), {
      messageStatus: data.status,
      lastReminderAt: FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();
}
