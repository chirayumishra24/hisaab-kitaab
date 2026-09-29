/**
 * Firestore security rules tests. Run with: npm run test:rules (starts the emulator).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  collection,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type Firestore,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-hisabkitaab-rules",
    firestore: { rules: readFileSync(resolve(__dirname, "firestore.rules"), "utf8") },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

const alice = () => env.authenticatedContext("alice").firestore() as unknown as Firestore;
const bob = () => env.authenticatedContext("bob").firestore() as unknown as Firestore;
const anon = () => env.unauthenticatedContext().firestore() as unknown as Firestore;

function contactData(ownerId = "alice") {
  return {
    ownerId,
    name: "Rahul Sharma",
    nameLower: "rahul sharma",
    phone: "+919876543210",
    email: null,
    notes: null,
    archived: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastActivityAt: serverTimestamp(),
    lastReminderAt: null,
    lastReminderStatus: null,
  };
}

function entryData(overrides: Record<string, unknown> = {}) {
  return {
    ownerId: "alice",
    contactId: "rahul",
    type: "RECEIVABLE",
    amount: 150000,
    paidAmount: 0,
    status: "ACTIVE",
    note: "Groceries",
    category: null,
    dueDate: "2026-10-10",
    reminderEnabled: false,
    messageStatus: "NOT_SENT",
    lastReminderAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    paidAt: null,
    ...overrides,
  };
}

/** Seeds Alice's data bypassing rules. */
async function seed() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "users/alice/contacts/rahul"), { ...contactData(), createdAt: new Date(), updatedAt: new Date(), lastActivityAt: new Date() });
    await setDoc(doc(db, "users/alice/transactions/t1"), {
      ...entryData(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await setDoc(doc(db, "users/alice/transactions/t2"), {
      ...entryData({ amount: 500000, paidAmount: 200000, status: "PARTIALLY_PAID" }),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await setDoc(doc(db, "users/alice/payments/p1"), {
      ownerId: "alice",
      contactId: "rahul",
      type: "RECEIVABLE",
      amount: 200000,
      allocations: [{ transactionId: "t2", amount: 200000 }],
      note: null,
      createdAt: new Date(),
    });
    await setDoc(doc(db, "users/alice"), {
      email: "alice@example.com",
      displayName: "Alice",
      businessName: null,
      phone: null,
      language: "en",
      notificationPrefs: { dueReminders: true, weeklySummary: false },
      messagePrefs: { includeBusinessName: true, defaultChannel: "WHATSAPP" },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });
}

describe("isolation between users", () => {
  it("blocks signed-out access", async () => {
    await seed();
    await assertFails(getDoc(doc(anon(), "users/alice")));
    await assertFails(getDocs(collection(anon(), "users/alice/contacts")));
  });

  it("lets a user read only their own records", async () => {
    await seed();
    await assertSucceeds(getDoc(doc(alice(), "users/alice")));
    await assertSucceeds(getDocs(collection(alice(), "users/alice/transactions")));
    for (const path of ["users/alice", "users/alice/contacts/rahul", "users/alice/transactions/t1", "users/alice/payments/p1"]) {
      await assertFails(getDoc(doc(bob(), path)));
    }
    for (const col of ["contacts", "transactions", "payments", "messages"]) {
      await assertFails(getDocs(collection(bob(), `users/alice/${col}`)));
    }
  });

  it("stops a user writing into someone else's account", async () => {
    await seed();
    await assertFails(setDoc(doc(bob(), "users/alice/contacts/evil"), contactData("bob")));
    await assertFails(setDoc(doc(bob(), "users/alice/contacts/evil"), contactData("alice")));
    await assertFails(updateDoc(doc(bob(), "users/alice/transactions/t1"), { note: "hacked", updatedAt: serverTimestamp() }));
    await assertFails(deleteDoc(doc(bob(), "users/alice/contacts/rahul")));
  });

  it("denies unknown top-level collections", async () => {
    await assertFails(setDoc(doc(alice(), "admin/config"), { x: 1 }));
  });
});

describe("contacts", () => {
  it("accepts a valid person and rejects bad data", async () => {
    await assertSucceeds(setDoc(doc(alice(), "users/alice/contacts/c1"), contactData()));
    await assertFails(setDoc(doc(alice(), "users/alice/contacts/c2"), { ...contactData(), phone: "12345" }));
    await assertFails(setDoc(doc(alice(), "users/alice/contacts/c3"), { ...contactData(), ownerId: "bob" }));
    await assertFails(setDoc(doc(alice(), "users/alice/contacts/c4"), { ...contactData(), isAdmin: true }));
    await assertFails(setDoc(doc(alice(), "users/alice/contacts/c5"), { ...contactData(), name: "" }));
  });

  it("does not let the client claim a reminder was SENT", async () => {
    await seed();
    await assertFails(updateDoc(doc(alice(), "users/alice/contacts/rahul"), { lastReminderStatus: "SENT", lastReminderAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(alice(), "users/alice/contacts/rahul"), { lastReminderStatus: "SHARED", lastReminderAt: serverTimestamp() }));
  });
});

describe("transactions", () => {
  it("creates a valid entry together with the contact activity update", async () => {
    await seed();
    const db = alice();
    const batch = writeBatch(db);
    batch.set(doc(db, "users/alice/transactions/new"), entryData());
    batch.update(doc(db, "users/alice/contacts/rahul"), { lastActivityAt: serverTimestamp(), updatedAt: serverTimestamp() });
    await assertSucceeds(batch.commit());
  });

  it("rejects invalid amounts and pre-paid entries", async () => {
    await seed();
    const db = alice();
    for (const bad of [
      { amount: 0 },
      { amount: -500 },
      { amount: 10.5 },
      { amount: "1500" },
      { amount: 20000000000 },
      { paidAmount: 100, status: "PARTIALLY_PAID" },
      { status: "PAID" },
      { messageStatus: "SENT" },
      { type: "GIFT" },
      { dueDate: "10/10/2026" },
      { extra: true },
    ]) {
      await assertFails(setDoc(doc(db, "users/alice/transactions/bad"), entryData(bad)));
    }
  });

  it("rejects entries for a person that doesn't exist", async () => {
    await seed();
    await assertFails(setDoc(doc(alice(), "users/alice/transactions/x"), entryData({ contactId: "ghost" })));
  });

  it("keeps amount, type and person permanent", async () => {
    await seed();
    const ref = doc(alice(), "users/alice/transactions/t1");
    await assertFails(updateDoc(ref, { amount: 100, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { type: "PAYABLE", updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { contactId: "other", updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(ref, { note: "Monthly supplies", dueDate: null, updatedAt: serverTimestamp() }));
  });

  it("records a partial payment and then a full payment", async () => {
    await seed();
    const ref = doc(alice(), "users/alice/transactions/t1");
    await assertSucceeds(updateDoc(ref, { paidAmount: 50000, status: "PARTIALLY_PAID", updatedAt: serverTimestamp(), paidAt: null }));
    await assertSucceeds(updateDoc(ref, { paidAmount: 150000, status: "PAID", updatedAt: serverTimestamp(), paidAt: serverTimestamp() }));
  });

  it("rejects inconsistent or shrinking payments", async () => {
    await seed();
    const ref = doc(alice(), "users/alice/transactions/t2"); // 5000 with 2000 paid
    await assertFails(updateDoc(ref, { paidAmount: 100000, status: "PARTIALLY_PAID", updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { paidAmount: 600000, status: "PAID", updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { paidAmount: 300000, status: "PAID", updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { paidAmount: 500000, status: "PARTIALLY_PAID", updatedAt: serverTimestamp() }));
  });

  it("only lets the client mark a message as SHARED", async () => {
    await seed();
    const ref = doc(alice(), "users/alice/transactions/t1");
    await assertFails(updateDoc(ref, { messageStatus: "SENT", lastReminderAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(ref, { messageStatus: "SHARED", lastReminderAt: serverTimestamp() }));
  });

  it("allows deleting an unpaid entry but not one with payments", async () => {
    await seed();
    await assertFails(deleteDoc(doc(alice(), "users/alice/transactions/t2")));
    await assertSucceeds(deleteDoc(doc(alice(), "users/alice/transactions/t1")));
  });
});

describe("payments", () => {
  it("are append-only", async () => {
    await seed();
    await assertSucceeds(
      setDoc(doc(alice(), "users/alice/payments/p2"), {
        ownerId: "alice",
        contactId: "rahul",
        type: "RECEIVABLE",
        amount: 100000,
        allocations: [{ transactionId: "t1", amount: 100000 }],
        note: null,
        createdAt: serverTimestamp(),
      }),
    );
    await assertFails(updateDoc(doc(alice(), "users/alice/payments/p1"), { amount: 1 }));
    await assertFails(deleteDoc(doc(alice(), "users/alice/payments/p1")));
  });

  it("rejects empty or invalid payments", async () => {
    const base = {
      ownerId: "alice",
      contactId: "rahul",
      type: "RECEIVABLE",
      amount: 100000,
      allocations: [{ transactionId: "t1", amount: 100000 }],
      note: null,
      createdAt: serverTimestamp(),
    };
    await assertFails(setDoc(doc(alice(), "users/alice/payments/x1"), { ...base, amount: 0 }));
    await assertFails(setDoc(doc(alice(), "users/alice/payments/x2"), { ...base, allocations: [] }));
    await assertFails(setDoc(doc(alice(), "users/alice/payments/x3"), { ...base, ownerId: "bob" }));
  });
});

describe("message logs", () => {
  const log = (overrides: Record<string, unknown> = {}) => ({
    ownerId: "alice",
    contactId: "rahul",
    transactionId: null,
    kind: "REMINDER",
    channel: "WHATSAPP_LINK",
    status: "SHARED",
    to: "+919876543210",
    body: "Hi Rahul",
    provider: "device",
    error: null,
    createdAt: serverTimestamp(),
    ...overrides,
  });

  it("allows device shares and blocks forged server statuses", async () => {
    await assertSucceeds(setDoc(doc(alice(), "users/alice/messages/m1"), log()));
    await assertFails(setDoc(doc(alice(), "users/alice/messages/m2"), log({ status: "SENT" })));
    await assertFails(setDoc(doc(alice(), "users/alice/messages/m3"), log({ channel: "SMS" })));
    await assertFails(setDoc(doc(bob(), "users/alice/messages/m4"), log()));
  });

  it("are immutable", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "users/alice/messages/m1"), { ...log(), createdAt: new Date() });
    });
    await assertFails(updateDoc(doc(alice(), "users/alice/messages/m1"), { status: "SENT" }));
    await assertFails(deleteDoc(doc(alice(), "users/alice/messages/m1")));
  });
});

describe("profile", () => {
  it("lets a user create and edit only their own profile", async () => {
    const profile = {
      email: "alice@example.com",
      displayName: "Alice",
      businessName: "Alice Stores",
      phone: null,
      language: "en",
      notificationPrefs: { dueReminders: true, weeklySummary: false },
      messagePrefs: { includeBusinessName: true, defaultChannel: "WHATSAPP" },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await assertFails(setDoc(doc(bob(), "users/alice"), profile));
    await assertSucceeds(setDoc(doc(alice(), "users/alice"), profile));
    await assertSucceeds(updateDoc(doc(alice(), "users/alice"), { businessName: "Verma Kirana", updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(alice(), "users/alice"), { email: "new@example.com" }));
    await assertFails(updateDoc(doc(alice(), "users/alice"), { language: "fr" }));
    await assertFails(deleteDoc(doc(alice(), "users/alice")));
  });
});
