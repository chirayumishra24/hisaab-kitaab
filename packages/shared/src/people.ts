import { effectiveStatus, isOverdue, outstanding } from "./calc";
import type { Contact, ContactBalance, EntryFilter, ISODate, PeopleFilter, Transaction } from "./types";

export interface Person {
  contact: Contact;
  balance: ContactBalance;
}

const EMPTY = (contactId: string): ContactBalance => ({
  contactId,
  toReceive: 0,
  toPay: 0,
  net: 0,
  overdueReceive: 0,
  overduePay: 0,
  nextDueDate: null,
  nextReceiveDueDate: null,
  openCount: 0,
});

/** Joins contacts with their derived balances. Archived people are left out. */
export function toPeople(contacts: readonly Contact[], balances: Map<string, ContactBalance>): Person[] {
  return contacts
    .filter((c) => !c.archived)
    .map((contact) => ({ contact, balance: balances.get(contact.id) ?? EMPTY(contact.id) }));
}

/**
 * Matches people by name (any word prefix, or substring for 3+ chars) or phone digits.
 * "rah" -> Rahul Sharma; "sharma" -> Rahul Sharma; "98765" -> +91 98765 43210
 */
export function matchesQuery(contact: Pick<Contact, "name" | "phone">, rawQuery: string): boolean {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return true;
  const digits = query.replace(/\D/g, "");
  const hasLetters = /\p{L}/u.test(query);
  if (!hasLetters && digits.length >= 3) {
    const phoneDigits = contact.phone.replace(/\D/g, "");
    // Match with or without the country code.
    return phoneDigits.includes(digits) || phoneDigits.slice(2).includes(digits.replace(/^0/, ""));
  }
  const name = contact.name.toLowerCase();
  if (name.startsWith(query)) return true;
  if (name.split(/\s+/).some((word) => word.startsWith(query))) return true;
  return query.length >= 3 && name.includes(query);
}

/** Ranks name-prefix matches first, then larger balances. */
export function searchPeople(people: readonly Person[], query: string): Person[] {
  const q = query.trim().toLowerCase();
  const matches = people.filter((p) => matchesQuery(p.contact, q));
  if (!q) return matches;
  return matches.sort((a, b) => {
    const aPrefix = a.contact.name.toLowerCase().startsWith(q) ? 0 : 1;
    const bPrefix = b.contact.name.toLowerCase().startsWith(q) ? 0 : 1;
    if (aPrefix !== bPrefix) return aPrefix - bPrefix;
    return Math.abs(b.balance.net) - Math.abs(a.balance.net);
  });
}

export function filterPeople(people: readonly Person[], filter: PeopleFilter): Person[] {
  switch (filter) {
    case "RECEIVE":
      return people.filter((p) => p.balance.toReceive > 0);
    case "PAY":
      return people.filter((p) => p.balance.toPay > 0);
    case "OVERDUE":
      return people.filter((p) => p.balance.overdueReceive + p.balance.overduePay > 0);
    case "SETTLED":
      return people.filter((p) => p.balance.openCount === 0);
    default:
      return [...people];
  }
}

/**
 * Default ordering for the People list: overdue first, then by amount pending,
 * then most recently active. Settled people sink to the bottom.
 */
export function sortPeople(people: readonly Person[]): Person[] {
  return [...people].sort((a, b) => {
    const aOver = a.balance.overdueReceive + a.balance.overduePay;
    const bOver = b.balance.overdueReceive + b.balance.overduePay;
    if ((aOver > 0) !== (bOver > 0)) return aOver > 0 ? -1 : 1;
    const aOpen = a.balance.toReceive + a.balance.toPay;
    const bOpen = b.balance.toReceive + b.balance.toPay;
    if ((aOpen > 0) !== (bOpen > 0)) return aOpen > 0 ? -1 : 1;
    if (aOpen !== bOpen) return bOpen - aOpen;
    return b.contact.lastActivityAt - a.contact.lastActivityAt;
  });
}

/** Filters open/paid entries for the Activity screen. */
export function filterEntries(entries: readonly Transaction[], filter: EntryFilter, today: ISODate): Transaction[] {
  switch (filter) {
    case "RECEIVE":
      return entries.filter((e) => e.type === "RECEIVABLE" && outstanding(e) > 0);
    case "PAY":
      return entries.filter((e) => e.type === "PAYABLE" && outstanding(e) > 0);
    case "OVERDUE":
      return entries
        .filter((e) => isOverdue(e, today))
        .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
    case "PAID":
      return entries.filter((e) => effectiveStatus(e, today) === "PAID");
    default:
      return [...entries];
  }
}

/** Open receivables with a due date inside the window, soonest first (for "Upcoming"). */
export function upcomingDue(entries: readonly Transaction[], today: ISODate, untilISO: ISODate): Transaction[] {
  return entries
    .filter((e) => outstanding(e) > 0 && e.dueDate && e.dueDate >= today && e.dueDate <= untilISO)
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
}

/** Two-letter initials for avatars. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/** Stable hue index for avatar tints, so a person keeps their color everywhere. */
export function avatarTone(id: string, tones = 6): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return hash % tones;
}
