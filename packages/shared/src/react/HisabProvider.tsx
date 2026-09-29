/**
 * App-wide data context shared by web and mobile. Holds exactly two
 * collection listeners (contacts + open entries) plus the profile document,
 * and derives every balance through calc.ts.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Firestore } from "firebase/firestore";
import { balancesByContact, summarize } from "../calc";
import { todayISO } from "../dates";
import { createTranslator, type Translate } from "../i18n";
import { searchPeople, sortPeople, toPeople, type Person } from "../people";
import type { Contact, ContactBalance, Language, Summary, Transaction, UserProfile } from "../types";
import { subscribeContacts, subscribeOpenEntries, subscribeProfile } from "../data/queries";

export type LoadStatus = "loading" | "ready" | "error";

export interface HisabContextValue {
  db: Firestore;
  uid: string;
  status: LoadStatus;
  error: Error | null;
  profile: UserProfile | null;
  language: Language;
  t: Translate;
  today: string;
  /** Includes archived people. */
  contacts: Contact[];
  contactsById: Map<string, Contact>;
  openEntries: Transaction[];
  balances: Map<string, ContactBalance>;
  summary: Summary;
  /** Active (not archived) people with balances, in default order. */
  people: Person[];
  search(query: string): Person[];
}

const HisabContext = createContext<HisabContextValue | null>(null);

function useToday(): string {
  const [today, setToday] = useState(() => todayISO());
  useEffect(() => {
    const id = setInterval(() => {
      const next = todayISO();
      setToday((prev) => (prev === next ? prev : next));
    }, 60_000);
    return () => clearInterval(id);
  }, []);
  return today;
}

export interface HisabProviderProps {
  db: Firestore;
  uid: string;
  /** Language to use before the profile has loaded (e.g. device language). */
  fallbackLanguage?: Language;
  children: ReactNode;
}

export function HisabProvider({ db, uid, fallbackLanguage = "en", children }: HisabProviderProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [openEntries, setOpenEntries] = useState<Transaction[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const today = useToday();

  useEffect(() => {
    setContacts(null);
    setOpenEntries(null);
    setError(null);
    const unsubs = [
      subscribeProfile(db, uid, setProfile, setError),
      subscribeContacts(db, uid, setContacts, setError),
      subscribeOpenEntries(db, uid, setOpenEntries, setError),
    ];
    return () => unsubs.forEach((u) => u());
  }, [db, uid]);

  const language = profile?.language ?? fallbackLanguage;
  const t = useMemo(() => createTranslator(language), [language]);

  const value = useMemo<HisabContextValue>(() => {
    const safeContacts = contacts ?? [];
    const safeEntries = openEntries ?? [];
    const contactsById = new Map(safeContacts.map((c) => [c.id, c]));
    // Ignore entries whose person was removed so totals always match what's on screen.
    const visibleEntries = safeEntries.filter((e) => contactsById.has(e.contactId));
    const balances = balancesByContact(visibleEntries, today);
    const people = sortPeople(toPeople(safeContacts, balances));
    const status: LoadStatus = error ? "error" : contacts && openEntries ? "ready" : "loading";
    return {
      db,
      uid,
      status,
      error,
      profile,
      language,
      t,
      today,
      contacts: safeContacts,
      contactsById,
      openEntries: visibleEntries,
      balances,
      summary: summarize(visibleEntries, today),
      people,
      search: (query: string) => searchPeople(people, query),
    };
  }, [db, uid, contacts, openEntries, error, profile, language, t, today]);

  return <HisabContext.Provider value={value}>{children}</HisabContext.Provider>;
}

export function useHisab(): HisabContextValue {
  const ctx = useContext(HisabContext);
  if (!ctx) throw new Error("useHisab must be used inside <HisabProvider>");
  return ctx;
}
