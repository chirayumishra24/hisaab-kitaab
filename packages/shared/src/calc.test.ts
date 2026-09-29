import { describe, expect, it } from "vitest";
import {
  AllocationError,
  allocatePayment,
  applyAllocation,
  balancesByContact,
  contactBalance,
  effectiveStatus,
  isOverdue,
  outstanding,
  paidRatio,
  statusFor,
  summarize,
} from "./calc";
import type { Transaction } from "./types";

const TODAY = "2026-09-29";
let seq = 0;

function entry(partial: Partial<Transaction> & Pick<Transaction, "type" | "amount">): Transaction {
  seq += 1;
  return {
    id: partial.id ?? `t${seq}`,
    ownerId: "u1",
    contactId: partial.contactId ?? "rahul",
    paidAmount: 0,
    status: "ACTIVE",
    note: null,
    category: null,
    dueDate: null,
    reminderEnabled: false,
    messageStatus: "NOT_SENT",
    lastReminderAt: null,
    createdAt: partial.createdAt ?? seq,
    updatedAt: seq,
    paidAt: null,
    ...partial,
  };
}

const rupees = (r: number) => r * 100;

describe("single transaction", () => {
  it("counts a receivable fully as to receive", () => {
    const s = summarize([entry({ type: "RECEIVABLE", amount: rupees(1500) })], TODAY);
    expect(s.toReceive).toBe(rupees(1500));
    expect(s.toPay).toBe(0);
    expect(s.net).toBe(rupees(1500));
    expect(s.peopleToReceive).toBe(1);
  });

  it("counts a payable fully as to pay", () => {
    const s = summarize([entry({ type: "PAYABLE", amount: rupees(500) })], TODAY);
    expect(s.toPay).toBe(rupees(500));
    expect(s.toReceive).toBe(0);
    expect(s.net).toBe(-rupees(500));
  });
});

describe("multiple transactions", () => {
  it("adds up several entries for the same person", () => {
    const entries = [
      entry({ type: "RECEIVABLE", amount: rupees(1500) }),
      entry({ type: "RECEIVABLE", amount: rupees(2000) }),
    ];
    const b = contactBalance("rahul", entries, TODAY);
    expect(b.toReceive).toBe(rupees(3500));
    expect(b.openCount).toBe(2);
  });

  it("keeps people separate", () => {
    const entries = [
      entry({ type: "RECEIVABLE", amount: rupees(1500), contactId: "rahul" }),
      entry({ type: "RECEIVABLE", amount: rupees(3200), contactId: "aisha" }),
    ];
    const map = balancesByContact(entries, TODAY);
    expect(map.get("rahul")?.toReceive).toBe(rupees(1500));
    expect(map.get("aisha")?.toReceive).toBe(rupees(3200));
    expect(summarize(entries, TODAY).peopleToReceive).toBe(2);
  });

  it("handles paise without floating point drift", () => {
    const entries = [
      entry({ type: "RECEIVABLE", amount: 10 }), // ₹0.10
      entry({ type: "RECEIVABLE", amount: 20 }), // ₹0.20
    ];
    expect(summarize(entries, TODAY).toReceive).toBe(30);
  });
});

