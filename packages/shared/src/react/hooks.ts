import { useEffect, useMemo, useState } from "react";
import type { Unsubscribe } from "firebase/firestore";
import {
  subscribeContactEntries,
  subscribeContactPayments,
  subscribeEntry,
  subscribePaidEntries,
  subscribeRecentEntries,
  subscribeRecentPayments,
} from "../data/queries";
import type { Payment, Transaction } from "../types";
import { useHisab, type LoadStatus } from "./HisabProvider";

export type TimelineItem =
  | { kind: "entry"; id: string; at: number; contactId: string; entry: Transaction }
  | { kind: "payment"; id: string; at: number; contactId: string; payment: Payment };

/** Merges entries and payments newest-first. */
export function mergeTimeline(entries: readonly Transaction[], payments: readonly Payment[]): TimelineItem[] {
  const items: TimelineItem[] = [
    ...entries.map((entry) => ({ kind: "entry" as const, id: entry.id, at: entry.createdAt, contactId: entry.contactId, entry })),
    ...payments.map((payment) => ({
      kind: "payment" as const,
      id: payment.id,
      at: payment.createdAt,
      contactId: payment.contactId,
      payment,
    })),
  ];
  return items.sort((a, b) => b.at - a.at);
}

function useListener<T>(
  subscribe: ((onData: (value: T) => void, onError: (e: Error) => void) => Unsubscribe) | null,
  deps: unknown[],
): { data: T | null; status: LoadStatus; error: Error | null } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    if (!subscribe) return;
    setError(null);
    return subscribe(
      (value) => {
        setData(value);
        setError(null);
      },
      (e) => setError(e),
    );
    // `subscribe` is recreated every render; `deps` lists what it actually closes over.
  }, deps);
  const status: LoadStatus = error ? "error" : data === null ? "loading" : "ready";
  return { data, status, error };
}

/** One person's history. Listeners live only while the page using this hook is mounted. */
export function useContactLedger(contactId: string, pageSize = 50) {
  const { db, uid } = useHisab();
  const [max, setMax] = useState(pageSize);
  const entries = useListener<Transaction[]>(
    (onData, onError) => subscribeContactEntries(db, uid, contactId, max, onData, onError),
    [db, uid, contactId, max],
  );
  const payments = useListener<Payment[]>(
    (onData, onError) => subscribeContactPayments(db, uid, contactId, max, onData, onError),
    [db, uid, contactId, max],
  );
  const timeline = useMemo(
    () => mergeTimeline(entries.data ?? [], payments.data ?? []),
    [entries.data, payments.data],
  );
  const hasMore = (entries.data?.length ?? 0) >= max || (payments.data?.length ?? 0) >= max;
  const status: LoadStatus =
    entries.status === "error" || payments.status === "error"
      ? "error"
      : entries.status === "ready" && payments.status === "ready"
        ? "ready"
        : "loading";
  return {
    status,
    error: entries.error ?? payments.error,
    entries: entries.data ?? [],
    payments: payments.data ?? [],
    timeline,
    hasMore,
    loadMore: () => setMax((m) => m + pageSize),
  };
}

/** Latest entries and payments across everyone, merged. */
export function useRecentActivity(initial = 10, step = 20) {
  const { db, uid } = useHisab();
  const [max, setMax] = useState(initial);
  const entries = useListener<Transaction[]>(
    (onData, onError) => subscribeRecentEntries(db, uid, max, onData, onError),
    [db, uid, max],
  );
  const payments = useListener<Payment[]>(
    (onData, onError) => subscribeRecentPayments(db, uid, max, onData, onError),
    [db, uid, max],
  );
  const timeline = useMemo(() => {
    const merged = mergeTimeline(entries.data ?? [], payments.data ?? []);
    // Only show items older than both lists' last item once both are exhausted,
    // so a page never skips something that belongs in between.
    const lastEntry = (entries.data?.length ?? 0) >= max ? entries.data?.[entries.data.length - 1]?.createdAt : undefined;
    const lastPayment =
      (payments.data?.length ?? 0) >= max ? payments.data?.[payments.data.length - 1]?.createdAt : undefined;
    const cutoff = Math.max(lastEntry ?? -Infinity, lastPayment ?? -Infinity);
    return merged.filter((item) => item.at >= cutoff);
  }, [entries.data, payments.data, max]);
  const status: LoadStatus =
    entries.status === "error" || payments.status === "error"
      ? "error"
      : entries.status === "ready" && payments.status === "ready"
        ? "ready"
        : "loading";
  return {
    status,
    error: entries.error ?? payments.error,
    timeline,
    hasMore: (entries.data?.length ?? 0) >= max || (payments.data?.length ?? 0) >= max,
    loadMore: () => setMax((m) => m + step),
  };
}

export function usePaidEntries(enabled: boolean, initial = 30) {
  const { db, uid } = useHisab();
  const [max, setMax] = useState(initial);
  const result = useListener<Transaction[]>(
    enabled ? (onData, onError) => subscribePaidEntries(db, uid, max, onData, onError) : null,
    [db, uid, max, enabled],
  );
  return {
    ...result,
    entries: result.data ?? [],
    hasMore: (result.data?.length ?? 0) >= max,
    loadMore: () => setMax((m) => m + initial),
  };
}

export function useEntry(transactionId: string) {
  const { db, uid } = useHisab();
  const result = useListener<Transaction | null>(
    (onData, onError) => subscribeEntry(db, uid, transactionId, onData, onError),
    [db, uid, transactionId],
  );
  return { ...result, entry: result.data };
}

export function useDebouncedValue<T>(value: T, delayMs = 150): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}
