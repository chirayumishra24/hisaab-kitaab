import { describe, expect, it } from "vitest";
import { balancesByContact } from "./calc";
import { filterEntries, filterPeople, initials, matchesQuery, searchPeople, sortPeople, toPeople } from "./people";
import type { Contact, Transaction } from "./types";

const TODAY = "2026-09-29";

function contact(id: string, name: string, phone: string, extra: Partial<Contact> = {}): Contact {
  return {
    id,
    ownerId: "u1",
    name,
    nameLower: name.toLowerCase(),
    phone,
    email: null,
    notes: null,
    archived: false,
    createdAt: 1,
    updatedAt: 1,
    lastActivityAt: 1,
    lastReminderAt: null,
    lastReminderStatus: null,
    ...extra,
  };
}

function entry(id: string, contactId: string, type: Transaction["type"], amount: number, extra: Partial<Transaction> = {}): Transaction {
  return {
    id,
    ownerId: "u1",
    contactId,
    type,
    amount,
    paidAmount: 0,
    status: "ACTIVE",
    note: null,
    category: null,
    dueDate: null,
    reminderEnabled: false,
    messageStatus: "NOT_SENT",
    lastReminderAt: null,
    createdAt: 1,
    updatedAt: 1,
    paidAt: null,
    ...extra,
  };
}

const contacts = [
  contact("rahul", "Rahul Sharma", "+919876543210"),
  contact("rakesh", "Rakesh", "+919812345678"),
  contact("aisha", "Aisha Khan", "+919900011122"),
  contact("meera", "Meera Iyer", "+919000000001"),
  contact("old", "Old Friend", "+919000000002", { archived: true }),
];

const entries = [
  entry("e1", "rahul", "RECEIVABLE", 250000),
  entry("e2", "rakesh", "PAYABLE", 70000),
  entry("e3", "aisha", "RECEIVABLE", 320000, { dueDate: "2026-09-25" }),
  entry("e4", "meera", "RECEIVABLE", 1000, { paidAmount: 1000, status: "PAID" }),
];

const people = toPeople(contacts, balancesByContact(entries, TODAY));

describe("search", () => {
  it("finds people by name prefix", () => {
    expect(searchPeople(people, "Rah").map((p) => p.contact.id)).toEqual(["rahul"]);
    expect(searchPeople(people, "ra").map((p) => p.contact.id).sort()).toEqual(["rahul", "rakesh"]);
  });

  it("matches a surname and is case-insensitive", () => {
    expect(matchesQuery(contacts[0]!, "SHARMA")).toBe(true);
    expect(matchesQuery(contacts[2]!, "kh")).toBe(true);
  });

  it("finds people by phone digits with or without country code", () => {
    expect(searchPeople(people, "98765").map((p) => p.contact.id)).toEqual(["rahul"]);
    expect(searchPeople(people, "919812").map((p) => p.contact.id)).toEqual(["rakesh"]);
    expect(searchPeople(people, "0981234").map((p) => p.contact.id)).toEqual(["rakesh"]);
  });

  it("excludes archived people and returns everyone for an empty query", () => {
    expect(searchPeople(people, "Old")).toEqual([]);
    expect(searchPeople(people, " ").length).toBe(4);
  });
});

describe("people filters", () => {
  const ids = (filter: Parameters<typeof filterPeople>[1]) => filterPeople(people, filter).map((p) => p.contact.id);
  it("filters by direction, overdue and settled", () => {
    expect(ids("RECEIVE").sort()).toEqual(["aisha", "rahul"]);
    expect(ids("PAY")).toEqual(["rakesh"]);
    expect(ids("OVERDUE")).toEqual(["aisha"]);
    expect(ids("SETTLED")).toEqual(["meera"]);
    expect(ids("ALL").length).toBe(4);
  });

  it("sorts overdue first, then by amount, settled last", () => {
    expect(sortPeople(people).map((p) => p.contact.id)).toEqual(["aisha", "rahul", "rakesh", "meera"]);
  });
});

describe("entry filters", () => {
  it("filters entries for the activity screen", () => {
    expect(filterEntries(entries, "RECEIVE", TODAY).map((e) => e.id)).toEqual(["e1", "e3"]);
    expect(filterEntries(entries, "PAY", TODAY).map((e) => e.id)).toEqual(["e2"]);
    expect(filterEntries(entries, "OVERDUE", TODAY).map((e) => e.id)).toEqual(["e3"]);
    expect(filterEntries(entries, "PAID", TODAY).map((e) => e.id)).toEqual(["e4"]);
    expect(filterEntries(entries, "ALL", TODAY).length).toBe(4);
  });
});

describe("initials", () => {
  it("builds avatar initials", () => {
    expect(initials("Rahul Sharma")).toBe("RS");
    expect(initials("Rakesh")).toBe("RA");
    expect(initials("  ")).toBe("?");
  });
});
