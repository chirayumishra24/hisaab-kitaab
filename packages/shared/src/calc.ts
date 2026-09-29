/**
 * The one place where HisabKitaab does money math.
 * Every screen (web + mobile) and the server derive balances through these
 * functions, so totals can never disagree between components.
 */
import { DUE_SOON_DAYS, daysBetween } from "./dates";
import type {
  ContactBalance,
  ISODate,
  Paise,
  PaymentAllocation,
  StoredTransactionStatus,
  Summary,
  Transaction,
  TransactionStatus,
  TransactionType,
} from "./types";

type Entry = Pick<Transaction, "id" | "contactId" | "type" | "amount" | "paidAmount" | "dueDate" | "createdAt">;

export class AllocationError extends Error {
  constructor(
    public readonly code: "INVALID_AMOUNT" | "NOTHING_PENDING" | "EXCEEDS_PENDING",
    public readonly pending: Paise,
  ) {
    super(code);
    this.name = "AllocationError";
  }
}

/** Amount still pending on one entry. Never negative. */
export function outstanding(entry: Pick<Transaction, "amount" | "paidAmount">): Paise {
  return Math.max(0, entry.amount - entry.paidAmount);
}

/** Stored status implied by how much of an entry has been paid. */
export function statusFor(amount: Paise, paidAmount: Paise): StoredTransactionStatus {
  if (paidAmount <= 0) return "ACTIVE";
  if (paidAmount >= amount) return "PAID";
  return "PARTIALLY_PAID";
}

export function isOpen(entry: Pick<Transaction, "amount" | "paidAmount">): boolean {
  return outstanding(entry) > 0;
}

export function isOverdue(entry: Pick<Transaction, "amount" | "paidAmount" | "dueDate">, today: ISODate): boolean {
  return isOpen(entry) && !!entry.dueDate && entry.dueDate < today;
}

/** Status for display: OVERDUE wins over ACTIVE / PARTIALLY_PAID when the due date has passed. */
export function effectiveStatus(
  entry: Pick<Transaction, "amount" | "paidAmount" | "dueDate">,
  today: ISODate,
): TransactionStatus {
  if (isOverdue(entry, today)) return "OVERDUE";
  return statusFor(entry.amount, entry.paidAmount);
}

function emptyBalance(contactId: string): ContactBalance {
  return {
    contactId,
    toReceive: 0,
    toPay: 0,
    net: 0,
    overdueReceive: 0,
    overduePay: 0,
    nextDueDate: null,
    nextReceiveDueDate: null,
    openCount: 0,
  };
}

function earlier(a: ISODate | null, b: ISODate | null): ISODate | null {
  if (!a) return b;
  if (!b) return a;
  return a < b ? a : b;
}

/** Balance with a single person from their entries (paid entries contribute nothing). */
export function contactBalance(contactId: string, entries: readonly Entry[], today: ISODate): ContactBalance {
  const balance = emptyBalance(contactId);
  for (const entry of entries) {
    if (entry.contactId !== contactId) continue;
    addToBalance(balance, entry, today);
  }
  return balance;
}

function addToBalance(balance: ContactBalance, entry: Entry, today: ISODate): void {
  const pending = outstanding(entry);
  if (pending === 0) return;
  const overdue = isOverdue(entry, today);
  balance.openCount += 1;
  if (entry.type === "RECEIVABLE") {
    balance.toReceive += pending;
    if (overdue) balance.overdueReceive += pending;
    balance.nextReceiveDueDate = earlier(balance.nextReceiveDueDate, entry.dueDate);
  } else {
    balance.toPay += pending;
    if (overdue) balance.overduePay += pending;
  }
  balance.nextDueDate = earlier(balance.nextDueDate, entry.dueDate);
  balance.net = balance.toReceive - balance.toPay;
}