describe("partial payment", () => {
  it("reduces what is pending and marks the entry PARTIALLY_PAID", () => {
    const e = entry({ type: "RECEIVABLE", amount: rupees(5000) });
    const [allocation] = allocatePayment([e], "RECEIVABLE", rupees(2000));
    expect(allocation).toEqual({ transactionId: e.id, amount: rupees(2000) });
    const next = applyAllocation(e, allocation!.amount);
    expect(next).toEqual({ paidAmount: rupees(2000), status: "PARTIALLY_PAID" });
    const after = { ...e, ...next };
    expect(outstanding(after)).toBe(rupees(3000));
    expect(summarize([after], TODAY).toReceive).toBe(rupees(3000));
    expect(paidRatio(after)).toBeCloseTo(0.4);
  });

  it("settles the earliest due entry first, then oldest", () => {
    const later = entry({ type: "RECEIVABLE", amount: rupees(1000), dueDate: "2026-10-20", createdAt: 1 });
    const sooner = entry({ type: "RECEIVABLE", amount: rupees(1000), dueDate: "2026-10-01", createdAt: 2 });
    const noDue = entry({ type: "RECEIVABLE", amount: rupees(1000), createdAt: 0 });
    const allocations = allocatePayment([later, noDue, sooner], "RECEIVABLE", rupees(1500));
    expect(allocations).toEqual([
      { transactionId: sooner.id, amount: rupees(1000) },
      { transactionId: later.id, amount: rupees(500) },
    ]);
  });

  it("only settles entries in the payment's direction", () => {
    const owed = entry({ type: "RECEIVABLE", amount: rupees(1000) });
    const owing = entry({ type: "PAYABLE", amount: rupees(700) });
    const allocations = allocatePayment([owed, owing], "PAYABLE", rupees(700));
    expect(allocations).toEqual([{ transactionId: owing.id, amount: rupees(700) }]);
  });

  it("continues from an already partially paid entry", () => {
    const e = entry({ type: "RECEIVABLE", amount: rupees(5000), paidAmount: rupees(2000), status: "PARTIALLY_PAID" });
    expect(allocatePayment([e], "RECEIVABLE", rupees(3000))).toEqual([{ transactionId: e.id, amount: rupees(3000) }]);
  });
});

describe("full payment", () => {
  it("marks the entry PAID and removes it from totals", () => {
    const e = entry({ type: "RECEIVABLE", amount: rupees(1500) });
    const [allocation] = allocatePayment([e], "RECEIVABLE", rupees(1500));
    const paid = { ...e, ...applyAllocation(e, allocation!.amount) };
    expect(paid.status).toBe("PAID");
    expect(effectiveStatus(paid, TODAY)).toBe("PAID");
    expect(summarize([paid], TODAY)).toMatchObject({ toReceive: 0, openCount: 0, peopleToReceive: 0 });
  });

  it("rejects paying more than what is pending", () => {
    const e = entry({ type: "RECEIVABLE", amount: rupees(1000) });
    expect(() => allocatePayment([e], "RECEIVABLE", rupees(1001))).toThrow(AllocationError);
    try {
      allocatePayment([e], "RECEIVABLE", rupees(1001));
    } catch (error) {
      expect((error as AllocationError).code).toBe("EXCEEDS_PENDING");
      expect((error as AllocationError).pending).toBe(rupees(1000));
    }
  });

  it("rejects zero, negative and fractional-paise amounts", () => {
    const e = entry({ type: "RECEIVABLE", amount: rupees(1000) });
    for (const amount of [0, -100, 10.5]) {
      expect(() => allocatePayment([e], "RECEIVABLE", amount)).toThrow(AllocationError);
    }
  });

  it("rejects a payment when nothing is pending", () => {
    const e = entry({ type: "RECEIVABLE", amount: rupees(1000), paidAmount: rupees(1000), status: "PAID" });
    expect(() => allocatePayment([e], "RECEIVABLE", 100)).toThrowError("NOTHING_PENDING");
  });

  it("never lets paidAmount exceed the amount", () => {
    const e = entry({ type: "RECEIVABLE", amount: rupees(1000), paidAmount: rupees(900) });
    expect(applyAllocation(e, rupees(500))).toEqual({ paidAmount: rupees(1000), status: "PAID" });
  });
});

describe("mixed receivable / payable", () => {
  it("shows both sides separately and a net position", () => {
    const entries = [
      entry({ type: "RECEIVABLE", amount: rupees(1500) }),
      entry({ type: "PAYABLE", amount: rupees(500) }),
    ];
    const b = contactBalance("rahul", entries, TODAY);
    expect(b.toReceive).toBe(rupees(1500));
    expect(b.toPay).toBe(rupees(500));
    expect(b.net).toBe(rupees(1000));
    const s = summarize(entries, TODAY);
    expect(s).toMatchObject({ toReceive: rupees(1500), toPay: rupees(500), net: rupees(1000) });
  });

  it("matches the person-page example: 1500 + 2000 - 1000 paid = 2500", () => {
    const groceries = entry({ type: "RECEIVABLE", amount: rupees(1500), createdAt: 1 });
    const supplies = entry({ type: "RECEIVABLE", amount: rupees(2000), createdAt: 2 });
    const allocations = allocatePayment([groceries, supplies], "RECEIVABLE", rupees(1000));
    const updated = [groceries, supplies].map((e) => {
      const a = allocations.find((x) => x.transactionId === e.id);
      return a ? { ...e, ...applyAllocation(e, a.amount) } : e;
    });
    expect(contactBalance("rahul", updated, TODAY).toReceive).toBe(rupees(2500));
    expect(updated[0]!.status).toBe("PARTIALLY_PAID");
    expect(updated[1]!.status).toBe("ACTIVE");
  });
});

