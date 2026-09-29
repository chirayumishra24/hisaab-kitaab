"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { MessageKind, Paise, TransactionType } from "@hisabkitaab/shared";
import { AddHisabDialog } from "./AddHisabDialog";
import { EntryDialog } from "./EntryDialog";
import { PaymentDialog } from "./PaymentDialog";
import { PersonDialog } from "./PersonDialog";
import { ReminderDialog } from "./ReminderDialog";

export type DialogRequest =
  | { type: "addHisab"; contactId?: string; entryType?: TransactionType }
  | { type: "person"; contactId?: string }
  | { type: "payment"; contactId: string; entryType: TransactionType; transactionId?: string }
  | {
      type: "reminder";
      contactId: string;
      kind: MessageKind;
      transactionId?: string | null;
      paymentAmount?: Paise;
      remaining?: Paise;
    }
  | { type: "entry"; transactionId: string };

interface DialogsApi {
  open(request: DialogRequest): void;
  close(): void;
}

const DialogsContext = createContext<DialogsApi | null>(null);

/**
 * One sheet at a time. Opening a new one replaces the current, which lets
 * flows chain naturally: Add Hisab -> saved -> Send Reminder.
 */
export function DialogsProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<(DialogRequest & { key: number }) | null>(null);
  const open = useCallback((request: DialogRequest) => setCurrent({ ...request, key: Date.now() }), []);
  const close = useCallback(() => setCurrent(null), []);
  const api = useMemo(() => ({ open, close }), [open, close]);

  return (
    <DialogsContext.Provider value={api}>
      {children}
      <AddHisabDialog
        key={current?.type === "addHisab" ? current.key : "add"}
        request={current?.type === "addHisab" ? current : null}
        onClose={close}
      />
      <PersonDialog
        key={current?.type === "person" ? current.key : "person"}
        request={current?.type === "person" ? current : null}
        onClose={close}
      />
      <PaymentDialog
        key={current?.type === "payment" ? current.key : "payment"}
        request={current?.type === "payment" ? current : null}
        onClose={close}
      />
      <ReminderDialog
        key={current?.type === "reminder" ? current.key : "reminder"}
        request={current?.type === "reminder" ? current : null}
        onClose={close}
      />
      <EntryDialog
        key={current?.type === "entry" ? current.key : "entry"}
        request={current?.type === "entry" ? current : null}
        onClose={close}
      />
    </DialogsContext.Provider>
  );
}

export function useDialogs(): DialogsApi {
  const ctx = useContext(DialogsContext);
  if (!ctx) throw new Error("useDialogs must be used inside <DialogsProvider>");
  return ctx;
}