/** Balances for every person that has at least one open entry, keyed by contactId. */
export function balancesByContact(entries: readonly Entry[], today: ISODate): Map<string, ContactBalance> {
  const map = new Map<string, ContactBalance>();
  for (const entry of entries) {
    if (outstanding(entry) === 0) continue;
    let balance = map.get(entry.contactId);
    if (!balance) {
      balance = emptyBalance(entry.contactId);
      map.set(entry.contactId, balance);
    }
    addToBalance(balance, entry, today);
  }
  return map;
}

/**
 * Totals for the dashboard. To Receive and To Pay are kept separate; `net`
 * is only a convenience and must never replace them in the UI.
 */
export function summarize(entries: readonly Entry[], today: ISODate): Summary {
  const summary: Summary = {
    toReceive: 0,
    toPay: 0,
    net: 0,
    overdueReceive: 0,
    overduePay: 0,
    dueSoonReceive: 0,
    peopleToReceive: 0,
    peopleToPay: 0,
    openCount: 0,
  };
  const receivePeople = new Set<string>();
  const payPeople = new Set<string>();
  for (const entry of entries) {
    const pending = outstanding(entry);
    if (pending === 0) continue;
    summary.openCount += 1;
    const overdue = isOverdue(entry, today);
    if (entry.type === "RECEIVABLE") {
      summary.toReceive += pending;
      receivePeople.add(entry.contactId);
      if (overdue) summary.overdueReceive += pending;
      else if (entry.dueDate && daysBetween(today, entry.dueDate) <= DUE_SOON_DAYS) summary.dueSoonReceive += pending;
    } else {
      summary.toPay += pending;
      payPeople.add(entry.contactId);
      if (overdue) summary.overduePay += pending;
    }
  }
  summary.net = summary.toReceive - summary.toPay;
  summary.peopleToReceive = receivePeople.size;
  summary.peopleToPay = payPeople.size;
  return summary;
}

/**
 * Order in which a lump-sum payment settles open entries:
 * earliest due date first (entries without a due date last), then oldest first.
 */
export function settlementOrder<T extends Entry>(entries: readonly T[]): T[] {
  return [...entries].sort((a, b) => {
    if (a.dueDate !== b.dueDate) {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate < b.dueDate ? -1 : 1;
    }
    if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
    return a.id < b.id ? -1 : 1;
  });
}

/**
 * Splits a payment across open entries of one direction.
 * Throws AllocationError if the amount is invalid or larger than what is pending,
 * so we never silently record an overpayment.
 */
export function allocatePayment(
  entries: readonly Entry[],
  type: TransactionType,
  amount: Paise,
): PaymentAllocation[] {
  const candidates = settlementOrder(entries.filter((e) => e.type === type && outstanding(e) > 0));
  const pending = candidates.reduce((sum, e) => sum + outstanding(e), 0);
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new AllocationError("INVALID_AMOUNT", pending);
  if (pending === 0) throw new AllocationError("NOTHING_PENDING", 0);
  if (amount > pending) throw new AllocationError("EXCEEDS_PENDING", pending);

  const allocations: PaymentAllocation[] = [];
  let remaining = amount;
  for (const entry of candidates) {
    if (remaining === 0) break;
    const take = Math.min(remaining, outstanding(entry));
    allocations.push({ transactionId: entry.id, amount: take });
    remaining -= take;
  }
  return allocations;
}

/** New paid amount + status for an entry after applying an allocation. */
export function applyAllocation(
  entry: Pick<Transaction, "amount" | "paidAmount">,
  allocation: Paise,
): { paidAmount: Paise; status: StoredTransactionStatus } {
  const paidAmount = Math.min(entry.amount, entry.paidAmount + allocation);
  return { paidAmount, status: statusFor(entry.amount, paidAmount) };
}

/** Share paid, 0..1, for progress indicators. */
export function paidRatio(entry: Pick<Transaction, "amount" | "paidAmount">): number {
  if (entry.amount <= 0) return 0;
  return Math.min(1, entry.paidAmount / entry.amount);
}