describe("overdue", () => {
  it("is overdue only when the due date has passed and money is pending", () => {
    expect(isOverdue(entry({ type: "RECEIVABLE", amount: 100, dueDate: "2026-09-28" }), TODAY)).toBe(true);
    expect(isOverdue(entry({ type: "RECEIVABLE", amount: 100, dueDate: TODAY }), TODAY)).toBe(false);
    expect(isOverdue(entry({ type: "RECEIVABLE", amount: 100, dueDate: null }), TODAY)).toBe(false);
    expect(
      isOverdue(entry({ type: "RECEIVABLE", amount: 100, paidAmount: 100, status: "PAID", dueDate: "2026-01-01" }), TODAY),
    ).toBe(false);
  });

  it("derives OVERDUE status over ACTIVE and PARTIALLY_PAID", () => {
    expect(effectiveStatus(entry({ type: "RECEIVABLE", amount: 100, dueDate: "2026-09-01" }), TODAY)).toBe("OVERDUE");
    expect(
      effectiveStatus(entry({ type: "RECEIVABLE", amount: 100, paidAmount: 40, dueDate: "2026-09-01" }), TODAY),
    ).toBe("OVERDUE");
  });

  it("sums only the pending part of overdue entries", () => {
    const entries = [
      entry({ type: "RECEIVABLE", amount: rupees(3500), paidAmount: rupees(500), dueDate: "2026-09-25" }),
      entry({ type: "RECEIVABLE", amount: rupees(1000), dueDate: "2026-10-02" }),
      entry({ type: "PAYABLE", amount: rupees(700), dueDate: "2026-09-01" }),
    ];
    const s = summarize(entries, TODAY);
    expect(s.overdueReceive).toBe(rupees(3000));
    expect(s.overduePay).toBe(rupees(700));
    expect(s.dueSoonReceive).toBe(rupees(1000));
  });

  it("tracks the next due date per person", () => {
    const entries = [
      entry({ type: "RECEIVABLE", amount: 100, dueDate: "2026-10-10" }),
      entry({ type: "PAYABLE", amount: 100, dueDate: "2026-10-01" }),
    ];
    const b = contactBalance("rahul", entries, TODAY);
    expect(b.nextDueDate).toBe("2026-10-01");
    expect(b.nextReceiveDueDate).toBe("2026-10-10");
  });
});

describe("zero balance", () => {
  it("returns zeros for no entries", () => {
    expect(summarize([], TODAY)).toEqual({
      toReceive: 0,
      toPay: 0,
      net: 0,
      overdueReceive: 0,
      overduePay: 0,
      dueSoonReceive: 0,
      peopleToReceive: 0,
      peopleToPay: 0,
      openCount: 0,
    });
    expect(contactBalance("nobody", [], TODAY).openCount).toBe(0);
  });

  it("does not list fully paid people in balances", () => {
    const paid = entry({ type: "RECEIVABLE", amount: 100, paidAmount: 100, status: "PAID" });
    expect(balancesByContact([paid], TODAY).size).toBe(0);
  });

  it("equal receivable and payable give a zero net but keep both sides", () => {
    const b = contactBalance(
      "rahul",
      [entry({ type: "RECEIVABLE", amount: 500 }), entry({ type: "PAYABLE", amount: 500 })],
      TODAY,
    );
    expect(b).toMatchObject({ toReceive: 500, toPay: 500, net: 0 });
  });
});

describe("statusFor", () => {
  it("maps paid amounts to statuses", () => {
    expect(statusFor(1000, 0)).toBe("ACTIVE");
    expect(statusFor(1000, 1)).toBe("PARTIALLY_PAID");
    expect(statusFor(1000, 1000)).toBe("PAID");
  });
});
