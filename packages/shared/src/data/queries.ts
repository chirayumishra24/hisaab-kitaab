/**
 * Read side. Listeners are used only where live data matters:
 *  - contacts + open entries: app-wide (2 listeners), powers dashboard, people and search
 *  - one person's ledger: only while their page is open
 *  - recent / paid lists: limited, grow with "Show more"
 * Nothing ever loads the full transaction history in one go.
 */
import {
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type Firestore,
  type Unsubscribe,
} from "firebase/firestore";
import type { Contact, Payment, Transaction, UserProfile } from "../types";
import { OPEN_STATUSES } from "../types";
import {
  contactsCol,
  paymentsCol,
  toContact,
  toPayment,
  toProfile,
  toTransaction,
  transactionsCol,
  userDoc,
} from "./refs";

type OnError = (error: Error) => void;

export function subscribeProfile(
  db: Firestore,
  uid: string,
  onData: (profile: UserProfile | null) => void,
  onError: OnError,
): Unsubscribe {
  return onSnapshot(userDoc(db, uid), (snap) => onData(toProfile(snap)), onError);
}

/** Every contact of the user (including archived; filter in the UI). */
export function subscribeContacts(
  db: Firestore,
  uid: string,
  onData: (contacts: Contact[]) => void,
  onError: OnError,
): Unsubscribe {
  return onSnapshot(
    query(contactsCol(db, uid), orderBy("lastActivityAt", "desc")),
    (snap) => onData(snap.docs.map(toContact)),
    onError,
  );
}

export function subscribeContact(
  db: Firestore,
  uid: string,
  contactId: string,
  onData: (contact: Contact | null) => void,
  onError: OnError,
): Unsubscribe {
  return onSnapshot(
    doc(contactsCol(db, uid), contactId),
    (snap) => onData(snap.exists() ? toContact(snap) : null),
    onError,
  );
}

/** Entries with money still pending. This is what every balance is computed from. */
export function subscribeOpenEntries(
  db: Firestore,
  uid: string,
  onData: (entries: Transaction[]) => void,
  onError: OnError,
): Unsubscribe {
  return onSnapshot(
    query(transactionsCol(db, uid), where("status", "in", [...OPEN_STATUSES])),
    (snap) => onData(snap.docs.map(toTransaction)),
    onError,
  );
}

export function subscribeContactEntries(
  db: Firestore,
  uid: string,
  contactId: string,
  max: number,
  onData: (entries: Transaction[]) => void,
  onError: OnError,
): Unsubscribe {
  return onSnapshot(
    query(transactionsCol(db, uid), where("contactId", "==", contactId), orderBy("createdAt", "desc"), limit(max)),
    (snap) => onData(snap.docs.map(toTransaction)),
    onError,
  );
}

export function subscribeContactPayments(
  db: Firestore,
  uid: string,
  contactId: string,
  max: number,
  onData: (payments: Payment[]) => void,
  onError: OnError,
): Unsubscribe {
  return onSnapshot(
    query(paymentsCol(db, uid), where("contactId", "==", contactId), orderBy("createdAt", "desc"), limit(max)),
    (snap) => onData(snap.docs.map(toPayment)),
    onError,
  );
}

export function subscribeEntry(
  db: Firestore,
  uid: string,
  transactionId: string,
  onData: (entry: Transaction | null) => void,
  onError: OnError,
): Unsubscribe {
  return onSnapshot(
    doc(transactionsCol(db, uid), transactionId),
    (snap) => onData(snap.exists() ? toTransaction(snap) : null),
    onError,
  );
}

export function subscribeRecentEntries(
  db: Firestore,
  uid: string,
  max: number,
  onData: (entries: Transaction[]) => void,
  onError: OnError,
): Unsubscribe {
  return onSnapshot(
    query(transactionsCol(db, uid), orderBy("createdAt", "desc"), limit(max)),
    (snap) => onData(snap.docs.map(toTransaction)),
    onError,
  );
}

export function subscribeRecentPayments(
  db: Firestore,
  uid: string,
  max: number,
  onData: (payments: Payment[]) => void,
  onError: OnError,
): Unsubscribe {
  return onSnapshot(
    query(paymentsCol(db, uid), orderBy("createdAt", "desc"), limit(max)),
    (snap) => onData(snap.docs.map(toPayment)),
    onError,
  );
}

export function subscribePaidEntries(
  db: Firestore,
  uid: string,
  max: number,
  onData: (entries: Transaction[]) => void,
  onError: OnError,
): Unsubscribe {
  return onSnapshot(
    query(transactionsCol(db, uid), where("status", "==", "PAID"), orderBy("paidAt", "desc"), limit(max)),
    (snap) => onData(snap.docs.map(toTransaction)),
    onError,
  );
}
